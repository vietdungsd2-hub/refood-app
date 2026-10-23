const router = require('express').Router();
const db = require('../db');
const { HttpError, v } = require('../validate');
const { optionalAuth, requireAuth } = require('../auth');
const { saleStatus, mapsSearchUrl } = require('../sale');

const DEFAULT_IMAGES = {
  'Túi bánh': 'images/bag-bakery.jpg',
  'Túi sushi': 'images/bag-sushi.jpg',
  'Túi rau củ': 'images/bag-veg.jpg',
};
const FALLBACK_IMAGE = 'images/bag-bread.jpg';

const toDTO = (r) => ({
  id: r.id,
  ownerId: r.owner_id,
  restaurant: r.restaurant,
  address: r.address,
  type: r.type,
  name: r.name,
  tag: r.tag || '',
  price: r.price,
  value: r.value,
  discount: r.value > 0 ? Math.round((1 - r.price / r.value) * 100) : 0,
  province: r.province || '',
  district: r.district || '',
  area: [r.district, r.province].filter(Boolean).join(', '),
  mapUrl: r.map_url || mapsSearchUrl(r.restaurant, r.address),
  shopUrl: r.shop_url || '',
  shelfNote: r.shelf_note || '',
  saleFrom: r.sale_from || '',
  saleTo: r.sale_to || '',
  sale: r.sale_from && r.sale_to ? `${r.sale_from} – ${r.sale_to}` : '',
  saleStatus: saleStatus(r.sale_from, r.sale_to),
  pickupFrom: r.pickup_from,
  pickupTo: r.pickup_to,
  pickup: `${r.pickup_from} – ${r.pickup_to}`,
  left: r.quantity,
  image: r.image || DEFAULT_IMAGES[r.type] || FALLBACK_IMAGE,
  featured: !!r.featured,
  active: !!r.active,
  favorite: !!r.fav,
});

const escLike = (s) => s.replace(/[\\%_]/g, (c) => '\\' + c);
const BASE = `SELECT b.*, (SELECT 1 FROM favorites f WHERE f.bag_id = b.id AND f.user_id = @uid) AS fav FROM bags b`;

/** Danh sách túi mù (công khai): lọc, tìm kiếm, sắp xếp ở phía server. */
router.get('/', optionalAuth, (req, res) => {
  const q = req.query;
  const where = ['b.active = 1'];
  const params = { uid: req.user ? req.user.id : 0 };

  if (typeof q.q === 'string' && q.q.trim()) {
    where.push(`lower(b.restaurant || ' ' || b.address || ' ' || b.type || ' ' || b.name || ' ' || coalesce(b.district, '') || ' ' || coalesce(b.province, '')) LIKE @q ESCAPE '\\'`);
    params.q = '%' + escLike(q.q.trim().toLowerCase().slice(0, 100)) + '%';
  }
  if (typeof q.type === 'string' && q.type) {
    const types = q.type.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10);
    if (types.length) {
      where.push(`b.type IN (${types.map((_, i) => '@t' + i).join(',')})`);
      types.forEach((t, i) => (params['t' + i] = t));
    }
  }
  if (typeof q.province === 'string' && q.province.trim()) { where.push('b.province = @province'); params.province = q.province.trim().slice(0, 60); }
  if (typeof q.district === 'string' && q.district.trim()) { where.push('b.district = @district'); params.district = q.district.trim().slice(0, 60); }
  if (q.price === 'low') where.push('b.price < 40000');
  else if (q.price === 'mid') where.push('b.price BETWEEN 40000 AND 60000');
  else if (q.price === 'high') where.push('b.price > 60000');
  if (q.available === '1') where.push('b.quantity > 0');
  if (q.featured === '1') where.push('b.featured = 1');

  const order = { price: 'b.price ASC', discount: '(1.0 * b.price / b.value) ASC' }[q.sort] || 'b.pickup_from ASC';
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || 50, 1), 100);

  const rows = db.prepare(`${BASE} WHERE ${where.join(' AND ')} ORDER BY ${order}, b.id ASC LIMIT ${limit}`).all(params);
  res.json({ count: rows.length, bags: rows.map(toDTO) });
});

router.get('/types', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT type FROM bags WHERE active = 1 ORDER BY type').all();
  res.json({ types: rows.map((r) => r.type) });
});

/** Khu vực đang có túi: [{ province, districts: [...] }] để dựng bộ lọc Tỉnh/Thành → Quận/Huyện. */
router.get('/areas', (req, res) => {
  const rows = db.prepare(`SELECT DISTINCT province, district FROM bags
    WHERE active = 1 AND province IS NOT NULL ORDER BY province, district`).all();
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.province)) map.set(r.province, []);
    if (r.district) map.get(r.province).push(r.district);
  }
  res.json({ areas: [...map].map(([province, districts]) => ({ province, districts })) });
});

