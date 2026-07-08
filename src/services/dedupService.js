import { supabase } from '../utils/supabase';

// Hàm đối chiếu xem hai bản ghi có trùng khớp ít nhất 2 trong 4 trường (url, address, phone, title)
function isMatch2of4(r1, r2) {
  let matchCount = 0;
  
  const clean = (val) => String(val || '').trim().toLowerCase().normalize('NFC');
  const cleanPhone = (val) => String(val || '').replace(/\D/g, '');

  const u1 = clean(r1.url);
  const u2 = clean(r2.url);
  if (u1 && u2 && u1 === u2) matchCount++;

  const a1 = clean(r1.address);
  const a2 = clean(r2.address);
  if (a1 && a2 && a1 === a2) matchCount++;

  const p1 = cleanPhone(r1.phone);
  const p2 = cleanPhone(r2.phone);
  if (p1 && p2 && p1 === p2) matchCount++;

  const t1 = clean(r1.title);
  const t2 = clean(r2.title);
  if (t1 && t2 && t1 === t2) matchCount++;

  return matchCount >= 2;
}

export const dedupService = {
  /**
   * 3. Nghiệp vụ Kiểm tra trùng lặp (Deduplication Check) diện rộng trên Supabase
   * Kết hợp truy vấn song song cả 2 bảng hotels và restaurants để đối chiếu trùng lặp chéo toàn bộ DB
   * @param {Array<Object>} records - Danh sách các bản ghi cần đối chiếu kiểm tra trùng lặp
   * @param {string|null} provinceId - ID của tỉnh thành đang xem (activeListId) dùng để loại trừ
   * @param {string} dataType - Loại dữ liệu đang đối chiếu ('hotels' hoặc 'restaurants')
   * @returns {Promise<{duplicateStts: Array<number>}>}
   */
  async checkDuplicates(records, provinceId = null, dataType = 'hotels') {
    try {
      // 1. Thực hiện truy vấn song song dữ liệu từ cả 2 bảng hotels và restaurants trên Supabase
      const [resHotels, resRestaurants] = await Promise.all([
        supabase.from('hotels').select('url, address, phone, title, province_id'),
        supabase.from('restaurants').select('url, address, phone, title, province_id')
      ]);

      if (resHotels.error) {
        console.error('Lỗi khi tải bảng hotels:', resHotels.error);
        throw new Error(`Lỗi truy vấn hotels: ${resHotels.error.message}`);
      }
      if (resRestaurants.error) {
        console.error('Lỗi khi tải bảng restaurants:', resRestaurants.error);
        throw new Error(`Lỗi truy vấn restaurants: ${resRestaurants.error.message}`);
      }

      const dbHotels = resHotels.data || [];
      const dbRestaurants = resRestaurants.data || [];

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

      // 3. Tiến hành đối chiếu thuật toán khớp 2 trong 4 trường
      if (allDbRecords.length > 0) {
        for (const item of records) {
          for (const dbRec of allDbRecords) {
            if (isMatch2of4(item, dbRec)) {
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
