/** Giờ mở bán theo giờ Việt Nam (UTC+7), lặp lại mỗi ngày. */
const toMin = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; };

function vnNowMin(d = new Date()) {
  const t = new Date(d.getTime() + 7 * 3600 * 1000);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
}

/** 'open' (đang mở bán), 'upcoming' (sắp mở), 'closed' (đã đóng hôm nay). Không đặt giờ thì luôn 'open'. */
function saleStatus(from, to, nowMin = vnNowMin()) {
  if (!from || !to) return 'open';
  if (nowMin < toMin(from)) return 'upcoming';
  if (nowMin >= toMin(to)) return 'closed';
  return 'open';
}

const mapsSearchUrl = (restaurant, address) =>
  'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${restaurant}, ${address}`);

module.exports = { saleStatus, vnNowMin, mapsSearchUrl };
