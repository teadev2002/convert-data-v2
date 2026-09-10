import Papa from 'papaparse';
import { normalizePhone } from './phoneNormalizer';

// Định nghĩa danh sách các từ đồng nghĩa (aliases) cho từng trường dữ liệu để ánh xạ thông minh
const FIELD_ALIASES = {
  title: ['title', 'ten', 'tên', 'name', 'hotel', 'co_so', 'cơ sở', 'ten_co_so', 'tên khách sạn', 'hotel name'],
  phone: ['phone', 'so_dien_thoai', 'sdt', 'sđt', 'dien_thoai', 'điện thoại', 'tel', 'sdt_goc', 'sđt_gốc'],
  address: ['address', 'dia_chi', 'địa chỉ', 'location', 'dia-chi', 'dia_chi_co_so'],
  url: ['url', 'google_maps_url', 'link', 'maps', 'map', 'link_google_maps', 'google-map'],
  totalScore: ['total score', 'totalscore', 'total_score', 'score', 'rating', 'diem', 'điểm', 'diem_danh_gia', 'diem_danh_gia_trung_binh'],
  website: ['website', 'web', 'trang_web', 'trangweb', 'url_website'],
  facebook: ['facebook', 'fb', 'link_facebook', 'facebook_url', 'facebook url'],
  cuisineType: ['categoryname', 'category_name', 'category', 'cuisine type', 'service type', 'cuisine_type', 'service_type', 'cuisine', 'cuisinetype', 'loai_am_thuc', 'loại ẩm thực', 'am_thuc', 'ẩm thực', 'loai_hinh_am_thuc', 'loại hình', 'loai_hinh'],
  email: ['email', 'mail', 'thu_dien_tu', 'thư điện tử', 'contact_email'],
  neighborhood: ['neighborhood', 'phuong', 'phường', 'phuong_xa', 'phường xã', 'khu_vuc', 'khu vực', 'sub_district', 'subdistrict', 'ward', 'phuongxa'],
  source: ['source', 'nguon', 'nguồn', 'nguon_tin', 'nguồn tin'],
  isFlag: ['isflag', 'is_flag', 'flag', 'danh_dau', 'đánh dấu', 'quan_trong', 'quan trọng'],
  nvCall: [
    'tên nv gọi', 'tên nv goi', 'ten nv goi', 'ten nv gọi',
    'tên nv', 'ten nv', 'nv gọi', 'nv goi',
    'nhân viên gọi', 'nhan vien goi', 'tên nhân viên gọi', 'ten nhan vien goi',
    'tên nhân viên', 'ten nhan vien', 'nhân viên', 'nhan vien',
    'nvcall', 'nv_call', 'caller', 'staff'
  ],
  docDateZalo: [
    'ngày nhận báo giá, hợp đồng (zalo)',
    'ngày nhận báo giá, hợp đồng zalo',
    'ngày nhận báo giá hợp đồng (zalo)',
    'ngày nhận báo giá, hợp đồng (zalo) ',
    'ngày nhận báo giá, hợp đồng ',
    'docdate2'
  ],
  upDateZalo: [
    'ngày up tt ncc (zalo)',
    'ngày up tt ncc zalo',
    'ngày up tt ncc (zalo) ',
    'ngày up tt ncc ',
    'update2'
  ],
  docDateEmail: [
    'ngày nhận báo giá, hợp đồng',
    'ngày nhận báo giá, hợp đồng (email)',
    'ngày nhận báo giá hợp đồng',
    'docdate1'
  ],
  upDateEmail: [
    'ngày up tt ncc',
    'ngày up tt ncc (email)',
    'update1'
  ],
  readAiZalo: [
    'đọc ai (zalo)', 'đọc ai zalo', 'doc ai zalo', 'doc ai (zalo)', 'đọc ai ', 'readai2'
  ],
  checkAiZalo: [
    'kiểm tra dữ liệu ai (zalo)', 'kiểm tra dữ liệu ai zalo', 'kiem tra du lieu ai zalo', 'kiểm tra ai zalo', 'kiểm tra dữ liệu ai ', 'checkai2'
  ],
  readAiEmail: [
    'đọc ai', 'đọc ai (email)', 'doc ai', 'readai1'
  ],
  checkAiEmail: [
    'kiểm tra dữ liệu ai', 'kiểm tra dữ liệu ai (email)', 'kiem tra du lieu ai', 'checkai1'
  ]
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
  
  // 1. Tìm khớp chính xác key alias có chứa giá trị KHÁC RỖNG trước
  for (const alias of aliases) {
    const exactKey = keys.find(k => k.trim().toLowerCase() === alias.toLowerCase());
    if (exactKey !== undefined) {
      const val = obj[exactKey];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        return val;
      }
    }
  }
  
  // 2. Tìm khớp tương đối (chứa từ khóa đồng nghĩa) có chứa giá trị KHÁC RỖNG
  for (const alias of aliases) {
    const partialKey = keys.find(k => k.trim().toLowerCase().includes(alias.toLowerCase()));
    if (partialKey !== undefined) {
      const val = obj[partialKey];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        return val;
      }
    }
  }

  // 3. Fallback: Nếu tất cả các alias khớp đều rỗng, lấy giá trị của key khớp đầu tiên
  for (const alias of aliases) {
    const exactKey = keys.find(k => k.trim().toLowerCase() === alias.toLowerCase());
    if (exactKey !== undefined) {
      return obj[exactKey];
    }
  }

  return '';
}

