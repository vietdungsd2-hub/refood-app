// Dùng SQLite có sẵn trong Node (node:sqlite, Node >= 22.5) nên không cần biên dịch gì khi npm install.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const file = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'refood.db');
if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });

const raw = new DatabaseSync(file);
raw.exec('PRAGMA journal_mode = WAL');
raw.exec('PRAGMA foreign_keys = ON');

/** Lớp mỏng cho giống API quen thuộc: prepare().run/get/all với tham số @tên, và transaction(). */
function wrapStatement(sql) {
  const st = raw.prepare(sql);
  const names = new Set((sql.match(/@\w+/g) || []).map((n) => n.slice(1)));
  const fit = (args) => {
    if (args.length === 1 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
      const o = {};
      for (const k of names) o[k] = args[0][k] === undefined ? null : args[0][k];
      return [o];
    }
    return args;
  };
  return {
    run: (...a) => st.run(...fit(a)),
    get: (...a) => st.get(...fit(a)),
    all: (...a) => st.all(...fit(a)),
  };
}

const db = {
  exec: (sql) => raw.exec(sql),
  prepare: wrapStatement,
  /** Trả về hàm chạy trong một transaction (BEGIN IMMEDIATE khoá ghi ngay, nên không bán vượt). */
  transaction(fn) {
    return (...args) => {
      raw.exec('BEGIN IMMEDIATE');
      try {
        const r = fn(...args);
        raw.exec('COMMIT');
        return r;
      } catch (e) {
        try { raw.exec('ROLLBACK'); } catch (_) { /* đã rollback */ }
        throw e;
      }
    };
  },
};

raw.exec(`
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  role            TEXT    NOT NULL DEFAULT 'user' CHECK (role IN ('user','restaurant')),
  name            TEXT    NOT NULL,
  email           TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  phone           TEXT,
  password_hash   TEXT    NOT NULL,
  restaurant_name TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_phone ON users(phone) WHERE phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS bags (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  restaurant  TEXT    NOT NULL,
  address     TEXT    NOT NULL,
  type        TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  tag         TEXT,
  price       INTEGER NOT NULL CHECK (price >= 0),
  value       INTEGER NOT NULL CHECK (value >= price),
  pickup_from TEXT    NOT NULL,
  pickup_to   TEXT    NOT NULL,
  quantity    INTEGER NOT NULL CHECK (quantity >= 0),
  image       TEXT,
  featured    INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_bags_type ON bags(type);

CREATE TABLE IF NOT EXISTS orders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bag_id     INTEGER NOT NULL REFERENCES bags(id)  ON DELETE CASCADE,
  quantity   INTEGER NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 3),
  total      INTEGER NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','cancelled','completed')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS ix_orders_bag  ON orders(bag_id);

CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bag_id  INTEGER NOT NULL REFERENCES bags(id)  ON DELETE CASCADE,
  PRIMARY KEY (user_id, bag_id)
);

CREATE TABLE IF NOT EXISTS contacts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT,
  message    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscribers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

/* ---- Migration: thêm cột mới cho CSDL cũ (an toàn khi chạy nhiều lần) ---- */
const NEW_BAG_COLUMNS = [
  ['province', 'TEXT'],     // Tỉnh / Thành phố
  ['district', 'TEXT'],     // Quận / Huyện
  ['map_url', 'TEXT'],      // Link Google Maps của quán
  ['shop_url', 'TEXT'],     // Website / trang riêng của quán
  ['sale_from', 'TEXT'],    // Giờ bắt đầu mở bán trên web (HH:MM, mỗi ngày)
  ['sale_to', 'TEXT'],      // Giờ kết thúc mở bán trên web
  ['shelf_note', 'TEXT'],   // Ghi chú hạn dùng (sắp bị huỷ nhưng vẫn dùng được)
];
const have = raw.prepare('PRAGMA table_info(bags)').all().map((c) => c.name);
for (const [name, type] of NEW_BAG_COLUMNS) {
  if (!have.includes(name)) raw.exec(`ALTER TABLE bags ADD COLUMN ${name} ${type}`); // tên cột từ danh sách cố định ở trên
}
raw.exec('CREATE INDEX IF NOT EXISTS ix_bags_area ON bags(province, district)');
// Túi cũ chưa có khu vực: suy ra từ địa chỉ dạng "số nhà, quận/huyện, tỉnh/thành"
for (const r of raw.prepare('SELECT id, address FROM bags WHERE province IS NULL').all()) {
  const parts = String(r.address).split(',').map((x) => x.trim()).filter(Boolean);
  const province = parts.length >= 3 ? parts[parts.length - 1] : 'Hà Nội';
  const district = parts.length >= 3 ? parts[parts.length - 2] : null;
  raw.prepare('UPDATE bags SET province = ?, district = ? WHERE id = ?').run(province, district, r.id);
}

module.exports = db;
