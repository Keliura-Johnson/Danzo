import { useEffect, useMemo, useState } from 'react';
import { auth, api, notifications } from '@appdeploy/client';
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
    const r =
      m === 'GET'
        ? await api.get(p)
        : m === 'POST'
          ? await api.post(p, d)
          : m === 'PUT'
            ? await api.put(p, d)
            : await api.delete(p, d);
    return r.data;
  } catch (e: any) {
    throw new Error(
      e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        'Something went wrong.'
    );
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
    [saved, setSaved] = useState<any[]>([]),
    [notificationItems, setNotificationItems] = useState<any[]>([]),
    [selected, setSelected] = useState<Product | null>(null),
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
      location: 'Yola',
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
        }
      }
    } catch (e: any) {
      notify(e.message);
    }
  };
  useEffect(() => {
    (async () => {
      try {
        const u = await auth.getUser();
        setUser(u);
        const c = await call('GET', '/api/config');
        setCfg(c);
        if (u) {
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
        }
        setAuthReady(true);
        await load();
      } catch (e: any) {
        setAuthReady(true);
        notify(e.message);
      }
    })();
  }, []);
  useEffect(() => {
    if (user && profile) privateLoad();
  }, [user, profile?.role]);
  useEffect(() => {
    if (!user) return;
    const off = notifications.onMessage((payload: any) => {
      notify(payload?.notification?.body || 'You have a new Danzo update.');
      privateLoad();
    });
    return off;
  }, [user?.userId]);
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
    try {
      sessionStorage.setItem('danzo_signup', JSON.stringify(form));
      await auth.signInWithRedirect({
        scope: 'openid email profile offline_access',
      });
    } catch (e: any) {
      notify(e.message);
    }
  };
  const logout = async () => {
    await auth.signOut();
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
  const contact = async () => {
    if (!user) {
      nav('login');
      return;
    }
    try {
      const d = await call('GET', '/api/products/' + selected?.id + '/contact');
      const msg =
        'Hello, I saw "' +
        selected?.title +
        '" (' +
        money(selected?.price || 0) +
        ') on Danzo. Is it still available?';
      window.open(
        'https://wa.me/' + phone(d.phone) + '?text=' + encodeURIComponent(msg),
        '_blank',
        'noopener,noreferrer'
      );
    } catch (e: any) {
      notify(e.message);
    }
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
      const imgs = await Promise.all(listing.images.map(compress)),
        receipt = await compress(listing.receipt);
      await call('POST', '/api/products', {
        ...listing,
        price: Number(listing.price),
        images: imgs,
        receipt,
      });
      notify('Listing submitted for approval.');
      setListing({
        title: '',
        category: 'Phones & Tablets',
        condition: 'Used - Good',
        price: '',
        description: '',
        location: profile?.location || 'Yola',
        negotiable: false,
        images: [],
        receipt: null,
      });
      nav('my');
      await privateLoad();
    } catch (e: any) {
      notify(e.message);
    } finally {
      setLoading(false);
    }
  };
  const loadAdmin = async (tab = adminTab, token = adminToken) => {
    try {
      const path =
        tab === 'dashboard'
          ? '/api/admin/dashboard'
          : tab === 'settings'
            ? '/api/admin/settings'
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
  const enableSellerAlerts = async () => {
    try { if (!user) { notify('Log in first to enable listing notifications.'); return; } await notifications.subscribe(); notify('Listing notifications enabled on this device.'); }
    catch (e: any) { notify(e.message || 'Could not enable notifications.'); }
  };
  const enableAdminAlerts = async () => {
    try { if (!user) { notify('Sign in to your Danzo account first, then unlock admin to enable alerts.'); return; } await notifications.subscribe(); await adminCall('POST', '/api/admin/subscribe'); notify('Admin listing alerts enabled on this device.'); }
    catch (e: any) { notify(e.message || 'Could not enable admin alerts.'); }
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
  const pick = async (e: any, field: string) => {
    const fs = Array.from(e.target.files || []) as File[];
    if (field === 'images') {
      if (listing.images.length + fs.length > 4) {
        notify('Maximum four photos.');
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
            <p>Secure passwordless email sign-in. No password to remember.</p>
            <label>
              Full name
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Your full name"
              />
            </label>
            <label>
              Email address
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
              />
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
                </label>
                <label>
                  Location
                  <select
                    value={form.location}
                    onChange={e =>
                      setForm({ ...form, location: e.target.value })
                    }
                  >
                    {cfg.locations?.map((x: string) => (
                      <option>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Area / hostel
                  <input
                    value={form.area}
                    onChange={e => setForm({ ...form, area: e.target.value })}
                    placeholder="Area or hostel"
                  />
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
            <button
              className="primary full"
              disabled={
                !form.name ||
                !form.email ||
                !form.terms ||
                (form.role === 'seller' && !form.phone)
              }
              onClick={login}
            >
              Continue with email
            </button>
            <p className="muted center">
              Already have an account?{' '}
              <button className="link" onClick={() => nav('login')}>
                Log in
              </button>
            </p>
          </section>
        )}
        {page === 'login' && (
          <section className="panel">
            <small>WELCOME BACK</small>
            <h1>Log in to Danzo</h1>
            <p>We’ll send a secure sign-in link to your email.</p>
            <label>
              Email address
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
              />
            </label>
            <button
              className="primary full"
              disabled={!form.email}
              onClick={() =>
                auth
                  .signInWithRedirect({
                    scope: 'openid email profile offline_access',
                  })
                  .catch((e: any) => notify(e.message))
              }
            >
              Send sign-in link
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
                  <button className="whatsapp full" onClick={contact}>
                    <MessageCircle /> Message on WhatsApp
                  </button>
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
                  Description
                  <textarea
                    rows={4}
                    value={listing.description}
                    onChange={e =>
                      setListing({ ...listing, description: e.target.value })
                    }
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
                <label>
                  Product photos (1–4, max 5MB each)
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={e => pick(e, 'images')}
                  />
                </label>
                <div className="thumbs">
                  {listing.images.map((f: File, i: number) => (
                    <span>
                      {f.name}
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
                <div className="payment">
                  <small>STEP 2 · PAYMENT</small>
                  <h2>Listing fee ({cfg.listingFeePercent || 10}%): {money(Math.ceil((Number(listing.price) || 0) * (cfg.listingFeePercent || 10) / 100))}</h2>
                  <p className="muted">The listing fee is 10% of your intended product price.</p>
                  <p>Bank: <b>{cfg.bankName}</b></p>
                  <p>Account number: <b>{cfg.bankAccountNumber || 'Add account number in Admin Settings'}</b>{' '}{cfg.bankAccountNumber && <button className="link" onClick={() => { navigator.clipboard.writeText(cfg.bankAccountNumber); notify('Copied.'); }}><Copy size={14} /> Copy</button>}</p>
                  <p>Account name: <b>{cfg.bankAccountName || 'Add account name in Admin Settings'}</b></p>
                  <ol>
                    <li>Transfer the exact amount.</li>
                    <li>Take a screenshot of the receipt.</li>
                    <li>Upload it below.</li>
                  </ol>
                  <label>
                    Payment receipt (required)
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => pick(e, 'receipt')}
                    />
                  </label>
                  {listing.receipt && <small>{listing.receipt.name}</small>}
                </div>
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
                    !listing.images.length ||
                    !listing.receipt
                  }
                  onClick={submit}
                >
                  {loading ? 'Submitting…' : 'Submit for approval'}
                </button>
              </>
            )}
          </section>
        )}
        {page === 'my' && (
          <section className="section">
            <small>SELLER SPACE</small>
            <h1>My listings</h1>
            <div className="notification-tools"><div><b>Listing notifications</b><small>Get an alert when your product is approved or needs changes.</small></div><button className="outline" onClick={enableSellerAlerts}>Enable alerts</button></div>
            {notificationItems.length > 0 && <div className="seller-notifications"><b>Recent updates</b>{notificationItems.map((n: any) => <div className="seller-notice" key={n.id}><strong>{n.title}</strong><small>{n.body}</small></div>)}</div>}
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
                    {p.status === 'Live' && (
                      <button
                        className="outline"
                        onClick={async () => {
                          await call('POST', '/api/products/' + p.id + '/sold');
                          privateLoad();
                        }}
                      >
                        Mark sold
                      </button>
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
                          <b>
                            {p.isDemo ? 'DEMO · ' : ''}
                            {p.title}
                          </b>
                          <small>
                            {money(p.price)} · {p.location} · {p.status}
                          </small>
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
              <p>
                Browse, message the seller on WhatsApp, meet in public, inspect
                the item and arrange payment directly. Danzo does not collect
                buyer payments.
              </p>
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
              <p>
                Owner contact details can be added in the app configuration
                before launch.
              </p>
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
