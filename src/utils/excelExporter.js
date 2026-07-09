import * as XLSX from 'xlsx';

/**
 * Xuất mảng dữ liệu khách sạn/nhà hàng/spa hiện tại ra file Excel (.xlsx)
 * @param {Array} data - Dữ liệu hiện tại (currentData)
 * @param {string} fileName - Tên tệp Excel xuất ra
 * @param {string} dataType - Loại dữ liệu đang xuất ('hotels', 'restaurants' hoặc 'spa')
 */
export function exportToExcel(data, fileName = 'hotels_data.xlsx', dataType = 'hotels') {
  if (!Array.isArray(data) || data.length === 0) return;

  const hasExtraCol = dataType === 'restaurants' || dataType === 'spa';

  // 1. Sao chép và định dạng lại các cột theo chuẩn
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
      'Neighborhood': item.neighborhood || '',
      ...(hasExtraCol ? { [dataType === 'restaurants' ? 'Cuisine Type' : 'Service Type']: item.cuisineType || '' } : {}),
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

  // 3. Thiết lập độ rộng cột cho chuyên nghiệp
  const columnWidths = [
    { wch: 6 },   // Cột STT
    { wch: 30 },  // Cột Title
    { wch: 18 },  // Cột Neighborhood
    ...(hasExtraCol ? [{ wch: 20 }] : []), // Cột Cuisine/Service Type
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
  const sheetName = dataType === 'restaurants' 
    ? 'Restaurants Data' 
    : dataType === 'spa' 
    ? 'Spa Data' 
    : 'Hotels Data';

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // 5. Tiến hành ghi và tải file xuống máy người dùng
  XLSX.writeFile(workbook, fileName);
}
