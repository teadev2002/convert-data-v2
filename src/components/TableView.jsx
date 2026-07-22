import React, { useState, useEffect } from 'react';

export default function TableView({ data, onDeleteRow, onToggleFlag }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);

  // Reset về trang 1 khi data thay đổi (ví dụ khi nạp file mới hoặc lọc dữ liệu)
  useEffect(() => {
    setCurrentPage(1);
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
        Không có dữ liệu hiển thị. Vui lòng dán JSON/CSV hoặc kéo thả tệp tin vào đây, sau đó bấm nút "Xử lý dữ liệu".
      </div>
    );
  }

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  // Đảm bảo currentPage luôn hợp lệ trong khoảng [1, totalPages]
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (validCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedData = data.slice(startIndex, endIndex);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
              <th className="col-cuisine" style={{ minWidth: '130px' }}>categoryName (Loại hình)</th>
              <th className="col-source">Nguồn tin</th>
              <th className="col-isflag" style={{ width: '80px', textAlign: 'center' }}>Đánh dấu</th>
              <th style={{ width: '60px', textAlign: 'center' }}>Xóa</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, index) => {
              const globalIndex = startIndex + index;
              return (
                <tr key={globalIndex} className={row.isDuplicate ? 'duplicate-row' : ''}>
                  {/* Số thứ tự tính toán dựa theo vị trí toàn cục của bản ghi */}
                  <td className="col-stt">{row.stt || (globalIndex + 1)}</td>

                  {/* Tên cơ sở kèm badge cảnh báo trùng lặp */}
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

                  {/* Đường dẫn website */}
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

                  {/* Loại hình (categoryName) */}
                  <td className="col-cuisine" style={{ fontStyle: 'italic' }}>
                    {row.categoryName || row.cuisineType || <span className="empty-text">-</span>}
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
                      onChange={() => onToggleFlag && onToggleFlag(globalIndex)}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </td>

                  {/* Nút hành động xóa hàng thủ công */}
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem' }}
                      onClick={() => onDeleteRow(globalIndex)}
                      title="Xóa dòng này khỏi danh sách đang xem"
                    >
                      ❌
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bộ điều khiển phân trang - Pagination Controls */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          flexWrap: 'wrap',
          gap: '0.75rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Hiển thị <strong style={{ color: 'var(--text-main)' }}>{startIndex + 1} - {endIndex}</strong> trong tổng số <strong style={{ color: 'var(--text-main)' }}>{totalItems}</strong> bản ghi
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', minWidth: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              disabled={validCurrentPage === 1}
              onClick={() => setCurrentPage(1)}
              title="Trang đầu"
            >
              ⏮️
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', minWidth: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              disabled={validCurrentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              title="Trang trước"
            >
              ◀️
            </button>
            
            <span style={{ fontSize: '0.875rem', margin: '0 0.5rem', color: 'var(--text-muted)' }}>
              Trang <strong style={{ color: 'var(--primary)' }}>{validCurrentPage}</strong> / <strong>{totalPages}</strong>
            </span>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', minWidth: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              disabled={validCurrentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              title="Trang sau"
            >
              ▶️
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', minWidth: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              disabled={validCurrentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
              title="Trang cuối"
            >
              ⏭️
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Số dòng mỗi trang:</span>
            <select
              className="form-select"
              style={{ width: '90px', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
