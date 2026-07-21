import { useState, useRef } from 'react';
import { toast } from 'react-toastify';
import { exportToExcel } from '../utils/excelExporter.js';

export default function JsonAccumulator() {
  const [fileList, setFileList] = useState([]);
  const [dupFields, setDupFields] = useState({
    url: true,
    phone: false,
    title: false,
    address: false
  });

  // State quản lý sắp xếp ưu tiên liên hệ (Email > Website > Facebook > Phone)
  const [sortByPriority, setSortByPriority] = useState(true);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressText, setProgressText] = useState('');

  const [stats, setStats] = useState(null);
  const [mergedData, setMergedData] = useState([]);

  // Phân trang cho preview bảng
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const fileInputRef = useRef(null);

  // --- Xử lý chọn tệp ---
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const jsonFiles = files.filter(f => f.name.endsWith('.json') || f.type === 'application/json');
    if (jsonFiles.length === 0) {
      toast.warn('Vui lòng chọn các tệp có định dạng .json');
      return;
    }

    setFileList(prev => {
      const existingNames = new Set(prev.map(f => f.name));
      const newFiles = jsonFiles.filter(f => !existingNames.has(f.name));
      return [...prev, ...newFiles];
    });

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Xử lý kéo thả tệp ---
  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    const jsonFiles = files.filter(f => f.name.endsWith('.json') || f.type === 'application/json');
    if (jsonFiles.length === 0) {
      toast.warn('Vui lòng kéo thả các tệp định dạng .json');
      return;
    }

    setFileList(prev => {
      const existingNames = new Set(prev.map(f => f.name));
      const newFiles = jsonFiles.filter(f => !existingNames.has(f.name));
      return [...prev, ...newFiles];
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleRemoveFile = (index) => {
    setFileList(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    setFileList([]);
    setMergedData([]);
    setStats(null);
    setProgressPercent(0);
  };

  const handleDupFieldToggle = (field) => {
    setDupFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // --- Hàm sinh Khóa định danh (Unique Key) cho việc gộp bản ghi ---
  const buildUniqueKey = (record) => {
    const cleanStr = (val) => String(val || '').trim().toLowerCase().normalize('NFC');
    const cleanPhone = (val) => String(val || '').replace(/\D/g, '');

    const keys = [];
    if (dupFields.url) keys.push(`url:${cleanStr(record.url)}`);
    if (dupFields.phone) keys.push(`phone:${cleanPhone(record.phone)}`);
    if (dupFields.title) keys.push(`title:${cleanStr(record.title)}`);
    if (dupFields.address) keys.push(`address:${cleanStr(record.address)}`);

    // Nếu không chọn trường nào, fallback dùng URL hoặc Title
    if (keys.length === 0) {
      return `url:${cleanStr(record.url)}|title:${cleanStr(record.title)}`;
    }

    return keys.join('|');
  };

  // --- Hàm gộp cộng dồn 2 bản ghi (Field-by-Field Merge) ---
  const mergeTwoRecords = (r1, r2) => {
    const pickValue = (v1, v2) => {
      const s1 = String(v1 !== undefined && v1 !== null ? v1 : '').trim();
      const s2 = String(v2 !== undefined && v2 !== null ? v2 : '').trim();
      return s1 !== '' ? s1 : s2;
    };

    return {
      title: pickValue(r1.title, r2.title),
      categoryName: pickValue(r1.categoryName || r1.cuisineType, r2.categoryName || r2.cuisineType),
      email: pickValue(r1.email, r2.email),
      phone: pickValue(r1.phone, r2.phone),
      address: pickValue(r1.address, r2.address),
      url: pickValue(r1.url, r2.url),
      totalScore: pickValue(r1.totalScore, r2.totalScore),
      website: pickValue(r1.website, r2.website),
      facebook: pickValue(r1.facebook, r2.facebook),
      source: pickValue(r1.source, r2.source),
      isFlag: Boolean(r1.isFlag || r2.isFlag)
    };
  };

  // --- Thuật toán Xử lý Cộng dồn không nghẽn UI (Async Chunking + Hash Map) ---
  const handleStartAccumulation = async () => {
    if (fileList.length === 0) {
      toast.warn('Vui lòng nạp ít nhất 1 tệp JSON!');
      return;
    }

    const anyChecked = Object.values(dupFields).some(v => v);
    if (!anyChecked) {
      toast.warn('Vui lòng chọn ít nhất 1 tiêu chí đối chiếu để cộng dồn!');
      return;
    }

    setIsProcessing(true);
    setProgressPercent(0);
    setProgressText('Đang khởi tạo...');
    setStats(null);
    setMergedData([]);

    // Cho phép UI render thông báo khởi tạo
    await new Promise(r => setTimeout(r, 50));

    try {
      const recordsMap = new Map();
      let totalInputRecords = 0;
      let totalOverwrittenCount = 0;
      const fileCount = fileList.length;

      for (let i = 0; i < fileCount; i++) {
        const file = fileList[i];
        setProgressText(`Đang đọc tệp (${i + 1}/${fileCount}): ${file.name}`);
        setProgressPercent(Math.round(((i) / fileCount) * 100));

        // Nhường lượt UI vẽ lại
        await new Promise(r => setTimeout(r, 20));

        const text = await file.text();
        let parsed = [];
        try {
          parsed = JSON.parse(text);
          if (!Array.isArray(parsed)) {
            // Nếu file JSON là object lồng mảng data
            parsed = parsed.data || parsed.records || parsed.items || [];
          }
        } catch (err) {
          toast.error(`Tệp "${file.name}" lỗi cú pháp JSON: ${err.message}`);
          continue;
        }

        totalInputRecords += parsed.length;

        // Xử lý từng lô bản ghi trong tệp (Chunking 2.000 bản ghi/lô)
        const chunkSize = 2000;
        for (let j = 0; j < parsed.length; j += chunkSize) {
          const chunk = parsed.slice(j, j + chunkSize);

          for (const item of chunk) {
            const key = buildUniqueKey(item);

            if (recordsMap.has(key)) {
              const existingRecord = recordsMap.get(key);
              const merged = mergeTwoRecords(existingRecord, item);
              recordsMap.set(key, merged);
              totalOverwrittenCount++;
            } else {
              recordsMap.set(key, {
                title: item.title || '',
                categoryName: item.categoryName || item.cuisineType || item.category_name || item.category || '',
                email: item.email || '',
                phone: item.phone || '',
                address: item.address || '',
                url: item.url || '',
                totalScore: item.totalScore !== undefined && item.totalScore !== null ? String(item.totalScore) : '',
                website: item.website || '',
                facebook: item.facebook || '',
                source: item.source || '',
                isFlag: !!item.isFlag
              });
            }
          }

          // Nhường lượt UI giữa các lô nếu dữ liệu siêu lớn
          if (parsed.length > 5000) {
            await new Promise(r => setTimeout(r, 10));
          }
        }
      }

      setProgressText('Đang tổng hợp & chuẩn hóa lại STT...');
      setProgressPercent(95);
      await new Promise(r => setTimeout(r, 50));

      // Hàm tính điểm ưu tiên thông tin liên hệ (Email > Website > Facebook > Phone)
      const getPriorityScore = (rec) => {
        const hasVal = (v) => String(v || '').trim() !== '';
        let score = 0;
        if (hasVal(rec.email)) score += 8;
        if (hasVal(rec.website)) score += 4;
        if (hasVal(rec.facebook)) score += 2;
        if (hasVal(rec.phone)) score += 1;
        return score;
      };

      let rawList = Array.from(recordsMap.values());

      // Thực hiện sắp xếp ưu tiên theo Email > Website > Facebook > Phone nếu kích hoạt
      if (sortByPriority) {
        rawList.sort((a, b) => {
          const scoreA = getPriorityScore(a);
          const scoreB = getPriorityScore(b);
          if (scoreB !== scoreA) {
            return scoreB - scoreA; // Điểm cao hơn xếp trước
          }
          // Nếu bằng điểm liên hệ, sắp xếp theo tên địa điểm tăng dần
          return String(a.title || '').localeCompare(String(b.title || ''));
        });
      }

      // Đánh lại số thứ tự STT bắt đầu từ 1 đến N và chuẩn hóa đúng thứ tự 12 field người dùng chỉ định
      const finalResult = rawList.map((rec, idx) => {
        const item = {
          stt: idx + 1,
          title: rec.title || '',
          email: rec.email || '',
          phone: rec.phone || '',
          address: rec.address || '',
          url: rec.url || '',
          totalScore: rec.totalScore !== undefined && rec.totalScore !== null ? String(rec.totalScore) : '',
          website: rec.website || '',
          facebook: rec.facebook || '',
          categoryName: rec.categoryName || '',
          source: rec.source || '',
          isFlag: Boolean(rec.isFlag)
        };

        return item;
      });

      setMergedData(finalResult);
      setCurrentPage(1);
      setStats({
        fileCount,
        totalInputRecords,
        totalOverwrittenCount,
        uniqueOutputRecords: finalResult.length
      });

      setProgressPercent(100);
      setProgressText('Hoàn tất cộng dồn!');
      toast.success(`Cộng dồn thành công ${finalResult.length} bản ghi duy nhất từ ${fileCount} tệp!`);
    } catch (err) {
      toast.error(`Lỗi xử lý cộng dồn: ${err.message}`);
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Export File JSON ---
  const handleExportJson = () => {
    if (mergedData.length === 0) return;
    const jsonStr = JSON.stringify(mergedData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cong_don_data_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Đã tải xuống tệp JSON tổng hợp!');
  };

  // --- Export File Excel ---
  const handleExportExcel = () => {
    if (mergedData.length === 0) return;
    exportToExcel(mergedData, `cong_don_data_${Date.now()}.xlsx`, 'hotels');
    toast.success('Đã tải xuống tệp Excel tổng hợp!');
  };

  // Dữ liệu phân trang cho preview
  const totalPages = Math.ceil(mergedData.length / pageSize) || 1;
  const paginatedData = mergedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <main className="main-card glass-card" style={{ textAlign: 'left' }}>
      <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>
          🧩 Cộng dồn & Gộp tệp JSON (JSON Accumulator)
        </h2>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Nạp nhiều tệp JSON cùng lúc. Hệ thống sẽ tự động gộp cộng dồn các trường dữ liệu còn thiếu giữa các bản ghi trùng lặp và ghi đè tạo thành 1 tệp JSON tổng duy nhất.
        </p>
      </div>

      {/* 1. Khu vực Kéo thả & Chọn nhiều tệp */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          border: '2px dashed var(--primary)',
          borderRadius: '16px',
          padding: '2rem',
          textAlign: 'center',
          background: 'rgba(99, 102, 241, 0.03)',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          marginBottom: '1.5rem'
        }}
        onClick={() => fileInputRef.current && fileInputRef.current.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📁</div>
        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>
          Kéo & Thả nhiều tệp JSON vào đây hoặc <span style={{ color: 'var(--primary)', textDecoration: 'underline' }}>bấm để chọn</span>
        </h4>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Hỗ trợ nạp hàng chục tệp JSON cùng lúc với tốc độ xử lý siêu tốc chống lag.
        </p>
      </div>

      {/* Danh sách các tệp đã nạp */}
      {fileList.length > 0 && (
        <div style={{ marginBottom: '1.5rem', background: 'var(--bg-card)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
              Danh sách tệp đã chọn ({fileList.length} tệp):
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
              onClick={handleClearAll}
              disabled={isProcessing}
            >
              Xóa tất cả
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto' }}>
            {fileList.map((file, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid var(--primary)',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem'
                }}
              >
                <span>📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                {!isProcessing && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleRemoveFile(idx); }}
                    style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 700, padding: 0 }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Cấu hình Tiêu chí kiểm trùng đối chiếu */}
      <div style={{ marginBottom: '1.5rem', background: 'var(--bg-card)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)', display: 'block', marginBottom: '0.75rem' }}>
          Tiêu chí đối chiếu gộp bản ghi trùng lặp (Điều kiện AND):
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={dupFields.url}
              onChange={() => handleDupFieldToggle('url')}
              disabled={isProcessing}
            />
            <span>🔗 URL Google Maps</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={dupFields.phone}
              onChange={() => handleDupFieldToggle('phone')}
              disabled={isProcessing}
            />
            <span>📞 Số điện thoại</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={dupFields.title}
              onChange={() => handleDupFieldToggle('title')}
              disabled={isProcessing}
            />
            <span>🏨 Tên địa điểm (Title)</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={dupFields.address}
              onChange={() => handleDupFieldToggle('address')}
              disabled={isProcessing}
            />
            <span>📍 Địa chỉ</span>
          </label>
        </div>

        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-color)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)' }}>
            <input
              type="checkbox"
              checked={sortByPriority}
              onChange={(e) => setSortByPriority(e.target.checked)}
              disabled={isProcessing}
            />
            <span>⭐ Sắp xếp ưu tiên thông tin liên hệ (Email &gt; Website &gt; Facebook &gt; Phone)</span>
          </label>
        </div>
      </div>

      {/* Nút Kích hoạt Xử lý */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleStartAccumulation}
          disabled={isProcessing || fileList.length === 0}
          style={{ padding: '0.75rem 2rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          {isProcessing ? (
            <>
              <span className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px', borderLeftColor: '#fff' }}></span>
              Đang cộng dồn dữ liệu...
            </>
          ) : (
            '🚀 Thực hiện Cộng dồn JSON'
          )}
        </button>
      </div>

      {/* 3. Thanh Tiến trình khi đang chạy */}
      {isProcessing && (
        <div style={{ marginBottom: '1.5rem', background: 'var(--bg-card)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
            <span>{progressText}</span>
            <span>{progressPercent}%</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: 'var(--primary)',
                transition: 'width 0.2s ease'
              }}
            />
          </div>
        </div>
      )}

      {/* 4. Hộp Thống kê Kết quả */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Tổng số tệp nạp</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{stats.fileCount} tệp</span>
          </div>
          <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Tổng record ban đầu</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>{stats.totalInputRecords.toLocaleString()}</span>
          </div>
          <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Số record gộp trùng</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>{stats.totalOverwrittenCount.toLocaleString()}</span>
          </div>
          <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Record đầu ra duy nhất</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>{stats.uniqueOutputRecords.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* 5. Nút Tải về & Bảng Preview */}
      {mergedData.length > 0 && (
        <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
              📋 Kết quả sau khi cộng dồn ({mergedData.length.toLocaleString()} bản ghi)
            </h3>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExportJson}
                style={{ padding: '0.5rem 1.25rem', fontWeight: 600 }}
              >
                📥 Tải File JSON Tổng
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleExportExcel}
                style={{ padding: '0.5rem 1.25rem', fontWeight: 600 }}
              >
                📊 Tải File Excel (.xlsx)
              </button>
            </div>
          </div>

          {/* Bảng hiển thị dữ liệu đầy đủ 11 cột */}
          <div style={{ overflowX: 'auto', marginBottom: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: '50px', textAlign: 'center' }}>STT</th>
                  <th style={{ minWidth: '200px' }}>Title (Tên địa điểm)</th>
                  <th style={{ minWidth: '180px' }}>Email</th>
                  <th style={{ minWidth: '130px' }}>Phone</th>
                  <th style={{ minWidth: '220px' }}>Address (Địa chỉ)</th>
                  <th style={{ minWidth: '140px' }}>URL</th>
                  <th style={{ minWidth: '90px', textAlign: 'center' }}>Total Score</th>
                  <th style={{ minWidth: '140px' }}>Website</th>
                  <th style={{ minWidth: '140px' }}>Facebook</th>
                  <th style={{ minWidth: '140px' }}>Loại hình</th>
                  <th style={{ minWidth: '140px' }}>Source</th>
                  <th style={{ minWidth: '90px', textAlign: 'center' }}>isFlag</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((item) => (
                  <tr key={item.stt}>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.stt}</td>
                    <td style={{ fontWeight: 600, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.title}>
                      {item.title || '-'}
                    </td>
                    <td>{item.email || '-'}</td>
                    <td>{item.phone || '-'}</td>
                    <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.address}>
                      {item.address || '-'}
                    </td>
                    <td>
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                          Xem Maps 🔗
                        </a>
                      ) : '-'}
                    </td>
                    <td style={{ textAlign: 'center' }}>{item.totalScore || '-'}</td>
                    <td>
                      {item.website ? (
                        <a href={item.website.startsWith('http') ? item.website : `http://${item.website}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                          Website 🌐
                        </a>
                      ) : '-'}
                    </td>
                    <td>
                      {item.facebook ? (
                        <a href={item.facebook.startsWith('http') ? item.facebook : `https://${item.facebook}`} target="_blank" rel="noreferrer" style={{ color: '#1877f2', textDecoration: 'none' }}>
                          Facebook 📘
                        </a>
                      ) : '-'}
                    </td>
                    <td>{item.categoryName || item.cuisineType || '-'}</td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.source}>
                      {item.source || '-'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {item.isFlag ? (
                        <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                          TRUE
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                          FALSE
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Controls Phân trang */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Hiển thị trang {currentPage} / {totalPages} ({mergedData.length.toLocaleString()} bản ghi)
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                >
                  ◀ Trước
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                >
                  Sau ▶
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
