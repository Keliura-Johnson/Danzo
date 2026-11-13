import {
  router,
  json,
  error,
  db,
  storage,
  secrets,
  notifications,
} from '@appdeploy/sdk';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { DANZO_CONFIG as C } from '../danzo.config.ts';

let firebaseAdminAuth: ReturnType<typeof getAuth> | null = null;
async function getFirebaseAdminAuth() {
  if (firebaseAdminAuth) return firebaseAdminAuth;
  const names = await secrets.listSecretNames();
  if (!names.includes('FIREBASE_SERVICE_ACCOUNT_JSON')) {
    throw new Error('Firebase service account is not configured.');
  }
  const serviceAccount = JSON.parse(await secrets.readSecret('FIREBASE_SERVICE_ACCOUNT_JSON'));
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({ credential: cert(serviceAccount) });
  firebaseAdminAuth = getAuth(app);
  return firebaseAdminAuth;
}
async function requireFirebaseAuth(ctx: any) {
  const headers = ctx.event?.headers || {};
  const authorization = headers.authorization || headers.Authorization || '';
  if (!authorization.startsWith('Bearer ')) {
    return fail('Sign in to continue.', 401);
  }
  try {
    const decoded = await (await getFirebaseAdminAuth()).verifyIdToken(authorization.slice(7));
    let userId = decoded.uid;
    if (decoded.email) {
      const existing = await db.list<any>('users', { limit: 100 });
      const match = existing.items.find((item: any) =>
        String(item.email || '').toLowerCase() === decoded.email!.toLowerCase()
      );
      if (match?.id) userId = match.id;
    }
    ctx.user = {
      userId,
      email: decoded.email || '',
      scope: 'openid email profile',
    };
  } catch (e) {
    console.warn('Firebase token verification failed.');
    return fail('Your session could not be verified. Please log in again.', 401);
  }
}
const now = () => Date.now(),
  clean = (v: any, n = 3000) =>
    String(v ?? '')
      .trim()
      .slice(0, n),
  obj = (v: any) => (v && typeof v === 'object' ? v : {});
const fail = (m: string, s = 400) => error(m, s),
  uid = () => randomBytes(16).toString('hex');
const phone = (v: string) => {
  let n = v.replace(/[^0-9+]/g, '').replace(/^\+/, '');
  if (n.startsWith('0')) n = '234' + n.slice(1);
  if (n.length === 10) n = '234' + n;
  return n;
};
const validPhone = (v: string) => /^234[0-9]{10}$/.test(v);
const sha = (v: string) => createHash('sha256').update(v).digest('hex');
const signed = async (paths: string[] = []) =>
  (await storage.url(paths.filter(Boolean).slice(0, 4))).map(x => x.url);
async function profile(id: string) {
  const [p] = await db.get<any>('users', [id], { consistent: true });
  return p;
}
async function viewProduct(p: any, includeAllImages = false) {
  const [s] = await db.get<any>('users', [p.sellerId]);
  const visiblePaths = includeAllImages ? p.imagePaths : (p.imagePaths || []).slice(0, 1);
  return {
    ...p,
    images: await signed(visiblePaths),
    seller: {
      id: p.sellerId,
      name: s?.name || 'Danzo Demo Seller',
      location: s?.location || p.location,
      bio: s?.bio || '',
      memberSince: s?.createdAt || p.createdAt,
    },
  };
}
async function ensureDemo() {
  const [flag] = await db.get<any>('settings', ['demo-seeded'], {
    consistent: true,
  });
  if (flag) return;
  const t = now(),
    demo = [
      [
        'demo-01',
        'Samsung Galaxy A14',
        'Phones & Tablets',
        72000,
        'Yola',
        'Used - Good',
        'Good working condition. Demo listing — remove from Admin.',
      ],
      [
        'demo-02',
        'HP EliteBook 840 G5',
        'Laptops & Computers',
        185000,
        'Jimeta',
        'Used - Good',
        'Reliable laptop for school and everyday work. Demo listing — remove from Admin.',
      ],
      [
        'demo-03',
        'Oraimo Bluetooth Speaker',
        'Electronics',
        18000,
        'Yola',
        'New',
        'Portable speaker, demo listing.',
      ],
      [
        'demo-04',
        'Unisex Canvas Sneakers',
        'Fashion',
        12500,
        'Biu',
        'New',
        'Comfortable everyday sneakers. Demo listing.',
      ],
      [
        'demo-05',
        'Engineering Mathematics Textbook',
        'Books & Textbooks',
        6500,
        'Jimeta',
        'Used - Like new',
        'Useful textbook for students. Demo listing.',
      ],
      [
        'demo-06',
        'Study Table and Chair',
        'Hostel & Home Items',
        28000,
        'Yola',
        'Used - Good',
        'Compact hostel study set. Demo listing.',
      ],
      [
        'demo-07',
        'Pack of Local Snacks',
        'Food & Snacks',
        2500,
        'Biu',
        'New',
        'Sample snack listing. Demo listing.',
      ],
      [
        'demo-08',
        'Laptop Software Installation',
        'Services',
        5000,
        'Mubi',
        'New',
        'Student-friendly setup service. Demo listing.',
      ],
    ];
  const [ok] = await db.tx.add('settings', [
    { id: 'demo-seeded', seeded: true },
  ]);
  if (!ok) return;
  for (const x of demo) {
    await db.tx.add('products', [
      {
        id: x[0],
        sellerId: 'danzo-demo-seller',
        title: x[1],
        category: x[2],
        price: x[3],
        location: x[4],
        condition: x[5],
        description: x[6],
        imagePaths: [],
        receiptPath: '',
        status: 'Live',
        isDemo: true,
        negotiable: false,
        createdAt: t - (Number(String(x[0]).slice(-2)) || 1) * 86400000,
        expiresAt: t + C.LISTING_DURATION_DAYS * 86400000,
        views: 0,
      },
    ]);
  }
}
async function cleanupDemo() {
  const r = await db.list<any>('products', { limit: 100 });