/** Túi của nhà hàng đang đăng nhập (kể cả đã ẩn). */
router.get('/mine', requireAuth('restaurant'), (req, res) => {
  const rows = db.prepare(`${BASE} WHERE b.owner_id = @owner ORDER BY b.id DESC`).all({ uid: req.user.id, owner: req.user.id });
  res.json({ bags: rows.map(toDTO) });
});

router.get('/:id', optionalAuth, (req, res) => {
  const row = db.prepare(`${BASE} WHERE b.id = @id AND b.active = 1`).get({ uid: req.user ? req.user.id : 0, id: Number(req.params.id) });
  if (!row) throw new HttpError(404, 'Không tìm thấy túi mù.');
  res.json({ bag: toDTO(row) });
});

/** Chỉ nhận http(s), tránh javascript: và các giao thức nguy hiểm khác. */
function okUrl(s) {
  if (typeof s !== 'string' || s.length > 300) return false;
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch (e) { return false; }
}

function parseBag(b, partial) {
  const errors = {};
  const out = {};
  const has = (k) => b[k] !== undefined;

  if (!partial || has('address')) { if (!v.text(b.address, 5, 200)) errors.address = 'Địa chỉ từ 5 đến 200 ký tự.'; else out.address = b.address.trim(); }
  if (!partial || has('province')) { if (!v.text(b.province, 2, 40)) errors.province = 'Vui lòng nhập Tỉnh/Thành phố (2–40 ký tự).'; else out.province = b.province.trim(); }
  if (!partial || has('district')) { if (!v.text(b.district, 2, 40)) errors.district = 'Vui lòng nhập Quận/Huyện (2–40 ký tự).'; else out.district = b.district.trim(); }
  for (const [key, col, label] of [['mapUrl', 'map_url', 'Link Google Maps'], ['shopUrl', 'shop_url', 'Website của quán']]) {
    if (has(key)) {
      const val = typeof b[key] === 'string' ? b[key].trim() : '';
      if (!val) out[col] = null;
      else if (!okUrl(val)) errors[key] = `${label} phải bắt đầu bằng http:// hoặc https:// (tối đa 300 ký tự).`;
      else out[col] = val;
    }
  }
  if (has('shelfNote')) { if (b.shelfNote !== '' && !v.text(b.shelfNote, 1, 80)) errors.shelfNote = 'Ghi chú hạn dùng tối đa 80 ký tự.'; else out.shelf_note = (b.shelfNote || '').trim() || null; }
  if (has('saleFrom') || has('saleTo')) {
    const f = b.saleFrom || '', t = b.saleTo || '';
    if (!f && !t) { out.sale_from = null; out.sale_to = null; }
    else if (!v.time(f)) errors.saleFrom = 'Giờ bắt đầu mở bán phải có dạng HH:MM.';
    else if (!v.time(t)) errors.saleTo = 'Giờ kết thúc mở bán phải có dạng HH:MM.';
    else { out.sale_from = f; out.sale_to = t; }
  }
  if (!partial || has('type')) { if (!v.text(b.type, 2, 40)) errors.type = 'Lĩnh vực túi từ 2 đến 40 ký tự.'; else out.type = b.type.trim(); }
  if (!partial || has('name')) { if (!v.text(b.name, 2, 100)) errors.name = 'Tên túi từ 2 đến 100 ký tự.'; else out.name = b.name.trim(); }
  if (has('tag')) { if (b.tag !== '' && !v.text(b.tag, 1, 60)) errors.tag = 'Mô tả ngắn tối đa 60 ký tự.'; else out.tag = (b.tag || '').trim(); }
  if (!partial || has('price')) { if (!v.int(b.price, 0, 10000000)) errors.price = 'Giá bán phải là số nguyên không âm.'; else out.price = b.price; }
  if (!partial || has('value')) { if (!v.int(b.value, 0, 10000000)) errors.value = 'Giá trị ban đầu phải là số nguyên không âm.'; else out.value = b.value; }
  if (!partial || has('pickupFrom')) { if (!v.time(b.pickupFrom)) errors.pickupFrom = 'Giờ nhận bắt đầu phải có dạng HH:MM.'; else out.pickup_from = b.pickupFrom; }
  if (!partial || has('pickupTo')) { if (!v.time(b.pickupTo)) errors.pickupTo = 'Giờ nhận kết thúc phải có dạng HH:MM.'; else out.pickup_to = b.pickupTo; }
  if (!partial || has('quantity')) { if (!v.int(b.quantity, 0, 500)) errors.quantity = 'Số túi từ 0 đến 500.'; else out.quantity = b.quantity; }
  if (has('image')) {
    out.image = typeof b.image === 'string' && /^images\/[\w.-]+\.(jpe?g|png|svg|webp)$/.test(b.image) ? b.image : null;
  }
  if (has('active')) out.active = b.active ? 1 : 0;
  return { errors, out };
}

