import React from 'react';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel }) {
  if (!isOpen) return null;

  // Đóng modal khi nhấn phím Escape
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close-btn" onClick={onCancel} aria-label="Đóng">&times;</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '0.925rem', color: 'var(--text-main)' }}>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>Hủy bỏ</button>
          <button className="btn btn-danger" onClick={onConfirm}>Đồng ý</button>
        </div>
      </div>
    </div>
  );
}
