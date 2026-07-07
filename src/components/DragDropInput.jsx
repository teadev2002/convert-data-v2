import React, { useState } from 'react';
import { toast } from 'react-toastify';

export default function DragDropInput({ value, onChange, onRawInputLoad }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (!file) return;

    const fileType = file.name.split('.').pop().toLowerCase();
    if (fileType !== 'json' && fileType !== 'csv') {
      toast.error('Chỉ hỗ trợ kéo thả tệp định dạng .json hoặc .csv');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      onRawInputLoad(text);
      toast.success(`Đã tải tệp ${file.name} thành công!`);
    };
    reader.onerror = () => {
      toast.error('Lỗi khi đọc tệp.');
    };
    reader.readAsText(file);
  };

  return (
    <div className="drag-drop-input">
      <div className="input-labels">
        <label style={{ color: 'var(--text-main)' }}>Dữ liệu khách sạn đầu vào (JSON hoặc CSV):</label>
      </div>

      <div 
        className={`textarea-wrapper ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Dán mã JSON hoặc nội dung CSV tại đây... Hoặc kéo thả tệp .json/.csv trực tiếp vào vùng này."
        />
        {(!value && !isDragging) && (
          <div className="drag-placeholder">
            <span className="drag-placeholder-icon">📥</span>
            <span>Dán CSV / JSON hoặc kéo thả tệp vào đây</span>
          </div>
        )}
        {isDragging && (
          <div className="drag-placeholder" style={{ color: 'var(--primary)' }}>
            <span className="drag-placeholder-icon" style={{ animation: 'bounce 0.5s infinite' }}>💾</span>
            <span style={{ fontWeight: 600 }}>Thả tệp để nạp dữ liệu!</span>
          </div>
        )}
      </div>
    </div>
  );
}
