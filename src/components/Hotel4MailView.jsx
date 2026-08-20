import React, { useState } from 'react';
import { Button, Table } from 'antd';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { parseHotelData } from '../utils/parser.js';
import { exportHotel4MailToExcel } from '../utils/excelExporter.js';

export default function Hotel4MailView({ data, onNavigate, onImportData, currentFileName }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  // Xử lý nạp file Excel/JSON trực tiếp tại trang này
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileType = file.name.split('.').pop().toLowerCase();
    if (fileType !== 'json' && fileType !== 'csv' && fileType !== 'xlsx' && fileType !== 'xls') {
      toast.error('Chỉ hỗ trợ nạp tệp định dạng .json, .csv, .xlsx hoặc .xls');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let parsed = [];
        if (fileType === 'xlsx' || fileType === 'xls') {
          const binaryData = new Uint8Array(event.target.result);
          const workbook = XLSX.read(binaryData, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawJson = XLSX.utils.sheet_to_json(worksheet);
          const jsonStr = JSON.stringify(rawJson, null, 2);
          parsed = parseHotelData(jsonStr);
        } else {
          const text = event.target.result;
          parsed = parseHotelData(text);
        }

        if (parsed.length === 0) {
          toast.warn('Không tìm thấy dữ liệu hợp lệ trong tệp.');
          return;
        }

        if (onImportData) {
          onImportData(parsed, file.name);
          toast.success(`Đã nạp thành công ${parsed.length} bản ghi!`);
        }
      } catch (err) {
        console.error('File parsing error:', err);
        toast.error(`Lỗi phân tích tệp tin: ${err.message}`);
      }
    };

    if (fileType === 'xlsx' || fileType === 'xls') {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
    
    // Reset file input value để cho phép chọn lại cùng 1 file
    e.target.value = '';
  };

  // Cuộn chuột ngang thông minh khi người dùng lăn chuột dọc trực tiếp trên thanh cuộn ngang ở đáy bảng
  const handleWheel = (e) => {
    const container = e.currentTarget;
    if (container.scrollWidth > container.clientWidth) {
      const rect = container.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const clientHeight = container.clientHeight;
      const offsetHeight = container.offsetHeight;

      // Phát hiện chuột nằm trên thanh cuộn ngang ở đáy bảng
      const isHoveringScrollbar = relativeY >= clientHeight && relativeY <= offsetHeight;

      if (isHoveringScrollbar && e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', margin: '2rem auto', maxWidth: '600px' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>📭 Không có dữ liệu để hiển thị</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Bạn có thể nạp tệp dữ liệu (Excel/JSON) trực tiếp tại đây hoặc quay về trang chủ.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
          <input
            type="file"
            id="hotel4mail-file-input-empty"
            accept=".json,.csv,.xlsx,.xls"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <Button type="primary" onClick={() => document.getElementById('hotel4mail-file-input-empty').click()}>
            📥 Nạp File dữ liệu
          </Button>
          <Button onClick={() => onNavigate('/')}>
            🏠 Quay về Trang chủ
          </Button>
        </div>
      </div>
    );
  }

  // Phân trang thủ công trên Client
  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedData = data.slice(startIndex, endIndex);

  // Chuyển đổi dữ liệu sang định dạng JSON cho việc Copy/Download
  const getMappedJsonData = () => {
    return data.map((item, index) => ({
      "STT": index + 1,
      "Tên khách sạn": item.title || item["Tên khách sạn"] || item["Hotel Name"] || '',
      "Email": item.email || item["Email"] || '',
      "Phone": item.phone || item["Phone"] || '',
      "CategoryName": item.categoryName || item["CategoryName"] || '',
      "Ghi chú": item["Ghi chú"] || '',
      "Ngày tương tác": item["Ngày tương tác"] || '',
      "Tên nv gọi": item["Tên nv gọi"] || '',
      "Emai": item["Emai"] || item["Email liên hệ"] || '',
      "Gửi email": item["Gửi email"] || '',
      "Nhắc L1": item["Nhắc L1"] || item["Nhắc lần 1 (Email)"] || '',
      "Nhắc lần 2": item["Nhắc lần 2"] || item["Nhắc lần 2 (Email)"] || '',
      "Ngày nhận Báo giá, Hợp đồng": item["Ngày nhận Báo giá, Hợp đồng"] || item["Ngày nhận Báo giá, Hợp đồng (Email)"] || '',
      "Ngày up TT NCC": item["Ngày up TT NCC"] || item["Ngày up TT NCC (Email)"] || '',
      "Đọc AI": item["Đọc AI"] || item["Đọc AI (Email)"] || '',
      "Kiểm tra Dữ liệu AI": item["Kiểm tra Dữ liệu AI"] || item["Kiểm tra Dữ liệu AI (Email)"] || '',
      "Zalo": item["Zalo"] || '',
      "Gửi zalo": item["Gửi zalo"] || '',
      "Nhắc lần 1": item["Nhắc lần 1"] || item["Nhắc lần 1 (Zalo)"] || '',
      "Nhắc lần 2": item["Nhắc lần 2"] || item["Nhắc lần 2 (Zalo)"] || '',
      "Ngày nhận Báo giá, Hợp đồng ": item["Ngày nhận Báo giá, Hợp đồng (Zalo)"] || item["Ngày nhận Báo giá, Hợp đồng "] || '',
      "Ngày up TT NCC ": item["Ngày up TT NCC (Zalo)"] || item["Ngày up TT NCC "] || '',
      "Đọc AI ": item["Đọc AI (Zalo)"] || item["Đọc AI "] || '',
      "Kiểm tra Dữ liệu AI ": item["Kiểm tra Dữ liệu AI (Zalo)"] || item["Kiểm tra Dữ liệu AI "] || '',
      "Khác": item["Khác"] || '',
      "Address": item.address || item["Address"] || '',
      "url": item.url || item["URL"] || item["url"] || ''
    }));
  };

  const handleCopyJson = () => {
    try {
      const mapped = getMappedJsonData();
      navigator.clipboard.writeText(JSON.stringify(mapped, null, 2));
      toast.success('Đã sao chép JSON định dạng hotel4mail vào Clipboard!');
    } catch (err) {
      toast.error('Lỗi sao chép: ' + err.message);
    }
  };

  const handleDownloadJson = () => {
    try {
      const mapped = getMappedJsonData();
      const blob = new Blob([JSON.stringify(mapped, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hotels_4mail.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Đã tải xuống file JSON định dạng hotel4mail!');
    } catch (err) {
      toast.error('Lỗi tải JSON: ' + err.message);
    }
  };

  const handleExportExcel = () => {
    try {
      exportHotel4MailToExcel(data, 'hotels_4mail.xlsx');
      toast.success('Đã tải xuống file Excel định dạng hotel4mail!');
    } catch (err) {
      toast.error('Lỗi xuất Excel: ' + err.message);
    }
  };

  // Định nghĩa các cột cho bảng hiển thị Ant Design
  const columns = [
    { title: 'STT', dataIndex: 'stt', width: 60, align: 'center', render: (_, __, index) => startIndex + index + 1 },
    { title: 'Tên khách sạn', dataIndex: 'title', width: 200, ellipsis: true, render: (val, item) => val || item["Hotel Name"] || item["Tên khách sạn"] || '' },
    { title: 'Email', dataIndex: 'email', width: 180, render: (val, item) => val || item["Email"] || '' },
    { title: 'Phone', dataIndex: 'phone', width: 140, render: (val, item) => val || item["Phone"] || '' },
    { title: 'CategoryName', dataIndex: 'categoryName', width: 140, render: (val, item) => val || item["CategoryName"] || '' },
    { title: 'Ghi chú', dataIndex: 'notes', width: 150, render: (_, item) => item["Ghi chú"] || '' },
    { title: 'Ngày tương tác', dataIndex: 'interactDate', width: 130, render: (_, item) => item["Ngày tương tác"] || '' },
    { title: 'Tên nv gọi', dataIndex: 'nvCall', width: 120, render: (_, item) => item["Tên nv gọi"] || '' },
    { title: 'Emai', dataIndex: 'emai', width: 130, render: (_, item) => item["Emai"] || item["Email liên hệ"] || '' },
    { title: 'Gửi email', dataIndex: 'sendMail', width: 120, render: (_, item) => item["Gửi email"] || '' },
    { title: 'Nhắc L1', dataIndex: 'remindL1', width: 120, render: (_, item) => item["Nhắc L1"] || item["Nhắc lần 1 (Email)"] || '' },
    { title: 'Nhắc lần 2', dataIndex: 'remindL2', width: 120, render: (_, item) => item["Nhắc lần 2"] || item["Nhắc lần 2 (Email)"] || '' },
    { title: 'Ngày nhận Báo giá, Hợp đồng', dataIndex: 'docDate1', width: 200, render: (_, item) => item["Ngày nhận Báo giá, Hợp đồng"] || item["Ngày nhận Báo giá, Hợp đồng (Email)"] || '' },
    { title: 'Ngày up TT NCC', dataIndex: 'upDate1', width: 150, render: (_, item) => item["Ngày up TT NCC"] || item["Ngày up TT NCC (Email)"] || '' },
    { title: 'Đọc AI', dataIndex: 'readAi1', width: 100, render: (_, item) => item["Đọc AI"] || item["Đọc AI (Email)"] || '' },
    { title: 'Kiểm tra Dữ liệu AI', dataIndex: 'checkAi1', width: 160, render: (_, item) => item["Kiểm tra Dữ liệu AI"] || item["Kiểm tra Dữ liệu AI (Email)"] || '' },
    { title: 'Zalo', dataIndex: 'zalo', width: 100, render: (_, item) => item["Zalo"] || '' },
    { title: 'Gửi zalo', dataIndex: 'sendZalo', width: 100, render: (_, item) => item["Gửi zalo"] || '' },
    { title: 'Nhắc lần 1', dataIndex: 'remindZalo1', width: 120, render: (_, item) => item["Nhắc lần 1"] || item["Nhắc lần 1 (Zalo)"] || '' },
    { title: 'Nhắc lần 2', dataIndex: 'remindZalo2', width: 120, render: (_, item) => item["Nhắc lần 2"] || item["Nhắc lần 2 (Zalo)"] || '' },
    { title: 'Ngày nhận Báo giá, Hợp đồng (Zalo)', dataIndex: 'docDate2', width: 200, render: (_, item) => item["Ngày nhận Báo giá, Hợp đồng (Zalo)"] || item["Ngày nhận Báo giá, Hợp đồng "] || '' },
    { title: 'Ngày up TT NCC (Zalo)', dataIndex: 'upDate2', width: 150, render: (_, item) => item["Ngày up TT NCC (Zalo)"] || item["Ngày up TT NCC "] || '' },
    { title: 'Đọc AI (Zalo)', dataIndex: 'readAi2', width: 100, render: (_, item) => item["Đọc AI (Zalo)"] || item["Đọc AI "] || '' },
    { title: 'Kiểm tra Dữ liệu AI (Zalo)', dataIndex: 'checkAi2', width: 160, render: (_, item) => item["Kiểm tra Dữ liệu AI (Zalo)"] || item["Kiểm tra Dữ liệu AI "] || '' },
    { title: 'Khác', dataIndex: 'other', width: 100, render: (_, item) => item["Khác"] || '' },
    { title: 'Address', dataIndex: 'address', width: 250, ellipsis: true, render: (val, item) => val || item["Address"] || '' },
    { title: 'url', dataIndex: 'url', width: 200, ellipsis: true, render: (val, item) => val || item["URL"] || item["url"] || '' }
  ];

  return (
    <div className="glass-card" style={{ padding: '1.5rem', marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📧 Định dạng Gửi Mail (view-hotel4mail)
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Đang hiển thị <strong style={{ color: 'var(--text-main)' }}>{data.length}</strong> khách sạn với cấu trúc cột tùy chỉnh.
          </p>
          {currentFileName && (
            <div style={{
              marginTop: '0.5rem',
              fontSize: '0.9rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              borderLeft: '3px solid var(--primary)',
              width: 'fit-content'
            }}>
              📂 <span>Tệp đang xử lý:</span>
              <strong style={{ color: 'var(--text-main)', wordBreak: 'break-all' }}>{currentFileName}</strong>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="file"
            id="hotel4mail-file-input"
            accept=".json,.csv,.xlsx,.xls"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <Button type="dashed" onClick={() => document.getElementById('hotel4mail-file-input').click()} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            📥 Nạp File dữ liệu
          </Button>
          <Button type="default" onClick={handleCopyJson} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            📋 Copy JSON
          </Button>
          <Button type="default" onClick={handleDownloadJson} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            📥 Tải JSON
          </Button>
          <Button type="primary" onClick={handleExportExcel} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            📥 Tải File Excel
          </Button>
          <Button type="primary" onClick={() => onNavigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: 'var(--warning-text)', borderColor: 'var(--warning-text)' }}>
            🔄 Chuyển Root
          </Button>
        </div>
      </div>

      <div 
        className="table-container" 
        style={{ overflowX: 'auto' }}
        onWheel={handleWheel}
      >
        <Table
          dataSource={paginatedData.map((item, idx) => ({ ...item, key: idx }))}
          columns={columns}
          pagination={false}
          bordered
          size="small"
          style={{ minWidth: '3400px' }}
        />
      </div>

      {/* Thanh phân trang tùy chỉnh bên ngoài bảng, không bị trượt khi cuộn ngang */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '1.5rem',
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          flexWrap: 'wrap',
          gap: '0.75rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Hiển thị <strong style={{ color: 'var(--text-main)' }}>{startIndex + 1} - {endIndex}</strong> trong tổng số <strong style={{ color: 'var(--text-main)' }}>{totalItems}</strong> bản ghi
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Button
              disabled={validCurrentPage === 1}
              onClick={() => setCurrentPage(1)}
              title="Trang đầu"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '40px', height: '32px' }}
            >
              ⏮️
            </Button>
            <Button
              disabled={validCurrentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              title="Trang trước"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '40px', height: '32px' }}
            >
              ◀️
            </Button>
            
            <span style={{ fontSize: '0.875rem', margin: '0 0.5rem', color: 'var(--text-muted)' }}>
              Trang <strong style={{ color: 'var(--primary)' }}>{validCurrentPage}</strong> / <strong>{totalPages}</strong>
            </span>

            <Button
              disabled={validCurrentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              title="Trang sau"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '40px', height: '32px' }}
            >
              ▶️
            </Button>
            <Button
              disabled={validCurrentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
              title="Trang cuối"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '40px', height: '32px' }}
            >
              ⏭️
            </Button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Số dòng mỗi trang:</span>
            <select
              className="form-select"
              style={{ width: '90px', padding: '0.25rem 0.5rem', fontSize: '0.875rem', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', borderColor: 'var(--border-color)', borderRadius: '6px' }}
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
