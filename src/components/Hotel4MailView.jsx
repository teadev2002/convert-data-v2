import React, { useState } from 'react';
import { Button, Table } from 'antd';
import { toast } from 'react-toastify';
import { exportHotel4MailToExcel } from '../utils/excelExporter.js';

export default function Hotel4MailView({ data, onNavigate }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  if (!data || data.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', margin: '2rem auto', maxWidth: '600px' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>📭 Không có dữ liệu để hiển thị</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Vui lòng nạp dữ liệu hoặc kéo thả tệp tin ở trang chủ trước khi xem định dạng gửi mail.
        </p>
        <Button type="primary" onClick={() => onNavigate('/')}>
          🏠 Quay về Trang chủ
        </Button>
      </div>
    );
  }

  // Chuyển đổi dữ liệu sang định dạng JSON cho việc Copy/Download
  const getMappedJsonData = () => {
    return data.map((item, index) => ({
      "STT": index + 1,
      "Tên khách sạn": item.title || '',
      "Email": item.email || '',
      "Phone": item.phone || '',
      "CategoryName": item.categoryName || '',
      "Ghi chú": "",
      "Ngày tương tác": "",
      "Tên nv gọi": "",
      "Emai": "",
      "Gửi email": "",
      "Nhắc L1": "",
      "Nhắc lần 2": "",
      "Ngày nhận Báo giá, Hợp đồng": "",
      "Ngày up TT NCC": "",
      "Đọc AI": "",
      "Kiểm tra Dữ liệu AI": "",
      "Zalo": "",
      "Gửi zalo": "",
      "Nhắc lần 1": "",
      "Nhắc lần 2": "",
      "Ngày nhận Báo giá, Hợp đồng ": "", // Khoảng trắng ở cuối để tránh bị ghi đè key
      "Ngày up TT NCC ": "",
      "Đọc AI ": "",
      "Kiểm tra Dữ liệu AI ": "",
      "Khác": "",
      "Address": item.address || '',
      "url": item.url || ''
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
    { title: 'STT', dataIndex: 'stt', width: 60, align: 'center', render: (_, __, index) => (currentPage - 1) * pageSize + index + 1 },
    { title: 'Tên khách sạn', dataIndex: 'title', width: 200, ellipsis: true },
    { title: 'Email', dataIndex: 'email', width: 180 },
    { title: 'Phone', dataIndex: 'phone', width: 140 },
    { title: 'CategoryName', dataIndex: 'categoryName', width: 140 },
    { title: 'Ghi chú', dataIndex: 'notes', width: 100, render: () => '' },
    { title: 'Ngày tương tác', dataIndex: 'interactDate', width: 130, render: () => '' },
    { title: 'Tên nv gọi', dataIndex: 'nvCall', width: 120, render: () => '' },
    { title: 'Emai', dataIndex: 'emai', width: 100, render: () => '' },
    { title: 'Gửi email', dataIndex: 'sendMail', width: 100, render: () => '' },
    { title: 'Nhắc L1', dataIndex: 'remindL1', width: 100, render: () => '' },
    { title: 'Nhắc lần 2', dataIndex: 'remindL2', width: 100, render: () => '' },
    { title: 'Ngày nhận Báo giá, Hợp đồng', dataIndex: 'docDate1', width: 200, render: () => '' },
    { title: 'Ngày up TT NCC', dataIndex: 'upDate1', width: 150, render: () => '' },
    { title: 'Đọc AI', dataIndex: 'readAi1', width: 100, render: () => '' },
    { title: 'Kiểm tra Dữ liệu AI', dataIndex: 'checkAi1', width: 160, render: () => '' },
    { title: 'Zalo', dataIndex: 'zalo', width: 100, render: () => '' },
    { title: 'Gửi zalo', dataIndex: 'sendZalo', width: 100, render: () => '' },
    { title: 'Nhắc lần 1', dataIndex: 'remindZalo1', width: 100, render: () => '' },
    { title: 'Nhắc lần 2', dataIndex: 'remindZalo2', width: 100, render: () => '' },
    { title: 'Ngày nhận Báo giá, Hợp đồng (Zalo)', dataIndex: 'docDate2', width: 200, render: () => '' },
    { title: 'Ngày up TT NCC (Zalo)', dataIndex: 'upDate2', width: 150, render: () => '' },
    { title: 'Đọc AI (Zalo)', dataIndex: 'readAi2', width: 100, render: () => '' },
    { title: 'Kiểm tra Dữ liệu AI (Zalo)', dataIndex: 'checkAi2', width: 160, render: () => '' },
    { title: 'Khác', dataIndex: 'other', width: 100, render: () => '' },
    { title: 'Address', dataIndex: 'address', width: 250, ellipsis: true },
    { title: 'url', dataIndex: 'url', width: 200, ellipsis: true }
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
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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

      <div className="table-container" style={{ overflowX: 'auto' }}>
        <Table
          dataSource={data.map((item, idx) => ({ ...item, key: idx }))}
          columns={columns}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: data.length,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
            showSizeChanger: true,
            pageSizeOptions: ['50', '100', '200', '500'],
            style: { color: 'var(--text-main)', marginTop: '1rem' }
          }}
          bordered
          size="small"
          scroll={{ x: 3200 }}
        />
      </div>
    </div>
  );
}
