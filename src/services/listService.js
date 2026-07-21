import { storageService } from './storageService.js';

// Tiện ích chuyển đổi Tiếng Việt có dấu thành slug không dấu thân thiện
function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Xóa dấu
    .replace(/[đĐ]/g, 'd')
    .replace(/([^a-z0-9\s-]|_)+/g, '') // Xóa ký tự đặc biệt
    .trim()
    .replace(/\s+/g, '-') // Thay khoảng trắng bằng -
    .replace(/-+/g, '-'); // Thu gọn nhiều dấu -
}

// Hàm đối chiếu xem hai bản ghi có trùng khớp dựa trên tất cả các trường được chọn (điều kiện AND)
function isMatchSelected(r1, r2, dupFields = { url: true, address: true, phone: true, title: true }) {
  const clean = (val) => String(val || '').trim().toLowerCase().normalize('NFC');
  const cleanPhone = (val) => String(val || '').replace(/\D/g, '');

  let hasCheckedField = false;

  if (dupFields.url) {
    hasCheckedField = true;
    const u1 = clean(r1.url);
    const u2 = clean(r2.url);
    if (!u1 || !u2 || u1 !== u2) return false;
  }

  if (dupFields.address) {
    hasCheckedField = true;
    const a1 = clean(r1.address);
    const a2 = clean(r2.address);
    if (!a1 || !a2 || a1 !== a2) return false;
  }

  if (dupFields.phone) {
    hasCheckedField = true;
    const p1 = cleanPhone(r1.phone);
    const p2 = cleanPhone(r2.phone);
    if (!p1 || !p2 || p1 !== p2) return false;
  }

  if (dupFields.title) {
    hasCheckedField = true;
    const t1 = clean(r1.title);
    const t2 = clean(r2.title);
    if (!t1 || !t2 || t1 !== t2) return false;
  }

  return hasCheckedField;
}

