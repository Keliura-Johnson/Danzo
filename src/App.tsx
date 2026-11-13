import { useEffect, useMemo, useState } from 'react';
import { firebaseAuth } from './firebase';
import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
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
    const token = await firebaseAuth.currentUser?.getIdToken();
    const response = await fetch(p, {
      method: m,
      headers: {
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(d ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(d ? { body: JSON.stringify(d) } : {}),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result?.message || result?.error || 'Something went wrong.');
    }
    return result;
  } catch (e: any) {
    throw new Error(e?.message || 'Something went wrong.');
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