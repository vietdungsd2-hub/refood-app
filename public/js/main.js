(function () {
  'use strict';

  /* ---------- icons ---------- */
  var P = {
    home: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>',
    bag: '<path d="M6 7h12l1 13H5L6 7zM9 7a3 3 0 016 0"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    mail: '<path d="M3 6h18v12H3zM3 7l9 7 9-7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    pin: '<path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    heart: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 018-2.5A4.5 4.5 0 0120 9c0 6-8 11-8 11z"/>',
    leaf: '<path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15zM5 19l8-8"/>',
    recycle: '<path d="M7 19l-3-5h4M17 5l3 5h-4M9 5h6l2 3M15 19H9l-2-3"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6M16 5a3 3 0 010 6M21 20c0-3-2-5-4-5.5"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    ticket: '<path d="M3 9a2 2 0 002-2h14a2 2 0 002 2v6a2 2 0 00-2 2H5a2 2 0 00-2-2zM10 7v10"/>'
  };
  function ico(n) { return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">' + (P[n] || '') + '</svg>'; }

  /* ---------- helpers ---------- */
  function fmt(n) { return Number(n).toLocaleString('vi-VN') + 'đ'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  /* chỉ cho phép link http(s) trong href */
  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : '#'; }
  function toast(msg) {
    var t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 3400);
  }

  /* ---------- phiên đăng nhập + gọi API ---------- */
  var TOKEN_KEY = 'refood_token', USER_KEY = 'refood_user';
  function getToken() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
  function getUser() { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch (e) { return null; } }
  function saveAuth(t, u) { try { localStorage.setItem(TOKEN_KEY, t); localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch (e) {} }
  function clearAuth() { try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch (e) {} }

  function api(path, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    var token = getToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetch('/api' + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) {
          var e = new Error(d.error || 'Có lỗi xảy ra, vui lòng thử lại.');
          e.status = r.status; e.errors = d.errors;
          if (r.status === 401 && token) clearAuth();
          throw e;
        }
        return d;
      });
    }, function () {
      throw new Error('Không kết nối được máy chủ. Hãy chạy "npm start" rồi mở http://localhost:3000');
    });
  }

  function currentPage() {
    var p = location.pathname.split('/').pop() || 'index.html';
    return /\.html$/.test(p) ? p : p + '.html';
  }
  function goLogin() {
    location.href = 'dang-nhap.html?next=' + encodeURIComponent(currentPage());
  }
  /* chỉ cho phép chuyển hướng tới trang .html cùng thư mục */
  function safeNext() {
    var n = new URLSearchParams(location.search).get('next');
    return n && /^[a-z0-9-]+\.html$/i.test(n) ? n : null;
  }

  /* ---------- header / footer ---------- */
  var NAV = [
    ['index.html', 'Trang chủ', 'home', 'home'],
    ['tui-mu.html', 'Túi mù từ cửa hàng', 'bag', 'bag'],
    ['gioi-thieu.html', 'Giới thiệu', 'info', 'about'],
    ['lien-he.html', 'Liên hệ', 'mail', 'contact']
  ];
  function header() {
    var page = document.body.getAttribute('data-page');
    var links = NAV.map(function (n) {
      return '<a href="' + n[0] + '"' + (n[3] === page ? ' class="active"' : '') + '>' + ico(n[2]) + n[1] + '</a>';
    }).join('');
    var q = new URLSearchParams(location.search).get('q') || '';
    var u = getToken() && getUser();
    var auth = u ?
      '<a class="btn btn-outline btn-sm user-chip" href="tai-khoan.html" title="Tài khoản của tôi">' + esc(u.name) + '</a><button class="btn btn-solid btn-sm" id="logout" type="button">Đăng xuất</button>' :
      '<a class="btn btn-outline btn-sm" href="dang-nhap.html">Đăng nhập</a><a class="btn btn-solid btn-sm" href="dang-ky.html">Đăng ký</a>';
    return '<header class="site-header"><div class="nav-wrap">' +
      '<a class="brand" href="index.html" aria-label="ReFood.vn – Trang chủ"><img src="images/logo-wordmark.png" alt="ReFood"></a>' +
      '<button class="nav-toggle" aria-label="Mở menu" type="button">☰</button>' +
      '<nav class="main-nav" aria-label="Menu chính">' + links + '</nav>' +
      '<form class="nav-search" action="tui-mu.html">' + ico('search') + '<input name="q" value="' + esc(q) + '" placeholder="Tìm túi mù, cửa hàng…" aria-label="Tìm kiếm"></form>' +
      '<div class="nav-auth">' + auth + '</div>' +
      '</div></header>';
  }
  function footer(withNewsletter) {
    var nl = withNewsletter ?
      '<section class="newsletter"><div class="container">' +
      '<div class="nl-left"><span class="nl-ico">' + ico('mail') + '</span><div><h3>Đăng ký nhận tin</h3><p>Nhận ngay thông tin món ngon, ưu đãi hấp dẫn và các hoạt động cộng đồng từ ReFood.</p></div></div>' +
      '<form class="nl-form" id="nlForm">' + ico('mail') + '<input type="email" name="email" required placeholder="Nhập email của bạn" aria-label="Email"><button type="submit">Đăng ký</button></form>' +
      '<div class="socials"><a href="#" aria-label="Facebook">f</a><a href="#" aria-label="Instagram">ig</a><a href="#" aria-label="YouTube">▶</a><a href="#" aria-label="Chat">✉</a></div>' +
      '<span class="script nl-tag">Cùng nhau<br>vì một hành tinh xanh</span></div></section>' : '';
    return nl + '<footer class="site-footer' + (withNewsletter ? '' : ' solo') + '"><div class="container"><div class="foot-grid">' +
      '<div><div class="foot-brand"><img src="images/logo-wordmark.png" alt="ReFood.vn"></div><p style="margin-top:10px;font-size:13.5px">Kết nối nhà hàng với cộng đồng để giải cứu thực phẩm dư mỗi ngày bằng những túi mù giá tốt.</p></div>' +
      '<div><h4>Về chúng tôi</h4><ul><li><a href="gioi-thieu.html">Giới thiệu</a></li><li><a href="tui-mu.html">Túi mù từ cửa hàng</a></li><li><a href="dang-ky.html?type=restaurant">Đăng ký quán ăn</a></li><li><a href="lien-he.html">Hỗ trợ</a></li></ul></div>' +
      '<div><h4>Liên hệ</h4><ul><li>' + ico('phone') + ' (+84) 123 456 789</li><li>' + ico('mail') + ' support@refood.vn</li><li>' + ico('pin') + ' Hà Nội, Việt Nam</li></ul></div>' +
      '<div><h4>Kết nối với chúng tôi</h4><div class="socials"><a href="#" aria-label="Facebook">f</a><a href="#" aria-label="Instagram">ig</a><a href="#" aria-label="YouTube">▶</a></div></div>' +
      '</div><p class="copy">© 2026 ReFood.vn. Tất cả quyền được bảo lưu.</p></div></footer>';
  }
  function mountChrome() {
    var h = document.getElementById('site-header'), f = document.getElementById('site-footer');
    if (h) { h.outerHTML = header(); }
    if (f) { f.outerHTML = footer(f.hasAttribute('data-newsletter')); }
    var hd = document.querySelector('.site-header'), tg = document.querySelector('.nav-toggle');
    if (tg && hd) tg.addEventListener('click', function () { hd.classList.toggle('open'); });
    var lo = document.getElementById('logout');
    if (lo) lo.addEventListener('click', function () { clearAuth(); location.href = 'index.html'; });
    var nl = document.getElementById('nlForm');
    if (nl) nl.addEventListener('submit', function (e) {
      e.preventDefault();
      api('/newsletter', { method: 'POST', body: { email: nl.elements.email.value } })
        .then(function () { nl.reset(); toast('Cảm ơn bạn đã đăng ký nhận tin từ ReFood!'); })
        .catch(function (err) { toast(err.message); });
    });
  }

  /* ---------- thẻ túi mù ---------- */
  function saleLine(b) {
    if (!b.sale) return '';
    var tag = b.saleStatus === 'upcoming' ? ' <em class="tag-up">Sắp mở bán</em>' : b.saleStatus === 'closed' ? ' <em class="tag-closed">Hết giờ hôm nay</em>' : '';
    return '<li>' + ico('ticket') + '<span>Mở bán: ' + esc(b.sale) + tag + '</span></li>';
  }
  function card(b, h) {
    var left = b.left;
    var badge = left === 0 ? '<span class="badge out">Hết túi</span>' :
      left <= 3 ? '<span class="badge warn">Sắp hết</span>' : '<span class="badge">Giảm ' + b.discount + '%</span>';
    return '<article class="bag-card' + (h ? ' h' : '') + '" data-id="' + b.id + '">' +
      '<div class="bag-img"><img src="' + esc(b.image) + '" alt="' + esc(b.name) + '" loading="lazy">' + badge +
      '<button class="fav' + (b.favorite ? ' on' : '') + '" type="button" aria-label="Yêu thích">' + ico('heart') + '</button></div>' +
      '<div class="bag-body">' +
      '<p class="bag-rest">' + esc(b.restaurant) + '</p>' +
      (b.area ? '<span class="bag-area">' + ico('pin') + esc(b.area) + '</span>' : '') +
      '<p class="bag-addr">' + ico('pin') + '<span><a href="' + esc(safeUrl(b.mapUrl)) + '" target="_blank" rel="noopener noreferrer" title="Xem trên Google Maps">' + esc(b.address) + '</a></span></p>' +
      '<h3>' + esc(b.name) + '</h3>' +
      '<div class="chips"><span class="chip">' + esc(b.type) + '</span>' + (b.tag ? '<span class="chip alt">' + esc(b.tag) + '</span>' : '') + '</div>' +
      (b.shelfNote ? '<p class="shelf">Hạn dùng: ' + esc(b.shelfNote) + '</p>' : '') +
      '<div class="price"><span class="now">' + fmt(b.price) + '</span><span class="was">Giá trị ban đầu <s>' + fmt(b.value) + '</s></span></div>' +
      '<ul class="meta">' + saleLine(b) + '<li>' + ico('clock') + 'Giờ nhận: ' + esc(b.pickup) + '</li>' +
      '<li>' + ico('bag') + (left === 0 ? '<span>Đã hết túi</span>' : '<span class="' + (left <= 3 ? 'low' : '') + '">Còn ' + left + ' túi</span>') + '</li></ul>' +
      '<div class="bag-links"><a href="' + esc(safeUrl(b.mapUrl)) + '" target="_blank" rel="noopener noreferrer">Chỉ đường (Google Maps)</a>' +
      (b.shopUrl ? '<a href="' + esc(safeUrl(b.shopUrl)) + '" target="_blank" rel="noopener noreferrer">Trang của quán</a>' : '') + '</div>' +
      '<button class="btn btn-orange reserve" type="button"' + (left === 0 ? ' disabled' : '') + '>' + (left === 0 ? 'Đã hết túi' : 'Đặt túi') + '</button>' +
      '</div></article>';
  }
  function bindCards(root, bags, rerender) {
    root.addEventListener('click', function (e) {
      var el = e.target.closest('.bag-card'); if (!el) return;
      var id = Number(el.getAttribute('data-id'));
      var b = bags().filter(function (x) { return x.id === id; })[0]; if (!b) return;

      if (e.target.closest('.fav')) {
        if (!getToken()) { toast('Hãy đăng nhập để lưu túi yêu thích.'); setTimeout(goLogin, 1100); return; }
        api('/favorites/' + id + '/toggle', { method: 'POST' }).then(rerender).catch(function (err) {
          toast(err.message); if (err.status === 401) setTimeout(goLogin, 1100);
        });
        return;
      }
      if (e.target.closest('.reserve')) {
        if (!getToken()) { toast('Hãy đăng nhập để đặt túi mù.'); setTimeout(goLogin, 1100); return; }
        api('/orders', { method: 'POST', body: { bagId: id, quantity: 1 } }).then(function (r) {
          toast('Đã giữ 1 túi tại ' + r.order.bag.restaurant + '. Nhận lúc ' + r.order.bag.pickup + '.');
          rerender();
        }).catch(function (err) {
          toast(err.message);
          if (err.status === 401) setTimeout(goLogin, 1100); else rerender();
        });
      }
    });
  }
  function errBox(msg) { return '<div class="empty" style="grid-column:1/-1">' + esc(msg) + '</div>'; }

  /* ---------- trang chủ ---------- */
  function initHome() {
    var grid = document.getElementById('homeBags'), pl = document.getElementById('partners');
    var bags = [];
    function load() {
      api('/bags?featured=1&limit=4').then(function (d) {
        bags = d.bags;
        grid.innerHTML = bags.length ? bags.map(function (b) { return card(b, true); }).join('') : errBox('Chưa có túi mù nào.');
      }).catch(function (e) { grid.innerHTML = errBox(e.message); });
      api('/restaurants').then(function (d) {
        pl.innerHTML = d.restaurants.map(function (r) {
          return '<div class="partner"><h3>' + esc(r.name) + '</h3>' + (r.area ? '<p class="area">' + ico('pin') + '<span>' + esc(r.area) + '</span></p>' : '') + '<p>' + ico('pin') + '<span><a class="map" href="' + esc(safeUrl(r.mapUrl)) + '" target="_blank" rel="noopener noreferrer">' + esc(r.address) + '</a></span></p>' +
            '<p>' + ico('clock') + '<span>Nhận từ ' + esc(r.firstPickup) + '</span></p>' +
            '<p>' + ico('bag') + '<span>' + r.bags + ' loại túi · còn ' + r.left + ' túi</span></p>' +
            '<a class="link" href="tui-mu.html?q=' + encodeURIComponent(r.name) + '">Xem túi mù →</a></div>';
        }).join('');
      }).catch(function () { pl.innerHTML = ''; });
    }
    bindCards(grid, function () { return bags; }, load);
    load();
  }

  /* ---------- trang Túi mù ---------- */
  function initShop() {
    var grid = document.getElementById('bagGrid');
    var qEl = document.getElementById('fq'), sortEl = document.getElementById('fsort'), cnt = document.getElementById('fcount');
    var provEl = document.getElementById('fprov'), distEl = document.getElementById('fdist');
    var params = new URLSearchParams(location.search);
    qEl.value = params.get('q') || '';
    var areas = [], bags = [], seq = 0, timer;

    function checked() {
      return [].slice.call(document.querySelectorAll('input[name=type]:checked')).map(function (i) { return i.value; });
    }
    function fillDistricts() {
      var a = areas.filter(function (x) { return x.province === provEl.value; })[0];
      distEl.innerHTML = '<option value="">Tất cả</option>' + (a ? a.districts.map(function (d) { return '<option>' + esc(d) + '</option>'; }).join('') : '');
      distEl.disabled = !a;
    }
    function draw() {
      var ts = checked();
      var pr = (document.querySelector('input[name=price]:checked') || {}).value || 'all';
      var qs = new URLSearchParams();
      if (qEl.value.trim()) qs.set('q', qEl.value.trim());
      if (provEl.value) qs.set('province', provEl.value);
      if (distEl.value) qs.set('district', distEl.value);
      if (ts.length) qs.set('type', ts.join(','));
      if (pr !== 'all') qs.set('price', pr);
      if (document.getElementById('fonly').checked) qs.set('available', '1');
      qs.set('sort', sortEl.value);
      var my = ++seq;
      api('/bags?' + qs.toString()).then(function (d) {
        if (my !== seq) return; // bỏ kết quả của yêu cầu cũ
        bags = d.bags;
        cnt.textContent = 'Hiển thị ' + d.count + ' túi mù';
        grid.innerHTML = d.count ? bags.map(function (b) { return card(b); }).join('') : errBox('Không tìm thấy túi mù phù hợp. Hãy thử đổi bộ lọc nhé!');
      }).catch(function (e) {
        if (my !== seq) return;
        cnt.textContent = '';
        grid.innerHTML = errBox(e.message);
      });
    }

    api('/bags/areas').then(function (d) {
      areas = d.areas;
      provEl.innerHTML = '<option value="">Tất cả</option>' + areas.map(function (a) { return '<option>' + esc(a.province) + '</option>'; }).join('');
      if (params.get('province')) { provEl.value = params.get('province'); fillDistricts(); if (params.get('district')) distEl.value = params.get('district'); draw(); }
    }).catch(function () {});
    api('/bags/types').then(function (d) {
      document.getElementById('typeFilters').innerHTML = d.types.map(function (t) {
        return '<label><input type="checkbox" name="type" value="' + esc(t) + '"> ' + esc(t) + '</label>';
      }).join('');
    }).catch(function () {});

    provEl.addEventListener('change', function () { fillDistricts(); });
    qEl.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(draw, 250); });
    document.querySelector('.shop').addEventListener('change', draw);
    qEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') e.preventDefault(); });
    document.getElementById('fform').addEventListener('submit', function (e) { e.preventDefault(); });
    bindCards(grid, function () { return bags; }, draw);
    draw();
  }

  /* ---------- form ---------- */
  function setErr(field, msg) {
    var f = field.closest('.field'); if (!f) return;
    var s = f.querySelector('.err'); if (s && msg) s.textContent = msg;
    f.classList.add('bad');
  }
  function validate(form) {
    var ok = true;
    var isReg = form.hasAttribute('data-register');
    [].forEach.call(form.querySelectorAll('.field'), function (f) {
      var i = f.querySelector('input,textarea,select'); if (!i) return;
      var bad = false, v = i.value.trim();
      if (i.required && !v) bad = true;
      if (v && i.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) bad = true;
      if (v && i.name === 'phone' && !/^(\+84|0)\d{9}$/.test(v.replace(/\s/g, ''))) bad = true;
      if (isReg && i.type === 'password' && i.name === 'password' && i.value.length < 8) bad = true;
      if (i.name === 'confirm') { var p = form.querySelector('[name=password]'); if (p && p.value !== i.value) bad = true; }
      f.classList.toggle('bad', bad); if (bad) ok = false;
    });
    return ok;
  }
  function collect(form) {
    var o = {};
    [].forEach.call(form.elements, function (el) {
      if (!el.name || el.type === 'submit' || el.type === 'button') return;
      o[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    });
    return o;
  }
  function initForms() {
    [].forEach.call(document.querySelectorAll('form[data-api]'), function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!validate(form)) { toast('Vui lòng kiểm tra lại các trường được đánh dấu.'); return; }
        var btn = form.querySelector('[type=submit]'); if (btn) btn.disabled = true;
        api(form.getAttribute('data-api'), { method: 'POST', body: collect(form) }).then(function (d) {
          if (form.hasAttribute('data-auth') && d.token) saveAuth(d.token, d.user);
          toast(form.getAttribute('data-msg') || 'Thành công!');
          if (form.hasAttribute('data-auth')) {
            setTimeout(function () { location.href = safeNext() || form.getAttribute('data-go') || 'index.html'; }, 900);
          } else { form.reset(); if (btn) btn.disabled = false; }
        }).catch(function (err) {
          if (btn) btn.disabled = false;
          if (err.errors) Object.keys(err.errors).forEach(function (k) {
            var el = form.querySelector('[name="' + k + '"]'); if (el) setErr(el, err.errors[k]);
          });
          toast(err.message);
        });
      });
    });
    var sel = document.getElementById('accType'), rn = document.getElementById('restName');
    if (sel && rn) {
      var sync = function () { rn.style.display = sel.value === 'restaurant' ? 'block' : 'none'; rn.querySelector('input').required = sel.value === 'restaurant'; };
      if (new URLSearchParams(location.search).get('type') === 'restaurant') sel.value = 'restaurant';
      sel.addEventListener('change', sync); sync();
    }
  }

  /* ---------- trang Tài khoản ---------- */
  var STATUS = { reserved: 'Đang giữ chỗ', cancelled: 'Đã huỷ', completed: 'Đã nhận' };
  function orderRow(o, shop) {
    var who = shop && o.customer ? '<span>Khách: ' + esc(o.customer.name) + (o.customer.phone ? ' · ' + esc(o.customer.phone) : '') + '</span>' : '';
    var btn = o.status !== 'reserved' ? '' : shop ?
      '<button class="btn btn-solid btn-sm" data-action="complete" data-id="' + o.id + '" type="button">Đã giao</button>' :
      '<button class="btn btn-outline btn-sm" data-action="cancel" data-id="' + o.id + '" type="button">Huỷ đơn</button>';
    return '<div class="row"><div><b>' + esc(o.bag.name) + '</b><span>' + esc(o.bag.restaurant) + ' · ' + esc(o.bag.address) + '</span>' + who +
      '<span>Nhận: ' + esc(o.bag.pickup) + ' · SL ' + o.quantity + ' · ' + fmt(o.total) + '</span></div>' +
      '<div class="side"><span class="status s-' + esc(o.status) + '">' + (STATUS[o.status] || esc(o.status)) + '</span>' + btn + '</div></div>';
  }
  function initAccount() {
    if (!getToken()) { goLogin(); return; }
    var $ = function (id) { return document.getElementById(id); };
    var user = null;

    function loadOrders() {
      api('/orders/me').then(function (d) {
        $('orders').innerHTML = d.orders.length ? d.orders.map(function (o) { return orderRow(o, false); }).join('') :
          '<p class="muted">Bạn chưa đặt túi nào. <a href="tui-mu.html"><b>Khám phá túi mù →</b></a></p>';
      }).catch(function (e) { $('orders').innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; });
    }
    function loadShop() {
      api('/bags/mine').then(function (d) {
        $('myBags').innerHTML = d.bags.length ? d.bags.map(function (b) {
          return '<div class="row"><div><b>' + esc(b.name) + '</b><span>' + esc(b.area) + ' · ' + esc(b.type) + ' · ' + fmt(b.price) + ' (giá trị ' + fmt(b.value) + ')</span><span>' + (b.sale ? 'Mở bán ' + esc(b.sale) + ' · ' : '') + 'Nhận ' + esc(b.pickup) + '</span></div>' +
            '<div class="side"><span class="status ' + (b.active ? 's-reserved' : 's-cancelled') + '">' + (b.active ? 'Đang bán' : 'Đã ẩn') + '</span>' +
            '<input class="qty" type="number" min="0" max="500" value="' + b.left + '" aria-label="Số túi còn" data-qty="' + b.id + '">' +
            '<button class="btn btn-outline btn-sm" data-action="qty" data-id="' + b.id + '" type="button">Lưu số túi</button>' +
            '<button class="btn btn-outline btn-sm" data-action="toggle" data-id="' + b.id + '" data-active="' + (b.active ? 1 : 0) + '" type="button">' + (b.active ? 'Ẩn' : 'Hiện') + '</button></div></div>';
        }).join('') : '<p class="muted">Quán chưa đăng túi nào.</p>';
      }).catch(function (e) { $('myBags').innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; });
      api('/orders/restaurant').then(function (d) {
        $('shopOrders').innerHTML = d.orders.length ? d.orders.map(function (o) { return orderRow(o, true); }).join('') : '<p class="muted">Chưa có đơn nào.</p>';
      }).catch(function () {});
    }

    api('/auth/me').then(function (d) {
      user = d.user; saveAuth(getToken(), user);
      $('hello').textContent = 'Xin chào ' + user.name + ' · ' + user.email + (user.role === 'restaurant' ? ' · Nhà hàng: ' + user.restaurant : '');
      loadOrders();
      if (user.role === 'restaurant') { $('shopPanel').hidden = false; loadShop(); }
    }).catch(function () { clearAuth(); goLogin(); });

    document.body.addEventListener('click', function (e) {
      var b = e.target.closest('[data-action]'); if (!b) return;
      var id = b.getAttribute('data-id'), act = b.getAttribute('data-action');
      var done = function (msg, fn) { return function () { toast(msg); fn(); }; };
      var fail = function (err) { toast(err.message); };
      if (act === 'cancel') api('/orders/' + id + '/cancel', { method: 'POST' }).then(done('Đã huỷ đơn, túi được trả lại.', loadOrders)).catch(fail);
      if (act === 'complete') api('/orders/' + id + '/complete', { method: 'POST' }).then(done('Đã đánh dấu giao túi.', loadShop)).catch(fail);
      if (act === 'qty') {
        var q = Number(document.querySelector('[data-qty="' + id + '"]').value);
        api('/bags/' + id, { method: 'PATCH', body: { quantity: q } }).then(done('Đã cập nhật số túi.', loadShop)).catch(fail);
      }
      if (act === 'toggle') api('/bags/' + id, { method: 'PATCH', body: { active: b.getAttribute('data-active') !== '1' } }).then(done('Đã cập nhật trạng thái túi.', loadShop)).catch(fail);
    });

    var form = $('bagForm');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = form.elements;
      var body = {
        type: f.type.value.trim(), name: f.name.value.trim(), tag: f.tag.value.trim(), address: f.address.value.trim(),
        province: f.province.value.trim(), district: f.district.value.trim(),
        mapUrl: f.mapUrl.value.trim(), shopUrl: f.shopUrl.value.trim(), shelfNote: f.shelfNote.value.trim(),
        saleFrom: f.saleFrom.value, saleTo: f.saleTo.value,
        price: parseInt(f.price.value, 10), value: parseInt(f.value.value, 10),
        pickupFrom: f.pickupFrom.value, pickupTo: f.pickupTo.value, quantity: parseInt(f.quantity.value, 10)
      };
      [].forEach.call(form.querySelectorAll('.field'), function (x) { x.classList.remove('bad'); });
      api('/bags', { method: 'POST', body: body }).then(function () {
        toast('Đã đăng túi mù mới!'); form.reset(); loadShop();
      }).catch(function (err) {
        if (err.errors) Object.keys(err.errors).forEach(function (k) { if (f[k]) setErr(f[k], err.errors[k]); });
        toast(err.message);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    mountChrome();
    [].forEach.call(document.querySelectorAll('[data-ico]'), function (el) { el.insertAdjacentHTML('afterbegin', ico(el.getAttribute('data-ico'))); });
    var page = document.body.getAttribute('data-page');
    if (page === 'home') initHome();
    if (page === 'bag') initShop();
    if (page === 'account') initAccount();
    initForms();
  });
})();
