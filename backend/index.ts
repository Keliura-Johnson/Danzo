import {
  router,
  json,
  error,
  requireAuth,
  db,
  storage,
  secrets,
  notifications,
} from '@appdeploy/sdk';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { DANZO_CONFIG as C } from '../danzo.config.ts';

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
  const demos = r.items.filter((p: any) => p.isDemo || p.sellerId === 'danzo-demo-seller');
  for (const p of demos) {
    await db.delete('products', [p.id]);
    await storage.delete([...(p.imagePaths || []), p.receiptPath].filter(Boolean));
  }
}
async function ensureGlobalSettings() {
  const [old] = await db.get<any>('settings', ['global'], { consistent: true });
  const values = {
    listingFeePercent: C.LISTING_FEE_PERCENT,
    bankName: C.BANK_NAME,
    bankAccountNumber: C.BANK_ACCOUNT_NUMBER,
    bankAccountName: C.BANK_ACCOUNT_NAME,
    listingDurationDays: C.LISTING_DURATION_DAYS,
    paymentSettingsVersion: 2,
  };
  if (!old) await db.tx.add('settings', [{ id: 'global', ...values }]);
  else if (old.paymentSettingsVersion !== 2) await db.update('settings', [{ id: 'global', record: { ...old, ...values } }]);
}
async function admin(ctx: any) {
  const token = clean(
    ctx.event?.headers?.['x-admin-token'] ||
      ctx.event?.headers?.['X-Admin-Token'] ||
      ctx.event?.queryStringParameters?.adminToken ||
      obj(ctx.body).adminToken,
    300
  );
  if (!token) return false;
  const [s] = await db.get<any>('admin_sessions', [sha(token)], {
    consistent: true,
  });
  return !!s && s.expiresAt > now();
}
async function upload(file: any, path: string) {
  const data = clean(file?.data, 7000000),
    type = clean(file?.contentType, 30);
  if (
    !data ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(type) ||
    data.length > 6800000
  )
    throw new Error('Use a JPG, PNG or WebP image under 5MB.');
  const [ok] = await storage.write([
    { path, content: data, contentType: type },
  ]);
  if (!ok) throw new Error('Image upload failed.');
  return path;
}
async function rate(key: string, max: number, windowMs: number) {
  const [r] = await db.get<any>('rate_limits', [key], { consistent: true });
  const item =
    r && r.resetAt > now() ? r : { count: 0, resetAt: now() + windowMs };
  if (item.count >= max) return false;
  await db.update('rate_limits', [
    { id: key, record: { count: item.count + 1, resetAt: item.resetAt } },
  ]);
  return true;
}
const adminRoutes = {
  'POST /api/admin/login': [
    async ({ body }: any) => {
      const pass = clean(obj(body).password, 300);
      if (!pass) return fail('Enter admin password.');
      const names = await secrets.listSecretNames();
      if (!names.includes(C.ADMIN_PASSWORD_SECRET))
        return fail('ADMIN_PASSWORD has not been configured.', 503);
      const expected = await secrets.readSecret(C.ADMIN_PASSWORD_SECRET),
        a = Buffer.from(pass),
        b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b))
        return fail('Incorrect admin password.', 401);
      const token = randomBytes(32).toString('hex');
      await db.tx.add('admin_sessions', [
        { id: sha(token), expiresAt: now() + 43200000 },
      ]);
      return json({ token });
    },
  ],
  'GET /api/admin/dashboard': [
    async (ctx: any) => {
      if (!(await admin(ctx))) return fail('Admin session expired.', 401);
      const [u, p, r, alerts] = await Promise.all([
        db.list<any>('users', { limit: 100 }),
        db.list<any>('products', { limit: 100 }),
        db.list<any>('reports', { limit: 100 }),
        db.list<any>('admin_notifications', { limit: 20 }),
      ]);
      const live = p.items.filter(
        (x: any) => x.status === 'Live' && (!x.expiresAt || x.expiresAt > now())
      );
      return json({
        users: u.items.length,
        sellers: u.items.filter((x: any) => x.role === 'seller').length,
        buyers: u.items.filter((x: any) => x.role === 'buyer').length,
        live: live.length,
        pending: p.items.filter((x: any) => x.status === 'Pending').length,
        reports: r.items.filter((x: any) => x.status === 'Open').length,
        feesCollected: p.items.reduce((sum: number, x: any) => sum + (['Live', 'Expired', 'Sold'].includes(x.status) ? Number(x.listingFeeAmount || 0) : 0), 0),
        notifications: alerts.items.sort((a: any, b: any) => b.createdAt - a.createdAt).slice(0, 10),
      });
    },
  ],
  'GET /api/admin/products': [
    async (ctx: any) => {
      if (!(await admin(ctx))) return fail('Admin session expired.', 401);
      const r = await db.list<any>('products', { limit: 100 });
      return json({
        items: await Promise.all(
          r.items.map(async (p: any) => ({
            ...p,
            images: await signed(p.imagePaths),
            receiptUrl: p.receiptPath ? (await signed([p.receiptPath]))[0] : '',
          }))
        ),
      });
    },
  ],
  'POST /api/admin/products/:id/review': [
    async (ctx: any) => {
      if (!(await admin(ctx))) return fail('Admin session expired.', 401);
      const [p] = await db.get<any>('products', [ctx.params.id]);
      if (!p) return fail('Listing not found.', 404);
      const b = obj(ctx.body);
      if (b.action === 'approve') {
        await db.update('products', [{ id: ctx.params.id, record: { ...p, status: 'Live', approvedAt: now(), expiresAt: now() + C.LISTING_DURATION_DAYS * 86400000, rejectionReason: '' } }]);
        await db.tx.add('user_notifications', [{ id: uid(), userId: p.sellerId, kind: 'listing_approved', productId: p.id, title: 'Your product has been verified', body: p.title + ' is approved and now visible on Danzo.', createdAt: now(), read: false }]);
        try {
          await notifications.send({ userIds: [p.sellerId], notification: { title: 'Your Danzo listing is verified', body: p.title + ' is approved and now live on Danzo.', url: '/' }, data: { kind: 'listing_approved', productId: p.id } });
        } catch (e) { console.warn('Seller approval notification could not be delivered', e); }
        return json({ ok: true });
      }
      const reason = clean(b.reason, 300);
      if (!reason) return fail('A rejection reason is required.');
      await db.update('products', [{ id: ctx.params.id, record: { ...p, status: 'Rejected', rejectionReason: reason } }]);
      await db.tx.add('user_notifications', [{ id: uid(), userId: p.sellerId, kind: 'listing_rejected', productId: p.id, title: 'Listing needs changes', body: p.title + ' was not approved: ' + reason, createdAt: now(), read: false }]);
      try { await notifications.send({ userIds: [p.sellerId], notification: { title: 'Update on your Danzo listing', body: p.title + ' was not approved. Check My Listings for details.', url: '/' }, data: { kind: 'listing_rejected', productId: p.id } }); }
      catch (e) { console.warn('Seller rejection notification could not be delivered', e); }
      return json({ ok: true });
    },
  ],
  'DELETE /api/admin/products/:id': [
    async (ctx: any) => {
      if (!(await admin(ctx))) return fail('Admin session expired.', 401);
      const [p] = await db.get<any>('products', [ctx.params.id]);
      if (!p) return fail('Listing not found.', 404);
      await db.delete('products', [ctx.params.id]);
      await storage.delete(
        [...(p.imagePaths || []), p.receiptPath].filter(Boolean)
      );
      return json({ ok: true });
    },
  ],
  'GET /api/admin/reports': [
    async (ctx: any) => {
      if (!(await admin(ctx))) return fail('Admin session expired.', 401);
      return json(await db.list<any>('reports', { limit: 100 }));
    },
  ],
  'POST /api/admin/reports/:id/action': [
    async (ctx: any) => {
      if (!(await admin(ctx))) return fail('Admin session expired.', 401);
      const [r] = await db.get<any>('reports', [ctx.params.id]);
      if (!r) return fail('Report not found.', 404);
      if (obj(ctx.body).action === 'remove') {
        const [p] = await db.get<any>('products', [r.productId]);
        if (p) {
          await db.delete('products', [r.productId]);
          await storage.delete(
            [...(p.imagePaths || []), p.receiptPath].filter(Boolean)
          );
        }
      }
      await db.update('reports', [
        {
          id: ctx.params.id,
          record: {
            ...r,
            status: 'Closed',
            action: clean(obj(ctx.body).action, 20),
          },
        },
      ]);
      return json({ ok: true });
    },
  ],
  'GET /api/admin/users': [
    async (ctx: any) => {
      if (!(await admin(ctx))) return fail('Admin session expired.', 401);
      return json(await db.list<any>('users', { limit: 100 }));
    },
  ],
  'POST /api/admin/users/:id/suspend': [
    async (ctx: any) => {
      if (!(await admin(ctx))) return fail('Admin session expired.', 401);
      const [u] = await db.get<any>('users', [ctx.params.id]);
      if (!u) return fail('User not found.', 404);
      await db.update('users', [
        { id: ctx.params.id, record: { ...u, suspended: !u.suspended } },
      ]);
      return json({ suspended: !u.suspended });
    },
  ],
  'GET /api/admin/settings': [
    async (ctx: any) => {
      if (!(await admin(ctx))) return fail('Admin session expired.', 401);
      await ensureGlobalSettings();
      const [s] = await db.get<any>('settings', ['global']);
      return json({
        listingFeePercent: s?.listingFeePercent ?? C.LISTING_FEE_PERCENT,
        bankName: s?.bankName ?? C.BANK_NAME,
        bankAccountNumber: s?.bankAccountNumber ?? C.BANK_ACCOUNT_NUMBER,
        bankAccountName: s?.bankAccountName ?? C.BANK_ACCOUNT_NAME,
        listingDurationDays: s?.listingDurationDays ?? C.LISTING_DURATION_DAYS,
      });
    },
  ],
  'POST /api/admin/subscribe': [
    requireAuth(),
    async (ctx: any) => {
      if (!(await admin(ctx))) return fail('Admin session expired.', 401);
      await notifications.subscribeTopic({ userIds: [ctx.user!.userId], topic: 'danzo-admin' });
      return json({ ok: true });
    },
  ],
  'GET /api/notifications': [
    requireAuth(),
    async (ctx: any) => {
      const r = await db.list<any>('user_notifications', { limit: 100 });
      return json({ items: r.items.filter((n: any) => n.userId === ctx.user!.userId).sort((a: any, b: any) => b.createdAt - a.createdAt).slice(0, 20) });
    },
  ],
  'PUT /api/admin/settings': [
    async (ctx: any) => {
      if (!(await admin(ctx))) return fail('Admin session expired.', 401);
      const b = obj(ctx.body),
        record = {
          listingFeePercent: C.LISTING_FEE_PERCENT,
          bankName: clean(b.bankName, 60) || C.BANK_NAME,
          bankAccountNumber: clean(b.bankAccountNumber, 30),
          bankAccountName: clean(b.bankAccountName, 100),
          listingDurationDays: Math.max(1, Math.min(365, Number(b.listingDurationDays) || C.LISTING_DURATION_DAYS)),
          paymentSettingsVersion: 2,
        };
      const [old] = await db.get<any>('settings', ['global']);
      if (old)
        await db.update('settings', [
          { id: 'global', record: { ...old, ...record } },
        ]);
      else await db.tx.add('settings', [{ id: 'global', ...record }]);
      return json({ ok: true });
    },
  ],
};
export const handler = router({
  'GET /api/health': [async () => json({ ok: true })],
  'GET /api/config': [
    async () => {
      await ensureGlobalSettings();
      const [s] = await db.get<any>('settings', ['global']);
      return json({
        categories: C.CATEGORIES,
        locations: C.LOCATIONS,
        conditions: C.CONDITIONS,
        listingFeePercent: s?.listingFeePercent ?? C.LISTING_FEE_PERCENT,
        bankName: s?.bankName ?? C.BANK_NAME,
        bankAccountNumber: s?.bankAccountNumber ?? C.BANK_ACCOUNT_NUMBER,
        bankAccountName: s?.bankAccountName ?? C.BANK_ACCOUNT_NAME,
        listingDurationDays: s?.listingDurationDays ?? C.LISTING_DURATION_DAYS,
      });
    },
  ],
  'GET /api/products': [
    async ({ query }: any) => {
      await cleanupDemo();
      const r = await db.list<any>('products', { limit: 100 });
      const q = clean(query.q, 120).toLowerCase(),
        cat = clean(query.category, 80),
        loc = clean(query.location, 80),
        min = Number(query.min) || 0,
        max = Number(query.max) || Number.MAX_SAFE_INTEGER;
      let items = r.items.filter(
        (p: any) =>
          p.status === 'Live' &&
          (!p.expiresAt || p.expiresAt > now()) &&
          (!q || (p.title + ' ' + p.description).toLowerCase().includes(q)) &&
          (!cat || p.category === cat) &&
          (!loc || p.location === loc) &&
          p.price >= min &&
          p.price <= max
      );
      items.sort((a: any, b: any) =>
        query.sort === 'low'
          ? a.price - b.price
          : query.sort === 'high'
            ? b.price - a.price
            : b.createdAt - a.createdAt
      );
      return json({
        items: await Promise.all(items.slice(0, 60).map(viewProduct)),
        count: items.length,
      });
    },
  ],
  'GET /api/products/:id': [
    async (ctx: any) => {
      const [p] = await db.get<any>('products', [ctx.params.id]);
      if (!p || p.status !== 'Live' || (p.expiresAt && p.expiresAt < now()))
        return fail('Listing not found.', 404);
      await db.tx.update(
        'products',
        [{ id: ctx.params.id, record: { views: (p.views || 0) + 1 } }],
        { patch: true }
      );
      return json(await viewProduct(p, true));
    },
  ],
  'GET /api/products/:id/contact': [
    requireAuth(),
    async (ctx: any) => {
      const [p] = await db.get<any>('products', [ctx.params.id]);
      if (!p || p.status !== 'Live') return fail('Listing not found.', 404);
      const s = await profile(p.sellerId),
        contactPhone = p.alternativePhone || s?.phone;
      if (!s || s.suspended || !validPhone(contactPhone))
        return fail('Seller contact is unavailable.', 404);
      return json({ phone: contactPhone });
    },
  ],
  'GET /api/me': [
    requireAuth(),
    async (ctx: any) =>
      json({
        profile: await profile(ctx.user!.userId),
        email: ctx.user!.email,
      }),
  ],
  'POST /api/profile': [
    requireAuth(),
    async (ctx: any) => {
      const b = obj(ctx.body),
        name = clean(b.name, 80),
        role = b.role === 'seller' ? 'seller' : 'buyer',
        ph = phone(clean(b.phone, 30));
      if (!name) return fail('Full name is required.');
      if (role === 'seller' && !validPhone(ph))
        return fail('Enter a valid Nigerian WhatsApp number.');
      const old = await profile(ctx.user!.userId),
        record = {
          name,
          email: ctx.user!.email || clean(b.email, 150),
          role,
          phone: role === 'seller' ? ph : '',
          location: clean(b.location, 120),
          bio: clean(b.bio, 240),
          createdAt: old?.createdAt || now(),
          suspended: old?.suspended || false,
        };
      if (old)
        await db.update('users', [
          { id: ctx.user!.userId, record: { ...old, ...record } },
        ]);
      else await db.tx.add('users', [{ id: ctx.user!.userId, ...record }]);
      return json({ profile: record });
    },
  ],
  'PUT /api/profile': [
    requireAuth(),
    async (ctx: any) => {
      const old = await profile(ctx.user!.userId);
      if (!old) return fail('Create your profile first.', 404);
      const b = obj(ctx.body),
        ph = old.role === 'seller' ? phone(clean(b.phone, 30)) : '';
      if (!clean(b.name, 80) || (old.role === 'seller' && !validPhone(ph)))
        return fail('Check your name and WhatsApp number.');
      const next = {
        ...old,
        name: clean(b.name, 80),
        phone: ph,
        location: clean(b.location, 120),
        bio: clean(b.bio, 240),
      };
      await db.update('users', [{ id: ctx.user!.userId, record: next }]);
      return json({ profile: next });
    },
  ],
  'DELETE /api/account': [
    requireAuth(),
    async (ctx: any) => {
      const userId = ctx.user!.userId;
      const readAll = async (table: string) => {
        const rows: any[] = [];
        let nextToken: string | undefined;
        do {
          const page = await db.list<any>(table, {
            limit: 100,
            ...(nextToken ? { nextToken } : {}),
          });
          rows.push(...page.items);
          nextToken = page.nextToken;
        } while (nextToken);
        return rows;
      };
      const allProducts = await readAll('products');
      const ownedProducts = allProducts.filter((p: any) => p.sellerId === userId);
      const productIds = new Set(ownedProducts.map((p: any) => p.id));
      const [savedRows, notificationRows, reportRows, adminRows, receiptRows] = await Promise.all([
        readAll('saved_items'),
        readAll('user_notifications'),
        readAll('reports'),
        readAll('admin_notifications'),
        readAll('receipt_hashes'),
      ]);
      const saved = savedRows.filter((r: any) => r.userId === userId || productIds.has(r.productId));
      const userNotifications = notificationRows.filter((r: any) => r.userId === userId);
      const reports = reportRows.filter((r: any) => r.userId === userId || productIds.has(r.productId));
      const adminNotifications = adminRows.filter((r: any) => r.sellerId === userId || productIds.has(r.productId));
      const receipts = receiptRows.filter((r: any) => productIds.has(r.listingId));
      const paths = ownedProducts.flatMap((p: any) => [...(p.imagePaths || []), p.receiptPath].filter(Boolean));
      if (paths.length) await storage.delete(paths);
      const removeRows = async (table: string, rows: any[]) => {
        const ids = rows.map((r: any) => r.id).filter(Boolean);
        for (let i = 0; i < ids.length; i += 100) {
          await db.delete(table, ids.slice(i, i + 100));
        }
      };
      await Promise.all([
        removeRows('products', ownedProducts),
        removeRows('saved_items', saved),
        removeRows('user_notifications', userNotifications),
        removeRows('reports', reports),
        removeRows('admin_notifications', adminNotifications),
        removeRows('receipt_hashes', receipts),
      ]);
      await db.delete('users', [userId]);
      return json({ ok: true, deletedProducts: ownedProducts.length });
    },
  ],
  'POST /api/products': [
    requireAuth(),
    async (ctx: any) => {
      const s = await profile(ctx.user!.userId);
      if (!s || s.role !== 'seller' || s.suspended)
        return fail('A seller account is required.', 403);
      if (!validPhone(s.phone))
        return fail('Add a WhatsApp number to your profile first.');
      const b = obj(ctx.body),
        title = clean(b.title, 90),
        desc = clean(b.description, 3000),
        price = Number(b.price),
        category = clean(b.category, 80),
        altPhone = phone(clean(b.alternativePhone, 30)),
        imgs = Array.isArray(b.images) ? b.images.slice(0, 2) : [];
      if (!validPhone(altPhone) || altPhone === s.phone)
        return fail('Enter a valid alternative Nigerian phone number different from your profile WhatsApp number.');
      if (
        !title ||
        !desc ||
        !Number.isFinite(price) ||
        price <= 0 ||
        !C.CATEGORIES.includes(category as any)
      )
        return fail('Check title, category, price and description.');
      if (imgs.length !== 2 || !b.receipt)
        return fail('Add exactly two product photos and a payment receipt.');
      const receiptData = clean(b.receipt.data, 6800000);
      if (!receiptData) return fail('Receipt image is required.');
      const receiptHash = sha(receiptData),
        [duplicate] = await db.get<any>('receipt_hashes', [receiptHash], {
          consistent: true,
        });
      if (duplicate) return fail('This receipt image has already been used.');
      const lid = uid(),
        paths: string[] = [],
        listingFeeAmount = Math.ceil(price * C.LISTING_FEE_PERCENT / 100);
      try {
        for (let i = 0; i < imgs.length; i++)
          paths.push(await upload(imgs[i], 'products/' + lid + '/' + i));
        const receiptPath = await upload(b.receipt, 'receipts/' + lid);
        const [rh] = await db.tx.add('receipt_hashes', [
          { id: receiptHash, listingId: lid, createdAt: now() },
        ]);
        if (!rh) throw new Error('This receipt image has already been used.');
        const [saved] = await db.tx.add('products', [
          {
            id: lid,
            sellerId: ctx.user!.userId,
            title,
            description: desc,
            price,
            listingFeeAmount,
            listingFeePercent: C.LISTING_FEE_PERCENT,
            category,
            condition: C.CONDITIONS.includes(b.condition)
              ? b.condition
              : 'Used - Good',
            location: clean(b.location || s.location, 120),
            alternativePhone: altPhone,
            negotiable: !!b.negotiable,
            imagePaths: paths,
            receiptPath,
            status: 'Pending',
            rejectionReason: '',
            createdAt: now(),
            views: 0,
            isDemo: false,
          },
        ]);
        if (!saved) throw new Error('Could not save listing.');
        await db.tx.add('admin_notifications', [{ id: uid(), kind: 'listing_submitted', productId: lid, sellerId: ctx.user!.userId, title: 'New listing awaiting approval', body: title + ' is waiting for review.', createdAt: now(), read: false }]);
        try {
          await notifications.sendToTopic({ topic: 'danzo-admin', notification: { title: 'New Danzo listing', body: title + ' is waiting for approval.', url: '/admin' }, data: { kind: 'listing_submitted', productId: lid } });
        } catch (e) { console.warn('Admin listing notification could not be delivered', e); }
        return json({ id: lid, status: 'Pending', listingFeeAmount });
      } catch (e) {
        await storage.delete(paths);
        throw e;
      }
    },
  ],
  'GET /api/my-products': [
    requireAuth(),
    async (ctx: any) => {
      const r = await db.list<any>('products', { limit: 100 });
      const items = r.items.filter((p: any) => p.sellerId === ctx.user!.userId);
      return json({
        items: await Promise.all(
          items.map(async (p: any) => ({
            ...p,
            images: await signed(p.imagePaths),
          }))
        ),
      });
    },
  ],
  'PUT /api/products/:id': [
    requireAuth(),
    async (ctx: any) => {
      const [p] = await db.get<any>('products', [ctx.params.id]);
      if (!p || p.sellerId !== ctx.user!.userId)
        return fail('You can only edit your own listings.', 403);
      if (!['Pending', 'Live'].includes(p.status))
        return fail('This listing cannot be edited.');
      const b = obj(ctx.body),
        next = {
          ...p,
          title: clean(b.title ?? p.title, 90),
          description: clean(b.description ?? p.description, 3000),
          price: Number(b.price ?? p.price),
          category: clean(b.category ?? p.category, 80),
          location: clean(b.location ?? p.location, 120),
          negotiable:
            b.negotiable === undefined ? p.negotiable : !!b.negotiable,
        };
      if (!next.title || !Number.isFinite(next.price) || next.price <= 0)
        return fail('Enter a valid title and price.');
      await db.update('products', [{ id: ctx.params.id, record: next }]);
      return json({ ok: true });
    },
  ],
  'POST /api/products/:id/sold': [
    requireAuth(),
    async (ctx: any) => {
      const [p] = await db.get<any>('products', [ctx.params.id]);
      if (!p || p.sellerId !== ctx.user!.userId)
        return fail('Not your listing.', 403);
      await db.update('products', [
        { id: ctx.params.id, record: { ...p, status: 'Sold', soldAt: now() } },
      ]);
      return json({ ok: true });
    },
  ],
  'DELETE /api/products/:id': [
    requireAuth(),
    async (ctx: any) => {
      const [p] = await db.get<any>('products', [ctx.params.id]);
      if (!p || p.sellerId !== ctx.user!.userId)
        return fail('Not your listing.', 403);
      await db.delete('products', [ctx.params.id]);
      await storage.delete(
        [...(p.imagePaths || []), p.receiptPath].filter(Boolean)
      );
      return json({ ok: true });
    },
  ],
  'POST /api/reports': [
    requireAuth(),
    async (ctx: any) => {
      if (!(await rate('reports-' + ctx.user!.userId, 5, 86400000)))
        return fail('Daily report limit reached.', 429);
      const b = obj(ctx.body),
        reason = clean(b.reason, 80);
      if (
        ![
          'Scam/fraud',
          'Wrong category',
          'Already sold',
          'Offensive content',
          'Other',
        ].includes(reason)
      )
        return fail('Choose a report reason.');
      await db.tx.add('reports', [
        {
          id: uid(),
          productId: clean(b.productId, 100),
          userId: ctx.user!.userId,
          reason,
          note: clean(b.note, 500),
          status: 'Open',
          createdAt: now(),
        },
      ]);
      return json({ ok: true });
    },
  ],
  'GET /api/saved': [
    requireAuth(),
    async (ctx: any) => {
      const r = await db.list<any>('saved_items', { limit: 100 }),
        mine = r.items.filter((x: any) => x.userId === ctx.user!.userId);
      const items = await Promise.all(
        mine.map(async (x: any) => {
          const [p] = await db.get<any>('products', [x.productId]);
          return p
            ? {
                ...p,
                available: p.status === 'Live',
                images: await signed(p.imagePaths),
              }
            : { id: x.productId, available: false };
        })
      );
      return json({ items });
    },
  ],
  'POST /api/saved/:id': [
    requireAuth(),
    async (ctx: any) => {
      const key = sha(ctx.user!.userId + ':' + ctx.params.id),
        [old] = await db.get<any>('saved_items', [key]);
      if (old) await db.delete('saved_items', [key]);
      else
        await db.tx.add('saved_items', [
          { id: key, userId: ctx.user!.userId, productId: ctx.params.id },
        ]);
      return json({ saved: !old });
    },
  ],
  ...adminRoutes,
});
