/**
 * Tiện ích chuẩn hóa số điện thoại về định dạng chuẩn của Việt Nam (bắt đầu bằng 0)
 * Giải quyết các định dạng:
 * - Dạng số mũ khoa học (ví dụ: 8.42814752E+9, 8.49123E+10)
 * - Chứa ký tự lạ, khoảng trắng, gạch ngang, dấu chấm: "0828.147-520"
 * - Mã quốc gia: +84..., 84..., 0084...
 * - Hỗ trợ nhiều số điện thoại được ngăn cách bởi |, /, ,, ;
 * 
 * @param {string|number} phone - Số điện thoại thô đầu vào
 * @returns {string} - Số điện thoại đã được chuẩn hóa (chỉ gồm các chữ số và dấu ngăn cách " | ")
 */
export function normalizePhone(phone) {
  if (phone === null || phone === undefined) return '';
  
  let str = String(phone).trim();
  if (str === '') return '';

  const separatorRegex = /[|/,;]/;
  if (separatorRegex.test(str)) {
    const parts = str.split(separatorRegex);
    const normalizedParts = parts
      .map(part => normalizeSinglePhone(part))
      .filter(part => part !== ''); // Bỏ các phần trống
    return normalizedParts.join(' | ');
  }

  return normalizeSinglePhone(str);
}

function normalizeSinglePhone(str) {
  let s = str.trim();
  if (s === '') return '';

  // 1. Kiểm tra và giải mã dạng số khoa học (scientific notation) ví dụ: 8.42814752E+9
  if (/^[-+]?[0-9]*\.?[0-9]+[eE][-+]?[0-9]+$/.test(s)) {
    try {
      const num = Number(s);
      if (!isNaN(num) && isFinite(num)) {
        // Chuyển đổi số thực thành chuỗi số nguyên thông thường
        s = Number(num.toFixed(0)).toString();
      }
    } catch (e) {
      console.warn('Lỗi phân tích số khoa học:', s, e);
    }
  }

  // 2. Loại bỏ tất cả các ký tự không phải là chữ số
  s = s.replace(/\D/g, '');

  // 3. Chuẩn hóa mã quốc gia Việt Nam (84, +84, 0084) thành 0
  if (s.startsWith('0084') && s.length >= 12) {
    s = '0' + s.slice(4);
  } else if (s.startsWith('84') && s.length >= 10) {
    s = '0' + s.slice(2);
  }

  return s;
}
