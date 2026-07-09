import { supabase } from '../utils/supabase';

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

// Helper để lấy toàn bộ bản ghi của một bảng (tự động phân trang để vượt qua giới hạn max_rows = 1000 của Supabase)
async function fetchAll(tableName, selectQuery = '*') {
  let results = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select(selectQuery)
      .range(from, from + step - 1);

    if (error) {
      throw error;
    }

    if (data && data.length > 0) {
      results = [...results, ...data];
      if (data.length < step) {
        hasMore = false;
      } else {
        from += step;
      }
    } else {
      hasMore = false;
    }
  }

  return results;
}

export const dedupService = {
  /**
   * 3. Nghiệp vụ Kiểm tra trùng lặp (Deduplication Check) diện rộng trên Supabase
   * Kết hợp truy vấn song song cả 2 bảng hotels và restaurants để đối chiếu trùng lặp chéo toàn bộ DB
   * @param {Array<Object>} records - Danh sách các bản ghi cần đối chiếu kiểm tra trùng lặp
   * @param {string|null} provinceId - ID của tỉnh thành đang xem (activeListId) dùng để loại trừ
   * @param {string} dataType - Loại dữ liệu đang đối chiếu ('hotels' hoặc 'restaurants')
   * @param {Object} dupFields - Đối tượng chứa trạng thái kích hoạt của các trường lọc trùng
   * @returns {Promise<{duplicateStts: Array<number>}>}
   */
  async checkDuplicates(records, provinceId = null, dataType = 'hotels', dupFields = { url: true, address: true, phone: true, title: true }) {
    try {
      // 1. Thực hiện truy vấn song song dữ liệu từ cả 2 bảng hotels và restaurants trên Supabase (không giới hạn 1000 dòng)
      const [dbHotels, dbRestaurants] = await Promise.all([
        fetchAll('hotels', 'url, address, phone, title, province_id'),
        fetchAll('restaurants', 'url, address, phone, title, province_id')
      ]);

      // 2. Quy tắc loại trừ tự đối chiếu:
      // Chỉ loại trừ các bản ghi thuộc tỉnh đang xem (provinceId) của ĐÚNG loại hình dữ liệu hiện tại (dataType)
      const filteredHotels = (dataType === 'hotels' && provinceId)
        ? dbHotels.filter(h => String(h.province_id) !== String(provinceId))
        : dbHotels;

      const filteredRestaurants = (dataType === 'restaurants' && provinceId)
        ? dbRestaurants.filter(r => String(r.province_id) !== String(provinceId))
        : dbRestaurants;

      // Hợp nhất toàn bộ dữ liệu đối chiếu từ cả 2 bảng
      const allDbRecords = [...filteredHotels, ...filteredRestaurants];

      const duplicateStts = [];

      // 3. Tiến hành đối chiếu thuật toán khớp trên các trường được kích hoạt
      if (allDbRecords.length > 0) {
        for (const item of records) {
          for (const dbRec of allDbRecords) {
            if (isMatchSelected(item, dbRec, dupFields)) {
              duplicateStts.push(item.stt);
              break; // Phát hiện trùng, dừng quét dbRec tiếp theo cho cơ sở này
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
      console.error('Lỗi khi đối chiếu trùng lặp chéo Supabase:', error);
      return { duplicateStts: [] };
    }
  }
};
