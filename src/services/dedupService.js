const INDEX_KEY = 'hotel_lists_index';
const DATA_PREFIX = 'hotel_data_';

export const dedupService = {
  /**
   * 3. Nghiệp vụ Kiểm tra trùng lặp (Deduplication Check)
   * @param {Array<string>} urls - Danh sách URL cần đối chiếu kiểm tra trùng lặp
   * @param {string|null} excludeListId - ID của danh sách đang xem trên màn hình (activeListId) dùng để loại trừ
   * @returns {Promise<{duplicateUrls: Array<string>}>}
   */
  async checkDuplicates(urls, excludeListId = null) {
    // Giả lập thời gian trễ của mạng
    await new Promise(resolve => setTimeout(resolve, 150));

    try {
      // Đọc chỉ mục danh sách hotel_lists_index
      const indexContent = localStorage.getItem(INDEX_KEY);
      const index = indexContent ? JSON.parse(indexContent) : [];

      const existingUrlsSet = new Set();

      // Duyệt qua tất cả các danh sách đã lưu để gom toàn bộ URL hiện có
      for (const list of index) {
        // QUY TẮC SO KHỚP URL:
        // - Nếu đang xem danh sách cũ (excludeListId có giá trị): loại trừ chính nó ra khỏi đối chiếu để tránh tự báo trùng
        // - Nếu là file mới import (excludeListId rỗng): so sánh đối chiếu với toàn bộ dữ liệu của tất cả các danh sách
        if (excludeListId && list.id === excludeListId) {
          continue;
        }

        // Đọc dữ liệu chi tiết của danh sách từ key hotel_data_[listId]
        const dataContent = localStorage.getItem(`${DATA_PREFIX}${list.id}`);
        if (dataContent) {
          const records = JSON.parse(dataContent);
          for (const item of records) {
            if (item.url && item.url.trim()) {
              // Sử dụng chữ thường để đối chiếu không phân biệt hoa thường
              existingUrlsSet.add(item.url.trim().toLowerCase());
            }
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
      console.error('Lỗi khi đối chiếu trùng lặp LocalStorage:', error);
      return { duplicateUrls: [] };
    }
  }
};
