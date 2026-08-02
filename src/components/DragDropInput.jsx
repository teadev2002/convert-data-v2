import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';

export default function DragDropInput({ value, onChange, onRawInputLoad }) {
  const [isDragging, setIsDragging] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const fileInputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Đồng bộ giá trị từ component cha xuống state cục bộ
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Dọn dẹp timer khi unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

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
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawJson = XLSX.utils.sheet_to_json(worksheet);
          
          const jsonStr = JSON.stringify(rawJson, null, 2);
          onRawInputLoad(jsonStr);
          toast.success(`Đã nạp tệp Excel "${file.name}" thành công!`);
        } else {
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

  const handleTextChange = (val) => {
    setLocalValue(val);
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      onChange(val);
    }, 500);
  };

  const handleBlur = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    onChange(localValue);
  };

  // Xác định dữ liệu lớn (> 150.000 ký tự)
  const isLarge = localValue && localValue.length >= 150000;
  
  const displayValue = isLarge 
    ? localValue.substring(0, 50000) + `\n\n... [DỮ LIỆU LỚN (${(localValue.length / 1024 / 1024).toFixed(2)} MB) - Đã được thu gọn để tránh làm lag trình duyệt. Bạn có thể xem bảng và các thao tác bình thường.] ...`
    : localValue;

  const handleClear = () => {
    setLocalValue('');
    onChange('');
  };

  return (
    <div className="drag-drop-input">
      <div className="input-labels">
        <label style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Dữ liệu đầu vào (Excel, JSON hoặc CSV):
          {isLarge && (
            <span style={{ 
              backgroundColor: 'rgba(235, 94, 40, 0.15)', 
              color: '#eb5e28', 
              padding: '0.15rem 0.5rem', 
              borderRadius: '6px', 
              fontSize: '0.75rem', 
              fontWeight: 700 
            }}>
              ⚠️ Dữ liệu lớn (Read-only chống lag)
            </span>
          )}
        </label>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isLarge && (
            <button
              type="button"
              className="btn btn-danger"
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem', border: 'none', cursor: 'pointer' }}
              onClick={handleClear}
            >
              🗑️ Xóa dữ liệu
            </button>
          )}
          <button 
            type="button" 
            className="api-import-toggle"
            onClick={() => fileInputRef.current.click()}
            title="Chọn tệp Excel, JSON hoặc CSV từ thiết bị của bạn"
          >
            📂 Chọn tệp tin (.xlsx, .csv, .json)
          </button>
        </div>
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
          value={displayValue || ''}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={handleBlur}
          readOnly={isLarge}
          placeholder="Dán mã JSON, nội dung CSV tại đây... Hoặc kéo thả tệp .xlsx/.csv/.json trực tiếp vào vùng này."
        />
        {(!localValue && !isDragging) && (
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
