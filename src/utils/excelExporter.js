import * as XLSX from 'xlsx';

/**
 * Xuất mảng dữ liệu khách sạn/nhà hàng hiện tại ra file Excel (.xlsx)
 * @param {Array} data - Dữ liệu hiện tại (currentData)
 * @param {string} fileName - Tên tệp Excel xuất ra (mặc định: hotels_data.xlsx)
 * @param {string} dataType - Loại dữ liệu đang xuất ('hotels' hoặc 'restaurants')
 */
export function exportToExcel(data, fileName = 'hotels_data.xlsx', dataType = 'hotels') {
  if (!Array.isArray(data) || data.length === 0) return;

  const isRestaurant = dataType === 'restaurants';

  // 1. Sao chép và định dạng lại cột số điện thoại cũng như đổi tên header theo thứ tự chuẩn
  const formattedData = data.map((item, index) => {
    let phoneStr = item.phone || '';
    
    // Nếu số điện thoại bắt đầu bằng số 0, thêm dấu nháy đơn `'` phía trước để Excel không nuốt mất số 0
    if (phoneStr.startsWith('0')) {
      phoneStr = `'${phoneStr}`;
    }

    const cleanWeb = item.website || '';
    const isFb = cleanWeb.toLowerCase().includes('facebook.com') || cleanWeb.toLowerCase().includes('fb.com');

    return {
      'STT': index + 1,
      'Title': item.title || '',
      ...(isRestaurant ? { 'Cuisine Type': item.cuisineType || '' } : {}),
      'Email': item.email || '',
      'Phone': phoneStr,
      'Address': item.address || '',
      'URL': item.url || '',
      'Total Score': item.totalScore !== undefined && item.totalScore !== null ? String(item.totalScore) : '',
      'Website': isFb ? '' : cleanWeb,
      'Facebook': isFb ? cleanWeb : ''
    };
  });

  // 2. Chuyển đổi dữ liệu JSON thành Worksheet
  const worksheet = XLSX.utils.json_to_sheet(formattedData);

  // 3. Thiết lập độ rộng cột cho chuyên nghiệp (wch là số ký tự hiển thị tối đa)
  const columnWidths = [
    { wch: 6 },   // Cột STT
    { wch: 30 },  // Cột Title
    ...(isRestaurant ? [{ wch: 20 }] : []), // Cột Cuisine Type
    { wch: 25 },  // Cột Email
    { wch: 16 },  // Cột Phone
    { wch: 45 },  // Cột Address
    { wch: 40 },  // Cột URL
    { wch: 12 },  // Cột Total Score
    { wch: 25 },  // Cột Website
    { wch: 25 }   // Cột Facebook
  ];
  worksheet['!cols'] = columnWidths;

  // 4. Tạo Workbook mới và gắn Worksheet vào
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook, 
    worksheet, 
    isRestaurant ? 'Restaurants Data' : 'Hotels Data'
  );

  // 5. Tiến hành ghi và tải file xuống máy người dùng
  XLSX.writeFile(workbook, fileName);
}
