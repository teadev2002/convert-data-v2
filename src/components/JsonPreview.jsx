import React from 'react';
import { toast } from 'react-toastify';

export default function JsonPreview({ data, dataType }) {
  // Lọc bớt cờ isDuplicate khi hiển thị và xuất JSON cho người dùng
  const cleanJsonData = data.map(({ stt, title, phone, address, url, totalScore, website, cuisineType, email, neighborhood }) => {
    const cleanWeb = website || '';
    const isFb = cleanWeb.toLowerCase().includes('facebook.com') || cleanWeb.toLowerCase().includes('fb.com');
    const obj = {
      stt,
      title,
      neighborhood: neighborhood || '',
      ...((dataType === 'restaurants' || dataType === 'spa') ? { cuisineType } : {}),
      email: email || '',
      phone,
      address,
      url,
      totalScore,
      website: isFb ? '' : cleanWeb,
      facebook: isFb ? cleanWeb : ''
    };
    return obj;
  });

  const jsonString = JSON.stringify(cleanJsonData, null, 2);

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(jsonString);
      toast.success('Đã sao chép dữ liệu JSON vào bộ nhớ đệm (Clipboard)!');
    } catch (err) {
      toast.error('Không thể sao chép tự động: ' + err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button 
          type="button" 
          className="btn btn-secondary" 
          onClick={handleCopy}
          title="Sao chép toàn bộ chuỗi JSON bên dưới"
        >
          📋 Sao chép JSON
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
