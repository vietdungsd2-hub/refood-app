const router = require('express').Router();
const db = require('../db');
const { HttpError, v } = require('../validate');
const { requireAuth } = require('../auth');
const { saleStatus } = require('../sale');

const orderRow = `SELECT o.id, o.quantity, o.total, o.status, o.created_at,
  b.id AS bag_id, b.restaurant, b.address, b.name AS bag_name, b.type, b.pickup_from, b.pickup_to`;

const toDTO = (r) => ({
  id: r.id, quantity: r.quantity, total: r.total, status: r.status, createdAt: r.created_at,
  bag: { id: r.bag_id, restaurant: r.restaurant, address: r.address, name: r.bag_name, type: r.type, pickup: `${r.pickup_from} – ${r.pickup_to}` },
  ...(r.customer ? { customer: { name: r.customer, phone: r.customer_phone || null } } : {}),
});

/** Đặt giữ túi. Trừ số lượng nguyên tử trong một transaction để không bán vượt số túi. */
const reserve = db.transaction((userId, bagId, qty) => {
  const bag = db.prepare('SELECT * FROM bags WHERE id = ? AND active = 1').get(bagId);
  if (!bag) throw new HttpError(404, 'Không tìm thấy túi mù.');
  // Mặc định chỉ hiển thị giờ mở bán (bản demo). Đặt ENFORCE_SALE_WINDOW=1 để chặn đặt ngoài giờ.
  if (process.env.ENFORCE_SALE_WINDOW === '1') {
    const st = saleStatus(bag.sale_from, bag.sale_to);
    if (st === 'upcoming') throw new HttpError(409, `Túi này sẽ mở bán lúc ${bag.sale_from}.`);
    if (st === 'closed') throw new HttpError(409, 'Túi này đã hết giờ mở bán hôm nay.');
  }
  if (bag.owner_id === userId) throw new HttpError(400, 'Bạn không thể đặt túi của chính quán mình.');
  const upd = db.prepare('UPDATE bags SET quantity = quantity - ? WHERE id = ? AND quantity >= ?').run(qty, bagId, qty);
  if (!upd.changes) throw new HttpError(409, 'Rất tiếc, túi này đã hết hoặc không đủ số lượng.');
  const info = db.prepare('INSERT INTO orders (user_id, bag_id, quantity, total) VALUES (?,?,?,?)').run(userId, bagId, qty, bag.price * qty);
  const left = db.prepare('SELECT quantity FROM bags WHERE id = ?').get(bagId).quantity;
  return { orderId: info.lastInsertRowid, left, bag };
});

router.post('/', requireAuth(), (req, res) => {
  const bagId = Number(req.body && req.body.bagId);
  const qty = req.body && req.body.quantity !== undefined ? req.body.quantity : 1;
  if (!Number.isInteger(bagId) || bagId < 1) throw new HttpError(400, 'Mã túi không hợp lệ.');
  if (!v.int(qty, 1, 3)) throw new HttpError(400, 'Mỗi lần đặt tối đa 3 túi.');
  const r = reserve(req.user.id, bagId, qty);
  const row = db.prepare(`${orderRow} FROM orders o JOIN bags b ON b.id = o.bag_id WHERE o.id = ?`).get(r.orderId);
  res.status(201).json({ order: toDTO(row), left: r.left });
});

router.get('/me', requireAuth(), (req, res) => {
  const rows = db.prepare(`${orderRow} FROM orders o JOIN bags b ON b.id = o.bag_id WHERE o.user_id = ? ORDER BY o.id DESC LIMIT 100`).all(req.user.id);
  res.json({ orders: rows.map(toDTO) });
});

const cancel = db.transaction((userId, orderId) => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, userId);
  if (!o) throw new HttpError(404, 'Không tìm thấy đơn đặt.');
  if (o.status !== 'reserved') throw new HttpError(409, 'Chỉ có thể huỷ đơn đang giữ chỗ.');
  db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(orderId);
  db.prepare('UPDATE bags SET quantity = quantity + ? WHERE id = ?').run(o.quantity, o.bag_id);
});

router.post('/:id/cancel', requireAuth(), (req, res) => {
  cancel(req.user.id, Number(req.params.id));
  res.json({ ok: true });
});

/** Đơn khách đặt tại các túi của nhà hàng. */
router.get('/restaurant', requireAuth('restaurant'), (req, res) => {
  const rows = db.prepare(`${orderRow}, u.name AS customer, u.phone AS customer_phone
    FROM orders o JOIN bags b ON b.id = o.bag_id JOIN users u ON u.id = o.user_id
    WHERE b.owner_id = ? ORDER BY o.id DESC LIMIT 100`).all(req.user.id);
  res.json({ orders: rows.map(toDTO) });
});

router.post('/:id/complete', requireAuth('restaurant'), (req, res) => {
  const info = db.prepare(`UPDATE orders SET status = 'completed'
    WHERE id = ? AND status = 'reserved' AND bag_id IN (SELECT id FROM bags WHERE owner_id = ?)`).run(Number(req.params.id), req.user.id);
  if (!info.changes) throw new HttpError(404, 'Không tìm thấy đơn đang giữ chỗ của quán bạn.');
  res.json({ ok: true });
});

module.exports = router;
