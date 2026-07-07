import Papa from 'papaparse';
import { normalizePhone } from './phoneNormalizer';

// Định nghĩa danh sách các từ đồng nghĩa (aliases) cho từng trường dữ liệu để ánh xạ thông minh
const FIELD_ALIASES = {
  title: ['title', 'ten', 'tên', 'name', 'hotel', 'co_so', 'cơ sở', 'ten_co_so'],
  phone: ['phone', 'so_dien_thoai', 'sdt', 'sđt', 'dien_thoai', 'điện thoại', 'tel', 'sdt_goc', 'sđt_gốc'],
  address: ['address', 'dia_chi', 'địa chỉ', 'location', 'dia-chi', 'dia_chi_co_so'],
  url: ['url', 'google_maps_url', 'link', 'maps', 'map', 'link_google_maps', 'google-map'],
  totalScore: ['totalscore', 'total_score', 'score', 'rating', 'diem', 'điểm', 'diem_danh_gia', 'diem_danh_gia_trung_binh'],
  website: ['website', 'web', 'trang_web', 'trangweb', 'url_website'],
  cuisineType: ['cuisine_type', 'cuisine', 'cuisinetype', 'loai_am_thuc', 'loại ẩm thực', 'am_thuc', 'ẩm thực', 'loai_hinh_am_thuc'],
  email: ['email', 'mail', 'thu_dien_tu', 'thư điện tử', 'contact_email']
};

/**
 * Lấy giá trị của thuộc tính trong đối tượng dựa vào danh sách từ đồng nghĩa
 * @param {Object} obj - Đối tượng dòng dữ liệu thô
 * @param {Array<string>} aliases - Danh sách các từ đồng nghĩa của trường cần lấy
 * @returns {any} - Giá trị tìm được hoặc chuỗi rỗng
 */
function getValueByAliases(obj, aliases) {
  if (!obj || typeof obj !== 'object') return '';
  
  const keys = Object.keys(obj);
  
  // 1. Tìm khớp chính xác trước (sau khi cắt khoảng trắng và đưa về viết thường)
  for (const alias of aliases) {
    const exactKey = keys.find(k => k.trim().toLowerCase() === alias.toLowerCase());
    if (exactKey !== undefined) {
      return obj[exactKey];
    }
  }
  
  // 2. Tìm khớp tương đối (chứa từ khóa đồng nghĩa)
  for (const alias of aliases) {
    const partialKey = keys.find(k => k.trim().toLowerCase().includes(alias.toLowerCase()));
    if (partialKey !== undefined) {
      return obj[partialKey];
    }
  }
  
  return '';
}

/**
 * Ánh xạ dữ liệu mảng thô sang Schema chuẩn hiển thị
 * @param {Array<Object>} rawData - Mảng các đối tượng thô vừa parse
 * @returns {Array<Object>} - Mảng các đối tượng theo chuẩn HotelRecordSchema
 */
export function mapToStandardSchema(rawData) {
  if (!Array.isArray(rawData)) return [];

  return rawData.map((item, index) => {
    // Trích xuất các thuộc tính qua alias mapping
    const rawTitle = getValueByAliases(item, FIELD_ALIASES.title);
    const rawPhone = getValueByAliases(item, FIELD_ALIASES.phone);
    const rawAddress = getValueByAliases(item, FIELD_ALIASES.address);
    const rawUrl = getValueByAliases(item, FIELD_ALIASES.url);
    const rawScore = getValueByAliases(item, FIELD_ALIASES.totalScore);
    const rawWebsite = getValueByAliases(item, FIELD_ALIASES.website);
    const rawCuisineType = getValueByAliases(item, FIELD_ALIASES.cuisineType);
    const rawEmail = getValueByAliases(item, FIELD_ALIASES.email);

    // Chuẩn hóa định dạng
    const title = String(rawTitle).trim();
    const phone = normalizePhone(rawPhone);
    const address = String(rawAddress).trim();
    const url = String(rawUrl).trim();
    const website = String(rawWebsite).trim();
    const cuisineType = String(rawCuisineType).trim();
    const email = rawEmail ? String(rawEmail).trim() : '';
    
    // Xử lý điểm số thành chuỗi hiển thị ví dụ "4.3", hoặc để trống
    let totalScore = '';
    if (rawScore !== null && rawScore !== undefined && String(rawScore).trim() !== '') {
      const scoreNum = parseFloat(rawScore);
      totalScore = !isNaN(scoreNum) ? String(scoreNum) : String(rawScore).trim();
    }

    return {
      stt: index + 1,
      title,
      phone,
      address,
      url,
      totalScore,
      website,
      cuisineType,
      email,
      isDuplicate: false
    };
  });
}

/**
 * Phân tích văn bản thô đầu vào (JSON hoặc CSV) thành dữ liệu Schema chuẩn
 * @param {string} rawInput - Nội dung chữ trong textarea hoặc tệp kéo thả
 * @returns {Array<Object>} - Dữ liệu khách sạn chuẩn hóa
 */
export function parseHotelData(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return [];
  
  const trimmed = rawInput.trim();
  if (trimmed === '') return [];

  let parsedRaw = [];

  // 1. Nhận diện dạng JSON
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      parsedRaw = Array.isArray(parsed) ? parsed : [parsed];
    } catch (jsonErr) {
      console.warn('Cố gắng phân tích dạng JSON thất bại, chuyển sang chế độ phân tích CSV:', jsonErr);
      // Fallback sang CSV nếu parsing JSON lỗi
      parsedRaw = parseCsv(trimmed);
    }
  } else {
    // 2. Nhận diện dạng CSV
    parsedRaw = parseCsv(trimmed);
  }

  // 3. Ánh xạ mảng thô sang Schema chuẩn và chuẩn hóa số điện thoại
  return mapToStandardSchema(parsedRaw);
}

/**
 * Phân tích dữ liệu dạng CSV bằng thư viện PapaParse
 * @param {string} csvText - Văn bản định dạng CSV
 * @returns {Array<Object>} - Mảng dữ liệu thô
 */
function parseCsv(csvText) {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false // Giữ nguyên chuỗi để tránh làm mất số 0 ở đầu số điện thoại
  });
  
  return result.data || [];
}
