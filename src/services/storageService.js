/**
 * StorageService - Giải pháp lưu trữ dung lượng lớn sử dụng IndexedDB tích hợp sẵn trong trình duyệt.
 * Thay thế cho localStorage (vốn bị giới hạn 5MB) để lưu hàng vạn bản ghi (GBs) mượt mà.
 */

const DB_NAME = 'ConvertDataIndexedDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_store';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

export const storageService = {
  /**
   * Lấy dữ liệu theo Key (Trả về mảng/đối tượng đã parse hoặc fallback sang localStorage nếu chưa tự chuyển)
   */
  async getItem(key) {
    try {
      const db = await openDB();
      const value = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      if (value !== undefined) {
        return value;
      }

      // Nếu trong IndexedDB chưa có, kiểm tra và chuyển dữ liệu cũ từ localStorage sang
      const localValStr = localStorage.getItem(key);
      if (localValStr) {
        try {
          const parsed = JSON.parse(localValStr);
          await this.setItem(key, parsed);
          localStorage.removeItem(key); // Xóa khỏi localStorage để giải phóng bộ nhớ 5MB
          return parsed;
        } catch {
          return null;
        }
      }

      return null;
    } catch (err) {
      console.error('Lỗi khi đọc IndexedDB:', err);
      // Fallback nếu có sự cố với IndexedDB
      const fallback = localStorage.getItem(key);
      return fallback ? JSON.parse(fallback) : null;
    }
  },

  /**
   * Lưu dữ liệu theo Key (Lưu trực tiếp dưới dạng Object/Array trong IndexedDB không cần JSON stringify)
   */
  async setItem(key, data) {
    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(data, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.error('Lỗi khi ghi IndexedDB:', err);
      throw new Error(`Không thể lưu dữ liệu vào IndexedDB: ${err.message}`, { cause: err });
    }
  },

  /**
   * Xóa một key trong IndexedDB (và localStorage nếu có)
   */
  async removeItem(key) {
    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      localStorage.removeItem(key);
    } catch (err) {
      console.error('Lỗi khi xóa trong IndexedDB:', err);
    }
  },

  /**
   * Lấy tất cả các keys lưu trữ
   */
  async getAllKeys() {
    try {
      const db = await openDB();
      const idbKeys = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAllKeys();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      // Kết hợp các key còn dính trong localStorage
      const lsKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) lsKeys.push(k);
      }

      const allKeys = Array.from(new Set([...idbKeys, ...lsKeys]));
      return allKeys;
    } catch (err) {
      console.error('Lỗi khi lấy danh sách keys từ IndexedDB:', err);
      const lsKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) lsKeys.push(k);
      }
      return lsKeys;
    }
  }
};
