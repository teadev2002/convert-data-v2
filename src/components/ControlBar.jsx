import React from 'react';

export default function ControlBar({
  onProcess,
  onCheckDuplicates,
  onRemoveDuplicates,
  hasRawInput,
  hasData,
  isChecking,
  dupFields = { url: true, address: true, phone: true, title: true },
  onDupFieldsChange
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
      <div className="control-bar" style={{ margin: 0 }}>
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
          title="Đối chiếu danh sách hiện tại với cơ sở dữ liệu dựa trên các trường được chọn"
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

      {/* Checkbox chọn trường lọc trùng */}
      {hasData && (
        <div className="dup-fields-selector" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
          padding: '0.65rem 0.85rem',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '6px',
          border: '1px solid var(--border-color)',
          fontSize: '0.875rem',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>So khớp trùng theo:</span>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: 'var(--text-main)' }}>
            <input
              type="checkbox"
              checked={!!dupFields.url}
              onChange={() => onDupFieldsChange('url')}
            />
            Bản đồ
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: 'var(--text-main)' }}>
            <input
              type="checkbox"
              checked={!!dupFields.address}
              onChange={() => onDupFieldsChange('address')}
            />
            Địa chỉ
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: 'var(--text-main)' }}>
            <input
              type="checkbox"
              checked={!!dupFields.phone}
              onChange={() => onDupFieldsChange('phone')}
            />
            Số điện thoại
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: 'var(--text-main)' }}>
            <input
              type="checkbox"
              checked={!!dupFields.title}
              onChange={() => onDupFieldsChange('title')}
            />
            Tên cơ sở
          </label>
        </div>
      )}
    </div>
  );
}
