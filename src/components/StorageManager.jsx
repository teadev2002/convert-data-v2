import React from 'react';

export default function StorageManager({
  lists,
  selectedListId,
  onSelectChange,
  onLoadList,
  onDeleteList,
  onOpenSaveModal,
  hasData
}) {
  return (
    <div className="storage-manager">
      {/* Cụm chọn danh sách */}
      <div className="storage-select-group">
        <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
          Danh sách đã lưu:
        </label>
        <select
          className="form-select storage-select"
          value={selectedListId}
          onChange={(e) => onSelectChange(e.target.value)}
        >
          <option value="">-- Chọn danh sách --</option>
          {lists.map(list => (
            <option key={list.id} value={list.id}>
              {list.name} ({list.count} bản ghi)
            </option>
          ))}
        </select>
      </div>

      {/* Nút Xem danh sách */}
      <button
        type="button"
        className="btn btn-secondary"
        onClick={onLoadList}
        disabled={!selectedListId}
        title="Tải dữ liệu của danh sách đã chọn lên màn hình"
      >
        📂 Xem danh sách
      </button>

      {/* Nút Xóa danh sách */}
      <button
        type="button"
        className="btn btn-danger"
        onClick={onDeleteList}
        disabled={!selectedListId}
        title="Xóa hoàn toàn danh sách này khỏi cơ sở dữ liệu"
      >
        🗑️ Xóa danh sách
      </button>

      {/* Nút Lưu dữ liệu */}
      <button
        type="button"
        className="btn btn-primary"
        onClick={onOpenSaveModal}
        disabled={!hasData}
        title="Lưu dữ liệu đang hiển thị trên bảng lên máy chủ"
        style={{ marginLeft: 'auto' }}
      >
        💾 Lưu dữ liệu
      </button>
    </div>
  );
}
