import { supabase } from '../utils/supabase';

export const dedupService = {
  /**
   * 3. Nghiệp vụ Kiểm tra trùng lặp (Deduplication Check) diện rộng trên Supabase
   * @param {Array<string>} urls - Danh sách URL cần đối chiếu kiểm tra trùng lặp
   * @param {string|null} provinceId - ID của tỉnh thành đang xem (activeListId) dùng để loại trừ
   * @param {string} dataType - Loại dữ liệu đang đối chiếu ('hotels' hoặc 'restaurants')
   * @returns {Promise<{duplicateUrls: Array<string>}>}
   */
  async checkDuplicates(urls, provinceId = null, dataType = 'hotels') {
    try {
      let query = supabase.from(dataType).select('url');

      // Quy tắc loại trừ: Nếu đang xem tỉnh cũ, chỉ so khớp với các tỉnh thành khác
      if (provinceId) {
        query = query.neq('province_id', provinceId);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Lỗi khi lấy dữ liệu URL đối chiếu ${dataType} từ Supabase:`, error);
        throw new Error(`Lỗi đối chiếu dữ liệu Supabase: ${error.message}`);
      }

      const existingUrlsSet = new Set();
      if (data) {
        for (const item of data) {
          if (item.url && item.url.trim()) {
            existingUrlsSet.add(item.url.trim().toLowerCase());
          }
        }
      }

      // Lọc ra các URL trùng lặp (nằm trong existingUrlsSet)
      const duplicateUrls = urls
        .map(u => u ? u.trim() : '')
        .filter(u => u !== '' && existingUrlsSet.has(u.toLowerCase()));

      // Đảm bảo mảng URL trùng lặp trả về là duy nhất
      const uniqueDuplicateUrls = Array.from(new Set(duplicateUrls));

      return {
        duplicateUrls: uniqueDuplicateUrls
      };
    } catch (error) {
      console.error('Lỗi khi đối chiếu trùng lặp Supabase:', error);
      return { duplicateUrls: [] };
    }
  }
};
