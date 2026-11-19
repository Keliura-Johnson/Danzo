import { useEffect, useMemo, useState } from 'react';
import { api } from './lib/api';
import { firebaseAuth } from './firebase';
import { createUserWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import {
  Search,
  Menu,
  Heart,
  MapPin,
  MessageCircle,
  Plus,
  User,
  Home,
  Bookmark,
  Package,
  X,
  ArrowLeft,
  ShieldCheck,
  ChevronRight,
  LogOut,
  Copy,
  Share2,
  Flag,
  Store,
  Camera,
  CheckCircle2,
  Trash2,
  Eye,
  EyeOff,
  Phone,
  Mail,
  Settings,
  LayoutDashboard,
} from 'lucide-react';
import { DANZO_CONFIG } from '../danzo.config.ts';
type Product = {
  id: string;
  title: string;
  price: number;
  category: string;
  condition: string;
  location: string;
  description: string;
  images: string[];
  status: string;
  views: number;
  createdAt: number;
  isDemo?: boolean;
  negotiable?: boolean;
  seller?: any;
  rejectionReason?: string;
};
const money = (n: number) => '₦' + Number(n || 0).toLocaleString('en-NG');
const phone = (v: string) => {
  let n = v.replace(/[^0-9+]/g, '').replace(/^\+/, '');
  if (n.startsWith('0')) n = '234' + n.slice(1);
  if (n.length === 10) n = '234' + n;
  return n;
};
const compress = (f: File) =>
  new Promise<any>((resolve, reject) => {
    if (f.size > 5 * 1024 * 1024) {
      reject(new Error('Each image must be 5MB or less.'));
      return;
    }
    const rd = new FileReader();
    rd.onerror = () => reject(new Error('Could not read image.'));
    rd.onload = () => {
      const im = new Image();
      im.onerror = () => reject(new Error('Invalid image.'));
      im.onload = () => {
        const sc = Math.min(1, 1400 / Math.max(im.width, im.height)),
          c = document.createElement('canvas');
        c.width = Math.round(im.width * sc);
        c.height = Math.round(im.height * sc);
        const ctx = c.getContext('2d');
        if (!ctx) {
          reject(new Error('Image processing failed.'));
          return;
        }
        ctx.drawImage(im, 0, 0, c.width, c.height);
        resolve({
          data: c.toDataURL('image/jpeg', 0.78).split(',')[1],
          contentType: 'image/jpeg',
        });
      };
      im.src = String(rd.result);
    };
    rd.readAsDataURL(f);
  });
const call = async (m: string, p: string, d?: any) => {
  try {
    let response: { data: any };
    if (m === 'GET') {
      response = await api.get(p);
    } else if (m === 'POST') {
      response = await api.post(p, d);
    } else if (m === 'PUT') {
      response = await api.put(p, d);
    } else {
      response = await api.delete(p, d);
    }
    return response.data;
  } catch (e: any) {
    const message = e?.response?.data?.message || e?.response?.data?.error || e?.message;
    throw new Error(message || 'Something went wrong. Please try again.');
  }
};
function App() {
  const [user, setUser] = useState<any>(null),
    [profile, setProfile] = useState<any>(null),
    [cfg, setCfg] = useState<any>({
      categories: DANZO_CONFIG.CATEGORIES,
      locations: DANZO_CONFIG.LOCATIONS,
      conditions: DANZO_CONFIG.CONDITIONS,
      listingFeePercent: 10,
      bankName: 'Union Bank',
      bankAccountNumber: '',
      bankAccountName: '',
    });
  const [page, setPage] = useState(
      location.pathname === '/admin' ? 'admin' : 'home'
    ),
    [menu, setMenu] = useState(false),
    [loading, setLoading] = useState(false),
    [toast, setToast] = useState(''),
    [products, setProducts] = useState<Product[]>([]),
    [mine, setMine] = useState<Product[]>([]),
    [payments, setPayments] = useState<any[]>([]),
    [paymentDraftId, setPaymentDraftId] = useState(''),
    [paymentDraftAmount, setPaymentDraftAmount] = useState(0),
    [editingDraftId, setEditingDraftId] = useState(''),
    [resumePaymentUrl, setResumePaymentUrl] = useState(''),
    [contactChoice, setContactChoice] = useState<any>(null),
    [saved, setSaved] = useState<any[]>([]),
    [notificationItems, setNotificationItems] = useState<any[]>([]),
    [selected, setSelected] = useState<Product | null>(null),
    [editingProduct, setEditingProduct] = useState<any>(null),
    [editForm, setEditForm] = useState<any>({}),
    [savingEdit, setSavingEdit] = useState(false),
    [query, setQuery] = useState(''),
    [cat, setCat] = useState(''),
    [loc, setLoc] = useState(''),
    [sort, setSort] = useState('newest'),
    [min, setMin] = useState(''),
    [max, setMax] = useState(''),
    [form, setForm] = useState<any>({
      name: '',
      email: '',
      role: 'buyer',
      phone: '',
      location: '',
      area: '',
      bio: '',
      terms: false,
    }),
    [listing, setListing] = useState<any>({
      title: '',
      category: 'Phones & Tablets',
      condition: 'Used - Good',
      price: '',
      description: '',
      location: 'Yola',
      alternativePhone: '',
      negotiable: false,
      images: [],
      receipt: null,
    }),
    [report, setReport] = useState({ reason: 'Scam/fraud', note: '' }),
    [modal, setModal] = useState(false),
    [adminPass, setAdminPass] = useState(''),
    [adminToken, setAdminToken] = useState(
      sessionStorage.getItem('danzo_admin') || ''
    ),
    [adminTab, setAdminTab] = useState('dashboard'),
    [adminData, setAdminData] = useState<any>({}),
    [profileEdit, setProfileEdit] = useState<any>({}),
    [authReady, setAuthReady] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const notify = (s: string) => {
    setToast(s);
    window.setTimeout(() => setToast(''), 3000);
  };
  const load = async () => {
    setLoading(true);
    try {
      const d = await call('GET', '/api/products');
      setProducts(d.items || []);
    } catch (e: any) {
      notify(e.message);
    } finally {
      setLoading(false);
    }
  };
  const privateLoad = async () => {
    if (!user) return;
    try {
      const m = await call('GET', '/api/me');
      setProfile(m.profile);
      if (m.profile) {
        setProfileEdit(m.profile);
        const s = await call('GET', '/api/saved');
        setSaved(s.items || []);
        const n = await call('GET', '/api/notifications');
        setNotificationItems(n.items || []);
        if (m.profile.role === 'seller') {
          const l = await call('GET', '/api/my-products');
          setMine(l.items || []);
          const paymentData = await call('GET', '/api/payments/mine');
          setPayments(paymentData.items || []);
        }
      }
    } catch (e: any) {
      notify(e.message);
    }
  };
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async firebaseUser => {
      setUser(firebaseUser);
      try {
        const c = await call('GET', '/api/config');
        setCfg(c);
        if (firebaseUser) {
          const m = await call('GET', '/api/me');
          setProfile(m.profile);
          if (!m.profile) {
            const draft = sessionStorage.getItem('danzo_signup');
            if (draft) {
              const b = JSON.parse(draft);
              const r = await call('POST', '/api/profile', {
                ...b,
                location: b.location + (b.area ? ', ' + b.area : ''),
              });
              setProfile(r.profile);
              sessionStorage.removeItem('danzo_signup');
            }
          }
        } else {
          setProfile(null);
        }
        setAuthReady(true);
        await load();
      } catch (e: any) {
        setAuthReady(true);
        notify(e.message);
      }
    });
    return unsubscribe;
  }, []);
  useEffect(() => {
    if (user && profile) privateLoad();
  }, [user, profile?.role]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference');
    if (params.get('paystack') === 'callback' && reference) {
      call('GET', '/api/paystack/callback?reference=' + encodeURIComponent(reference))
        .then(result => {
          notify(result.paymentStatus === 'paid'
            ? 'Payment received. Waiting for admin verification.'
            : 'Paystack has not confirmed this payment yet. You can check again in My Listings.');
          setPage('my');
        })
        .catch((e: any) => notify(e.message))
        .finally(() => history.replaceState({}, '', '/'));
    }
  }, []);

  useEffect(() => {
    if (page === 'home' || page === 'search') load();
  }, [page]);
  const results = useMemo(
    () =>
      products
        .filter(
          p =>
            (!query ||
              (p.title + ' ' + p.description)
                .toLowerCase()
                .includes(query.toLowerCase())) &&
            (!cat || p.category === cat) &&
            (!loc || p.location === loc) &&
            (!min || p.price >= Number(min)) &&
            (!max || p.price <= Number(max))
        )
        .sort((a, b) =>
          sort === 'low'
            ? a.price - b.price
            : sort === 'high'
              ? b.price - a.price
              : b.createdAt - a.createdAt
        ),
    [products, query, cat, loc, min, max, sort]
  );
  const nav = (p: string) => {
    setPage(p);
    setSelected(null);
    setMenu(false);
    window.scrollTo(0, 0);
    if (p === 'admin') history.pushState({}, '', '/admin');
    else if (location.pathname === '/admin') history.pushState({}, '', '/');
  };
  const login = async () => {
    setLoading(true);
    try {
      sessionStorage.setItem('danzo_signup', JSON.stringify(form));
      const email = form.email.trim().toLowerCase();
      const current = firebaseAuth.currentUser;
      if (current && current.email?.toLowerCase() === email) {
        const existing = await call('GET', '/api/me');
        if (!existing.profile) {
          const created = await call('POST', '/api/profile', {
            ...form,
            location: form.location + (form.area ? ', ' + form.area : ''),
          });
          setProfile(created.profile);
        } else {
          setProfile(existing.profile);
        }
        sessionStorage.removeItem('danzo_signup');
        setPassword('');
        nav('home');
        notify('Your Danzo account is ready.');
        return;
      }
      await createUserWithEmailAndPassword(firebaseAuth, email, password);
      const created = await call('POST', '/api/profile', {
        ...form,
        location: form.location + (form.area ? ', ' + form.area : ''),
      });
      setUser(firebaseAuth.currentUser);
      setProfile(created.profile);
      sessionStorage.removeItem('danzo_signup');
      setPassword('');
      nav('home');
      notify('Your Danzo account is ready.');
    } catch (e: any) {
      notify(e.code === 'auth/email-already-in-use'
        ? 'This email already has an account. Log in, then return here to finish setting up your Danzo profile.'
        : e.message || 'Account setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  const passwordLogin = async () => {
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, form.email.trim().toLowerCase(), password);
      const existing = await call('GET', '/api/me');
      let activeProfile = existing.profile;
      if (!activeProfile) {
        const draftText = sessionStorage.getItem('danzo_signup');
        if (!draftText) {
          setForm(prev => ({
            ...prev,
            email: credential.user.email || prev.email,
            name: '',
            role: 'buyer',
            phone: '',
            location: '',
            area: '',
            bio: '',
            terms: false,
          }));
          nav('signup');
          notify('Your login is valid. Complete your Danzo profile to continue.');
          return;
        }
        const draft = JSON.parse(draftText);
        const created = await call('POST', '/api/profile', {
          ...draft,
          location: draft.location + (draft.area ? ', ' + draft.area : ''),
        });
        activeProfile = created.profile;
        sessionStorage.removeItem('danzo_signup');
      }
      setUser(credential.user);
      setProfile(activeProfile);
      setPassword('');
      nav('home');
      notify('Welcome back.');
    } catch (e: any) {
      notify(e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password'
        ? 'Email or password is incorrect.'
        : e.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  const googleSignIn = async (source: 'login' | 'signup') => {
    if (source === 'signup' && !form.terms) {
      notify('Please agree to the Terms and Privacy Policy first.');
      return;
    }
    if (form.role === 'seller' && (!form.phone.trim() || !form.location.trim())) {
      notify('Sellers must enter their WhatsApp number and location first.');
      return;
    }
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await signInWithPopup(firebaseAuth, provider);
      const existing = await call('GET', '/api/me');
      let activeProfile = existing.profile;
      if (!activeProfile) {
        const details = {
          name: credential.user.displayName || form.name || credential.user.email?.split('@')[0] || 'Danzo user',
          email: credential.user.email || '',
          role: form.role === 'seller' ? 'seller' : 'buyer',
          phone: form.role === 'seller' ? form.phone : '',
          location: form.location || '',
          area: form.area || '',
          bio: form.bio || '',
        };
        const created = await call('POST', '/api/profile', details);
        activeProfile = created.profile;
      }
      setUser(credential.user);
      setProfile(activeProfile);
      setProfileEdit(activeProfile);
      setPassword('');
      sessionStorage.removeItem('danzo_signup');
      nav('home');
      notify(existing.profile ? 'Welcome back to Danzo.' : 'Your Danzo account is ready.');
    } catch (e: any) {
      const message = e.code === 'auth/account-exists-with-different-credential'
        ? 'This email already uses another sign-in method. Log in with that method first.'
        : e.code === 'auth/popup-closed-by-user'
          ? 'Google sign-in was cancelled.'
          : e.message || 'Google sign-in failed. Please try again.';
      notify(message);
    } finally {
      setLoading(false);
    }
  };
  const resetPassword = async () => {
    if (!form.email.trim()) {
      notify('Enter your email address first.');
      return;
    }
    try {
      await sendPasswordResetEmail(firebaseAuth, form.email.trim());
      notify('Password reset email sent. Check your inbox.');
    } catch (e: any) {
      notify(e.message);
    }
  };
  const logout = async () => {
    await firebaseSignOut(firebaseAuth);
    setUser(null);
    setProfile(null);
    nav('home');
    notify('Logged out.');
  };
  const open = async (p: Product) => {
    try {
      const d = await call('GET', '/api/products/' + p.id);
      setSelected(d);
      setPage('detail');
      window.scrollTo(0, 0);
    } catch (e: any) {
      notify(e.message);
    }
  };
  const contact = async (method: 'whatsapp' | 'sms' | 'call' = 'whatsapp') => {
    if (!user) { nav('login'); return; }
    try {
      const d = await call('GET', '/api/products/' + selected?.id + '/contact');
      setContactChoice({ method, phone: d.phone, alternativePhone: d.alternativePhone || '' });
    } catch (e: any) { notify(e.message); }
  };
  const performContact = (rawNumber: string) => {
    if (!contactChoice || !rawNumber) return;
    const number = phone(rawNumber), method = contactChoice.method;
    setContactChoice(null);
    if (method === 'call') window.location.href = 'tel:+' + number;
    else if (method === 'sms') window.location.href = 'sms:+' + number;
    else {
      const msg = 'Hello, I saw "' + selected?.title + '" (' + money(selected?.price || 0) + ') on Danzo. Is it still available?';
      window.open('https://wa.me/' + number + '?text=' + encodeURIComponent(msg), '_blank', 'noopener,noreferrer');
    }
  };
  const resumeDraft = (p: any) => {
    const pendingPayment = payments.find((x: any) => x.listingId === p.id && x.paymentStatus === 'pending' && x.planType !== 'waiver');
    setListing({
      title: p.title || '',
      category: p.category || cfg.categories?.[0] || 'Phones & Tablets',
      condition: p.condition || cfg.conditions?.[0] || 'Used - Good',
      price: String(p.price ?? ''),
      description: p.description || '',
      location: p.location || profile?.location || 'Yola',
      alternativePhone: p.alternativePhone || '',
      negotiable: !!p.negotiable,
      images: Array.isArray(p.images) ? p.images : [],
      receipt: null,
    });
    setEditingDraftId(p.id);
    setPaymentDraftId(p.id);
    setPaymentDraftAmount(Math.ceil(Number(p.price) * DANZO_CONFIG.PER_LISTING_PERCENT / 100));
    setResumePaymentUrl(pendingPayment?.authorizationUrl || '');
    nav('sell');
    window.scrollTo(0, 0);
  };
  const save = async (p: Product) => {
    if (!user) {
      nav('login');
      return;
    }
    try {
      await call('POST', '/api/saved/' + p.id);
      const d = await call('GET', '/api/saved');
      setSaved(d.items || []);
      notify('Saved items updated.');
    } catch (e: any) {
      notify(e.message);
    }
  };
  const submit = async () => {
    setLoading(true);
    try {
      if (editingDraftId) {
        await call('PUT', '/api/listing-drafts/' + editingDraftId, { ...listing, price: Number(listing.price) });
        setPaymentDraftId(editingDraftId);
        setPaymentDraftAmount(Math.ceil(Number(listing.price) * DANZO_CONFIG.PER_LISTING_PERCENT / 100));
        notify('Draft details saved. Continue to payment below.');
      } else {
        const imgs = await Promise.all(listing.images.map((f: any) => typeof f === 'string' ? Promise.resolve(f) : compress(f)));
        const result = await call('POST', '/api/listing-drafts', { ...listing, price: Number(listing.price), images: imgs });
        if (result.needsPayment) {
          setEditingDraftId(result.listingId);
          setPaymentDraftId(result.listingId);
          setPaymentDraftAmount(Math.ceil(Number(listing.price) * DANZO_CONFIG.PER_LISTING_PERCENT / 100));
          notify('Your product draft is saved. Choose a payment option.');
        } else {
          notify(result.message || 'Listing submitted for approval.');
          setListing({ title: '', category: 'Phones & Tablets', condition: 'Used - Good', price: '', description: '', location: profile?.location || 'Yola', alternativePhone: '', negotiable: false, images: [], receipt: null });
          setEditingDraftId('');
          setPaymentDraftId('');
          setResumePaymentUrl('');
          nav('my');
          await privateLoad();
        }
      }
    } catch (e: any) { notify(e.message); }
    finally { setLoading(false); }
  };
  const startListingPayment = async (planType: string) => {
    if (!paymentDraftId) return;
    setLoading(true);
    try {
      const result = await call('POST', '/api/payments/initialize', { listingId: paymentDraftId, planType });
      if (!result.authorizationUrl) throw new Error('Paystack did not return a checkout link.');
      window.location.assign(result.authorizationUrl);
    } catch (e: any) { notify(e.message); setLoading(false); }
  };
  const requestListingWaiver = async () => {
    if (!paymentDraftId) return;
    const accepted = confirm('Waivers are not given to everyone. Requests are reviewed by the admin and may be declined. Continue?');
    if (!accepted) return;
    setLoading(true);
    try {
      await call('POST', '/api/payments/waiver', { listingId: paymentDraftId });
      setPaymentDraftId('');
      setListing({ title: '', category: 'Phones & Tablets', condition: 'Used - Good', price: '', description: '', location: profile?.location || 'Yola', alternativePhone: '', negotiable: false, images: [], receipt: null });
      notify('Waiver request pending.');
      nav('my');
      await privateLoad();
    } catch (e: any) { notify(e.message); }
    finally { setLoading(false); }
  };
  const verifyMyPayment = async (reference: string) => {
    try {
      const result = await call('POST', '/api/payments/verify', { reference });
      notify(result.message);
      const data = await call('GET', '/api/payments/mine');
      setPayments(data.items || []);
    } catch (e: any) { notify(e.message); }
  };
  const loadAdmin = async (tab = adminTab, token = adminToken) => {
    try {
      const path =
        tab === 'dashboard'
          ? '/api/admin/dashboard'
          : tab === 'settings'
            ? '/api/admin/settings'          : tab === 'payments'
            ? '/api/admin/payments'
            : tab === 'reports'
            ? '/api/admin/reports'
              : tab === 'users'
                ? '/api/admin/users'
                : '/api/admin/products';
      const d = await call(
        'GET',
        path + '?adminToken=' + encodeURIComponent(token)
      );
      setAdminData(d);
      setAdminTab(tab);
    } catch (e: any) {
      notify(e.message);
      if (e.message.toLowerCase().includes('session')) {
        sessionStorage.removeItem('danzo_admin');
        setAdminToken('');
      }
    }
  };
  const adminLogin = async () => {
    setLoading(true);
    try {
      const d = await call('POST', '/api/admin/login', { password: adminPass });
      sessionStorage.setItem('danzo_admin', d.token);
      setAdminToken(d.token);
      notify('Admin access granted.');
      await loadAdmin('dashboard', d.token);
    } catch (e: any) {
      notify(e.message);
    } finally {
      setLoading(false);
    }
  };
  const adminCall = async (m: string, p: string, d?: any) => call(m, p + (p.includes('?') ? '&' : '?') + 'adminToken=' + encodeURIComponent(adminToken), d);
  const enableAdminAlerts = async () => {
    notify('Admin push notifications are temporarily unavailable during the Firebase sign-in migration.');
  };
  const review = async (p: any, action: string) => {
    const reason =
      action === 'reject'
        ? prompt('Reason for rejection (visible to seller):') || ''
        : '';
    if (action === 'reject' && !reason) return;
    try {
      await adminCall('POST', '/api/admin/products/' + p.id + '/review', {
        action,
        reason,
      });
      notify('Listing updated.');
      loadAdmin('products');
    } catch (e: any) {
      notify(e.message);
    }
  };
  const startEdit = (p: any) => {
    setEditForm({
      title: p.title || '',
      price: String(p.price ?? ''),
      category: p.category || cfg.categories?.[0] || '',
      condition: p.condition || cfg.conditions?.[0] || '',
      location: p.location || '',
      description: p.description || '',
      alternativePhone: p.alternativePhone || '',
      negotiable: !!p.negotiable,
    });
    setEditingProduct(p);
  };
  const saveListingEdit = async () => {
    if (!editingProduct) return;
    setSavingEdit(true);
    try {
      await call('PUT', '/api/products/' + editingProduct.id, {
        ...editForm,
        price: Number(editForm.price),
      });
      notify('Your listing details have been updated.');
      setEditingProduct(null);
      await privateLoad();
      await load();
    } catch (e: any) {
      notify(e.message);
    } finally {
      setSavingEdit(false);
    }
  };
  const pick = async (e: any, field: string) => {
    const fs = Array.from(e.target.files || []) as File[];
    if (field === 'images') {
      if (listing.images.length + fs.length > 2) {
        notify('Exactly two product photos are required.');
        return;
      }
      if (fs.some(f => f.size > 5 * 1024 * 1024)) {
        notify('Each image must be 5MB or less.');
        return;
      }
      setListing({ ...listing, images: [...listing.images, ...fs] });
    } else if (fs[0]) {
      if (fs[0].size > 5 * 1024 * 1024) {
        notify('Receipt must be 5MB or less.');
        return;
      }
      setListing({ ...listing, receipt: fs[0] });
    }
    e.target.value = '';
  };
  const Card = ({ p }: any) => (
    <button className="product" onClick={() => open(p)}>
      <div className="photo">
        {p.images?.[0] ? (
          <img loading="lazy" src={p.images[0]} alt={p.title} />
        ) : (
          <span>{p.isDemo ? '🛍️' : 'Danzo'}</span>
        )}
        {p.isDemo && <i>DEMO</i>}
      </div>
      <div className="pinfo">
        <b>{p.title}</b>
        <strong>{money(p.price)}</strong>
        <small>
          <MapPin size={12} />
          {p.location}
        </small>
        <small>{new Date(p.createdAt).toLocaleDateString()}</small>
      </div>
    </button>
  );
  if (!authReady)
    return (
      <div className="loading">
        <img className="brand-mark" src="/danzo-logo.svg" alt="Danzo" />
        <p>Getting things ready…</p>
      </div>
    );
  return (
    <div className="shell">
      <header>
        <button className="logo" onClick={() => nav('home')} aria-label="Danzo home">
          <img className="brand-mark" src="/danzo-logo.svg" alt="Danzo" />
        </button>
        <div>
          <button className="icon" onClick={() => nav('search')}>
            <Search />
          </button>
          <button className="icon" onClick={() => setMenu(!menu)}>
            <Menu />
          </button>
        </div>
        {menu && (
          <div className="menu">
            {user ? (
              <>
                <button onClick={() => nav('profile')}>Profile</button>
                <button onClick={() => nav('saved')}>Saved items</button>
                {profile?.role === 'seller' && (
                  <button onClick={() => nav('my')}>My listings</button>
                )}
                <button onClick={logout}>Log out</button>
              </>
            ) : (
              <>
                <button onClick={() => nav('login')}>Log in</button>
                <button onClick={() => nav('signup')}>Sign up</button>
              </>
            )}
          </div>
        )}
      </header>
      {user && page !== 'admin' && (
        <nav className="desktop-nav" aria-label="Main navigation">
          <button className={page === 'home' ? 'active' : ''} onClick={() => nav('home')}><Home size={17} /> Home</button>
          <button className={page === 'search' ? 'active' : ''} onClick={() => nav('search')}><Search size={17} /> Search</button>
          <button className={page === 'saved' ? 'active' : ''} onClick={() => nav('saved')}><Bookmark size={17} /> Saved</button>
          <button className={page === 'profile' ? 'active' : ''} onClick={() => nav('profile')}><User size={17} /> Profile</button>
        </nav>
      )}
      <main>
        {page === 'home' && (
          <>
            <section className="hero">
              <span className="eyebrow">A NATIONWIDE MARKETPLACE</span>
              <h1>
                Buy and sell across Nigeria.{' '}
                <em>Connect directly with sellers.</em>
              </h1>
              <p>
                Discover products from sellers nationwide and connect directly to get what you need.
              </p>
              <div className="actions">
                <button className="primary" onClick={() => nav('search')}>
                  Browse products
                </button>
                <button
                  className="white"
                  onClick={() => (user ? nav('sell') : nav('signup'))}
                >
                  Start selling
                </button>
              </div>
              <div className="hero-note">Find it. Message the seller.</div>
            </section>
            <div className="trust">
              <span>
                <ShieldCheck /> Reviewed listings
              </span>
              <span>
                <MapPin /> Nationwide
              </span>
              <span>
                <MessageCircle /> Direct contact
              </span>
            </div>
            <section className="section">
              <div className="sect-head">
                <div>
                  <small>EXPLORE</small>
                  <h2>Browse categories</h2>
                </div>
                <button onClick={() => nav('search')}>See all ›</button>
              </div>
              <div className="categories">
                {cfg.categories?.map((c: string, i: number) => (
                  <button
                    onClick={() => {
                      setCat(c);
                      nav('search');
                    }}
                  >
                    <span>
                      {
                        [
                          '📱',
                          '💻',
                          '🎧',
                          '👕',
                          '📚',
                          '🛏️',
                          '🍲',
                          '🧰',
                          '🚗',
                          '🧴',
                          '✨',
                        ][i]
                      }
                    </span>
                    {c}
                  </button>
                ))}
              </div>
            </section>
            <section className="section">
              <div className="sect-head">
                <div>
                  <small>FRESH FINDS</small>
                  <h2>Recently listed</h2>
                </div>
                <button onClick={() => nav('search')}>View all ›</button>
              </div>
              {loading ? (
                <p>Loading…</p>
              ) : products.length ? (
                <div className="grid">
                  {products.slice(0, 8).map(p => (
                    <Card p={p} key={p.id} />
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <h3>No products yet. Be the first to sell!</h3>
                  <button className="primary" onClick={() => nav('sell')}>
                    Start selling
                  </button>
                </div>
              )}
            </section>
            <section className="steps">
              <h2>Good deals in 3 simple steps</h2>
              <div>
                <article>
                  <b>01</b>
                  <h3>Find what you need</h3>
                  <p>Browse listings around your community.</p>
                </article>
                <article>
                  <b>02</b>
                  <h3>Message the seller</h3>
                  <p>Ask questions directly on WhatsApp.</p>
                </article>
                <article>
                  <b>03</b>
                  <h3>Meet and inspect</h3>
                  <p>Meet safely and arrange payment directly.</p>
                </article>
              </div>
            </section>
            <aside className="safety">
              <ShieldCheck />
              <p>
                <b>Stay safe on every deal</b>
                <br />
                Meet in a public place. Inspect the item before paying. Never
                pay in advance.
              </p>
              <button onClick={() => nav('safety')}>Safety tips</button>
            </aside>
          </>
        )}
        {page === 'signup' && (
          <section className="panel">
            <small>JOIN DANZO</small>
            <h1>Create your account</h1>
            <p>Create an account with your email address and a password, or use Google.</p>
            <label>
              Full name
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your full name" />
            </label>
            <label>
              Email address
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
            </label>
            <label>
              Password
              <div className="password-input">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" minLength={6} autoComplete="new-password" />
                <button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
              </div>
            </label>
            <b>What would you like to do?</b>
            <div className="roles">
              <button
                className={form.role === 'buyer' ? 'chosen' : ''}
                onClick={() => setForm({ ...form, role: 'buyer' })}
              >
                🛍️<b>I want to buy</b>
                <small>Browse and contact sellers</small>
              </button>
              <button
                className={form.role === 'seller' ? 'chosen' : ''}
                onClick={() => setForm({ ...form, role: 'seller' })}
              >
                🏷️<b>I want to sell</b>
                <small>List items nearby</small>
              </button>
            </div>
            {form.role === 'seller' && (
              <>
                <label>
                  WhatsApp phone
                  <input
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="0803… or +234803…"
                  />
                  <p className="notice">
                    Please enter the phone number you actively use on WhatsApp.
                    Buyers will use this number to contact you about your listings.
                  </p>
                </label>
                <label>
                  Location
                  <input
                    value={form.location}
                    onChange={e =>
                      setForm({ ...form, location: e.target.value })
                    }
                    placeholder="Enter your city or town (e.g. Jimeta, Yola)"
                    required
                  />
                </label>
                <label>
                  Area
                  <input value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} placeholder="Enter your area" />
                </label>
                <label>
                  Short bio (optional)
                  <textarea
                    value={form.bio}
                    onChange={e => setForm({ ...form, bio: e.target.value })}
                  />
                </label>
                <p className="notice">
                  Your name, location and WhatsApp number will be visible to
                  logged-in buyers on your listings.
                </p>
              </>
            )}
            <label className="agree">
              <input
                type="checkbox"
                checked={form.terms}
                onChange={e => setForm({ ...form, terms: e.target.checked })}
              />{' '}
              I agree to the Terms and Privacy Policy.
            </label>
            <button className="outline full google-signin" disabled={loading || !form.terms || (form.role === 'seller' && (!form.phone.trim() || !form.location.trim()))} onClick={() => googleSignIn('signup')}>
              <span className="google-mark" aria-hidden="true">G</span> {loading ? 'Connecting…' : 'Continue with Google'}
            </button>
            <p className="muted center auth-divider">or continue with email</p>
            <button className="primary full" disabled={loading || !form.name || !form.email || password.length < 6 || !form.terms || (form.role === 'seller' && (!form.phone.trim() || !form.location.trim()))} onClick={login}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
            <p className="muted center">
              Already have an account?{' '}
              <button className="link" onClick={() => nav('login')}>
                Continue to login
              </button>
            </p>
          </section>
        )}
        {page === 'login' && (
          <section className="panel">
            <small>WELCOME BACK</small>
            <h1>Log in to Danzo</h1>
            <p>Log in using your email address and password, or continue with Google.</p>
            <label>
              Email address
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
            </label>
            <label>
              Password
              <div className="password-input">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" />
                <button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
              </div>
            </label>
            <button className="primary full" disabled={loading || !form.email || !password} onClick={passwordLogin}>{loading ? 'Logging in…' : 'Log in'}</button>
            <button className="link" onClick={resetPassword}>Forgot password?</button>
            <p className="muted center auth-divider">or continue with Google</p>
            <button className="outline full google-signin" disabled={loading} onClick={() => googleSignIn('login')}>
              <span className="google-mark" aria-hidden="true">G</span> {loading ? 'Connecting…' : 'Continue with Google'}
            </button>
            <p className="muted center">
              New here?{' '}
              <button className="link" onClick={() => nav('signup')}>
                Create account
              </button>
            </p>
          </section>
        )}
        {page === 'search' && (
          <section className="section">
            <small>FIND YOUR NEXT DEAL</small>
            <h1>Search listings</h1>
            <div className="search">
              <Search />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="What are you looking for?"
              />
            </div>
            <div className="filters">
              <select value={cat} onChange={e => setCat(e.target.value)}>
                <option value="">All categories</option>
                {cfg.categories?.map((x: string) => (
                  <option>{x}</option>
                ))}
              </select>
              <select value={loc} onChange={e => setLoc(e.target.value)}>
                <option value="">All locations</option>
                {cfg.locations?.map((x: string) => (
                  <option>{x}</option>
                ))}
              </select>
              <input
                placeholder="Min ₦"
                value={min}
                onChange={e => setMin(e.target.value)}
              />
              <input
                placeholder="Max ₦"
                value={max}
                onChange={e => setMax(e.target.value)}
              />
              <select value={sort} onChange={e => setSort(e.target.value)}>
                <option value="newest">Newest</option>
                <option value="low">Price low to high</option>
                <option value="high">Price high to low</option>
              </select>
              <button
                className="outline"
                onClick={() => {
                  setQuery('');
                  setCat('');
                  setLoc('');
                  setMin('');
                  setMax('');
                  setSort('newest');
                }}
              >
                Clear filters
              </button>
            </div>
            <p className="muted">{results.length} results</p>
            {results.length ? (
              <div className="grid">
                {results.map(p => (
                  <Card p={p} key={p.id} />
                ))}
              </div>
            ) : (
              <div className="empty">
                No matching listings. Try changing your filters.
              </div>
            )}
          </section>
        )}
        {page === 'detail' && selected && (
          <section className="detail">
            <button className="link back" onClick={() => nav('search')}>
              <ArrowLeft /> Back to listings
            </button>
            <div className="detail-grid">
              <div className="images">
                {selected.images?.length ? (
                  selected.images.map((x: string) => (
                    <img src={x} loading="lazy" />
                  ))
                ) : (
                  <div className="no-image">Danzo</div>
                )}
              </div>
              <div>
                <small>{selected.category}</small>
                <h1>{selected.title}</h1>
                <strong className="price">{money(selected.price)}</strong>
                <p className="muted">
                  {selected.condition} · {selected.location} ·{' '}
                  {new Date(selected.createdAt).toLocaleDateString()}
                </p>
                <p>{selected.description}</p>
                <div className="seller">
                  <b>{selected.seller?.name || 'Danzo Demo Seller'}</b>
                  <small>{selected.seller?.location}</small>
                  <small>
                    Member since{' '}
                    {new Date(
                      selected.seller?.memberSince || Date.now()
                    ).toLocaleDateString()}
                  </small>
                </div>
                {user ? (
                  <div className="contact-actions">
                    <button className="whatsapp full" onClick={() => contact('whatsapp')}><MessageCircle /> Message on WhatsApp</button>
                    <button className="outline" onClick={() => contact('sms')}><MessageCircle size={17} /> Send SMS</button>
                    <button className="outline" onClick={() => contact('call')}><Phone size={17} /> Call seller</button>
                  </div>
                ) : (
                  <button className="primary full" onClick={() => nav('login')}>
                    Log in to contact seller
                  </button>
                )}
                <div className="secondary">
                  <button onClick={() => save(selected)}>
                    <Heart /> Save
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(location.href);
                      notify('Link copied.');
                    }}
                  >
                    <Share2 /> Share
                  </button>
                  <button
                    onClick={() => {
                      setModal(true);
                    }}
                  >
                    <Flag /> Report
                  </button>
                </div>
                <p className="notice">
                  Meet in a public place. Inspect the item before paying. Never
                  pay in advance.
                </p>
              </div>
            </div>
          </section>
        )}
        {page === 'sell' && (
          <section className="panel wide">
            <small>SELL ON DANZO</small>
            <h1>List an item</h1>
            {profile?.role !== 'seller' ? (
              <p>
                You need a seller account to post.{' '}
                <button className="link" onClick={() => nav('signup')}>
                  Create a seller account
                </button>
              </p>
            ) : (
              <>
                <label>
                  Title
                  <input
                    value={listing.title}
                    onChange={e =>
                      setListing({ ...listing, title: e.target.value })
                    }
                  />
                </label>
                <div className="two">
                  <label>
                    Category
                    <select
                      value={listing.category}
                      onChange={e =>
                        setListing({ ...listing, category: e.target.value })
                      }
                    >
                      {cfg.categories?.map((x: string) => (
                        <option>{x}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Condition
                    <select
                      value={listing.condition}
                      onChange={e =>
                        setListing({ ...listing, condition: e.target.value })
                      }
                    >
                      {cfg.conditions?.map((x: string) => (
                        <option>{x}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="two">
                  <label>
                    Price in ₦
                    <input
                      type="number"
                      value={listing.price}
                      onChange={e =>
                        setListing({ ...listing, price: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Location
                    <input
                      value={listing.location}
                      onChange={e =>
                        setListing({ ...listing, location: e.target.value })
                      }
                    />
                  </label>
                </div>
                <label>
                  Alternative phone number (required)
                  <input
                    type="tel"
                    value={listing.alternativePhone}
                    onChange={e =>
                      setListing({ ...listing, alternativePhone: e.target.value })
                    }
                    placeholder="A different number buyers can reach you on"
                  />
                  <p className="notice">
                    Enter a valid Nigerian phone number different from the WhatsApp number on your profile. Buyers will use it as an alternative contact for this product.
                  </p>
                </label>
                <label>
                  Description
                  <textarea
                    rows={4}
                    value={listing.description}
                    onChange={e => setListing({ ...listing, description: e.target.value })}
                  />
                </label>
                <label className="agree">
                  <input
                    type="checkbox"
                    checked={listing.negotiable}
                    onChange={e =>
                      setListing({ ...listing, negotiable: e.target.checked })
                    }
                  />{' '}
                  Negotiable
                </label>
                {!editingDraftId && <div className="photo-upload-options">
                  <label className="upload-choice">
                    <span>Choose from files or gallery</span>
                    <input className="file-picker-hidden" type="file" accept="image/*" multiple onChange={e => pick(e, 'images')} />
                  </label>
                  <label className="upload-choice">
                    <span><Camera size={18} /> Take a photo now</span>
                    <input className="file-picker-hidden" type="file" accept="image/*" capture="environment" onChange={e => pick(e, 'images')} />
                  </label>
                  <small>{listing.images.length} of 2 photos selected. {listing.images.length === 2 ? 'Both photos are ready.' : 'Select or take the remaining photo(s).'} Maximum 5MB per photo.</small>
                </div>}
                {editingDraftId && <p className="notice">Your two saved product photos will be kept with this draft.</p>}
                <div className="thumbs">
                  {listing.images.map((f: any, i: number) => (
                    <span>
                      {typeof f === 'string' ? 'Saved photo ' + (i + 1) : f.name}
                      <button
                        onClick={() =>
                          setListing({
                            ...listing,
                            images: listing.images.filter(
                              (_: any, j: number) => i !== j
                            ),
                          })
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                {profile?.planApprovalStatus === 'approved' && Number(profile.planExpiresAt) > Date.now() && <p className="notice">Your plan is active until {new Date(profile.planExpiresAt).toLocaleDateString('en-NG')}.</p>}
                {profile?.planApprovalStatus === 'pending' && <p className="notice">Your plan payment is pending admin verification. New listings will be held until approval.</p>}
                {paymentDraftId && <div className="payment panel">
                  <small>CHOOSE YOUR LISTING PAYMENT</small>
                  <h2>Your product draft is saved</h2>
                  <p>Choose one option. Payments are processed securely by Paystack.</p>
                  {resumePaymentUrl && <button className="primary full" disabled={loading} onClick={() => window.location.assign(resumePaymentUrl)}>Continue existing payment</button>}
                  <button className="outline full" disabled={loading} onClick={() => startListingPayment('month')}>Pay for 1 month: ₦{Number(DANZO_CONFIG.MONTH_PRICE).toLocaleString('en-NG')} · Unlimited listings for 31 days</button>
                  <button className="outline full" disabled={loading} onClick={() => startListingPayment('sixmonth')}>Pay for 6 months: ₦{Number(DANZO_CONFIG.SIXMONTH_PRICE).toLocaleString('en-NG')} · Unlimited listings for 183 days</button>
                  <button className="outline full" disabled={loading} onClick={() => startListingPayment('listing')}>Pay for just this listing: ₦{(paymentDraftAmount || Math.ceil(Number(listing.price) * DANZO_CONFIG.PER_LISTING_PERCENT / 100)).toLocaleString('en-NG')}</button>
                  <button className="outline full" disabled={loading} onClick={requestListingWaiver}>Request a waiver</button>
                  <button className="link" onClick={() => { setPaymentDraftId(''); setResumePaymentUrl(''); nav('my'); }}>Cancel and keep draft</button>
                </div>}
                <p className="muted">
                  Buyers will contact you on {profile.phone}.
                </p>
                <button
                  className="primary full"
                  disabled={
                    loading ||
                    !listing.title ||
                    !listing.price ||
                    !listing.description ||
                    !listing.alternativePhone ||
                    listing.images.length !== 2
                  }
                  onClick={submit}
                >
                  {loading ? 'Saving draft…' : 'Continue'}
                </button>
              </>
            )}
          </section>
        )}
        {page === 'my' && (
          <section className="section">
            <small>SELLER SPACE</small>
            <h1>My listings</h1>
            {payments.map((payment: any) => <article className="my-item payment-record" key={payment.reference}><div><b>{payment.planType === 'month' ? '1-month plan' : payment.planType === 'sixmonth' ? '6-month plan' : payment.planType === 'waiver' ? 'Waiver request' : 'Single listing fee'}</b><small>{payment.paymentStatus === 'paid' ? 'Payment received. Waiting for admin verification.' : payment.paymentStatus === 'pending' ? 'Payment pending' : payment.paymentStatus === 'waiver_requested' ? 'Waiver request pending' : payment.paymentStatus === 'rejected' || payment.paymentStatus === 'waiver_declined' ? 'Rejected: ' + (payment.rejectionReason || 'Please contact Danzo.') : payment.paymentStatus}</small><small>{payment.reference} · {payment.amount ? money(payment.amount) : 'No payment'}</small></div><div>{payment.paymentStatus === 'pending' && <><button className="outline" onClick={() => payment.authorizationUrl && window.location.assign(payment.authorizationUrl)}>Continue payment</button><button className="outline" onClick={() => verifyMyPayment(payment.reference)}>I've paid, check now</button></>}{(payment.paymentStatus === 'rejected' || payment.paymentStatus === 'waiver_declined') && <button className="outline" onClick={() => { setPaymentDraftId(payment.listingId); setPaymentDraftAmount(Number(payment.amount) || 0); nav('sell'); }}>Choose payment options again</button>}</div></article>)}
            <div className="my-list">
              {mine.map(p => (
                <article className="my-item">
                  <div>
                    <b>{p.title}</b>
                    <strong>{money(p.price)}</strong>
                    <small>
                      {p.status} · {p.views || 0} views
                    </small>
                    {p.rejectionReason && (
                      <small className="danger">{p.rejectionReason}</small>
                    )}
                  </div>
                  <div>
                    {p.status === 'Draft' && (() => {
                      const payment = payments.find((x: any) => x.listingId === p.id && x.planType !== 'waiver' && ['pending', 'paid'].includes(x.paymentStatus));
                      return payment?.paymentStatus === 'paid'
                        ? <button className="outline" disabled>Payment received · Awaiting admin approval</button>
                        : <button className="outline" onClick={() => resumeDraft(p)}>{payment?.paymentStatus === 'pending' ? 'Resume payment' : 'Resume draft'}</button>;
                    })()}
                    {p.status === 'Live' && (
                      <>
                      <button className="outline" onClick={() => startEdit(p)}>
                        Edit details
                      </button>
                      <button
                        className="outline"
                        onClick={async () => {
                          await call('POST', '/api/products/' + p.id + '/sold');
                          privateLoad();
                        }}
                      >
                        Mark sold
                      </button>
                      </>
                    )}
                    <button
                      className="outline"
                      onClick={async () => {
                        if (confirm('Delete listing?')) {
                          await call('DELETE', '/api/products/' + p.id);
                          privateLoad();
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {!mine.length && (
              <div className="empty">
                No listings yet.{' '}
                <button className="link" onClick={() => nav('sell')}>
                  Add your first item
                </button>
              </div>
            )}
          </section>
        )}
        {page === 'saved' && (
          <section className="section">
            <h1>Saved items</h1>
            {saved.length ? (
              <div className="grid">
                {saved.map((p: any) =>
                  p.available ? (
                    <Card p={p} />
                  ) : (
                    <div className="empty">Unavailable</div>
                  )
                )}
              </div>
            ) : (
              <div className="empty">No saved items yet.</div>
            )}
          </section>
        )}
        {page === 'profile' && (
          <section className="panel">
            <small>YOUR ACCOUNT</small>
            <h1>Profile & settings</h1>
            {profile ? (
              <>
                <label>
                  Full name
                  <input
                    value={profileEdit.name || ''}
                    onChange={e =>
                      setProfileEdit({ ...profileEdit, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Location
                  <input
                    value={profileEdit.location || ''}
                    onChange={e =>
                      setProfileEdit({
                        ...profileEdit,
                        location: e.target.value,
                      })
                    }
                  />
                </label>
                {profile.role === 'seller' && (
                  <>
                    <label>
                      Area
                      <input value={profileEdit.area || ''} onChange={e => setProfileEdit({ ...profileEdit, area: e.target.value })} placeholder="Enter your area" />
                    </label>
                    <label>
                      WhatsApp phone
                      <input
                        value={profileEdit.phone || ''}
                        onChange={e =>
                          setProfileEdit({
                            ...profileEdit,
                            phone: e.target.value,
                          })
                        }
                      />
                      <p className="notice">
                        Please make sure this is the phone number you actively use
                        on WhatsApp so buyers can reach you about your listings.
                      </p>
                    </label>
                    <p className="notice">
                      Your name, location and WhatsApp number are visible to
                      logged-in buyers on your listings.
                    </p>
                  </>
                )}
                <label>
                  Bio
                  <textarea
                    value={profileEdit.bio || ''}
                    onChange={e =>
                      setProfileEdit({ ...profileEdit, bio: e.target.value })
                    }
                  />
                </label>
                <button
                  className="primary full"
                  onClick={async () => {
                    try {
                      const r = await call('PUT', '/api/profile', profileEdit);
                      setProfile(r.profile);
                      notify('Profile saved.');
                    } catch (e: any) {
                      notify(e.message);
                    }
                  }}
                >
                  Save changes
                </button>
                <button className="outline full" onClick={logout}>
                  Log out
                </button>
                <button
                  className="outline full"
                  disabled={loading}
                  onClick={async () => {
                    const confirmed = confirm(
                      'Delete your Danzo account permanently? This removes your Danzo profile, listings and uploaded files, saved items, notifications, reports, and your Firebase sign-in account. You can register again with the same email afterward. This cannot be undone.'
                    );
                    if (!confirmed) return;
                    setLoading(true);
                    let danzoDataDeleted = false;
                    try {
                      await call('DELETE', '/api/account');
                      danzoDataDeleted = true;
                      await firebaseSignOut(firebaseAuth);
                      sessionStorage.removeItem('danzo_signup');
                      setUser(null);
                      setProfile(null);
                      setProfileEdit({});
                      setMine([]);
                      setSaved([]);
                      setNotificationItems([]);
                      setForm({
                        name: '',
                        email: user?.email || form.email || '',
                        role: 'buyer',
                        phone: '',
                        location: 'Yola',
                        area: '',
                        bio: '',
                        terms: false,
                      });
                      nav('signup');
                      notify('Your Danzo data has been deleted. Sign up again with the same email to start fresh.');
                    } catch (e: any) {
                      if (danzoDataDeleted) {
                        setProfile(null);
                        setProfileEdit({});
                        notify('Your Danzo data was deleted, but sign-out did not finish. Please use Log out before signing up again.');
                      } else {
                        notify(e.message);
                      }
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Delete Danzo account
                </button>
              </>
            ) : (
              <p>Complete your account setup.</p>
            )}
          </section>
        )}
        {page === 'admin' && (
          <section className="admin">
            <small>DANZO CONTROL ROOM</small>
            {!adminToken ? (
              <div className="panel">
                <h1>Admin access</h1>
                <p>Separate from normal buyer and seller accounts.</p>
                <label>
                  Admin password
                  <input
                    type="password"
                    value={adminPass}
                    onChange={e => setAdminPass(e.target.value)}
                  />
                </label>
                <button
                  className="primary full"
                  disabled={loading}
                  onClick={adminLogin}
                >
                  Unlock admin
                </button>
              </div>
            ) : (
              <>
                <div className="admin-title">
                  <div><h1>Admin dashboard</h1><small>Pending listings: {adminData.pending || 0}</small></div>
                  {user && <button className="outline" onClick={enableAdminAlerts}><ShieldCheck size={15} /> Enable alerts</button>}
                  <button
                    className="outline"
                    onClick={() => {
                      sessionStorage.removeItem('danzo_admin');
                      setAdminToken('');
                    }}
                  >
                    Lock
                  </button>
                </div>
                <div className="tabs">
                  {[
                    'dashboard',
                    'products',
                    'payments',
                    'reports',
                    'users',
                    'settings',
                  ].map(t => (
                    <button
                      className={adminTab === t ? 'active' : ''}
                      onClick={() => loadAdmin(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {adminTab === 'dashboard' ? (
                  <>
                  <div className="stats">
                    {Object.entries(adminData).map(([k, v]) => (
                      <div>
                        <small>{k}</small>
                        <b>{String(v)}</b>
                      </div>
                    ))}
                  </div>
                  {(adminData.notifications || []).length > 0 && <div className="seller-notifications"><b>Recent listing notifications</b>{(adminData.notifications || []).map((n: any) => <div className="seller-notice" key={n.id}><strong>{n.title}</strong><small>{n.body}</small><button className="link" onClick={() => loadAdmin('products')}>Review listings</button></div>)}</div>}
                  </>
                ) : adminTab === 'products' ? (
                  <div className="my-list">
                    {(adminData.items || []).map((p: any) => (
                      <article className="my-item">
                        <div>
                          <div className="admin-product-photos">
                            {(p.images || []).map((src: string, i: number) => <a href={src} target="_blank" rel="noreferrer" key={src}><img src={src} alt={p.title + ' photo ' + (i + 1)} loading="lazy" /></a>)}
                          </div>
                          <b>
                            {p.isDemo ? 'DEMO · ' : ''}
                            {p.title}
                          </b>
                          <small>{money(p.price)} · {p.location} · {p.status}</small>
                          <small><b>Description:</b> {p.description || 'No description provided.'}</small>
                          <small><b>Category:</b> {p.category || 'Not specified'} · <b>Condition:</b> {p.condition || 'Not specified'}</small>
                          <small><b>Negotiable:</b> {p.negotiable ? 'Yes' : 'No'} · <b>Alternative phone:</b> {p.alternativePhone || 'Not provided'}</small>
                          <small><b>Product owner:</b> {p.sellerFullName || 'Unknown seller'}</small>
                          <small><b>Owner email:</b> {p.sellerEmail || 'Not provided'}</small>
                          <small><b>Owner phone:</b> {p.sellerPhone || 'Not provided'}</small>
                          {p.sellerArea && <small><b>Area:</b> {p.sellerArea}</small>}
                          {p.receiptUrl && (
                            <a href={p.receiptUrl} target="_blank">
                              View receipt image
                            </a>
                          )}
                          <small>Seller: {p.sellerId}</small>
                        </div>
                        <div>
                          {p.status === 'Pending' && (
                            <>
                              <button
                                className="outline"
                                onClick={() => review(p, 'approve')}
                              >
                                Approve
                              </button>
                              <button
                                className="outline"
                                onClick={() => review(p, 'reject')}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            className="outline"
                            onClick={async () => {
                              if (confirm('Remove listing?')) {
                                await adminCall(
                                  'DELETE',
                                  '/api/admin/products/' + p.id
                                );
                                loadAdmin('products');
                              }
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : adminTab === 'payments' ? (
                  <div className="my-list">
                    {(adminData.items || []).map((p: any) => <article className="my-item" key={p.reference}><div><b>{p.ownerName} · {p.productTitle}</b><small>{p.ownerEmail} · {p.planType} · {p.amount ? money(p.amount) : '₦0'}</small><small>{p.paymentStatus === 'paid' ? 'Paid ✅ verified by Paystack' : p.paymentStatus === 'waiver_requested' ? 'Waiver requested' : p.paymentStatus} · {p.approvalStatus}</small><small>Reference: {p.reference}</small><small>{new Date(p.createdAt).toLocaleString('en-NG')}</small>{p.rejectionReason && <small className="danger">{p.rejectionReason}</small>}</div><div>{p.paymentStatus === 'paid' && p.approvalStatus === 'pending' && <><button className="outline" onClick={async () => { await adminCall('POST', '/api/admin/payments/' + encodeURIComponent(p.reference) + '/recheck'); loadAdmin('payments'); }}>Re-check with Paystack</button><button className="outline" onClick={async () => { await adminCall('POST', '/api/admin/payments/' + encodeURIComponent(p.reference) + '/action', { action: 'approve' }); loadAdmin('payments'); }}>Approve</button><button className="outline" onClick={async () => { const reason = prompt('Reason for rejection:') || ''; if (!reason) return; await adminCall('POST', '/api/admin/payments/' + encodeURIComponent(p.reference) + '/action', { action: 'reject', reason }); loadAdmin('payments'); }}>Reject</button></>}{p.planType === 'waiver' && p.approvalStatus === 'pending' && <><button className="outline" onClick={async () => { await adminCall('POST', '/api/admin/payments/' + encodeURIComponent(p.reference) + '/action', { action: 'approve' }); loadAdmin('payments'); }}>Approve waiver</button><button className="outline" onClick={async () => { const reason = prompt('Reason for declining waiver:') || 'Waiver request declined.'; await adminCall('POST', '/api/admin/payments/' + encodeURIComponent(p.reference) + '/action', { action: 'decline', reason }); loadAdmin('payments'); }}>Decline</button></>}</div></article>)}
                  </div>
                ) : adminTab === 'reports' ? (
                  <div className="my-list">
                    {(adminData.items || []).map((r: any) => (
                      <article className="my-item">
                        <div>
                          <b>{r.reason}</b>
                          <small>
                            {r.note} · {r.productId}
                          </small>
                        </div>
                        <div>
                          <button
                            className="outline"
                            onClick={async () => {
                              await adminCall(
                                'POST',
                                '/api/admin/reports/' + r.id + '/action',
                                { action: 'dismiss' }
                              );
                              loadAdmin('reports');
                            }}
                          >
                            Dismiss
                          </button>
                          <button
                            className="outline"
                            onClick={async () => {
                              await adminCall(
                                'POST',
                                '/api/admin/reports/' + r.id + '/action',
                                { action: 'remove' }
                              );
                              loadAdmin('reports');
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : adminTab === 'users' ? (
                  <div className="my-list">
                    {(adminData.items || []).map((u: any) => (
                      <article className="my-item">
                        <div>
                          <b>{u.name}</b>
                          <small>
                            {u.email} · {u.role} · {u.location}
                          </small>
                          {u.planExpiresAt && <small>Plan: {u.planType || 'Plan'} · Expires {new Date(u.planExpiresAt).toLocaleDateString('en-NG')}</small>}
                        </div>
                        <button
                          className="outline"
                          onClick={async () => {
                            await adminCall(
                              'POST',
                              '/api/admin/users/' + u.id + '/suspend'
                            );
                            loadAdmin('users');
                          }}
                        >
                          {u.suspended ? 'Unsuspend' : 'Suspend'}
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="panel">
                    <h2>Marketplace settings</h2>
                    <label>Listing fee percentage<input value="10%" readOnly /></label>
                    <label>Bank name<input id="bank" defaultValue={adminData.bankName} /></label>
                    <label>Bank account number<input id="banknumber" defaultValue={adminData.bankAccountNumber} /></label>
                    <label>Bank account name<input id="bankname" defaultValue={adminData.bankAccountName} /></label>
                    <label>
                      Listing duration (days)
                      <input
                        id="duration"
                        type="number"
                        defaultValue={adminData.listingDurationDays}
                      />
                    </label>
                    <button
                      className="primary full"
                      onClick={async () => {
                        await adminCall('PUT', '/api/admin/settings', {
                          bankName: (document.getElementById('bank') as HTMLInputElement).value,
                          bankAccountNumber: (document.getElementById('banknumber') as HTMLInputElement).value,
                          bankAccountName: (document.getElementById('bankname') as HTMLInputElement).value,
                          listingDurationDays: Number(
                            (
                              document.getElementById(
                                'duration'
                              ) as HTMLInputElement
                            ).value
                          ),
                        });
                        notify('Settings saved.');
                        loadAdmin('settings');
                      }}
                    >
                      Save settings
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}
        {['about', 'how', 'safety', 'terms', 'privacy', 'contact'].includes(
          page
        ) && (
          <section className="static">
            <h1>
              {
                (
                  {
                    about: 'About Danzo',
                    how: 'How it works',
                    safety: 'Safety Tips',
                    terms: 'Terms of Use',
                    privacy: 'Privacy Policy',
                    contact: 'Contact',
                  } as any
                )[page]
              }
            </h1>
            {page === 'about' && (
              <p>
                Danzo is a nationwide marketplace that helps buyers across Nigeria connect directly with sellers, discover the products they need, and shop with greater confidence through listing reviews and safety guidance.
              </p>
            )}
            {page === 'how' && (
              <div className="how-content">
                <p>Danzo helps people discover products and connect directly with sellers across Nigeria. Listings are reviewed before they appear in the marketplace.</p>
                <article><b>1. Create your account</b><p>Sign up with your name, email and password. Choose whether you want to buy or sell. Sellers should add their active WhatsApp number and location so buyers can reach them.</p></article>
                <article><b>2. Find a product</b><p>Browse the home page or use Search to explore categories, locations and prices. Open a listing to view its description, condition, price and photos. Read the details carefully and ask questions if anything is unclear.</p></article>
                <article><b>3. Contact the seller</b><p>Use Message on WhatsApp, Send SMS or Call seller on the product page. Choose which of the seller's available numbers to use for WhatsApp, SMS or a call. Confirm that the item is still available before making plans.</p></article>
                <article><b>4. Meet and inspect</b><p>Arrange to meet in a safe public place. Check the product and test it where possible. Make sure it matches the listing before paying, then agree on the final price and payment method directly with the seller.</p></article>
                <article><b>5. Start selling</b><p>Choose Sell, enter accurate product details and upload exactly two clear photos. Choose a monthly plan, six-month plan, one-listing payment or request a waiver. Paystack processes payments securely, then Danzo admins verify and approve the payment before your listing moves into review.</p></article>
                <p className="how-note">Danzo helps buyers and sellers connect but does not collect buyer payments or process transactions between users. Always inspect an item before paying and never send advance payment to an unknown seller.</p>
              </div>
            )}
            {page === 'safety' && (
              <ul>
                <li>Meet in a public place.</li>
                <li>Inspect items before paying.</li>
                <li>Never pay in advance to an unknown seller.</li>
              </ul>
            )}
            {page === 'terms' && (
              <p>
                Use accurate listings and lawful content. Listings are reviewed
                before publication. Danzo does not handle payments between
                buyers and sellers and is not responsible for transactions
                arranged between them.
              </p>
            )}
            {page === 'privacy' && (
              <p>
                Danzo stores account details, listings, reports and uploaded
                images. Sellers' names, locations and phone numbers are shown
                publicly on their listings to logged-in buyers. Danzo does not
                handle payments between buyers and sellers and is not
                responsible for transactions between them.
              </p>
            )}
            {page === 'contact' && (
              <div className="contact-card">
                <p>Have a question, need help with your account, or want to report an issue? Contact the Danzo team using either option below.</p>
                <a href="mailto:kevi.enterprises.co@gmail.com"><Mail size={19} /><span><b>Email</b><small>kevi.enterprises.co@gmail.com</small></span></a>
                <a href="tel:08127005163"><Phone size={19} /><span><b>Call us</b><small>08127005163</small></span></a>
                <p className="muted">For listing or account support, include the email address linked to your Danzo account and a short description of the issue.</p>
              </div>
            )}
          </section>
        )}
      </main>
      <footer>
        <img className="brand-mark footer-mark" src="/danzo-logo.svg" alt="Danzo" />
        <p>Find it. Message the seller.</p>
        <nav>
          {['about', 'how', 'safety', 'terms', 'privacy', 'contact'].map(x => (
            <button onClick={() => nav(x)}>
              {x === 'how'
                ? 'How it works'
                : x === 'safety'
                  ? 'Safety Tips'
                  : x[0].toUpperCase() + x.slice(1)}
            </button>
          ))}
        </nav>
        <small>© {new Date().getFullYear()} Danzo</small>
      </footer>
      {user && (
        <nav className="bottom">
          <button onClick={() => nav('home')}>
            <Home />
            Home
          </button>
          <button onClick={() => nav('search')}>
            <Search />
            Search
          </button>
          {profile?.role === 'seller' && (
            <button className="sell" onClick={() => nav('sell')}>
              <Plus />
              Sell
            </button>
          )}
          <button onClick={() => nav('saved')}>
            <Bookmark />
            Saved
          </button>
          <button onClick={() => nav('profile')}>
            <User />
            Profile
          </button>
        </nav>
      )}
      {editingProduct && (
        <div className="shade" onClick={() => !savingEdit && setEditingProduct(null)}>
          <div className="dialog edit-dialog" onClick={e => e.stopPropagation()}>
            <button className="close" onClick={() => setEditingProduct(null)} disabled={savingEdit}><X /></button>
            <small>EDIT APPROVED LISTING</small>
            <h2>Update product details</h2>
            <label>Product title<input maxLength={90} value={editForm.title || ''} onChange={e => setEditForm({...editForm, title:e.target.value})} /></label>
            <label>Price (₦)<input type="number" min="1" value={editForm.price || ''} onChange={e => setEditForm({...editForm, price:e.target.value})} /></label>
            <label>Category<select value={editForm.category || ''} onChange={e => setEditForm({...editForm, category:e.target.value})}>{(cfg.categories || []).map((x:string)=><option key={x} value={x}>{x}</option>)}</select></label>
            <label>Condition<select value={editForm.condition || ''} onChange={e => setEditForm({...editForm, condition:e.target.value})}>{(cfg.conditions || []).map((x:string)=><option key={x} value={x}>{x}</option>)}</select></label>
            <label>Area / location<input maxLength={120} value={editForm.location || ''} onChange={e => setEditForm({...editForm, location:e.target.value})} /></label>
            <label>Product description<textarea maxLength={3000} rows={5} value={editForm.description || ''} onChange={e => setEditForm({...editForm, description:e.target.value})} /></label>
            <label>Alternative phone number<input value={editForm.alternativePhone || ''} onChange={e => setEditForm({...editForm, alternativePhone:e.target.value})} /></label>
            <label className="edit-check"><input type="checkbox" checked={!!editForm.negotiable} onChange={e => setEditForm({...editForm, negotiable:e.target.checked})} /> Price is negotiable</label>
            <button className="primary full" disabled={savingEdit || !editForm.title?.trim() || !Number(editForm.price) || !editForm.description?.trim()} onClick={saveListingEdit}>{savingEdit ? 'Saving changes…' : 'Save changes'}</button>
          </div>
        </div>
      )}
      {contactChoice && (
        <div className="shade" onClick={() => setContactChoice(null)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <button className="close" onClick={() => setContactChoice(null)}><X /></button>
            <small>CHOOSE SELLER NUMBER</small>
            <h2>Which number should we use?</h2>
            <p>Choose the seller's number for {contactChoice.method === 'whatsapp' ? 'WhatsApp' : contactChoice.method === 'sms' ? 'SMS' : 'a phone call'}.</p>
            <button className="outline full" onClick={() => performContact(contactChoice.phone)}>WhatsApp number · {contactChoice.phone}</button>
            {contactChoice.alternativePhone && contactChoice.alternativePhone !== contactChoice.phone && <button className="outline full" onClick={() => performContact(contactChoice.alternativePhone)}>Alternative number · {contactChoice.alternativePhone}</button>}
            <button className="link" onClick={() => setContactChoice(null)}>Cancel</button>
          </div>
        </div>
      )}
      {modal && (
        <div className="shade">
          <div className="dialog">
            <button className="close" onClick={() => setModal(false)}>
              <X />
            </button>
            <h2>Report listing</h2>
            <label>
              Reason
              <select
                value={report.reason}
                onChange={e => setReport({ ...report, reason: e.target.value })}
              >
                {[
                  'Scam/fraud',
                  'Wrong category',
                  'Already sold',
                  'Offensive content',
                  'Other',
                ].map(x => (
                  <option>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Note (optional)
              <textarea
                value={report.note}
                onChange={e => setReport({ ...report, note: e.target.value })}
              />
            </label>
            <button
              className="primary full"
              onClick={async () => {
                try {
                  await call('POST', '/api/reports', {
                    productId: selected?.id,
                    ...report,
                  });
                  setModal(false);
                  notify("Thanks, we'll review it.");
                } catch (e: any) {
                  notify(e.message);
                }
              }}
            >
              Submit report
            </button>
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
export default App;
