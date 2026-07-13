import React from 'react';

export default function Header({ isDark, onToggleTheme, currentRoute, onNavigate }) {
  return (
    <header className="app-header">
      <div className="logo-section">
        <span className="logo-icon">🏢</span>
        <h1> Data Processor & Manager made by TheAnh</h1>
      </div>
      <div className="header-actions">
        {currentRoute === '/merge-file' ? (
          <button 
            onClick={() => onNavigate('/')} 
            className="theme-toggle-btn"
            style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer' }}
          >
            🏠 Trang chủ
          </button>
        ) : (
          <button 
            onClick={() => onNavigate('/merge-file')} 
            className="theme-toggle-btn"
            style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer' }}
          >
            🔀 Hợp nhất file
          </button>
        )}
        <button
          onClick={onToggleTheme}
          className="theme-toggle-btn"
          title={isDark ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
          aria-label="Toggle theme"
        >
          {isDark ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}