/**
 * Chuyển đổi số sê-ri ngày của Excel thành chuỗi dd/mm/yyyy
 * @param {number|string} serial 
 * @returns {string|null}
 */
function excelSerialToDateStr(serial) {
  const num = Number(serial);
  if (isNaN(num) || num < 10000 || num > 100000) return null;
  // Số sê-ri ngày trong Excel dựa theo mốc 1899-12-30
  const date = new Date(Math.round((num - 25569) * 86400 * 1000));
  if (isNaN(date.getTime())) return null;

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Tiện ích chuẩn hóa giá trị ngày tháng và các trường liên quan cho hotel4mail
 * Giải mã số sê-ri ngày của Excel (ví dụ 46274 -> 09/09/2026) hoặc ISO date (2026-09-09)
 * Tự động thêm tiền tố ' vào đầu chuỗi nếu chưa có (Ví dụ: 09/09/2026 -> '09/09/2026)
 * @param {any} val - Giá trị thô
 * @returns {string} - Chuỗi ngày tháng đã được chuẩn hóa với tiền tố ' ở đầu
 */
export function formatDateField(val) {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (str === '') return '';

  // 1. Nếu đã bắt đầu bằng dấu ' thì kiểm tra phần ruột
  if (str.startsWith("'")) {
    const inner = str.slice(1).trim();
    if (/^\d+$/.test(inner)) {
      const dateStr = excelSerialToDateStr(inner);
      if (dateStr) return "'" + dateStr;
    }
    return str;
  }

  // 2. Kiểm tra nếu là số sê-ri ngày của Excel (ví dụ: 45000 đến 55000 đại diện cho những năm từ 2023-2050)
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const dateStr = excelSerialToDateStr(str);
    if (dateStr) return "'" + dateStr;
  }

  // 3. Kiểm tra nếu là chuỗi ISO Date (ví dụ: 2026-09-09T00:00:00.000Z hoặc 2026-09-09)
  const isoMatch = str.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `'${day}/${month}/${year}`;
  }

  // 4. Kiểm tra nếu là chuỗi dạng d/m/yyyy hoặc dd/mm/yyyy hoặc dd-mm-yyyy
  const dmyMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    let year = dmyMatch[3];
    if (year.length === 2) year = '20' + year;
    return `'${day}/${month}/${year}`;
  }

  // 5. Fallback nếu là chuỗi khác: Thêm dấu ' vào đầu
  return "'" + str;
}

/**
 * Trích xuất Tên nhân viên gọi linh hoạt với nhiều từ đồng nghĩa
 * @param {Object} item - Bản ghi dữ liệu
 * @returns {string} - Tên nhân viên gọi tìm được hoặc chuỗi rỗng
 */
