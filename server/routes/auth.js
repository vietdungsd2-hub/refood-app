const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { HttpError, v, normPhone } = require('../validate');
const { sign, publicUser, requireAuth } = require('../auth');

// Hash giả để so sánh khi không tìm thấy tài khoản (giảm lộ thông tin qua thời gian phản hồi)
const DUMMY_HASH = bcrypt.hashSync('khong-ton-tai', 10);

router.post('/register', async (req, res) => {
  const b = req.body || {};
  const name = String(b.name ?? '').trim();
  const email = String(b.email ?? '').trim().toLowerCase();
  const phone = normPhone(b.phone);
  const password = String(b.password ?? '');
  const role = b.type === 'restaurant' ? 'restaurant' : 'user';
  const restaurant = String(b.restaurant ?? '').trim();

  const errors = {};
  if (!v.text(name, 2, 80)) errors.name = 'Họ và tên từ 2 đến 80 ký tự.';
  if (!v.email(email)) errors.email = 'Email không hợp lệ.';
  if (phone && !v.phone(phone)) errors.phone = 'Số điện thoại không hợp lệ.';
  if (password.length < 8 || Buffer.byteLength(password) > 72) errors.password = 'Mật khẩu phải từ 8 ký tự (tối đa 72 byte).';
  if (b.confirm !== undefined && String(b.confirm) !== password) errors.confirm = 'Mật khẩu xác nhận không khớp.';
  if (role === 'restaurant' && !v.text(restaurant, 2, 100)) errors.restaurant = 'Vui lòng nhập tên nhà hàng / quán ăn.';
  if (Object.keys(errors).length) throw new HttpError(400, 'Dữ liệu không hợp lệ.', errors);

  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email))
    throw new HttpError(409, 'Email này đã được đăng ký.', { email: 'Email này đã được đăng ký.' });
  if (phone && db.prepare('SELECT 1 FROM users WHERE phone = ?').get(phone))
    throw new HttpError(409, 'Số điện thoại này đã được đăng ký.', { phone: 'Số điện thoại này đã được đăng ký.' });

  const hash = await bcrypt.hash(password, 10);
  const info = db.prepare(
    'INSERT INTO users (role, name, email, phone, password_hash, restaurant_name) VALUES (?,?,?,?,?,?)'
  ).run(role, name, email, phone, hash, role === 'restaurant' ? restaurant : null);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ token: sign(user), user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const b = req.body || {};
  const id = String(b.user ?? b.email ?? '').trim();
  const password = String(b.password ?? '');
  if (!id || !password) throw new HttpError(400, 'Vui lòng nhập tài khoản và mật khẩu.');

  const row = db.prepare('SELECT * FROM users WHERE email = ? OR phone = ?').get(id.toLowerCase(), id.replace(/\s/g, ''));
  const ok = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);
  if (!row || !ok) throw new HttpError(401, 'Email/số điện thoại hoặc mật khẩu không đúng.');
  res.json({ token: sign(row), user: publicUser(row) });
});

router.get('/me', requireAuth(), (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = router;
