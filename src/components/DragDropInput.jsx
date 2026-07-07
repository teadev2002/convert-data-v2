import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';

export default function DragDropInput({ value, onChange, onRawInputLoad }) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

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
    processFile(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file) => {
    const fileType = file.name.split('.').pop().toLowerCase();
    if (fileType !== 'json' && fileType !== 'csv' && fileType !== 'xlsx' && fileType !== 'xls') {
      toast.error('Chỉ hỗ trợ nạp tệp định dạng .json, .csv, .xlsx hoặc .xls');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        if (fileType === 'xlsx' || fileType === 'xls') {
          // Xử lý tệp Excel bằng SheetJS
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawJson = XLSX.utils.sheet_to_json(worksheet);
          
          // Chuyển đổi thành chuỗi JSON đẹp để nạp vào textarea
          const jsonStr = JSON.stringify(rawJson, null, 2);
          onRawInputLoad(jsonStr);
          toast.success(`Đã nạp tệp Excel "${file.name}" thành công!`);
        } else {
          // Xử lý tệp JSON/CSV văn bản thường
          const text = event.target.result;
          onRawInputLoad(text);
          toast.success(`Đã nạp tệp tin "${file.name}" thành công!`);
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
  };

  return (
    <div className="drag-drop-input">
      <div className="input-labels">
        <label style={{ color: 'var(--text-main)' }}>Dữ liệu đầu vào (Excel, JSON hoặc CSV):</label>
        
        {/* Nút bấm chọn tệp tin nâng cao */}
        <button 
          type="button" 
          className="api-import-toggle"
          onClick={() => fileInputRef.current.click()}
          title="Chọn tệp Excel, JSON hoặc CSV từ thiết bị của bạn"
        >
          📂 Chọn tệp tin (.xlsx, .csv, .json)
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept=".json,.csv,.xlsx,.xls" 
          style={{ display: 'none' }}
        />
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
          placeholder="Dán mã JSON, nội dung CSV tại đây... Hoặc kéo thả tệp .xlsx/.csv/.json trực tiếp vào vùng này."
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