export function getNvCall(item) {
  if (!item || typeof item !== 'object') return '';
  const val = getValueByAliases(item, FIELD_ALIASES.nvCall);
  if (val !== null && val !== undefined && String(val).trim() !== '') {
    return String(val).trim();
  }
  return String(item["Tên nv gọi"] || item["Tên NV gọi"] || item["Tên nhân viên gọi"] || item["NV"] || '').trim();
}

export function getDocDateZalo(item) {
  if (!item || typeof item !== 'object') return '';
  const keys = Object.keys(item);

  // 1. Quét tìm key chứa cả "báo giá" (hoặc "hợp đồng") và "zalo"
  for (const k of keys) {
    const cleanK = k.replace(/[\s\u00A0]+/g, ' ').trim().toLowerCase();
    if ((cleanK.includes('báo giá') || cleanK.includes('bao gia') || cleanK.includes('hợp đồng') || cleanK.includes('hop dong')) && cleanK.includes('zalo')) {
      const val = item[k];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        return formatDateField(val);
      }
    }
  }

  // 2. Quét tìm key báo giá kết thúc bằng hậu tố trùng cột của Excel (_1, _2, " 2", khoảng trắng ở cuối)
  for (const k of keys) {
    const cleanK = k.replace(/[\s\u00A0]+/g, ' ').trim().toLowerCase();
    if ((cleanK.includes('báo giá') || cleanK.includes('bao gia') || cleanK.includes('hợp đồng') || cleanK.includes('hop dong')) && (cleanK.endsWith('_1') || cleanK.endsWith('_2') || cleanK.endsWith(' 2') || k.endsWith(' '))) {
      const val = item[k];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        return formatDateField(val);
      }
    }
  }

  // 3. Fallback theo getValueByAliases hoặc match trực tiếp
  const val = getValueByAliases(item, FIELD_ALIASES.docDateZalo) || item["Ngày nhận Báo giá, Hợp đồng (Zalo)"] || item[" Ngày nhận Báo giá, Hợp đồng (Zalo)"] || item["Ngày nhận Báo giá, Hợp đồng "] || '';
  return formatDateField(val);
}

export function getUpDateZalo(item) {
  if (!item || typeof item !== 'object') return '';
  const keys = Object.keys(item);

  // 1. Quét tìm key chứa "up tt ncc" (hoặc "up ncc") và "zalo"
  for (const k of keys) {
    const cleanK = k.replace(/[\s\u00A0]+/g, ' ').trim().toLowerCase();
    if ((cleanK.includes('up tt ncc') || cleanK.includes('up ncc') || cleanK.includes('ncc')) && cleanK.includes('zalo')) {
      const val = item[k];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        return formatDateField(val);
      }
    }
  }

  // 2. Quét tìm key up ncc kết thúc bằng hậu tố trùng cột (_1, _2, " 2", khoảng trắng ở cuối)
  for (const k of keys) {
    const cleanK = k.replace(/[\s\u00A0]+/g, ' ').trim().toLowerCase();
    if ((cleanK.includes('up tt ncc') || cleanK.includes('up ncc')) && (cleanK.endsWith('_1') || cleanK.endsWith('_2') || cleanK.endsWith(' 2') || k.endsWith(' '))) {
      const val = item[k];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        return formatDateField(val);
      }
    }
  }

  // 3. Fallback
  const val = getValueByAliases(item, FIELD_ALIASES.upDateZalo) || item["Ngày up TT NCC (Zalo)"] || item[" Ngày up TT NCC (Zalo)"] || item["Ngày up TT NCC "] || '';
  return formatDateField(val);
}

