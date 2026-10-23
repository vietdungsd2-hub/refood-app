# ReFood.vn – Túi mù từ cửa hàng 

Website (frontend + backend) kết nối nhà hàng với người dùng qua **túi mù**.

- Backend: Node.js, Express 5, SQLite có sẵn trong Node (`node:sqlite`, cần Node 22.5 trở lên, không phải biên dịch), JWT, bcrypt, helmet, rate limit
- Frontend: HTML/CSS/JS thuần trong thư mục `public/` (do chính server phục vụ)

## Chạy dự án

```bash
npm install
cp .env.example .env      # rồi sửa JWT_SECRET thành chuỗi ngẫu nhiên dài
npm start                 # mở http://localhost:3000
```

Lần chạy đầu tiên, server tự tạo file `data/refood.db` và nạp 6 túi mù mẫu.
Nạp lại dữ liệu mẫu: `npm run seed`. Chạy kiểm thử API: `npm test`.

> Đừng mở file `.html` trực tiếp từ ổ đĩa (file://). Hãy truy cập qua `http://localhost:3000`
> để trang gọi được API.

## Tính năng

| Nhóm | Chức năng |
|---|---|
| Tài khoản | Đăng ký (người mua / chủ nhà hàng), đăng nhập bằng email hoặc số điện thoại, JWT 7 ngày |
| Túi mù | Danh sách + lọc theo **khu vực (tỉnh/thành → quận/huyện)**, lĩnh vực túi, giá, còn hàng, tìm kiếm, sắp xếp ngay trên server. Mỗi túi có link Google Maps của quán, giờ mở bán, hạn dùng |
| Đặt túi | Giữ chỗ (tối đa 3 túi/lần), trừ số lượng nguyên tử, không bán vượt, huỷ đơn thì hoàn túi |
| Nhà hàng | Đăng túi mới (khu vực, link Maps, trang riêng, khung giờ mở bán, hạn dùng), sửa số túi, ẩn/hiện túi, xem đơn khách đặt và đánh dấu đã giao |
| Khác | Yêu thích, liên hệ, đăng ký nhận tin, danh sách nhà hàng |

## API

Tất cả đường dẫn bắt đầu bằng `/api`. Gửi JSON; endpoint cần đăng nhập dùng header `Authorization: Bearer <token>`.

| Method | Đường dẫn | Quyền | Mô tả |
|---|---|---|---|
| POST | `/auth/register` | công khai | `{name, email, phone?, password, confirm?, type?: "restaurant", restaurant?}` |
| POST | `/auth/login` | công khai | `{user, password}` (`user` là email hoặc số điện thoại) |
| GET | `/auth/me` | đăng nhập | Thông tin tài khoản |
| GET | `/bags` | công khai | Query: `q, province, district, type, price=low\|mid\|high, available=1, featured=1, sort=time\|price\|discount, limit` |
| GET | `/bags/types` | công khai | Các lĩnh vực túi (bánh, sữa, gia vị…) |
| GET | `/bags/areas` | công khai | Khu vực đang có túi: `[{province, districts}]` |
| GET | `/bags/:id` | công khai | Chi tiết một túi |
| GET | `/bags/mine` | nhà hàng | Túi của quán (kể cả đã ẩn) |
| POST | `/bags` | nhà hàng | Đăng túi mới |
| PATCH | `/bags/:id` | nhà hàng (chủ túi) | Sửa giá, số lượng, giờ nhận, `active`… |
| DELETE | `/bags/:id` | nhà hàng (chủ túi) | Ẩn túi |
| POST | `/orders` | đăng nhập | `{bagId, quantity?}` đặt giữ chỗ |
| GET | `/orders/me` | đăng nhập | Đơn của tôi |
| POST | `/orders/:id/cancel` | đăng nhập (chủ đơn) | Huỷ đơn, hoàn túi |
| GET | `/orders/restaurant` | nhà hàng | Đơn khách đặt tại quán |
| POST | `/orders/:id/complete` | nhà hàng | Đánh dấu đã giao |
| POST | `/favorites/:bagId/toggle` | đăng nhập | Bật/tắt yêu thích |
| GET | `/favorites` | đăng nhập | Danh sách mã túi yêu thích |
| GET | `/restaurants` | công khai | Nhà hàng + số túi còn |
| POST | `/contact` | công khai | `{name, email, phone?, msg}` |
| POST | `/newsletter` | công khai | `{email}` |

## Giờ mở bán

Mỗi túi có thể đặt khung giờ mở bán mỗi ngày (giờ Việt Nam). Trang web hiển thị "Sắp mở bán" / "Hết giờ hôm nay".
Mặc định chỉ hiển thị (phù hợp bản demo, ai cũng đặt thử được). Đặt `ENFORCE_SALE_WINDOW=1` trong `.env` để chặn đặt ngoài giờ.

## Bảo mật đã áp dụng

- Link Maps / trang quán do chủ quán nhập chỉ nhận `http(s)://` (chặn `javascript:`)
- Mật khẩu băm bằng bcrypt; thông báo đăng nhập sai không tiết lộ email có tồn tại hay không
- Mọi truy vấn SQL dùng tham số hoá (không nối chuỗi từ dữ liệu người dùng)
- Kiểm tra dữ liệu đầu vào ở server; giới hạn kích thước body (20 KB)
- Giới hạn tần suất: chung, riêng cho đăng nhập/đăng ký, riêng cho liên hệ/nhận tin
- `helmet` + Content-Security-Policy chặt (chỉ script từ chính site)
- Phân quyền theo vai trò và theo chủ sở hữu (chỉ sửa/xoá túi của mình, chỉ huỷ đơn của mình)
- Frontend luôn escape dữ liệu trước khi chèn vào HTML

## Lưu ý khi triển khai thật

- Đặt `NODE_ENV=production` và `JWT_SECRET` ngẫu nhiên dài (server từ chối chạy nếu thiếu)
- Chạy sau HTTPS; đặt `TRUST_PROXY=1` nếu có reverse proxy
- Token đang lưu trong `localStorage` cho đơn giản. Nếu cần chống XSS tốt hơn, chuyển sang cookie `HttpOnly` + CSRF token
- SQLite (node:sqlite còn đang ở mức thử nghiệm trong Node 22) phù hợp quy mô nhỏ/vừa; cần nhiều server thì chuyển sang PostgreSQL/MySQL
