import Papa from 'papaparse';
import { normalizePhone } from './phoneNormalizer';

// Định nghĩa danh sách các từ đồng nghĩa (aliases) cho từng trường dữ liệu để ánh xạ thông minh
const FIELD_ALIASES = {
  title: ['title', 'ten', 'tên', 'name', 'hotel', 'co_so', 'cơ sở', 'ten_co_so'],
  phone: ['phone', 'so_dien_thoai', 'sdt', 'sđt', 'dien_thoai', 'điện thoại', 'tel', 'sdt_goc', 'sđt_gốc'],
  address: ['address', 'dia_chi', 'địa chỉ', 'location', 'dia-chi', 'dia_chi_co_so'],
  url: ['url', 'google_maps_url', 'link', 'maps', 'map', 'link_google_maps', 'google-map'],
  totalScore: ['total score', 'totalscore', 'total_score', 'score', 'rating', 'diem', 'điểm', 'diem_danh_gia', 'diem_danh_gia_trung_binh'],
  website: ['website', 'web', 'trang_web', 'trangweb', 'url_website'],
  facebook: ['facebook', 'fb', 'link_facebook', 'facebook_url', 'facebook url'],
  cuisineType: ['cuisine type', 'service type', 'cuisine_type', 'service_type', 'cuisine', 'cuisinetype', 'loai_am_thuc', 'loại ẩm thực', 'am_thuc', 'ẩm thực', 'loai_hinh_am_thuc', 'categoryname', 'category_name', 'category'],
  email: ['email', 'mail', 'thu_dien_tu', 'thư điện tử', 'contact_email'],
  neighborhood: ['neighborhood', 'phuong', 'phường', 'phuong_xa', 'phường xã', 'khu_vuc', 'khu vực', 'sub_district', 'subdistrict', 'ward', 'phuongxa'],
  source: ['source', 'nguon', 'nguồn', 'nguon_tin', 'nguồn tin'],
  isFlag: ['isflag', 'is_flag', 'flag', 'danh_dau', 'đánh dấu', 'quan_trong', 'quan trọng']
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
    const rawFacebook = getValueByAliases(item, FIELD_ALIASES.facebook);
    const rawCuisineType = getValueByAliases(item, FIELD_ALIASES.cuisineType);
    const rawEmail = getValueByAliases(item, FIELD_ALIASES.email);
    const rawNeighborhood = getValueByAliases(item, FIELD_ALIASES.neighborhood);
    const rawSource = getValueByAliases(item, FIELD_ALIASES.source);
    const rawIsFlag = getValueByAliases(item, FIELD_ALIASES.isFlag);

    // Chuẩn hóa định dạng
    const title = String(rawTitle).trim();
    const phone = normalizePhone(rawPhone);
    
    // Loại bỏ ký tự lạ, ngắt dòng (\n, \r, \t), giữ lại chữ số & chữ UTF-8 cùng dấu câu thông dụng
    const cleanAddressStr = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/[^\p{L}\p{N}\s,.\-\/()]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
    };
    const address = cleanAddressStr(rawAddress);
    const url = String(rawUrl).trim();
    
    const website = String(rawWebsite).trim();
    const facebook = String(rawFacebook).trim();
    
    const cuisineType = String(rawCuisineType).trim();
    const email = rawEmail ? String(rawEmail).trim() : '';
    const neighborhood = String(rawNeighborhood).trim();
    
    // Xử lý điểm số thành chuỗi hiển thị ví dụ "4.3", hoặc để trống
    let totalScore = '';
    if (rawScore !== null && rawScore !== undefined && String(rawScore).trim() !== '') {
      const scoreNum = parseFloat(rawScore);
      totalScore = !isNaN(scoreNum) ? String(scoreNum) : String(rawScore).trim();
    }

    return {
      stt: index + 1,
      title,
      email,
      phone,
      address,
      url,
      totalScore,
      website,
      facebook,
      source: String(rawSource || '').trim(),
      isFlag: rawIsFlag === true || String(rawIsFlag).trim().toLowerCase() === 'true' || rawIsFlag === 1,
      neighborhood, // Lưu trữ nội bộ để lọc
      cuisineType,  // Lưu trữ nội bộ
      isDuplicate: false
    };
  });
}

/**
 * Phân tích văn bản thô đầu vào (JSON hoặc CSV/TSV) thành dữ liệu Schema chuẩn
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
    // 2. Nhận diện dạng CSV / TSV
    parsedRaw = parseCsv(trimmed);
  }

  // 3. Ánh xạ mảng thô sang Schema chuẩn
  return mapToStandardSchema(parsedRaw);
}

/**
 * Phân tích dữ liệu dạng CSV/TSV bằng thư viện PapaParse
 * @param {string} csvText - Văn bản định dạng CSV
 * @returns {Array<Object>} - Mảng dữ liệu thô
 */
function parseCsv(csvText) {
  // Tự động phát hiện delimiter là tab (\t) nếu copy-paste từ Excel sang textarea
  const delimiter = csvText.includes('\t') ? '\t' : undefined;
  
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    delimiter: delimiter,
    dynamicTyping: false // Giữ nguyên chuỗi để tránh làm mất số 0 ở đầu số điện thoại
  });
  return result.data || [];
}
