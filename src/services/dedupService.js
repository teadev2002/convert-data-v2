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
   * @param {Array<Object>} records - Danh sách các bản ghi cần đối chiếu kiểm tra trùng lặp
   * @param {string|null} provinceId - ID của tỉnh thành đang xem (activeListId) dùng để loại trừ
   * @param {string} dataType - Loại dữ liệu đang đối chiếu ('hotels' hoặc 'restaurants')
   * @returns {Promise<{duplicateStts: Array<number>}>}
   */
  async checkDuplicates(records, provinceId = null, dataType = 'hotels') {
    try {
      let query = supabase
        .from(dataType)
        .select('url, address, phone, title');

      // Quy tắc loại trừ: Nếu đang xem tỉnh cũ, chỉ so khớp với các tỉnh thành khác
      if (provinceId) {
        query = query.neq('province_id', provinceId);
      }

      const { data: dbRecords, error } = await query;

      if (error) {
        console.error(`Lỗi khi lấy dữ liệu đối chiếu ${dataType} từ Supabase:`, error);
        throw new Error(`Lỗi đối chiếu dữ liệu Supabase: ${error.message}`);
      }

      const duplicateStts = [];

      if (dbRecords && dbRecords.length > 0) {
        for (const item of records) {
          for (const dbRec of dbRecords) {
            if (isMatch2of4(item, dbRec)) {
              duplicateStts.push(item.stt);
              break; // Dừng check dbRec tiếp theo cho item này
            }
          }
        }
      }

      // Đảm bảo mảng trả về là duy nhất
      const uniqueDuplicateStts = Array.from(new Set(duplicateStts));

      return {
        duplicateStts: uniqueDuplicateStts
      };
    } catch (error) {
      console.error('Lỗi khi đối chiếu trùng lặp Supabase:', error);
      return { duplicateStts: [] };
    }
  }
};
