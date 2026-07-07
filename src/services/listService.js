const INDEX_KEY = 'hotel_lists_index';
const DATA_PREFIX = 'hotel_data_';

// Hỗ trợ mô phỏng độ trễ mạng để giao diện hiển thị hiệu ứng tải (loading) mượt mà
const simulateNetworkDelay = (ms = 250) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Tiện ích đọc và ghi an toàn vào LocalStorage
 */
function getListsIndex() {
  try {
    const content = localStorage.getItem(INDEX_KEY);
    return content ? JSON.parse(content) : [];
  } catch (e) {
    console.error('Lỗi đọc chỉ mục danh sách:', e);
    return [];
  }
}

function saveListsIndex(index) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch (e) {
    console.error('Lỗi ghi chỉ mục danh sách:', e);
  }
}

function getListRecords(listId) {
  try {
    const content = localStorage.getItem(`${DATA_PREFIX}${listId}`);
    return content ? JSON.parse(content) : [];
  } catch (e) {
    console.error(`Lỗi đọc dữ liệu danh sách ${listId}:`, e);
    return [];
  }
}

function saveListRecords(listId, records) {
  try {
    localStorage.setItem(`${DATA_PREFIX}${listId}`, JSON.stringify(records));
  } catch (e) {
    console.error(`Lỗi ghi dữ liệu danh sách ${listId}:`, e);
  }
}

export const listService = {
  /**
   * 1. Lấy danh mục các danh sách (Hotel Lists) từ hotel_lists_index
   * @returns {Promise<Array>} - Trả về mảng [{ id, name, count }]
   */
  async getAll() {
    await simulateNetworkDelay(150);
    return getListsIndex();
  },

  /**
   * Lấy dữ liệu chi tiết của danh sách từ hotel_data_[listId]
   * @param {string} id - ID danh sách
   * @returns {Promise<Object>} - Trả về đối tượng danh sách đầy đủ { id, name, count, data }
   */
  async getById(id) {
    await simulateNetworkDelay(150);
    const index = getListsIndex();
    const listSummary = index.find(item => item.id === id);
    if (!listSummary) return null;

    const data = getListRecords(id);
    return {
      ...listSummary,
      data
    };
  },

  /**
   * 2. Nghiệp vụ Lưu & Gộp dữ liệu (Save/Merge)
   * @param {string} name - Tên danh sách (tạo mới hoặc chọn trùng tên để gộp)
   * @param {Array} newData - Mảng bản ghi dữ liệu khách sạn mới
   * @returns {Promise<Object>} - Trả về thông tin danh sách sau khi lưu
   */
  async save(name, newData) {
    await simulateNetworkDelay(350);
    const index = getListsIndex();

    // Đảm bảo name là chuỗi hợp lệ, tránh lỗi khi name truyền vào là null/undefined
    const cleanName = String(name || '').trim();
    if (!cleanName) {
      throw new Error('Tên danh sách không được để trống.');
    }
    
    // Chuẩn hóa dữ liệu đầu vào theo Schema quy định (7 trường)
    const cleanNewData = newData.map((item, idx) => ({
      stt: idx + 1,
      title: item.title || '',
      phone: item.phone || '',
      address: item.address || '',
      url: item.url || '',
      totalScore: item.totalScore !== undefined && item.totalScore !== null ? String(item.totalScore) : '',
      website: item.website || ''
    }));

    // Tìm kiếm xem đã tồn tại danh sách trùng tên chưa (để gộp)
    const matchedList = index.find(item => item.name.toLowerCase() === cleanName.toLowerCase());

    if (matchedList) {
      // --- LỰA CHỌN: GỘP VÀO DANH SÁCH CŨ ---
      const listId = matchedList.id;
      const oldRecords = getListRecords(listId);
      
      // Tạo tập hợp các URL cũ để đối chiếu
      const oldUrlsSet = new Set(oldRecords.map(r => (r.url || '').trim().toLowerCase()));
      const mergedRecords = [...oldRecords];

      // Duyệt qua dữ liệu mới để loại bỏ bản ghi trùng lặp URL
      for (const newItem of cleanNewData) {
        const cleanUrl = (newItem.url || '').trim();
        if (cleanUrl) {
          // Chỉ thêm vào nếu URL không tồn tại trong danh sách cũ
          if (!oldUrlsSet.has(cleanUrl.toLowerCase())) {
            mergedRecords.push(newItem);
            oldUrlsSet.add(cleanUrl.toLowerCase());
          }
        } else {
          // Nếu không có URL, mặc định vẫn đẩy vào bảng
          mergedRecords.push(newItem);
        }
      }

      // Đánh số thứ tự (STT) lại động từ 1 cho danh sách gộp sạch
      mergedRecords.forEach((item, idx) => {
        item.stt = idx + 1;
      });

      // Lưu mảng gộp đã làm sạch đè lại vào key cũ
      saveListRecords(listId, mergedRecords);

      // Cập nhật lại chỉ mục
      matchedList.count = mergedRecords.length;
      saveListsIndex(index);

      return {
        id: listId,
        name: matchedList.name,
        count: mergedRecords.length
      };
    } else {
      // --- LỰA CHỌN: TẠO MỚI DANH SÁCH ---
      const newListId = `list_${Date.now()}`;
      
      // Đánh số thứ tự STT lại
      cleanNewData.forEach((item, idx) => {
        item.stt = idx + 1;
      });

      // Tạo key hotel_data_[newListId] lưu mảng dữ liệu khách sạn sạch
      saveListRecords(newListId, cleanNewData);

      // Thêm tên mới và thông tin vào chỉ mục hotel_lists_index
      const newIndexItem = {
        id: newListId,
        name: cleanName,
        count: cleanNewData.length
      };
      index.push(newIndexItem);
      saveListsIndex(index);

      return newIndexItem;
    }
  },

  /**
   * Xóa danh sách khỏi LocalStorage (xóa cả chỉ mục và dữ liệu chi tiết)
   * @param {string} id - ID danh sách cần xóa
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    await simulateNetworkDelay(150);
    const index = getListsIndex();
    const initialLength = index.length;
    
    // Lọc bỏ khỏi index
    const updatedIndex = index.filter(item => item.id !== id);
    if (updatedIndex.length !== initialLength) {
      saveListsIndex(updatedIndex);
      // Xóa key chi tiết hotel_data_[listId]
      localStorage.removeItem(`${DATA_PREFIX}${id}`);
      return true;
    }
    return false;
  }
};
