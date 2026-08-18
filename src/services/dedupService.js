import { storageService } from './storageService.js';

export const dedupService = {
  /**
   * Nghiệp vụ Kiểm tra trùng lặp (Deduplication Check) diện rộng trên IndexedDB / Storage
   * Quét tất cả các key lưu trữ dạng [dataType]-[provinceName] để làm đối chiếu loại trùng
   * Giải thuật tối ưu O(N + M) sử dụng Set để lưu trữ các mã khóa kết hợp.
   * @param {Array<Object>} records - Danh sách các bản ghi cần đối chiếu kiểm tra trùng lặp
   * @param {string|null} provinceId - Tên tỉnh thành đang xem (activeListId) dùng để loại trừ
   * @param {string} dataType - Loại dữ liệu đang đối chiếu ('hotels', 'restaurants' hoặc 'spa')
   * @param {Object} dupFields - Đối tượng chứa trạng thái kích hoạt của các trường lọc trùng
   * @param {boolean} ignoreAccents - Có bỏ qua dấu tiếng Việt khi đối chiếu hay không
   * @returns {Promise<{duplicateStts: Array<number>}>}
   */
  async checkDuplicates(records, provinceId = null, dataType = 'hotels', dupFields = { url: true, address: true, phone: true, title: true }, ignoreAccents = false) {
    try {
      const activeKey = provinceId ? `${dataType}-${provinceId}` : null;
      let allDbRecords = [];

      const allKeys = await storageService.getAllKeys();

      // Quét tất cả các key để gộp dữ liệu đối chiếu chéo
      for (const key of allKeys) {
        if (key && (key.startsWith('hotels-') || key.startsWith('restaurants-') || key.startsWith('spa-'))) {
          // Bỏ qua key của danh sách hiện đang mở để tránh tự đối chiếu trùng chính nó
          if (activeKey && key.toLowerCase() === activeKey.toLowerCase()) {
            continue;
          }
          const data = (await storageService.getItem(key)) || [];
          allDbRecords = [...allDbRecords, ...data];
        }
      }

      const duplicateStts = [];

      if (allDbRecords.length > 0 && records.length > 0) {
        // Hàm làm sạch chuỗi tùy thuộc vào ignoreAccents
        const cleanStr = (val) => {
          let s = String(val || '').trim().toLowerCase();
          if (ignoreAccents) {
            s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd');
          }
          return s.normalize('NFC');
        };
        const cleanPhone = (val) => String(val || '').replace(/\D/g, '');

        // Hàm trích xuất tên riêng thực tế (loại bỏ loại hình)
        const extractActualName = (title) => {
          let s = cleanStr(title);
          const categoryKeywords = ["hotel", "resort", "bungalow", "villa", "khach san", "nha nghi", "spa", "restaurant", "nha hang"];
          for (const kw of categoryKeywords) {
            const regex = new RegExp(`\\b${kw}\\b`, 'gi');
            if (regex.test(s)) {
              s = s.replace(regex, '').replace(/\s+/g, ' ').trim();
              break;
            }
          }
          return s;
        };

        // 1. Tạo dbKeySet chứa các chuỗi khóa đại diện từ Local Storage
        const dbKeySet = new Set();
        for (const r of allDbRecords) {
          let isValid = true;
          const keyParts = [];

          if (dupFields.url) {
            const u = cleanStr(r.url);
            if (!u) isValid = false;
            else keyParts.push(`url:${u}`);
          }

          if (dupFields.address) {
            const a = cleanStr(r.address);
            if (!a) isValid = false;
            else keyParts.push(`addr:${a}`);
          }

          if (dupFields.phone) {
            const p = cleanPhone(r.phone);
            if (!p) isValid = false;
            else keyParts.push(`phone:${p}`);
          }

          if (dupFields.title) {
            const t = extractActualName(r.title);
            if (!t) isValid = false;
            else keyParts.push(`title:${t}`);
          }

          if (isValid && keyParts.length > 0) {
            dbKeySet.add(keyParts.join('|'));
          }
        }

        // 2. Đối chiếu records hiện tại với dbKeySet
        for (const item of records) {
          let isValid = true;
          const keyParts = [];

          if (dupFields.url) {
            const u = cleanStr(item.url);
            if (!u) isValid = false;
            else keyParts.push(`url:${u}`);
          }

          if (dupFields.address) {
            const a = cleanStr(item.address);
            if (!a) isValid = false;
            else keyParts.push(`addr:${a}`);
          }

          if (dupFields.phone) {
            const p = cleanPhone(item.phone);
            if (!p) isValid = false;
            else keyParts.push(`phone:${p}`);
          }

          if (dupFields.title) {
            const t = extractActualName(item.title);
            if (!t) isValid = false;
            else keyParts.push(`title:${t}`);
          }

          if (isValid && keyParts.length > 0) {
            const key = keyParts.join('|');
            if (dbKeySet.has(key)) {
              duplicateStts.push(item.stt);
            }
          }
        }
      }

      // Đảm bảo mảng trả về chứa các STT duy nhất
      const uniqueDuplicateStts = Array.from(new Set(duplicateStts));

      return {
        duplicateStts: uniqueDuplicateStts
      };
    } catch (error) {
      console.error('Lỗi khi đối chiếu trùng lặp Storage:', error);
      return { duplicateStts: [] };
    }
  }
};
