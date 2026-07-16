import React from 'react';

export default function TableView({ data, dataType, onDeleteRow, onToggleFlag }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
        Không có dữ liệu hiển thị. Vui lòng dán JSON/CSV hoặc kéo thả tệp tin vào đây, sau đó bấm nút "Xử lý dữ liệu".
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="hotel-table">
        <thead>
          <tr>
            <th className="col-stt">STT</th>
            <th className="col-title">Tên cơ sở</th>
            <th className="col-email">Email</th>
            <th className="col-phone">Số điện thoại</th>
            <th className="col-address">Địa chỉ</th>
            <th className="col-url">Bản đồ</th>
            <th className="col-score">Điểm số</th>
            <th className="col-website">Website</th>
            <th className="col-facebook">Facebook</th>
            <th className="col-source">Nguồn tin</th>
            <th className="col-isflag" style={{ width: '80px', textAlign: 'center' }}>Đánh dấu</th>
            <th style={{ width: '60px', textAlign: 'center' }}>Xóa</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index} className={row.isDuplicate ? 'duplicate-row' : ''}>
              {/* Số thứ tự tính toán động trong React */}
              <td className="col-stt">{index + 1}</td>
              
              {/* Tên cơ sở có kèm badge báo trùng lặp nếu trùng */}
              <td className="col-title">
                {row.title || <span className="empty-text">Không có tên</span>}
                {row.isDuplicate && (
                  <span 
                    className="badge-duplicate" 
                    style={{ 
                      marginLeft: '0.5rem',
                      backgroundColor: row.duplicateSource === 'file' ? '#e67e22' : 'var(--danger)',
                      color: '#fff',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      fontSize: '0.725rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem'
                    }}
                    title={row.duplicateSource === 'file' ? 'Bản ghi này trùng với một bản ghi khác có sẵn trong tệp tin bạn vừa nạp' : 'Bản ghi này đã tồn tại trong kho Local Storage'}
                  >
                    ⚠️ {row.duplicateSource === 'file' ? 'Trùng trong tệp' : 'Trùng trong kho'}
                  </span>
                )}
              </td>

              {/* Cột email */}
              <td className="col-email">
                {row.email || <span className="empty-text">-</span>}
              </td>

              {/* Cột số điện thoại */}
              <td className="col-phone">
                {row.phone || <span className="empty-text">-</span>}
              </td>
              
              {/* Cột địa chỉ */}
              <td className="col-address">
                {row.address || <span className="empty-text">Không có địa chỉ</span>}
              </td>
              
              {/* Đường dẫn bản đồ Google Maps */}
              <td className="col-url">
                {row.url ? (
                  <a 
                    href={row.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="external-link"
                    title={row.url}
                  >
                    📍 Maps
                  </a>
                ) : (
                  <span className="empty-text">-</span>
                )}
              </td>

              {/* Điểm đánh giá */}
              <td className="col-score" style={{ fontWeight: 600 }}>
                {row.totalScore || <span className="empty-text">-</span>}
              </td>
              
              {/* Đường dẫn website khách sạn */}
              <td className="col-website">
                {row.website ? (
                  <a 
                    href={row.website.startsWith('http') ? row.website : `http://${row.website}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="external-link"
                    title={row.website}
                  >
                    🌐 Web
                  </a>
                ) : (
                  <span className="empty-text">-</span>
                )}
              </td>

              {/* Đường dẫn Facebook */}
              <td className="col-facebook">
                {row.facebook ? (
                  <a 
                    href={row.facebook.startsWith('http') ? row.facebook : `https://${row.facebook}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="external-link"
                    title={row.facebook}
                  >
                    🔵 Facebook
                  </a>
                ) : (
                  <span className="empty-text">-</span>
                )}
              </td>

              {/* Nguồn tin */}
              <td className="col-source">
                {row.source || <span className="empty-text">-</span>}
              </td>

              {/* Checkbox Đánh dấu Flag */}
              <td className="col-isflag" style={{ textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={!!row.isFlag}
                  onChange={() => onToggleFlag && onToggleFlag(index)}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
              </td>
              
              {/* Nút hành động xóa hàng thủ công */}
              <td style={{ textAlign: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem' }}
                  onClick={() => onDeleteRow(index)}
                  title="Xóa dòng này khỏi danh sách đang xem"
                >
                  ❌
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
