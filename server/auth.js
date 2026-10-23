const jwt = require('jsonwebtoken');
const db = require('./db');
const { HttpError } = require('./validate');

let SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 16) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET chưa được cấu hình (cần ít nhất 16 ký tự) khi chạy production.');
  }
  SECRET = 'dev-only-secret-khong-dung-khi-chay-that';
  console.warn('[cảnh báo] Đang dùng JWT_SECRET mặc định cho môi trường phát triển. Hãy đặt JWT_SECRET trong .env.');
}

const publicUser = (u) => ({
  id: u.id, role: u.role, name: u.name, email: u.email,
  phone: u.phone || null, restaurant: u.restaurant_name || null,
});

const sign = (u) => jwt.sign({ sub: u.id, role: u.role }, SECRET, { algorithm: 'HS256', expiresIn: '7d' });

function readUser(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  try {
    const p = jwt.verify(m[1], SECRET, { algorithms: ['HS256'] });
    return db.prepare('SELECT * FROM users WHERE id = ?').get(p.sub) || null;
  } catch (e) {
    return null;
  }
}

/** Gắn req.user nếu có token hợp lệ, nếu không vẫn cho qua. */
function optionalAuth(req, res, next) {
  req.user = readUser(req);
  next();
}

/** Bắt buộc đăng nhập (và tuỳ chọn vai trò). */
const requireAuth = (role) => (req, res, next) => {
  const u = readUser(req);
  if (!u) return next(new HttpError(401, 'Vui lòng đăng nhập để tiếp tục.'));
  if (role && u.role !== role) return next(new HttpError(403, 'Bạn không có quyền thực hiện thao tác này.'));
  req.user = u;
  next();
};

module.exports = { sign, publicUser, optionalAuth, requireAuth };
