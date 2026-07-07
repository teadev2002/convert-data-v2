import React from 'react';

export default function Header({ isDark, onToggleTheme }) {
  return (
    <header className="app-header">
      <div className="logo-section">
        <span className="logo-icon">🏢</span>
        <h1>Hotel Data Processor & Manager</h1>
      </div>
      <div className="header-actions">
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