export function getDocDateEmail(item) {
  if (!item || typeof item !== 'object') return '';
  const keys = Object.keys(item);

  // 1. Ưu tiên key chứa 'báo giá' và 'email'
  for (const k of keys) {
    const cleanK = k.replace(/[\s\u00A0]+/g, ' ').trim().toLowerCase();
    if ((cleanK.includes('báo giá') || cleanK.includes('bao gia') || cleanK.includes('hợp đồng') || cleanK.includes('hop dong')) && cleanK.includes('email')) {
      const val = item[k];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        return formatDateField(val);
      }
    }
  }

  // 2. Ưu tiên key chứa 'báo giá' và không chứa 'zalo', không có hậu tố trùng cột
  for (const k of keys) {
    const cleanK = k.replace(/[\s\u00A0]+/g, ' ').trim().toLowerCase();
    if ((cleanK.includes('báo giá') || cleanK.includes('bao gia') || cleanK.includes('hợp đồng') || cleanK.includes('hop dong')) && !cleanK.includes('zalo') && !cleanK.endsWith('_1') && !cleanK.endsWith('_2') && !cleanK.endsWith(' 2') && !k.endsWith(' ')) {
      const val = item[k];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        return formatDateField(val);
      }
    }
  }

  const val = getValueByAliases(item, FIELD_ALIASES.docDateEmail) || item["Ngày nhận Báo giá, Hợp đồng"] || item["Ngày nhận Báo giá, Hợp đồng (Email)"] || '';
  return formatDateField(val);
}

export function getUpDateEmail(item) {
  if (!item || typeof item !== 'object') return '';
  const keys = Object.keys(item);

  // 1. Ưu tiên key chứa 'up ncc' và 'email'
  for (const k of keys) {
    const cleanK = k.replace(/[\s\u00A0]+/g, ' ').trim().toLowerCase();
    if ((cleanK.includes('up tt ncc') || cleanK.includes('up ncc')) && cleanK.includes('email')) {
      const val = item[k];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        return formatDateField(val);
      }
    }
  }

  // 2. Ưu tiên key chứa 'up ncc' và không chứa 'zalo', không có hậu tố trùng cột
  for (const k of keys) {
    const cleanK = k.replace(/[\s\u00A0]+/g, ' ').trim().toLowerCase();
    if ((cleanK.includes('up tt ncc') || cleanK.includes('up ncc')) && !cleanK.includes('zalo') && !cleanK.endsWith('_1') && !cleanK.endsWith('_2') && !cleanK.endsWith(' 2') && !k.endsWith(' ')) {
      const val = item[k];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        return formatDateField(val);
      }
    }
  }

  const val = getValueByAliases(item, FIELD_ALIASES.upDateEmail) || item["Ngày up TT NCC"] || item["Ngày up TT NCC (Email)"] || '';
  return formatDateField(val);
}

