// Proves overselling protection.
// Creates a product with stock=5, then 20 customers try to buy 1 unit AT THE SAME TIME.
// Expected: exactly 5 succeed (201), 15 fail (409), final stock = 0 (never negative).
// Usage: start the server, run `npm run seed`, then `npm run demo:concurrency`
const BASE = process.env.BASE_URL || 'http://localhost:5000/api';
const N = 20;
const STOCK = 5;

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

(async () => {
  const run = Date.now();
  const admin = await api('/auth/login', {
    method: 'POST',
    body: { email: process.env.ADMIN_EMAIL || 'admin@shop.local', password: process.env.ADMIN_PASSWORD || 'Admin@12345' },
  });
  const adminToken = admin.json.accessToken;
  if (!adminToken) throw new Error('Admin login failed - did you run `npm run seed`?');

  const seller = await api('/auth/register', {
    method: 'POST',
    body: { name: 'Race Seller', email: `race-seller-${run}@test.com`, password: 'Password@123', role: 'seller' },
  });
  const sellerToken = seller.json.accessToken;

  const cat = await api('/categories', { method: 'POST', token: adminToken, body: { name: `Race ${run}` } });
  const prod = await api('/products', {
    method: 'POST',
    token: sellerToken,
    body: { name: `Limited Item ${run}`, price: 100, category: cat.json.category._id, stock: STOCK },
  });
  const productId = prod.json.product._id;
  console.log(`Product created with stock ${STOCK}`);

  // register customers + fill carts (sequential setup)
  const customers = [];
  for (let i = 0; i < N; i++) {
    const r = await api('/auth/register', {
      method: 'POST',
      body: { name: `Buyer ${i}`, email: `buyer-${run}-${i}@test.com`, password: 'Password@123' },
    });
    const token = r.json.accessToken;
    await api('/cart/items', { method: 'POST', token, body: { productId, quantity: 1 } });
    customers.push(token);
  }

  const address = {
    fullName: 'Test Buyer', phone: '9999999999', line1: '1 Test Street', city: 'Delhi', postalCode: '110001',
  };

  console.log(`${N} customers checking out simultaneously...`);
  const results = await Promise.all(
    customers.map((token) => api('/orders/checkout', { method: 'POST', token, body: { shippingAddress: address } }))
  );

  const ok = results.filter((r) => r.status === 201).length;
  const rejected = results.filter((r) => r.status === 409).length;
  const final = await api(`/products/${productId}`);

  console.log({ succeeded: ok, rejected_409: rejected, other: N - ok - rejected, finalStock: final.json.product.stock });
  console.log(ok === STOCK && final.json.product.stock === 0 ? 'PASS: no overselling' : 'FAIL: check logic');
})().catch((e) => { console.error(e); process.exit(1); });
