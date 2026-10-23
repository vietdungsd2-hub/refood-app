const { mapsSearchUrl } = require('../sale');
const router = require('express').Router();
const db = require('../db');
const { HttpError, v, normPhone } = require('../validate');
const { requireAuth } = require('../auth');

/** Bật/tắt yêu thích một túi mù. */
router.post('/:bagId/toggle', requireAuth(), (req, res) => {
  const bagId = Number(req.params.bagId);
  if (!db.prepare('SELECT 1 FROM bags WHERE id = ? AND active = 1').get(bagId)) throw new HttpError(404, 'Không tìm thấy túi mù.');
  const del = db.prepare('DELETE FROM favorites WHERE user_id = ? AND bag_id = ?').run(req.user.id, bagId);
  if (del.changes) return res.json({ favorite: false });
  db.prepare('INSERT INTO favorites (user_id, bag_id) VALUES (?, ?)').run(req.user.id, bagId);
  res.json({ favorite: true });
});

router.get('/', requireAuth(), (req, res) => {
  const rows = db.prepare('SELECT bag_id FROM favorites WHERE user_id = ?').all(req.user.id);
  res.json({ ids: rows.map((r) => r.bag_id) });
});

module.exports = router;

/* ---------- Các endpoint công khai khác ---------- */
const pub = require('express').Router();

pub.get('/health', (req, res) => res.json({ ok: true }));

/** Danh sách nhà hàng, gom từ các túi đang bán (đồng bộ với trang Túi mù). */
pub.get('/restaurants', (req, res) => {
  const rows = db.prepare(`SELECT restaurant AS name, MIN(address) AS address, MIN(province) AS province, MIN(district) AS district,
      MIN(map_url) AS mapUrl, MIN(shop_url) AS shopUrl, COUNT(*) AS bags, SUM(quantity) AS "left", MIN(pickup_from) AS firstPickup
    FROM bags WHERE active = 1 GROUP BY restaurant ORDER BY firstPickup, restaurant`).all();
  res.json({
    restaurants: rows.map((r) => ({
      ...r,
      area: [r.district, r.province].filter(Boolean).join(', '),
      mapUrl: r.mapUrl || mapsSearchUrl(r.name, r.address),
      shopUrl: r.shopUrl || '',
    })),
  });
});

pub.post('/contact', (req, res) => {
  const b = req.body || {};
  const name = String(b.name ?? '').trim(), email = String(b.email ?? '').trim();
  const phone = normPhone(b.phone), message = String(b.msg ?? b.message ?? '').trim();
  const errors = {};
  if (!v.text(name, 2, 80)) errors.name = 'Vui lòng nhập họ và tên.';
  if (!v.email(email)) errors.email = 'Email không hợp lệ.';
  if (phone && !v.phone(phone)) errors.phone = 'Số điện thoại không hợp lệ.';
  if (!v.text(message, 5, 2000)) errors.msg = 'Nội dung từ 5 đến 2000 ký tự.';
  if (Object.keys(errors).length) throw new HttpError(400, 'Dữ liệu không hợp lệ.', errors);
  db.prepare('INSERT INTO contacts (name, email, phone, message) VALUES (?,?,?,?)').run(name, email, phone, message);
  res.status(201).json({ ok: true });
});

pub.post('/newsletter', (req, res) => {
  const email = String((req.body && req.body.email) ?? '').trim().toLowerCase();
  if (!v.email(email)) throw new HttpError(400, 'Email không hợp lệ.', { email: 'Email không hợp lệ.' });
  db.prepare('INSERT OR IGNORE INTO subscribers (email) VALUES (?)').run(email);
  res.status(201).json({ ok: true }); // luôn trả 201 để không lộ email nào đã đăng ký
});

module.exports.public = pub;
