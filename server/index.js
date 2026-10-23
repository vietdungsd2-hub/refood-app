require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { HttpError } = require('./validate');
const { seed } = require('./seed');

seed(); // nạp túi mù mẫu nếu bảng còn trống

const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:'],
      'connect-src': ["'self'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
    },
  },
}));
app.use(express.json({ limit: '20kb' }));

// Giới hạn tần suất
const limiter = (windowMs, limit, message) =>
  rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: message } });
app.use('/api', limiter(60 * 1000, 120, 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.'));
app.use('/api/auth', limiter(15 * 60 * 1000, 20, 'Quá nhiều lần thử đăng nhập/đăng ký, vui lòng thử lại sau 15 phút.'));
app.use(['/api/contact', '/api/newsletter'], limiter(60 * 60 * 1000, 20, 'Bạn đã gửi quá nhiều lần, vui lòng thử lại sau.'));

// API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/bags', require('./routes/bags'));
app.use('/api/orders', require('./routes/orders'));
const misc = require('./routes/misc');
app.use('/api/favorites', misc);
app.use('/api', misc.public);
app.use('/api', (req, res) => res.status(404).json({ error: 'Không tìm thấy API.' }));

// Frontend tĩnh
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

// Xử lý lỗi tập trung
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, errors: err.errors || undefined });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON không hợp lệ.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Dữ liệu gửi lên quá lớn.' });
  console.error(err);
  res.status(500).json({ error: 'Lỗi máy chủ, vui lòng thử lại sau.' });
});

module.exports = app;

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`ReFood chạy tại http://localhost:${port}`));
}