export const listService = {
  /**
   * 1. Quét tất cả các key trong IndexedDB / Local Storage bắt đầu bằng [dataType]- để lấy danh sách tỉnh thành
   * @param {string} dataType - Loại dữ liệu truy vấn ('hotels', 'restaurants' hoặc 'spa')
   * @returns {Promise<Array>} - Mảng danh sách [{ id, name, slug, count }]
   */
  async getAll(dataType = 'hotels') {
    const prefix = `${dataType}-`;
    const provinces = [];
    const allKeys = await storageService.getAllKeys();

    for (const key of allKeys) {
      if (key && key.startsWith(prefix)) {
        const provinceName = key.substring(prefix.length);
        const records = (await storageService.getItem(key)) || [];

        provinces.push({
          id: provinceName, // Tên tỉnh đóng vai trò là ID định danh
          name: provinceName,
          slug: slugify(provinceName),
          count: records.length
        });
      }
    }

    // Sắp xếp các tỉnh thành theo tên tăng dần
    return provinces.sort((a, b) => a.name.localeCompare(b.name));
  },

  /**
   * Lấy chi tiết dữ liệu của một tỉnh thành dựa vào tên tỉnh
   * @param {string} provinceId - ID của tỉnh thành (chính là tên tỉnh, ví dụ: "Đồng Nai")
   * @param {string} dataType - Loại dữ liệu ('hotels', 'restaurants' hoặc 'spa')
   * @returns {Promise<Object>} - Đối tượng { id, name, count, data: [...] }
   */
  async getById(provinceId, dataType = 'hotels') {
    const key = `${dataType}-${provinceId}`;
    const records = (await storageService.getItem(key)) || [];

    // Sắp xếp theo tiêu đề
    const sortedRecords = records.sort((a, b) => a.title.localeCompare(b.title));

    // Ánh xạ các cột về dạng CamelCase chuẩn hiển thị
    const mappedData = sortedRecords.map((r, idx) => ({
      stt: idx + 1,
      id: r.id || `${provinceId}-${idx}`,
      title: r.title || '',
      email: r.email || '',
      phone: r.phone || '',
      address: r.address || '',
      url: r.url || '',
      totalScore: r.totalScore !== undefined && r.totalScore !== null ? String(r.totalScore) : '',
      website: r.website || '',
      facebook: r.facebook || '',
      categoryName: r.categoryName || r.cuisineType || '',
      cuisineType: r.categoryName || r.cuisineType || '',
      source: r.source || '',
      isFlag: !!r.isFlag,
      neighborhood: r.neighborhood || '',
      isDuplicate: false
    }));

    return {
      id: provinceId,
      name: provinceId,
      count: mappedData.length,
      data: mappedData
    };
  },

  /**
   * 2. Nghiệp vụ Lưu & Gộp (Save/Merge) dữ liệu theo key: [dataType]-[provinceName]
   * @param {string} provinceName - Tên tỉnh (người dùng chọn hoặc nhập mới)
   * @param {Array} newData - Mảng dữ liệu mới cần chèn
   * @param {string|null} provinceId - ID của tỉnh được chọn (chính là tên tỉnh cũ nếu có)
   * @param {string} dataType - Loại dữ liệu ('hotels', 'restaurants' hoặc 'spa')
   * @param {string} activeListId - Tên tỉnh cũ đang xem
   * @param {Object} dupFields - Các trường lọc trùng đang chọn
   * @returns {Promise<Object>} - Trả về tóm tắt tỉnh thành sau khi lưu { id, name, count }
   */
  async save(provinceName, newData, dataType = 'hotels', activeListId = '', dupFields = { url: true, address: true, phone: true, title: true }) {
    const targetProvinceName = String(provinceName || '').trim();
    if (!targetProvinceName) {
      throw new Error('Tên tỉnh thành không được để trống.');
    }

    const key = `${dataType}-${targetProvinceName}`;

    // Chuẩn hóa dữ liệu đầu vào theo Schema quy định
    const cleanNewData = newData.map((item, idx) => ({
      id: `${targetProvinceName}-${Date.now()}-${idx}`,
      title: item.title || '',
      email: item.email || '',
      phone: item.phone || '',
      address: item.address || '',
      url: item.url || '',
      totalScore: item.totalScore !== undefined && item.totalScore !== null ? String(item.totalScore) : '',
      website: item.website || '',
      facebook: item.facebook || '',
      categoryName: item.categoryName || item.cuisineType || '',
      cuisineType: item.categoryName || item.cuisineType || '',
      source: item.source || '',
      isFlag: !!item.isFlag,
      neighborhood: item.neighborhood || ''
    }));

    // Kiểm tra chế độ ghi đè: Nếu activeListId khớp với tên tỉnh muốn lưu
    const isOverwriteMode = activeListId && String(activeListId).trim().toLowerCase() === targetProvinceName.toLowerCase();

    if (isOverwriteMode) {
      // Chế độ ghi đè: Lưu đè toàn bộ lên key tương ứng trong IndexedDB
      await storageService.setItem(key, cleanNewData);

      return {
        id: targetProvinceName,
        name: targetProvinceName,
        count: cleanNewData.length
      };
    }

    // Chế độ gộp cộng thêm (Append): Tải dữ liệu cũ của key này lên đối sánh loại trùng
    const oldRecords = (await storageService.getItem(key)) || [];
    const toInsert = [];

    for (const newItem of cleanNewData) {
      let isDup = false;

      // So khớp với dữ liệu đã lưu
      for (const oldRec of oldRecords) {
        if (isMatchSelected(newItem, oldRec, dupFields)) {
          isDup = true;
          break;
        }
      }

      // So khớp chéo với các bản ghi đang chờ thêm (tránh trùng tệp chèn)
      if (!isDup) {
        for (const addedRec of toInsert) {
          if (isMatchSelected(newItem, addedRec, dupFields)) {
            isDup = true;
            break;
          }
        }
      }

      if (!isDup) {
        toInsert.push(newItem);
      }
    }

    const updatedRecords = [...oldRecords, ...toInsert];
    await storageService.setItem(key, updatedRecords);

    return {
      id: targetProvinceName,
      name: targetProvinceName,
      count: updatedRecords.length
    };
  },

  /**
   * Xóa toàn bộ dữ liệu của một tỉnh (xóa key tương ứng)
   * @param {string} provinceId - ID của tỉnh (chính là tên tỉnh)
   * @param {string} dataType - Loại dữ liệu ('hotels', 'restaurants' hoặc 'spa')
   * @returns {Promise<boolean>}
   */
  async delete(provinceId, dataType = 'hotels') {
    const key = `${dataType}-${provinceId}`;
    await storageService.removeItem(key);
    return true;
  }
};
