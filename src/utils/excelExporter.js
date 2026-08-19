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
console.log(`Exporting ${data.length} records to Excel. Extra column: ${hasExtraCol}`);
  // 1. Sao chép và định dạng lại các cột theo chuẩn
  const formattedData = data.map((item, index) => {
    let phoneStr = item.phone || '';
    
    // Nếu số điện thoại bắt đầu bằng số 0, thêm dấu nháy đơn `'` phía trước để Excel không nuốt mất số 0
    if (phoneStr.startsWith('0')) {
      phoneStr = `'${phoneStr}`;
    }

    return {
      'STT': index + 1,
      'Title': item.title || '',
      'Email': item.email || '',
      'Phone': phoneStr,
      'Address': item.address || '',
      'URL': item.url || '',
      'Total Score': item.totalScore !== undefined && item.totalScore !== null ? String(item.totalScore) : '',
      'Website': item.website || '',
      'Facebook': item.facebook || '',
      'Category Name': item.categoryName || item.cuisineType || '',
      'Source': item.source || '',
      'Is Flag': item.isFlag ? 'TRUE' : 'FALSE'
    };
  });

  // 2. Chuyển đổi dữ liệu JSON thành Worksheet
  const worksheet = XLSX.utils.json_to_sheet(formattedData);

  // 3. Thiết lập độ rộng cột cho chuyên nghiệp
  const columnWidths = [
    { wch: 6 },   // Cột STT
    { wch: 30 },  // Cột Title
    { wch: 20 },  // Cột Cuisine/Service Type
    { wch: 25 },  // Cột Email
    { wch: 16 },  // Cột Phone
    { wch: 45 },  // Cột Address
    { wch: 40 },  // Cột URL
    { wch: 12 },  // Cột Total Score
    { wch: 25 },  // Cột Website
    { wch: 25 },  // Cột Facebook
    { wch: 20 },  // Cột Source
    { wch: 10 }   // Cột Is Flag
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

/**
 * Xuất mảng dữ liệu khách sạn ra file Excel theo đúng cấu trúc 27 cột hotel4mail
 * @param {Array} data - Dữ liệu khách sạn hiện tại
 * @param {string} fileName - Tên file Excel xuất ra
 */
export function exportHotel4MailToExcel(data, fileName = 'hotels_4mail.xlsx') {
  if (!Array.isArray(data) || data.length === 0) return;

  const headers = [
    "STT", "Tên khách sạn", "Email", "Phone", "CategoryName", "Ghi chú",
    "Ngày tương tác", "Tên nv gọi", "Emai", "Gửi email", "Nhắc L1", "Nhắc lần 2",
    "Ngày nhận Báo giá, Hợp đồng", "Ngày up TT NCC", "Đọc AI", "Kiểm tra Dữ liệu AI",
    "Zalo", "Gửi zalo", "Nhắc lần 1", "Nhắc lần 2",
    "Ngày nhận Báo giá, Hợp đồng", "Ngày up TT NCC", "Đọc AI", "Kiểm tra Dữ liệu AI",
    "Khác", "Address", "url"
  ];

  const formattedRows = data.map((item, index) => {
    let phoneStr = item.phone || item["Phone"] || '';
    if (phoneStr.startsWith('0')) {
      phoneStr = `'${phoneStr}`;
    }

    return [
      index + 1,                 // STT
      item.title || item["Tên khách sạn"] || item["Hotel Name"] || '',
      item.email || item["Email"] || '',
      phoneStr,                  // Phone
      item.categoryName || item["CategoryName"] || '',   // CategoryName
      item["Ghi chú"] || '',
      item["Ngày tương tác"] || '',
      item["Tên nv gọi"] || '',
      item["Emai"] || item["Email liên hệ"] || '',
      item["Gửi email"] || '',
      item["Nhắc L1"] || item["Nhắc lần 1 (Email)"] || '',
      item["Nhắc lần 2"] || item["Nhắc lần 2 (Email)"] || '',
      item["Ngày nhận Báo giá, Hợp đồng"] || item["Ngày nhận Báo giá, Hợp đồng (Email)"] || '',
      item["Ngày up TT NCC"] || item["Ngày up TT NCC (Email)"] || '',
      item["Đọc AI"] || item["Đọc AI (Email)"] || '',
      item["Kiểm tra Dữ liệu AI"] || item["Kiểm tra Dữ liệu AI (Email)"] || '',
      item["Zalo"] || '',
      item["Gửi zalo"] || '',
      item["Nhắc lần 1"] || item["Nhắc lần 1 (Zalo)"] || '',
      item["Nhắc lần 2"] || item["Nhắc lần 2 (Zalo)"] || '',
      item["Ngày nhận Báo giá, Hợp đồng (Zalo)"] || item["Ngày nhận Báo giá, Hợp đồng "] || '',
      item["Ngày up TT NCC (Zalo)"] || item["Ngày up TT NCC "] || '',
      item["Đọc AI (Zalo)"] || item["Đọc AI "] || '',
      item["Kiểm tra Dữ liệu AI (Zalo)"] || item["Kiểm tra Dữ liệu AI "] || '',
      item["Khác"] || '',
      item.address || item["Address"] || '',
      item.url || item["URL"] || item["url"] || ''
    ];
  });

  // Tạo Worksheet từ mảng 2D
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...formattedRows]);

  // Thiết lập độ rộng cột
  const columnWidths = headers.map(() => ({ wch: 18 }));
  columnWidths[0] = { wch: 6 };    // STT
  columnWidths[1] = { wch: 30 };   // Tên khách sạn
  columnWidths[2] = { wch: 25 };   // Email
  columnWidths[3] = { wch: 16 };   // Phone
  columnWidths[25] = { wch: 45 };  // Address
  columnWidths[26] = { wch: 40 };  // url
  worksheet['!cols'] = columnWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Hotels for Mail');
  XLSX.writeFile(workbook, fileName);
}
