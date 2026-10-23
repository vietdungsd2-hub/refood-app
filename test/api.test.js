process.env.DB_FILE = ':memory:';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server/index');

let base, server;
test.before(async () => {
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const call = async (path, { method = 'GET', body, token } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

let userToken, shopToken, bagId, orderId;

test('danh sách túi mù có dữ liệu mẫu và lọc được', async () => {
  const all = await call('/api/bags');
  assert.equal(all.status, 200);
  assert.equal(all.data.count, 8);
  const sushi = await call('/api/bags?type=' + encodeURIComponent('Túi sushi'));
  assert.equal(sushi.data.count, 2);
  const avail = await call('/api/bags?available=1');
  assert.equal(avail.data.count, 7);
  const q = await call('/api/bags?q=' + encodeURIComponent('hàng bài'));
  assert.equal(q.data.bags[0].restaurant, 'Tiệm Bánh Artisan ABC');
  const sorted = await call('/api/bags?sort=price');
  assert.equal(sorted.data.bags[0].price, 28000);
});

test('lọc theo khu vực, danh sách khu vực, link Maps', async () => {
  const hn = await call('/api/bags?province=' + encodeURIComponent('Hà Nội'));
  assert.equal(hn.data.count, 6);
  const hk = await call('/api/bags?province=' + encodeURIComponent('Hà Nội') + '&district=' + encodeURIComponent('Hoàn Kiếm'));
  assert.equal(hk.data.count, 2);
  assert.equal((await call('/api/bags?province=' + encodeURIComponent('Đà Nẵng'))).data.count, 1);
  const areas = await call('/api/bags/areas');
  assert.equal(areas.data.areas.length, 3);
  assert.ok(areas.data.areas.find((a) => a.province === 'Hà Nội').districts.includes('Cầu Giấy'));
  const b = hn.data.bags[0];
  assert.match(b.mapUrl, /^https:\/\/www\.google\.com\/maps\/search\//);
  assert.ok(b.sale && b.shelfNote && b.area.includes('Hà Nội'));
  const rest = await call('/api/restaurants');
  assert.ok(rest.data.restaurants.every((r) => r.mapUrl.startsWith('https://')));
});

test('saleStatus theo giờ mở bán', () => {
  const { saleStatus } = require('../server/sale');
  assert.equal(saleStatus('17:00', '20:00', 16 * 60 + 59), 'upcoming');
  assert.equal(saleStatus('17:00', '20:00', 17 * 60), 'open');
  assert.equal(saleStatus('17:00', '20:00', 20 * 60), 'closed');
  assert.equal(saleStatus(null, null, 3 * 60), 'open');
});

test('tìm kiếm không bị SQL injection', async () => {
  const r = await call('/api/bags?q=' + encodeURIComponent("' OR 1=1 --"));
  assert.equal(r.status, 200);
  assert.equal(r.data.count, 0);
});

test('đăng ký: kiểm tra dữ liệu, trùng email, đăng nhập', async () => {
  const bad = await call('/api/auth/register', { method: 'POST', body: { name: 'A', email: 'x', password: '123' } });
  assert.equal(bad.status, 400);
  assert.ok(bad.data.errors.email && bad.data.errors.password && bad.data.errors.name);

  const ok = await call('/api/auth/register', { method: 'POST', body: { name: 'Nguyễn Văn A', email: 'a@example.com', phone: '0912345678', password: 'matkhau123', confirm: 'matkhau123' } });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.user.role, 'user');
  assert.ok(!('password_hash' in ok.data.user));
  userToken = ok.data.token;

  const dup = await call('/api/auth/register', { method: 'POST', body: { name: 'Bình An', email: 'A@Example.com', password: 'matkhau123' } });
  assert.equal(dup.status, 409);

  const wrong = await call('/api/auth/login', { method: 'POST', body: { user: 'a@example.com', password: 'sai-mat-khau' } });
  assert.equal(wrong.status, 401);
  const byPhone = await call('/api/auth/login', { method: 'POST', body: { user: '0912345678', password: 'matkhau123' } });
  assert.equal(byPhone.status, 200);
  const me = await call('/api/auth/me', { token: userToken });
  assert.equal(me.data.user.email, 'a@example.com');
  assert.equal((await call('/api/auth/me', { token: 'token-gia' })).status, 401);
});

test('chủ quán đăng túi; người mua thường không đăng được', async () => {
  const shop = await call('/api/auth/register', { method: 'POST', body: { name: 'Chị Lan', email: 'quan@example.com', password: 'matkhau123', type: 'restaurant', restaurant: 'Quán Lan' } });
  assert.equal(shop.status, 201);
  assert.equal(shop.data.user.role, 'restaurant');
  shopToken = shop.data.token;

  const payload = { address: '10 Phố Huế, Hai Bà Trưng, Hà Nội', province: 'Hà Nội', district: 'Hai Bà Trưng', type: 'Túi bánh', name: 'Bánh cuối ngày', tag: 'Mới nướng', price: 30000, value: 90000, pickupFrom: '20:00', pickupTo: '21:00', quantity: 2 };
  assert.equal((await call('/api/bags', { method: 'POST', body: payload, token: userToken })).status, 403);
  assert.equal((await call('/api/bags', { method: 'POST', body: payload })).status, 401);
  assert.equal((await call('/api/bags', { method: 'POST', body: { ...payload, value: 1000 }, token: shopToken })).status, 400);

  const noArea = { ...payload }; delete noArea.province;
  assert.equal((await call('/api/bags', { method: 'POST', body: noArea, token: shopToken })).status, 400);
  const evil = await call('/api/bags', { method: 'POST', body: { ...payload, mapUrl: 'javascript:alert(1)' }, token: shopToken });
  assert.equal(evil.status, 400);
  assert.ok(evil.data.errors.mapUrl);
  assert.equal((await call('/api/bags', { method: 'POST', body: { ...payload, saleFrom: '20:00', saleTo: '19:00' }, token: shopToken })).status, 400);

  const created = await call('/api/bags', { method: 'POST', body: { ...payload, mapUrl: 'https://maps.app.goo.gl/abc', shopUrl: 'https://quanlan.example.com', saleFrom: '18:00', saleTo: '20:00', shelfNote: 'Dùng trong ngày' }, token: shopToken });
  assert.equal(created.data.bag.mapUrl, 'https://maps.app.goo.gl/abc');
  assert.equal(created.data.bag.sale, '18:00 – 20:00');
  assert.equal(created.data.bag.district, 'Hai Bà Trưng');
  assert.equal(created.status, 201);
  assert.equal(created.data.bag.restaurant, 'Quán Lan');
  assert.equal(created.data.bag.left, 2);
  bagId = created.data.bag.id;
});

test('đặt túi trừ số lượng, không bán vượt, huỷ thì hoàn lại', async () => {
  assert.equal((await call('/api/orders', { method: 'POST', body: { bagId } })).status, 401);
  assert.equal((await call('/api/orders', { method: 'POST', body: { bagId }, token: shopToken })).status, 400); // chủ quán tự đặt

  const o1 = await call('/api/orders', { method: 'POST', body: { bagId, quantity: 1 }, token: userToken });
  assert.equal(o1.status, 201);
  assert.equal(o1.data.left, 1);
  assert.equal(o1.data.order.total, 30000);
  orderId = o1.data.order.id;

  const tooMany = await call('/api/orders', { method: 'POST', body: { bagId, quantity: 3 }, token: userToken });
  assert.equal(tooMany.status, 409);

  assert.equal((await call('/api/orders', { method: 'POST', body: { bagId, quantity: 1 }, token: userToken })).data.left, 0);
  assert.equal((await call('/api/orders', { method: 'POST', body: { bagId }, token: userToken })).status, 409);

  const mine = await call('/api/orders/me', { token: userToken });
  assert.equal(mine.data.orders.length, 2);

  assert.equal((await call(`/api/orders/${orderId}/cancel`, { method: 'POST', token: shopToken })).status, 404); // đơn của người khác
  assert.equal((await call(`/api/orders/${orderId}/cancel`, { method: 'POST', token: userToken })).status, 200);
  assert.equal((await call(`/api/orders/${orderId}/cancel`, { method: 'POST', token: userToken })).status, 409);
  assert.equal((await call(`/api/bags/${bagId}`)).data.bag.left, 1);
});

test('chủ quán xem đơn và hoàn tất; chỉ sửa được túi của mình', async () => {
  const list = await call('/api/orders/restaurant', { token: shopToken });
  const active = list.data.orders.find((o) => o.status === 'reserved');
  assert.ok(active && active.customer.name === 'Nguyễn Văn A');
  assert.equal((await call(`/api/orders/${active.id}/complete`, { method: 'POST', token: shopToken })).status, 200);

  assert.equal((await call('/api/bags/1', { method: 'PATCH', body: { price: 1 }, token: shopToken })).status, 404);
  const upd = await call(`/api/bags/${bagId}`, { method: 'PATCH', body: { quantity: 10 }, token: shopToken });
  assert.equal(upd.data.bag.left, 10);
  assert.equal((await call(`/api/bags/${bagId}`, { method: 'DELETE', token: shopToken })).status, 200);
  assert.equal((await call(`/api/bags/${bagId}`)).status, 404);
});

test('yêu thích, nhà hàng, liên hệ, nhận tin', async () => {
  assert.equal((await call('/api/favorites/1/toggle', { method: 'POST' })).status, 401);
  assert.equal((await call('/api/favorites/1/toggle', { method: 'POST', token: userToken })).data.favorite, true);
  const withFav = await call('/api/bags', { token: userToken });
  assert.equal(withFav.data.bags.find((b) => b.id === 1).favorite, true);
  assert.equal((await call('/api/favorites/1/toggle', { method: 'POST', token: userToken })).data.favorite, false);

  const rest = await call('/api/restaurants');
  assert.ok(rest.data.restaurants.length >= 6);

  assert.equal((await call('/api/contact', { method: 'POST', body: { name: 'A', email: 'x' } })).status, 400);
  assert.equal((await call('/api/contact', { method: 'POST', body: { name: 'Trần B', email: 'b@example.com', msg: 'Xin chào ReFood' } })).status, 201);
  assert.equal((await call('/api/newsletter', { method: 'POST', body: { email: 'c@example.com' } })).status, 201);
  assert.equal((await call('/api/newsletter', { method: 'POST', body: { email: 'khong-phai-email' } })).status, 400);
});

test('đặt song song không bán vượt số túi', async () => {
  const shop = await call('/api/auth/register', { method: 'POST', body: { name: 'Quán Hai', email: 'q2@example.com', password: 'matkhau123', type: 'restaurant', restaurant: 'Quán Hai' } });
  const bag = await call('/api/bags', { method: 'POST', token: shop.data.token, body: { address: '1 Phố Test, Hà Nội', province: 'Hà Nội', district: 'Ba Đình', type: 'Túi bánh', name: 'Túi thử', price: 10000, value: 20000, pickupFrom: '18:00', pickupTo: '19:00', quantity: 3 } });
  const results = await Promise.all(Array.from({ length: 8 }, () => call('/api/orders', { method: 'POST', body: { bagId: bag.data.bag.id }, token: userToken })));
  assert.equal(results.filter((r) => r.status === 201).length, 3);
  assert.equal(results.filter((r) => r.status === 409).length, 5);
});

test('API không tồn tại trả JSON 404 và JSON hỏng trả 400', async () => {
  assert.equal((await call('/api/khong-co')).status, 404);
  const res = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{hong' });
  assert.equal(res.status, 400);
});
