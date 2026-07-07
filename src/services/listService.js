import { supabase } from '../utils/supabase';

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

export const listService = {
  /**
   * 1. Lấy danh mục các tỉnh thành từ bảng provinces và tính số lượng bản ghi tương ứng
   * @param {string} dataType - Loại dữ liệu truy vấn ('hotels' hoặc 'restaurants')
   * @returns {Promise<Array>} - Mảng danh sách [{ id, name, slug, count }]
   */
  async getAll(dataType = 'hotels') {
    // Tải tất cả tỉnh thành
    const { data: provinces, error: provErr } = await supabase
      .from('provinces')
      .select('*')
      .order('name', { ascending: true });

    if (provErr) {
      console.error('Lỗi khi lấy danh sách tỉnh thành:', provErr);
      throw new Error(`Không thể lấy danh mục tỉnh thành: ${provErr.message}`);
    }

    if (!provinces || provinces.length === 0) return [];

    // Tải tất cả khóa ngoại province_id từ bảng hotels/restaurants để tự tính toán số lượng ở client (tối ưu hóa hiệu năng)
    const { data: records, error: recErr } = await supabase
      .from(dataType)
      .select('province_id');

    if (recErr) {
      console.error(`Lỗi tải liên kết dữ liệu ${dataType}:`, recErr);
      throw new Error(`Lỗi liên kết cơ sở dữ liệu: ${recErr.message}`);
    }

    const countsMap = {};
    if (records) {
      records.forEach(r => {
        const pid = r.province_id;
        if (pid) {
          countsMap[pid] = (countsMap[pid] || 0) + 1;
        }
      });
    }

    return provinces.map(p => ({
      id: String(p.id),
      name: p.name,
      slug: p.slug,
      count: countsMap[p.id] || 0
    }));
  },

  /**
   * Lấy chi tiết các khách sạn/nhà hàng của một tỉnh thành
   * @param {string} provinceId - ID của tỉnh thành
   * @param {string} dataType - Loại dữ liệu ('hotels' hoặc 'restaurants')
   * @returns {Promise<Object>} - Đối tượng { id, name, count, data: [...] }
   */
  async getById(provinceId, dataType = 'hotels') {
    // 1. Lấy chi tiết tỉnh thành
    const { data: province, error: provErr } = await supabase
      .from('provinces')
      .select('*')
      .eq('id', provinceId)
      .maybeSingle();

    if (provErr) {
      console.error('Lỗi tải thông tin tỉnh thành:', provErr);
      throw new Error(`Lỗi tải tỉnh thành: ${provErr.message}`);
    }

    if (!province) return null;

    // 2. Lấy toàn bộ khách sạn hoặc nhà hàng thuộc tỉnh này, sắp xếp theo title
    const { data: records, error: recErr } = await supabase
      .from(dataType)
      .select('*')
      .eq('province_id', provinceId)
      .order('title', { ascending: true });

    if (recErr) {
      console.error(`Lỗi lấy danh sách ${dataType}:`, recErr);
      throw new Error(`Lỗi tải danh sách chi tiết: ${recErr.message}`);
    }

    // Ánh xạ các cột về dạng camelCase
    const mappedData = (records || []).map((r, idx) => ({
      stt: idx + 1,
      id: r.id,
      title: r.title || '',
      phone: r.phone || '',
      address: r.address || '',
      url: r.url || '',
      totalScore: r.totalScore !== undefined && r.totalScore !== null ? String(r.totalScore) : '',
      website: r.website || '',
      email: r.email || '',
      ...(dataType === 'restaurants' ? { cuisineType: r.cuisine_type || '' } : {}),
      isDuplicate: false
    }));

    return {
      id: String(province.id),
      name: province.name,
      count: mappedData.length,
      data: mappedData
    };
  },

  /**
   * 2. Nghiệp vụ Lưu & Gộp (Save/Merge) cộng thêm dữ liệu theo tỉnh
   * @param {string} provinceName - Tên tỉnh (người dùng nhập mới hoặc được tự động điền)
   * @param {Array} newData - Mảng dữ liệu khách sạn/nhà hàng mới cần chèn
   * @param {string|null} provinceId - ID của tỉnh được chọn (nếu chọn tỉnh cũ)
   * @param {string} dataType - Loại dữ liệu ('hotels' hoặc 'restaurants')
   * @returns {Promise<Object>} - Trả về tóm tắt tỉnh thành sau khi lưu { id, name, count }
   */
  async save(provinceName, newData, provinceId = null, dataType = 'hotels') {
    const cleanProvinceName = String(provinceName || '').trim();
    if (!cleanProvinceName) {
      throw new Error('Tên tỉnh thành không được để trống.');
    }

    // Chuẩn hóa dữ liệu đầu vào theo Schema quy định
    const cleanNewData = newData.map(item => ({
      title: item.title || '',
      phone: item.phone || '',
      address: item.address || '',
      url: item.url || '',
      totalScore: item.totalScore !== undefined && item.totalScore !== null ? String(item.totalScore) : '',
      website: item.website || '',
      email: item.email || null, // Lưu dưới dạng NULL nếu không có địa chỉ email
      ...(dataType === 'restaurants' ? { cuisine_type: item.cuisineType || '' } : {})
    }));

    let targetProvinceId = provinceId;

    // 1. Nếu không có provinceId, kiểm tra xem tỉnh thành này đã tồn tại trong DB chưa
    if (!targetProvinceId) {
      const { data: existingProv, error: findErr } = await supabase
        .from('provinces')
        .select('*')
        .ilike('name', cleanProvinceName)
        .maybeSingle();

      if (findErr) throw new Error(`Lỗi tìm kiếm tỉnh thành: ${findErr.message}`);

      if (existingProv) {
        targetProvinceId = existingProv.id;
      } else {
        // Tỉnh thành chưa có -> chèn mới vào bảng provinces
        const newSlug = slugify(cleanProvinceName);
        const { data: newProv, error: insertProvErr } = await supabase
          .from('provinces')
          .insert({ name: cleanProvinceName, slug: newSlug })
          .select()
          .single();

        if (insertProvErr) {
          console.error('Lỗi khi chèn tỉnh thành mới:', insertProvErr);
          throw new Error(`Lỗi khởi tạo tỉnh thành mới: ${insertProvErr.message}`);
        }

        targetProvinceId = newProv.id;
      }
    }

    // 2. Tải toàn bộ dữ liệu hiện tại của tỉnh này để so khớp trùng lặp URL
    const { data: oldRecords, error: fetchErr } = await supabase
      .from(dataType)
      .select('*')
      .eq('province_id', targetProvinceId);

    if (fetchErr) throw new Error(`Lỗi tải dữ liệu cũ: ${fetchErr.message}`);

    const oldUrlsSet = new Set((oldRecords || []).map(r => (r.url || '').trim().toLowerCase()));
    const toInsert = [];

    // Lọc trùng bằng URL và chuẩn bị dữ liệu chèn mới (cộng thêm)
    for (const newItem of cleanNewData) {
      const cleanUrl = (newItem.url || '').trim();
      if (cleanUrl) {
        if (!oldUrlsSet.has(cleanUrl.toLowerCase())) {
          toInsert.push({
            ...newItem,
            province_id: targetProvinceId
          });
          oldUrlsSet.add(cleanUrl.toLowerCase());
        }
      } else {
        toInsert.push({
          ...newItem,
          province_id: targetProvinceId
        });
      }
    }

    // Chèn dữ liệu cộng thêm vào bảng
    if (toInsert.length > 0) {
      const { error: insertErr } = await supabase
        .from(dataType)
        .insert(toInsert);

      if (insertErr) {
        console.error(`Lỗi chèn dữ liệu ${dataType} lên Supabase:`, insertErr);
        throw new Error(`Lỗi lưu dữ liệu: ${insertErr.message}`);
      }
    }

    const totalCount = (oldRecords || []).length + toInsert.length;

    return {
      id: String(targetProvinceId),
      name: cleanProvinceName,
      count: totalCount
    };
  },

  /**
   * Xóa toàn bộ dữ liệu của một tỉnh trong bảng dataType
   * @param {string} provinceId - ID của tỉnh
   * @param {string} dataType - Loại dữ liệu ('hotels' hoặc 'restaurants')
   * @returns {Promise<boolean>}
   */
  async delete(provinceId, dataType = 'hotels') {
    const { error } = await supabase
      .from(dataType)
      .delete()
      .eq('province_id', provinceId);

    if (error) {
      console.error(`Lỗi xóa dữ liệu ${dataType}:`, error);
      throw new Error(`Lỗi xóa dữ liệu: ${error.message}`);
    }

    return true;
  }
};