router.post('/', requireAuth('restaurant'), (req, res) => {
  const { errors, out } = parseBag(req.body || {}, false);
  if (!errors.price && !errors.value && out.value < out.price) errors.value = 'Giá trị ban đầu phải lớn hơn hoặc bằng giá bán.';
  if (!errors.pickupFrom && !errors.pickupTo && out.pickup_to <= out.pickup_from) errors.pickupTo = 'Giờ kết thúc phải sau giờ bắt đầu.';
  if (out.sale_from && out.sale_to && out.sale_to <= out.sale_from) errors.saleTo = 'Giờ kết thúc mở bán phải sau giờ bắt đầu.';
  if (Object.keys(errors).length) throw new HttpError(400, 'Dữ liệu không hợp lệ.', errors);

  const info = db.prepare(`INSERT INTO bags (owner_id, restaurant, address, province, district, map_url, shop_url, sale_from, sale_to, shelf_note, type, name, tag, price, value, pickup_from, pickup_to, quantity, image)
    VALUES (@owner, @restaurant, @address, @province, @district, @map_url, @shop_url, @sale_from, @sale_to, @shelf_note, @type, @name, @tag, @price, @value, @pickup_from, @pickup_to, @quantity, @image)`).run({
    owner: req.user.id,
    restaurant: req.user.restaurant_name || req.user.name,
    address: out.address, province: out.province, district: out.district,
    map_url: out.map_url ?? null, shop_url: out.shop_url ?? null, sale_from: out.sale_from ?? null, sale_to: out.sale_to ?? null, shelf_note: out.shelf_note ?? null,
    type: out.type, name: out.name, tag: out.tag || '',
    price: out.price, value: out.value, pickup_from: out.pickup_from, pickup_to: out.pickup_to,
    quantity: out.quantity, image: out.image || null,
  });
  const row = db.prepare(`${BASE} WHERE b.id = @id`).get({ uid: req.user.id, id: info.lastInsertRowid });
  res.status(201).json({ bag: toDTO(row) });
});

router.patch('/:id', requireAuth('restaurant'), (req, res) => {
  const id = Number(req.params.id);
  const cur = db.prepare('SELECT * FROM bags WHERE id = ? AND owner_id = ?').get(id, req.user.id);
  if (!cur) throw new HttpError(404, 'Không tìm thấy túi mù của bạn.');
  const { errors, out } = parseBag(req.body || {}, true);
  const price = out.price ?? cur.price, value = out.value ?? cur.value;
  if (value < price) errors.value = 'Giá trị ban đầu phải lớn hơn hoặc bằng giá bán.';
  if ((out.pickup_to ?? cur.pickup_to) <= (out.pickup_from ?? cur.pickup_from)) errors.pickupTo = 'Giờ kết thúc phải sau giờ bắt đầu.';
  const sf = 'sale_from' in out ? out.sale_from : cur.sale_from, st = 'sale_to' in out ? out.sale_to : cur.sale_to;
  if (sf && st && st <= sf) errors.saleTo = 'Giờ kết thúc mở bán phải sau giờ bắt đầu.';
  if (Object.keys(errors).length) throw new HttpError(400, 'Dữ liệu không hợp lệ.', errors);

  const keys = Object.keys(out);
  if (keys.length) {
    // tên cột lấy từ danh sách cố định trong parseBag, không từ dữ liệu người dùng
    db.prepare(`UPDATE bags SET ${keys.map((k) => `${k} = @${k}`).join(', ')} WHERE id = @id`).run({ ...out, id });
  }
  const row = db.prepare(`${BASE} WHERE b.id = @id`).get({ uid: req.user.id, id });
  res.json({ bag: toDTO(row) });
});

router.delete('/:id', requireAuth('restaurant'), (req, res) => {
  const info = db.prepare('UPDATE bags SET active = 0 WHERE id = ? AND owner_id = ?').run(Number(req.params.id), req.user.id);
  if (!info.changes) throw new HttpError(404, 'Không tìm thấy túi mù của bạn.');
  res.json({ ok: true });
});

module.exports = router;
module.exports.toDTO = toDTO;
