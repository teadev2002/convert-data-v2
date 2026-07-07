import React, { useState, useEffect } from 'react';

export default function SaveModal({ isOpen, lists, onSave, onCancel }) {
  const [listName, setListName] = useState('');
  const [selectedExistingId, setSelectedExistingId] = useState('');

  // Reset state mỗi khi mở modal
  useEffect(() => {
    if (isOpen) {
      setListName('');
      setSelectedExistingId('');
    }
  }, [isOpen]);

  // Lắng nghe đóng bằng Escape
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleSelectChange = (e) => {
    const id = e.target.value;
    setSelectedExistingId(id);
    if (id) {
      // Tìm danh sách tương ứng để tự động điền tên vào ô input
      const selected = lists.find(l => l.id === id);
      if (selected) {
        setListName(selected.name);
      }
    } else {
      setListName('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!listName.trim()) return;
    onSave(listName.trim(), selectedExistingId);
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal-content" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-header">
          <h3>Lưu danh sách khách sạn</h3>
          <button type="button" className="modal-close-btn" onClick={onCancel} aria-label="Đóng">&times;</button>
        </div>
        
        <div className="modal-body">
          {/* Dropdown danh sách cũ để lựa chọn gộp */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Gộp dữ liệu vào danh sách đã có:
            </label>
            <select 
              className="form-select"
              value={selectedExistingId}
              onChange={handleSelectChange}
            >
              <option value="">-- Lưu thành danh sách mới --</option>
              {lists.map(list => (
                <option key={list.id} value={list.id}>
                  {list.name} ({list.count} bản ghi)
                </option>
              ))}
            </select>
          </div>

          {/* Ô nhập tên danh sách */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Tên danh sách khách sạn:
            </label>
            <input
              type="text"
              className="form-input"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="Ví dụ: Hotels Phú Thọ, Hotels Hải Phòng..."
              required
            />
          </div>
        </div>
        
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={!listName.trim()}>
            Lưu danh sách
          </button>
        </div>
      </form>
    </div>
  );
}
