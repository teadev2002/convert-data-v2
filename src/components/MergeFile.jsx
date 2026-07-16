import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Alert, Button, Checkbox, Radio, Divider } from 'antd';
import { toast } from 'react-toastify';
import { mapToStandardSchema } from '../utils/parser.js';

export default function MergeFile({ isDark, setIsLoading }) {
  const [file1, setFile1] = useState(null); // { name, size, data: [] }
  const [file2, setFile2] = useState(null); // { name, size, data: [] }
  
  const [matchFields, setMatchFields] = useState({
    title: true,
    phone: true,
    address: true
  });

  const [conflicts, setConflicts] = useState([]); // Array of conflicts: { key, indexInUniqueList, title, phone, address, email1, email2, record1, record2, resolution }
  const [tempMergeData, setTempMergeData] = useState(null); // Temporary hold uniqueMergedList during conflict resolution

  const [mergeSummary, setMergeSummary] = useState(null); // { totalRecords, matchedCount, emailsFilled, conflictsResolved }
  const [mergedResults, setMergedResults] = useState([]); // Final merged data
  
  const [isDragging1, setIsDragging1] = useState(false);
  const [isDragging2, setIsDragging2] = useState(false);

  const fileInputRef1 = useRef(null);
  const fileInputRef2 = useRef(null);

  // Helper chuyển đổi file sang Schema
  const parseUploadedFile = (file) => {
    return new Promise((resolve, reject) => {
      const fileType = file.name.split('.').pop().toLowerCase();
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          let rawData = [];
          if (fileType === 'xlsx' || fileType === 'xls') {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            rawData = XLSX.utils.sheet_to_json(worksheet);
          } else {
            const text = event.target.result;
            if (fileType === 'json') {
              const parsed = JSON.parse(text);
              rawData = Array.isArray(parsed) ? parsed : [parsed];
            } else {
              // CSV
              const delimiter = text.includes('\t') ? '\t' : undefined;
              const result = Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                delimiter: delimiter,
                dynamicTyping: false
              });
              rawData = result.data || [];
            }
          }

          const mapped = mapToStandardSchema(rawData);
          resolve({
            name: file.name,
            size: file.size,
            data: mapped
          });
        } catch (err) {
          reject(err);
        }
      };

      if (fileType === 'xlsx' || fileType === 'xls') {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  const handleFileChange = async (e, slotNum) => {
    const file = e.target.files[0];
    if (!file) return;
    await processFile(file, slotNum);
  };

  const processFile = async (file, slotNum) => {
    const fileType = file.name.split('.').pop().toLowerCase();
    const validTypes = ['xlsx', 'xls', 'csv', 'json'];
    if (!validTypes.includes(fileType)) {
      toast.error('Định dạng tệp không được hỗ trợ. Vui lòng tải lên file Excel (.xlsx, .xls), CSV hoặc JSON.');
      return;
    }

    setIsLoading(true);
    try {
      const parsed = await parseUploadedFile(file);
      if (slotNum === 1) {
        setFile1(parsed);
        toast.success(`Nạp tệp 1 thành công: ${parsed.data.length} bản ghi.`);
      } else {
        setFile2(parsed);
        toast.success(`Nạp tệp 2 thành công: ${parsed.data.length} bản ghi.`);
      }
      setMergeSummary(null);
      setMergedResults([]);
      setConflicts([]);
      setTempMergeData(null);
    } catch (err) {
      console.error(err);
      toast.error(`Lỗi đọc tệp: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = async (e, slotNum) => {
    e.preventDefault();
    if (slotNum === 1) setIsDragging1(false);
    else setIsDragging2(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      await processFile(file, slotNum);
    }
  };

  const cleanString = (val) => String(val || '').trim().toLowerCase().normalize('NFC');
  const cleanPhone = (val) => String(val || '').replace(/\D/g, '');

  // Thuật toán kiểm tra trùng khớp
  const isMatch = (r1, r2) => {
    let hasCheckedField = false;

    if (matchFields.title) {
      hasCheckedField = true;
      const t1 = cleanString(r1.title);
      const t2 = cleanString(r2.title);
      if (!t1 || !t2 || t1 !== t2) return false;
    }

    if (matchFields.phone) {
      hasCheckedField = true;
      const p1 = cleanPhone(r1.phone);
      const p2 = cleanPhone(r2.phone);
      if (!p1 || !p2 || p1 !== p2) return false;
    }

    if (matchFields.address) {
      hasCheckedField = true;
      const a1 = cleanString(r1.address);
      const a2 = cleanString(r2.address);
      if (!a1 || !a2 || a1 !== a2) return false;
    }

    return hasCheckedField;
  };

  // Khởi động quá trình hợp nhất với cơ chế chống trùng lặp tuyệt đối
  const handleStartMerge = () => {
    if (!file1 || !file2) {
      toast.warn('Vui lòng nạp đủ cả 2 tệp dữ liệu để tiến hành hợp nhất!');
      return;
    }

    const anyChecked = Object.values(matchFields).some(v => v);
    if (!anyChecked) {
      toast.warn('Vui lòng chọn ít nhất một trường để so khớp dữ liệu.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      try {
        const list1 = file1.data.map(item => ({ ...item, source: 'file1', isUpdated: false }));
        const list2 = file2.data.map(item => ({ ...item, source: 'file2', isUpdated: false }));

        // Gộp toàn bộ dữ liệu của 2 file lại để chạy giải thuật duy nhất hóa
        const combined = [...list1, ...list2];
        const uniqueMergedList = [];
        const detectedConflicts = [];

        combined.forEach(item => {
          // Tìm xem trong uniqueMergedList có bản ghi nào trùng khớp với bản ghi hiện tại không
          let matchIndex = -1;
          for (let i = 0; i < uniqueMergedList.length; i++) {
            if (isMatch(item, uniqueMergedList[i])) {
              matchIndex = i;
              break;
            }
          }

          if (matchIndex >= 0) {
            const existing = uniqueMergedList[matchIndex];
            const hasEmailExisting = !!cleanString(existing.email);
            const hasEmailItem = !!cleanString(item.email);

            if (hasEmailExisting && hasEmailItem && cleanString(existing.email) !== cleanString(item.email)) {
              // Xung đột email: Cả 2 đều có email nhưng email khác nhau
              detectedConflicts.push({
                key: `${existing.stt || matchIndex}_${item.stt || Math.random()}`,
                indexInUniqueList: matchIndex,
                title: existing.title || item.title,
                phone: existing.phone || item.phone,
                address: existing.address || item.address,
                email1: existing.email,
                email2: item.email,
                record1: { ...existing },
                record2: { ...item },
                resolution: 'file1'
              });
            } else {
              // Không xung đột email -> Điền email thiếu chéo
              if (!hasEmailExisting && hasEmailItem) {
                existing.email = item.email;
                existing.isUpdated = true;
              }
            }

            // Gộp chéo các trường dữ liệu bị thiếu khác
            if (!existing.website && item.website) existing.website = item.website;
            if (!existing.phone && item.phone) existing.phone = item.phone;
            if (!existing.address && item.address) existing.address = item.address;
            if (!existing.cuisineType && item.cuisineType) existing.cuisineType = item.cuisineType;
            if (!existing.neighborhood && item.neighborhood) existing.neighborhood = item.neighborhood;
            if (!existing.totalScore && item.totalScore) existing.totalScore = item.totalScore;

            if (existing.source !== item.source) {
              existing.source = 'both';
            }
          } else {
            // Bản ghi độc nhất mới tinh -> thêm vào uniqueMergedList
            uniqueMergedList.push({ ...item });
          }
        });

        setTempMergeData({
          uniqueMergedList
        });

        if (detectedConflicts.length > 0) {
          setConflicts(detectedConflicts);
          toast.warning(`Phát hiện ${detectedConflicts.length} bản ghi có xung đột email. Vui lòng duyệt qua các lựa chọn.`);
        } else {
          // Không có xung đột -> Finalize hợp nhất luôn
          finalizeMerge(uniqueMergedList, []);
        }
      } catch (err) {
        toast.error(`Lỗi đối hợp dữ liệu: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    }, 300);
  };

  // Hoàn tất hợp nhất sau khi đã phân giải toàn bộ xung đột
  const handleResolveAndMerge = () => {
    if (!tempMergeData) return;

    setIsLoading(true);
    setTimeout(() => {
      try {
        const { uniqueMergedList } = tempMergeData;
        const resolvedList = uniqueMergedList.map(item => ({ ...item }));

        conflicts.forEach(conflict => {
          const idx = conflict.indexInUniqueList;
          if (idx >= 0 && idx < resolvedList.length) {
            const existing = resolvedList[idx];

            if (conflict.resolution === 'file1') {
              existing.email = conflict.email1;
            } else if (conflict.resolution === 'file2') {
              existing.email = conflict.email2;
              existing.isUpdated = true;
            } else if (conflict.resolution === 'both') {
              existing.email = `${conflict.email1}, ${conflict.email2}`;
              existing.isUpdated = true;
            }
            existing.source = 'both';
          }
        });

        finalizeMerge(resolvedList, conflicts);
      } catch (err) {
        toast.error(`Lỗi hợp nhất xung đột: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    }, 200);
  };

  const finalizeMerge = (mergedList, resolvedConflicts) => {
    // Sắp xếp đưa các bản ghi có email lên hàng đầu
    mergedList.sort((a, b) => {
      const hasEmailA = !!String(a.email || '').trim();
      const hasEmailB = !!String(b.email || '').trim();
      if (hasEmailA && !hasEmailB) return -1;
      if (!hasEmailA && hasEmailB) return 1;
      return 0;
    });

    // Đánh lại số thứ tự STT bắt đầu từ 1
    const finalResults = mergedList.map((item, idx) => ({
      ...item,
      stt: idx + 1
    }));

    setMergedResults(finalResults);
    setMergeSummary({
      totalRecords: finalResults.length,
      matchedCount: (file1.data.length + file2.data.length) - finalResults.length,
      emailsFilled: finalResults.filter(item => item.isUpdated).length,
      conflictsResolved: resolvedConflicts.length
    });
    setConflicts([]);
    toast.success('Hợp nhất & điền email hoàn tất! Tuyệt đối không còn bản ghi trùng lặp.');
  };

  const updateConflictResolution = (key, value) => {
    setConflicts(prev => prev.map(c => c.key === key ? { ...c, resolution: value } : c));
  };

  // Xuất file Excel đã hợp nhất
  const handleExportExcel = () => {
    if (mergedResults.length === 0) return;

    const formattedData = mergedResults.map((item, index) => {
      let phoneStr = item.phone || '';
      if (phoneStr.startsWith('0')) {
        phoneStr = `'${phoneStr}`;
      }
      return {
        'STT': index + 1,
        'Title': item.title || '',
        'Cuisine/Service Type': item.cuisineType || '',
        'Email': item.email || '',
        'Phone': phoneStr,
        'Address': item.address || '',
        'URL': item.url || '',
        'Total Score': item.totalScore || '',
        'Website': item.website || '',
        'Facebook': item.facebook || '',
        'Source': item.source || '',
        'Is Flag': item.isFlag ? 'TRUE' : 'FALSE'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 30 },
      { wch: 20 },
      { wch: 25 },
      { wch: 16 },
      { wch: 45 },
      { wch: 40 },
      { wch: 12 },
      { wch: 25 },
      { wch: 25 },
      { wch: 20 },
      { wch: 10 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Merged Data');
    XLSX.writeFile(workbook, 'merged_file_data.xlsx');
    toast.success('Đã tải xuống file Excel đã hợp nhất!');
  };

  // Xuất file JSON đã hợp nhất (loại bỏ trường neighborhood & dữ liệu hỗ trợ UI)
  const handleExportJson = () => {
    if (mergedResults.length === 0) return;

    const cleanedData = mergedResults.map((item) => ({
      stt: item.stt,
      title: item.title || '',
      cuisineType: item.cuisineType || '',
      email: item.email || '',
      phone: item.phone || '',
      address: item.address || '',
      url: item.url || '',
      totalScore: item.totalScore || '',
      website: item.website || '',
      facebook: item.facebook || '',
      source: item.source || '',
      isFlag: !!item.isFlag
    }));
    const jsonString = JSON.stringify(cleanedData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'merged_file_data.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Đã tải xuống file JSON đã hợp nhất!');
  };

  const getFriendlySize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="main-card glass-card animate-fade-in" style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>
          🔀 Hợp nhất file &amp; Điền chéo Email
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Tải lên 2 tệp dữ liệu, hệ thống tự động đối chiếu các trường còn lại để bù trừ email còn thiếu cho nhau.
        </p>
      </div>

      {/* Grid Drag & Drop 2 File */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        {/* Hộp nạp file 1 */}
        <div 
          className={`textarea-wrapper ${isDragging1 ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging1(true); }}
          onDragLeave={() => setIsDragging1(false)}
          onDrop={(e) => handleDrop(e, 1)}
          style={{ 
            minHeight: '140px', 
            justifyContent: 'center', 
            alignItems: 'center', 
            cursor: 'pointer',
            flexDirection: 'column',
            padding: '1rem'
          }}
          onClick={() => fileInputRef1.current.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef1} 
            onChange={(e) => handleFileChange(e, 1)} 
            accept=".xlsx,.xls,.csv,.json"
            style={{ display: 'none' }}
          />
          {file1 ? (
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '2.5rem' }}>📊</span>
              <h4 style={{ fontWeight: 600, marginTop: '0.5rem', color: 'var(--text-main)' }}>Tệp thứ nhất</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file1.name}
              </p>
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <span className="badge" style={{ backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                  {file1.data.length} bản ghi
                </span>
                <span className="badge" style={{ backgroundColor: 'var(--border-color)', color: 'var(--text-main)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                  {getFriendlySize(file1.size)}
                </span>
              </div>
              <button 
                type="button"
                className="btn btn-secondary" 
                style={{ marginTop: '0.75rem', padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                onClick={(e) => { e.stopPropagation(); setFile1(null); setMergeSummary(null); setMergedResults([]); setConflicts([]); }}
              >
                Gỡ bỏ
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
              <span style={{ fontSize: '2.5rem' }}>📥</span>
              <h4 style={{ fontWeight: 600, marginTop: '0.5rem', color: 'var(--text-main)' }}>Chọn tệp thứ nhất</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Kéo thả file .xlsx, .csv hoặc .json vào đây
              </p>
            </div>
          )}
        </div>

        {/* Hộp nạp file 2 */}
        <div 
          className={`textarea-wrapper ${isDragging2 ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging2(true); }}
          onDragLeave={() => setIsDragging2(false)}
          onDrop={(e) => handleDrop(e, 2)}
          style={{ 
            minHeight: '140px', 
            justifyContent: 'center', 
            alignItems: 'center', 
            cursor: 'pointer',
            flexDirection: 'column',
            padding: '1rem'
          }}
          onClick={() => fileInputRef2.current.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef2} 
            onChange={(e) => handleFileChange(e, 2)} 
            accept=".xlsx,.xls,.csv,.json"
            style={{ display: 'none' }}
          />
          {file2 ? (
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '2.5rem' }}>📊</span>
              <h4 style={{ fontWeight: 600, marginTop: '0.5rem', color: 'var(--text-main)' }}>Tệp thứ hai</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file2.name}
              </p>
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <span className="badge" style={{ backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                  {file2.data.length} bản ghi
                </span>
                <span className="badge" style={{ backgroundColor: 'var(--border-color)', color: 'var(--text-main)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                  {getFriendlySize(file2.size)}
                </span>
              </div>
              <button 
                type="button"
                className="btn btn-secondary" 
                style={{ marginTop: '0.75rem', padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                onClick={(e) => { e.stopPropagation(); setFile2(null); setMergeSummary(null); setMergedResults([]); setConflicts([]); }}
              >
                Gỡ bỏ
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
              <span style={{ fontSize: '2.5rem' }}>📥</span>
              <h4 style={{ fontWeight: 600, marginTop: '0.5rem', color: 'var(--text-main)' }}>Chọn tệp thứ hai</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Kéo thả file .xlsx, .csv hoặc .json vào đây
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Cài đặt Trường so khớp */}
      <div style={{
        padding: '1rem',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-card)',
        marginBottom: '1.5rem'
      }}>
        <h4 style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
          ⚙️ Các trường dùng để so khớp cơ sở (AND Match):
        </h4>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <Checkbox 
            checked={matchFields.title} 
            onChange={(e) => setMatchFields(prev => ({ ...prev, title: e.target.checked }))}
            style={{ color: 'var(--text-main)' }}
          >
            Tên cơ sở (Title)
          </Checkbox>
          <Checkbox 
            checked={matchFields.phone} 
            onChange={(e) => setMatchFields(prev => ({ ...prev, phone: e.target.checked }))}
            style={{ color: 'var(--text-main)' }}
          >
            Số điện thoại (Phone)
          </Checkbox>
          <Checkbox 
            checked={matchFields.address} 
            onChange={(e) => setMatchFields(prev => ({ ...prev, address: e.target.checked }))}
            style={{ color: 'var(--text-main)' }}
          >
            Địa chỉ (Address)
          </Checkbox>
        </div>
      </div>

      {/* Nút bấm Merge Action */}
      {conflicts.length === 0 && (
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <button 
            onClick={handleStartMerge}
            className="btn btn-primary"
            style={{ 
              padding: '0.75rem 2rem', 
              borderRadius: '12px', 
              fontSize: '1rem', 
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(0, 115, 230, 0.3)'
            }}
            disabled={!file1 || !file2}
          >
            🔀 Tiến hành Hợp nhất dữ liệu
          </button>
        </div>
      )}

      {/* VÙNG GIẢI QUYẾT XUNG ĐỘT (Conflict Resolver) */}
      {conflicts.length > 0 && (
        <div style={{
          padding: '1.5rem',
          borderRadius: '16px',
          border: '2px solid var(--warning-border)',
          backgroundColor: 'var(--warning-bg)',
          marginBottom: '1.5rem',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ⚠️ Phát hiện {conflicts.length} bản ghi bị xung đột Email
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Cùng một cơ sở được đối khớp thành công ở 2 file nhưng chứa 2 địa chỉ email khác nhau. Vui lòng duyệt và lựa chọn email mong muốn giữ lại.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '450px', overflowY: 'auto', paddingRight: '0.5rem', marginBottom: '1.5rem' }}>
            {conflicts.map((conflict, idx) => (
              <div 
                key={conflict.key}
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{idx + 1}. {conflict.title}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      📞 SĐT: {conflict.phone || 'Trống'} | 📍 Địa chỉ: {conflict.address || 'Trống'}
                    </div>
                  </div>
                </div>

                <Divider style={{ margin: '0.5rem 0' }} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
                  <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Tệp 1 Email:</div>
                    <div style={{ marginTop: '0.25rem', color: 'var(--primary)', fontWeight: 600 }}>{conflict.email1}</div>
                  </div>
                  <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Tệp 2 Email:</div>
                    <div style={{ marginTop: '0.25rem', color: 'var(--primary)', fontWeight: 600 }}>{conflict.email2}</div>
                  </div>
                </div>

                <div style={{ marginTop: '0.5rem' }}>
                  <Radio.Group 
                    value={conflict.resolution} 
                    onChange={(e) => updateConflictResolution(conflict.key, e.target.value)}
                  >
                    <Radio value="file1" style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>Lấy của Tệp 1</Radio>
                    <Radio value="file2" style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>Lấy của Tệp 2</Radio>
                    <Radio value="both" style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>Gộp cả hai (ngăn cách bằng dấu phẩy)</Radio>
                  </Radio.Group>
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'right' }}>
            <Button 
              type="primary" 
              onClick={handleResolveAndMerge}
              style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', fontWeight: 600 }}
            >
              ✅ Hoàn tất chọn &amp; Hợp nhất dữ liệu
            </Button>
          </div>
        </div>
      )}

      {/* Kết quả Merge */}
      {mergeSummary && (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <Alert 
            type="success"
            showIcon
            message="Hợp nhất thành công!"
            description={`Tổng số: ${mergeSummary.totalRecords} bản ghi sau gộp. Đối sánh thành công ${mergeSummary.matchedCount} bản ghi trùng. Đã gộp và điền ${mergeSummary.emailsFilled} email còn thiếu (bao gồm ${mergeSummary.conflictsResolved} xung đột đã giải quyết).`}
            action={
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Button size="small" type="primary" onClick={handleExportExcel}>
                  📥 Tải File Excel
                </Button>
                <Button size="small" onClick={handleExportJson}>
                  📥 Tải File JSON
                </Button>
              </div>
            }
            style={{ marginBottom: '1.5rem' }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
              📊 Xem trước dữ liệu sau khi hợp nhất:
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              * Dòng tô màu xanh ngọc biểu diễn bản ghi đã được cập nhật hoặc chọn email thành công.
            </span>
          </div>

          {/* Bảng xem trước kết quả */}
          <div className="table-container" style={{ maxHeight: '400px' }}>
            <table className="hotel-table">
              <thead>
                <tr>
                  <th className="col-stt">STT</th>
                  <th className="col-title">Tên cơ sở</th>
                  <th>Email</th>
                  <th className="col-phone">Điện thoại</th>
                  <th className="col-address">Địa chỉ</th>
                  <th>Bản đồ</th>
                  <th>Điểm số</th>
                  <th>Website</th>
                  <th>Facebook</th>
                  <th>Nguồn tin</th>
                  <th style={{ textAlign: 'center' }}>Đánh dấu</th>
                  <th>Nguồn gốc</th>
                </tr>
              </thead>
              <tbody>
                {mergedResults.map((item, idx) => {
                  const isUpdated = item.isUpdated;
                  return (
                    <tr 
                      key={idx} 
                      style={isUpdated ? { 
                        backgroundColor: 'rgba(99, 102, 241, 0.08)',
                        borderLeft: '4px solid var(--primary)'
                      } : {}}
                    >
                      <td className="col-stt">{item.stt}</td>
                      <td className="col-title">{item.title || <span className="empty-text">Chưa có tên</span>}</td>
                      <td>
                        {item.email ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>{item.email}</span>
                            {isUpdated && (
                              <span style={{ 
                                backgroundColor: 'var(--primary-glow)', 
                                color: 'var(--primary)', 
                                fontSize: '0.7rem', 
                                padding: '0.1rem 0.4rem', 
                                borderRadius: '4px',
                                fontWeight: 600
                              }}>
                                📧 Đã cập nhật
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="empty-text">Chưa có email</span>
                        )}
                      </td>
                      <td className="col-phone">{item.phone || <span className="empty-text">Chưa có SĐT</span>}</td>
                      <td className="col-address">{item.address || <span className="empty-text">Chưa có địa chỉ</span>}</td>
                      <td>
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="external-link">📍 Maps</a>
                        ) : (
                          <span className="empty-text">-</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>{item.totalScore || <span className="empty-text">-</span>}</td>
                      <td>
                        {item.website ? (
                          <a href={item.website.startsWith('http') ? item.website : `http://${item.website}`} target="_blank" rel="noopener noreferrer" className="external-link">🌐 Web</a>
                        ) : (
                          <span className="empty-text">-</span>
                        )}
                      </td>
                      <td>
                        {item.facebook ? (
                          <a href={item.facebook.startsWith('http') ? item.facebook : `https://${item.facebook}`} target="_blank" rel="noopener noreferrer" className="external-link">🔵 Facebook</a>
                        ) : (
                          <span className="empty-text">-</span>
                        )}
                      </td>
                      <td>{item.source || <span className="empty-text">-</span>}</td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={!!item.isFlag}
                          disabled
                          style={{ width: '15px', height: '15px', opacity: 0.7 }}
                        />
                      </td>
                      <td>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          padding: '0.1rem 0.35rem', 
                          borderRadius: '4px', 
                          backgroundColor: 'var(--border-color)',
                          color: 'var(--text-muted)'
                        }}>
                          {item.source === 'file1' ? 'Tệp 1' : item.source === 'file2' ? 'Tệp 2' : 'Cả hai'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
