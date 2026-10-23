class HttpError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors || null;
  }
}

const EMAIL_RE = /^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$/;

const v = {
  email: (s) => typeof s === 'string' && s.length <= 254 && EMAIL_RE.test(s.trim()),
  phone: (s) => typeof s === 'string' && /^(\+84|0)\d{9}$/.test(s.replace(/\s/g, '')),
  text: (s, min, max) => typeof s === 'string' && s.trim().length >= min && s.trim().length <= max,
  int: (n, min, max) => Number.isInteger(n) && n >= min && n <= max,
  time: (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s),
};

/** Chuẩn hóa số điện thoại: bỏ khoảng trắng, rỗng -> null */
function normPhone(s) {
  const t = String(s == null ? '' : s).replace(/\s/g, '');
  return t === '' ? null : t;
}

module.exports = { HttpError, v, normPhone };
