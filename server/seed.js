const db = require('./db');

// Lấy danh sách tên cột thực tế trong bảng bags
const columnsInfo = db.prepare("PRAGMA table_info(bags)").all();
const existingCols = columnsInfo.map(c => c.name);

// Tên cột lưu số lượng (kiểm tra qty, left, quantity hoặc stock)
const qtyCol = ['qty', 'left', 'quantity', 'stock'].find(c => existingCols.includes(c));

const rawBags = [
  { restaurant: 'Tiệm Bánh Artisan ABC', address: '25 Hàng Bài, Hoàn Kiếm, Hà Nội', province: 'Hà Nội', district: 'Hoàn Kiếm', type: 'Túi bánh', name: 'Bánh mì & croissant', tag: 'Nướng mới mỗi chiều', shelf_note: 'Hạn dùng: Trong ngày', sale_from: '19:30', sale_to: '20:30', pickup_from: '19:30', pickup_to: '20:30', price: 32000, value: 95000, count: 9, image: 'images/bag-bread.jpg', featured: 1 },
  { restaurant: 'Sakura House', address: '18 Tô Hiến Thành, Hai Bà Trưng, Hà Nội', province: 'Hà Nội', district: 'Hai Bà Trưng', type: 'Túi sushi', name: 'Hộp sushi tổng hợp', tag: 'Tươi ngon trong ngày', shelf_note: 'Hạn dùng: Trong ngày', sale_from: '20:00', sale_to: '21:00', pickup_from: '20:00', pickup_to: '21:00', price: 45000, value: 120000, count: 3, image: 'images/bag-sushi.jpg', featured: 1 },
  { restaurant: 'Vườn Xanh Organic', address: '112 Xuân Thủy, Cầu Giấy, Hà Nội', province: 'Hà Nội', district: 'Cầu Giấy', type: 'Túi rau củ', name: 'Rau củ hữu cơ hỗn hợp', tag: 'Hữu cơ - An toàn', shelf_note: 'Hạn dùng: 3 ngày', sale_from: '17:30', sale_to: '18:30', pickup_from: '17:30', pickup_to: '18:30', price: 38000, value: 100000, count: 0, image: 'images/bag-veg.jpg', featured: 0 },
  { restaurant: 'Tuấn Cường mina Milk', address: '105 Nguyễn Trãi, Thanh Xuân, Hà Nội', province: 'Hà Nội', district: 'Thanh Xuân', type: 'Túi sữa', name: 'Sữa tươi thanh trùng & yoghurt', tag: 'Sữa tươi trong ngày', shelf_note: 'Hạn dùng: Trong ngày', sale_from: '18:30', sale_to: '19:30', pickup_from: '18:30', pickup_to: '19:30', price: 25000, value: 70000, count: 4, image: 'images/bag-milk.jpg', featured: 0 },
  { restaurant: 'AnAn Candy Shop', address: '42 Hàng Bạc, Hoàn Kiếm, Hà Nội', province: 'Hà Nội', district: 'Hoàn Kiếm', type: 'Túi kẹo', name: 'Kẹo dẻo trái cây & marshmallow', tag: 'Kẹo handmade', shelf_note: 'Hạn dùng: 30 ngày', sale_from: '19:00', sale_to: '20:30', pickup_from: '19:00', pickup_to: '20:30', price: 20000, value: 60000, count: 6, image: 'images/bag-candy.jpg', featured: 0 }
];

const BAGS = rawBags.map(item => {
  const { count, ...rest } = item;
  if (qtyCol) rest[qtyCol] = count;
  return rest;
});

function seed({ reset = false } = {}) {
  if (reset) db.prepare('DELETE FROM bags WHERE owner_id IS NULL').run();
  const has = db.prepare('SELECT COUNT(*) AS n FROM bags').get().n;
  if (has > 0) return 0;

  // Lấy các field trùng khớp với cột trong DB
  const sample = BAGS[0];
  const fields = Object.keys(sample).filter(f => existingCols.includes(f));
  
  const colsStr = fields.join(', ');
  const valsStr = fields.map(f => `@${f}`).join(', ');

  const ins = db.prepare(`INSERT INTO bags (${colsStr}) VALUES (${valsStr})`);
  db.transaction(() => BAGS.forEach((b) => ins.run(b)))();
  return BAGS.length;
}

module.exports = { seed };

if (require.main === module) {
  require('dotenv').config();
  const reset = process.argv.includes('--reset');
  const n = seed({ reset });
  console.log(n ? `Đã nạp ${n} túi mù mẫu.` : 'Cơ sở dữ liệu đã có túi mù, bỏ qua (dùng --reset để nạp lại).');
}