export function getReadAiZalo(item) {
  if (!item || typeof item !== 'object') return '';
  const keys = Object.keys(item);
  for (const k of keys) {
    const cleanK = k.replace(/[\s\u00A0]+/g, ' ').trim().toLowerCase();
    if (cleanK.includes('đọc ai') || cleanK.includes('doc ai')) {
      if (cleanK.includes('zalo') || cleanK.endsWith('_1') || cleanK.endsWith('_2') || cleanK.endsWith(' 2') || k.endsWith(' ')) {
        const val = item[k];
        if (val !== null && val !== undefined && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
    }
  }
  const val = getValueByAliases(item, FIELD_ALIASES.readAiZalo) || item["Đọc AI (Zalo)"] || item[" Đọc AI (Zalo)"] || item["Đọc AI Zalo"] || item["Đọc AI "] || '';
  return val !== null && val !== undefined ? String(val).trim() : '';
}

export function getCheckAiZalo(item) {
  if (!item || typeof item !== 'object') return '';
  const keys = Object.keys(item);
  for (const k of keys) {
    const cleanK = k.replace(/[\s\u00A0]+/g, ' ').trim().toLowerCase();
    if (cleanK.includes('kiểm tra dữ liệu ai') || cleanK.includes('kiem tra du lieu ai') || cleanK.includes('kiểm tra ai') || cleanK.includes('kiem tra ai')) {
      if (cleanK.includes('zalo') || cleanK.endsWith('_1') || cleanK.endsWith('_2') || cleanK.endsWith(' 2') || k.endsWith(' ')) {
        const val = item[k];
        if (val !== null && val !== undefined && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
    }
  }
  const val = getValueByAliases(item, FIELD_ALIASES.checkAiZalo) || item["Kiểm tra Dữ liệu AI (Zalo)"] || item[" Kiểm tra Dữ liệu AI (Zalo)"] || item["Kiểm tra Dữ liệu AI Zalo"] || item["Kiểm tra Dữ liệu AI "] || '';
  return val !== null && val !== undefined ? String(val).trim() : '';
}

export function getReadAiEmail(item) {
  if (!item || typeof item !== 'object') return '';
  const keys = Object.keys(item);
  for (const k of keys) {
    const cleanK = k.replace(/[\s\u00A0]+/g, ' ').trim().toLowerCase();
    if (cleanK.includes('đọc ai') || cleanK.includes('doc ai')) {
      if (cleanK.includes('email') || (!cleanK.includes('zalo') && !cleanK.endsWith('_1') && !cleanK.endsWith('_2') && !cleanK.endsWith(' 2') && !k.endsWith(' '))) {
        const val = item[k];
        if (val !== null && val !== undefined && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
    }
  }
  const val = getValueByAliases(item, FIELD_ALIASES.readAiEmail) || item["Đọc AI"] || item["Đọc AI (Email)"] || '';
  return val !== null && val !== undefined ? String(val).trim() : '';
}

export function getCheckAiEmail(item) {
  if (!item || typeof item !== 'object') return '';
  const keys = Object.keys(item);
  for (const k of keys) {
    const cleanK = k.replace(/[\s\u00A0]+/g, ' ').trim().toLowerCase();
    if (cleanK.includes('kiểm tra dữ liệu ai') || cleanK.includes('kiem tra du lieu ai') || cleanK.includes('kiểm tra ai') || cleanK.includes('kiem tra ai')) {
      if (cleanK.includes('email') || (!cleanK.includes('zalo') && !cleanK.endsWith('_1') && !cleanK.endsWith('_2') && !cleanK.endsWith(' 2') && !k.endsWith(' '))) {
        const val = item[k];
        if (val !== null && val !== undefined && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
    }
  }
  const val = getValueByAliases(item, FIELD_ALIASES.checkAiEmail) || item["Kiểm tra Dữ liệu AI"] || item["Kiểm tra Dữ liệu AI (Email)"] || '';
  return val !== null && val !== undefined ? String(val).trim() : '';
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
        .replace(/[^\p{L}\p{N}\s,.\-()]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
    };
    const address = cleanAddressStr(rawAddress);
    const url = String(rawUrl).trim();
    
    const website = String(rawWebsite).trim();
    const facebook = String(rawFacebook).trim();
    
    const categoryName = String(rawCuisineType).trim();
    const email = rawEmail ? String(rawEmail).trim() : '';
    const neighborhood = String(rawNeighborhood).trim();
    
    // Xử lý điểm số thành chuỗi hiển thị ví dụ "4.3", hoặc để trống
    let totalScore = '';
    if (rawScore !== null && rawScore !== undefined && String(rawScore).trim() !== '') {
      const scoreNum = parseFloat(rawScore);
      totalScore = !isNaN(scoreNum) ? String(scoreNum) : String(rawScore).trim();
    }

    // Tự động quét và bổ sung tiền tố ' cho các trường Ngày tháng, Gửi email, Gửi zalo, Nhắc L1...
    const formattedItem = { ...item };
    for (const key of Object.keys(formattedItem)) {
      const k = key.trim().toLowerCase();
      if (
        k.includes('ngày') || k.includes('ngay') ||
        k.includes('gửi') || k.includes('gui') ||
        k.includes('nhắc') || k.includes('nhac') ||
        /^\d{5}(\.\d+)?$/.test(String(formattedItem[key]).trim())
      ) {
        formattedItem[key] = formatDateField(formattedItem[key]);
      } else if (typeof formattedItem[key] === 'string' && /^\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}$/.test(formattedItem[key].trim())) {
        formattedItem[key] = formatDateField(formattedItem[key]);
      }
    }

    return {
      ...formattedItem,
      stt: index + 1,
      title,
      email,
      phone,
      address,
      url,
      totalScore,
      website,
      facebook,
      categoryName,
      cuisineType: categoryName,
      source: String(rawSource || '').trim(),
      isFlag: rawIsFlag === true || String(rawIsFlag).trim().toLowerCase() === 'true' || rawIsFlag === 1,
      neighborhood, // Lưu trữ nội bộ để lọc
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

  let parsedRaw;

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
