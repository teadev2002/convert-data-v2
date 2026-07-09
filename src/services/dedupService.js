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

export const dedupService = {
  /**
   * Nghiệp vụ Kiểm tra trùng lặp (Deduplication Check) diện rộng trên Local Storage
   * Quét tất cả các key lưu trữ dạng [dataType]-[provinceName] để làm đối chiếu loại trùng
   * @param {Array<Object>} records - Danh sách các bản ghi cần đối chiếu kiểm tra trùng lặp
   * @param {string|null} provinceId - Tên tỉnh thành đang xem (activeListId) dùng để loại trừ
   * @param {string} dataType - Loại dữ liệu đang đối chiếu ('hotels', 'restaurants' hoặc 'spa')
   * @param {Object} dupFields - Đối tượng chứa trạng thái kích hoạt của các trường lọc trùng
   * @returns {Promise<{duplicateStts: Array<number>}>}
   */
  async checkDuplicates(records, provinceId = null, dataType = 'hotels', dupFields = { url: true, address: true, phone: true, title: true }) {
    try {
      const activeKey = provinceId ? `${dataType}-${provinceId}` : null;
      let allDbRecords = [];

      // Quét tất cả các key trong localStorage để gộp dữ liệu đối chiếu chéo
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('hotels-') || key.startsWith('restaurants-') || key.startsWith('spa-'))) {
          // Bỏ qua key của danh sách hiện đang mở để tránh tự đối chiếu trùng chính nó
          if (activeKey && key.toLowerCase() === activeKey.toLowerCase()) {
            continue;
          }
          const data = JSON.parse(localStorage.getItem(key) || '[]');
          allDbRecords = [...allDbRecords, ...data];
        }
      }

      const duplicateStts = [];

      // Tiến hành đối chiếu trùng khớp
      if (allDbRecords.length > 0) {
        for (const item of records) {
          for (const dbRec of allDbRecords) {
            if (isMatchSelected(item, dbRec, dupFields)) {
              duplicateStts.push(item.stt);
              break; // Phát hiện trùng, dừng quét tiếp
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
      console.error('Lỗi khi đối chiếu trùng lặp Local Storage:', error);
      return { duplicateStts: [] };
    }
  }
};
