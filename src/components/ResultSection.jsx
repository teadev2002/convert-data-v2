import React, { useState } from 'react';
import TableView from './TableView';
import JsonPreview from './JsonPreview';
import { toast } from 'react-toastify';

export default function ResultSection({ 
  data, 
  dataType,
  onDeleteRow, 
  onSortByScore,
  onExportExcel
}) {
  const [activeTab, setActiveTab] = useState('table');

  const handleCopyAllJson = () => {
    try {
      const cleanData = data.map(({ stt, title, phone, address, url, totalScore, website, cuisineType, email }) => {
        const obj = {
          stt,
          title,
          ...(dataType === 'restaurants' ? { cuisineType } : {}),
          email: email || '',
          phone,
          address,
          url,
          totalScore,
          website
        };
        return obj;
      });
      navigator.clipboard.writeText(JSON.stringify(cleanData, null, 2));
      toast.success('Đã sao chép toàn bộ dữ liệu JSON vào Clipboard!');
    } catch (err) {
      toast.error('Lỗi khi sao chép: ' + err);
    }
  };

  if (!data || data.length === 0) return null;

  return (
    <section className="result-section glass-card">
      <div className="result-header">
        {/* Nút chuyển đổi Tab giữa Bảng và JSON */}
        <div className="result-tabs">
          <button 
            type="button" 
            className={`tab-btn ${activeTab === 'table' ? 'active' : ''}`}
            onClick={() => setActiveTab('table')}
          >
            📊 Xem dạng bảng
          </button>
          <button 
            type="button" 
            className={`tab-btn ${activeTab === 'json' ? 'active' : ''}`}
            onClick={() => setActiveTab('json')}
          >
            📝 Xem dạng JSON
          </button>
        </div>

        {/* Các thao tác nâng cao trên kết quả */}
        <div className="result-actions">
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={onSortByScore}
            title="Sắp xếp danh sách theo điểm số từ cao đến thấp"
          >
            ⭐ Sắp xếp điểm số
          </button>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={handleCopyAllJson}
            title="Sao chép toàn bộ danh sách thành mã JSON"
          >
            📋 Copy JSON
          </button>
          <button 
            type="button" 
            className="btn btn-success" 
            onClick={onExportExcel}
            title="Tải tệp Excel chứa dữ liệu của bảng hiện tại"
          >
            📥 Tải File Excel
          </button>
        </div>
      </div>

      {/* Hiển thị nội dung dựa trên tab đang chọn */}
      <div style={{ marginTop: '0.5rem' }}>
        {activeTab === 'table' ? (
          <TableView data={data} dataType={dataType} onDeleteRow={onDeleteRow} />
        ) : (
          <JsonPreview data={data} dataType={dataType} />
        )}
      </div>
    </section>
  );
}
