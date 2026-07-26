import React from 'react';
import { toast } from 'react-toastify';

export default function JsonPreview({ data, dataType }) {
  // Lọc bớt cờ isDuplicate khi hiển thị và xuất JSON cho người dùng
  const cleanJsonData = data.map((item) => {
    const obj = {
      stt: item.stt,
      title: item.title || '',
      email: item.email || '',
      phone: item.phone || '',
      address: item.address || '',
      url: item.url || '',
      totalScore: item.totalScore || '',
      website: item.website || '',
      facebook: item.facebook || '',
      categoryName: item.categoryName || item.cuisineType || '',
      source: item.source || '',
      isFlag: !!item.isFlag
    };
    return obj;
  });

  const jsonString = JSON.stringify(cleanJsonData, null, 2);

  const handleDownload = () => {
    try {
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = dataType === 'hotels' 
        ? 'hotels_filtered.json' 
        : dataType === 'restaurants' 
          ? 'restaurants_filtered.json' 
          : 'spa_filtered.json';
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Đã tải xuống tệp tin "${fileName}" thành công!`);
    } catch (err) {
      toast.error('Không thể tải tệp JSON: ' + err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button 
          type="button" 
          className="btn btn-secondary" 
          onClick={handleDownload}
          title="Tải xuống toàn bộ chuỗi JSON bên dưới thành tệp tin"
        >
          📥 Tải xuống JSON
        </button>
      </div>
      <div className="json-preview-container">
        <pre className="json-code">
          <code>{jsonString}</code>
        </pre>
      </div>
    </div>
  );
}
