import React from 'react';

export default function ControlBar({ 
  onProcess, 
  onCheckDuplicates, 
  onRemoveDuplicates, 
  hasRawInput, 
  hasData, 
  isChecking 
}) {
  return (
    <div className="control-bar">
      {/* Nút Xử lý dữ liệu */}
      <button 
        type="button" 
        className="btn btn-primary" 
        onClick={onProcess}
        disabled={!hasRawInput}
        title="Phân tích cú pháp văn bản đầu vào và chuẩn hóa dữ liệu"
      >
        ⚙️ Xử lý dữ liệu
      </button>

      {/* Nút Kiểm tra trùng lặp diện rộng */}
      <button 
        type="button" 
        className="btn btn-success" 
        onClick={onCheckDuplicates}
        disabled={!hasData || isChecking}
        title="Đối chiếu danh sách URL hiện tại với cơ sở dữ liệu để tìm trùng lặp"
      >
        {isChecking ? (
          <>
            <span className="spinner" style={{ width: '14px', height: '14px', borderLeftColor: '#fff', marginRight: '4px' }}></span>
            Đang đối chiếu...
          </>
        ) : (
          '🔍 Kiểm tra trùng lặp'
        )}
      </button>

      {/* Nút Xóa các dòng trùng lặp */}
      <button 
        type="button" 
        className="btn btn-danger" 
        onClick={onRemoveDuplicates}
        disabled={!hasData}
        title="Lọc bỏ toàn bộ các bản ghi bị gắn cờ trùng lặp khỏi bảng hiển thị"
      >
        🗑️ Xóa trùng lặp
      </button>
    </div>
  );
}
