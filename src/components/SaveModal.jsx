import React, { useState, useEffect } from 'react';

// Danh sách các tỉnh thành định nghĩa sẵn theo yêu cầu người dùng
export const provinces = [
  {
    value: "Tuyên Quang",
    label: "Tuyên Quang (Hà Giang - Tuyên Quang)"
  },
  {
    value: "Lào Cai",
    label: "Lào Cai (Lào Cai - Yên Bái)"
  },
  {
    value: "Thái Nguyên",
    label: "Thái Nguyên (Bắc Kạn - Thái Nguyên)"
  },
  {
    value: "Phú Thọ",
    label: "Phú Thọ (Hòa Bình - Vĩnh Phúc - Phú Thọ)"
  },
  {
    value: "Bắc Ninh",
    label: "Bắc Ninh (Bắc Giang - Bắc Ninh)"
  },
  {
    value: "Hưng Yên",
    label: "Hưng Yên (Thái Bình - Hưng Yên)"
  },
  {
    value: "Ninh Bình",
    label: "Ninh Bình (Hà Nam - Nam Định - Ninh Bình)"
  },
  {
    value: "Hải Phòng",
    label: "Hải Phòng (Hải Dương - Hải Phòng)"
  },
  {
    value: "Quảng Trị",
    label: "Quảng Trị (Quảng Bình - Quảng Trị)"
  },
  {
    value: "Đà Nẵng",
    label: "Đà Nẵng (Quảng Nam - Đà Nẵng)"
  },
  {
    value: "Quảng Ngãi",
    label: "Quảng Ngãi (Kon Tum - Quảng Ngãi)"
  },
  {
    value: "Gia Lai",
    label: "Gia Lai (Bình Định - Gia Lai)"
  },
  {
    value: "Đắk Lắk",
    label: "Đắk Lắk (Phú Yên - Đắk Lắk)"
  },
  {
    value: "Khánh Hòa",
    label: "Khánh Hòa (Ninh Thuận - Khánh Hòa)"
  },
  {
    value: "Lâm Đồng",
    label: "Lâm Đồng (Đắk Nông - Bình Thuận - Lâm Đồng)"
  },
  {
    value: "Đồng Nai",
    label: "Đồng Nai (Bình Phước - Đồng Nai)"
  },
  {
    value: "Tây Ninh",
    label: "Tây Ninh (Long An - Tây Ninh)"
  },
  {
    value: "Thành phố Hồ Chí Minh",
    label: "Thành phố Hồ Chí Minh (TP.HCM - Bình Dương - Bà Rịa - Vũng Tàu)"
  }
];

export default function SaveModal({ isOpen, lists, dataType, onSave, onCancel }) {
  const [selectedExistingId, setSelectedExistingId] = useState('');
  const [selectedNewProvince, setSelectedNewProvince] = useState('');

  const displayType = dataType === 'hotels' ? 'khách sạn' : 'nhà hàng';

  // Reset state mỗi khi mở modal
  useEffect(() => {
    if (isOpen) {
      setSelectedExistingId('');
      setSelectedNewProvince('');
    }
  }, [isOpen]);

  // Đóng modal bằng Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    if (selectedExistingId) {
      // 1. Lưu gộp vào tỉnh đã có
      const existing = lists.find(l => l.id === selectedExistingId);
      if (existing) {
        onSave(existing.name, selectedExistingId);
      }
    } else {
      // 2. Lưu thành tỉnh mới bằng việc chọn từ dropdown
      if (selectedNewProvince) {
        onSave(selectedNewProvince, '');
      }
    }
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal-content" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-header">
          <h3>Lưu danh sách {displayType}</h3>
          <button type="button" className="modal-close-btn" onClick={onCancel} aria-label="Đóng">&times;</button>
        </div>

        <div className="modal-body">
          {/* Input 1: Dropdown danh sách cũ có sẵn trên DB để lưu đè/lưu gộp */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Gộp dữ liệu vào tỉnh thành đã có lưu trên hệ thống :
            </label>
            <select
              className="form-select"
              value={selectedExistingId}
              onChange={(e) => {
                setSelectedExistingId(e.target.value);
                setSelectedNewProvince(''); // Reset lựa chọn tỉnh mới khi chọn gộp
              }}
            >
              <option value="">-- Lưu thành tỉnh thành--</option>
              {lists.map(list => (
                <option key={list.id} value={list.id}>
                  {list.name} ({list.count} {displayType})
                </option>
              ))}
            </select>
          </div>

          {/* Input 2: Dropdown danh sách định nghĩa sẵn (thay thế cho ô tự gõ text trước đó) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Tên tỉnh thành mới (Chọn từ danh mục định nghĩa sẵn):
            </label>
            <select
              className="form-select"
              value={selectedNewProvince}
              onChange={(e) => setSelectedNewProvince(e.target.value)}
              disabled={selectedExistingId !== ''}
              required={selectedExistingId === ''}
            >
              <option value="">-- Chọn tỉnh thành mới --</option>
              {provinces.map(prep => (
                <option key={prep.value} value={prep.value}>
                  {prep.label}
                </option>
              ))}
            </select>
            {selectedExistingId !== '' && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                * Đã chọn gộp vào tỉnh thành cũ, mục chọn tỉnh mới được tạm khóa.
              </span>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Hủy</button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={selectedExistingId === '' && !selectedNewProvince}
          >
            Lưu dữ liệu
          </button>
        </div>
      </form>
    </div>
  );
}
