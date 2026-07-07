/**
 * Tiện ích chuẩn hóa số điện thoại về định dạng chuẩn của Việt Nam (bắt đầu bằng 0)
 * Giải quyết các định dạng:
 * - Dạng số mũ khoa học (ví dụ: 8.42814752E+9, 8.49123E+10)
 * - Chứa ký tự lạ, khoảng trắng, gạch ngang, dấu chấm: "0828.147-520"
 * - Mã quốc gia: +84..., 84..., 0084...
 * 
 * @param {string|number} phone - Số điện thoại thô đầu vào
 * @returns {string} - Số điện thoại đã được chuẩn hóa (chỉ gồm các chữ số)
 */
export function normalizePhone(phone) {
  if (phone === null || phone === undefined) return '';
  
  let str = String(phone).trim();
  if (str === '') return '';

  // 1. Kiểm tra và giải mã dạng số khoa học (scientific notation) ví dụ: 8.42814752E+9
  if (/^[-+]?[0-9]*\.?[0-9]+[eE][-+]?[0-9]+$/.test(str)) {
    try {
      const num = Number(str);
      if (!isNaN(num) && isFinite(num)) {
        // Chuyển đổi số thực thành chuỗi số nguyên thông thường (không có phần thập phân nếu là số nguyên)
        str = Number(num.toFixed(0)).toString();
      }
    } catch (e) {
      console.warn('Lỗi phân tích số khoa học:', str, e);
    }
  }

  // 2. Loại bỏ tất cả các ký tự không phải là chữ số
  str = str.replace(/\D/g, '');

  // 3. Chuẩn hóa mã quốc gia Việt Nam (84, +84, 0084) thành 0
  if (str.startsWith('0084') && str.length >= 12) {
    str = '0' + str.slice(4);
  } else if (str.startsWith('84') && str.length >= 10) {
    str = '0' + str.slice(2);
  }

  return str;
}
