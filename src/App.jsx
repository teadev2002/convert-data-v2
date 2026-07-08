import React, { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Import các components
import Header from './components/Header.jsx';
import DragDropInput from './components/DragDropInput.jsx';
import ControlBar from './components/ControlBar.jsx';
import StorageManager from './components/StorageManager.jsx';
import ResultSection from './components/ResultSection.jsx';
import SaveModal from './components/SaveModal.jsx';
import ConfirmModal from './components/ConfirmModal.jsx';

// Import các dịch vụ API & tiện ích
import { listService } from './services/listService.js';
import { dedupService } from './services/dedupService.js';
import { parseHotelData } from './utils/parser.js';
import { exportToExcel } from './utils/excelExporter.js';

// Styles chính
import './App.css';

function App() {
  // --- States toàn cục quản lý luồng dữ liệu ---
  const [dataType, setDataType] = useState('hotels'); // 'hotels' hoặc 'restaurants'
  const [rawInput, setRawInput] = useState(''); // Lưu nội dung nhập liệu hoặc kéo thả thô
  const [originalData, setOriginalData] = useState([]); // Lưu dữ liệu thô sau khi parse (chưa qua lọc)
  const [currentData, setCurrentData] = useState([]); // Dữ liệu đang trực quan hóa (sau khi sắp xếp, lọc...)
  const [lists, setLists] = useState([]); // Danh mục các tỉnh thành từ Supabase (provinces)
  
  const [selectedListId, setSelectedListId] = useState(''); // ID tỉnh thành đang chọn ở dropdown
  const [activeListId, setActiveListId] = useState(''); // ID tỉnh thành cũ đang hiển thị trên bảng
  
  const [isLoading, setIsLoading] = useState(false); // Trạng thái tải dữ liệu chung
  const [isChecking, setIsChecking] = useState(false); // Trạng thái gọi API check trùng lặp
  const [isDarkTheme, setIsDarkTheme] = useState(false); // Trạng thái giao diện Tối/Sáng

  // --- States quản lý hiển thị các Modals ---
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {}
  });

  // --- Khởi tạo theme khi mở trang ---
  useEffect(() => {
    // Tự động kiểm tra cài đặt Dark Mode của hệ thống
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (systemPrefersDark) {
      setIsDarkTheme(true);
      document.documentElement.classList.add('dark-theme');
    }
  }, []);

  // --- Tự động tải lại danh sách tỉnh thành mỗi khi đổi Tab Hotels / Restaurants ---
  useEffect(() => {
    loadSavedLists();
    
    // Reset toàn bộ trạng thái dữ liệu cũ
    setSelectedListId('');
    setActiveListId('');
    setCurrentData([]);
    setOriginalData([]);
    setRawInput('');
  }, [dataType]);

  // --- Lấy danh mục các tỉnh thành từ Supabase ---
  const loadSavedLists = async () => {
    setIsLoading(true);
    try {
      const data = await listService.getAll(dataType);
      setLists(data || []);
    } catch (err) {
      toast.error(`Lỗi tải danh sách từ Supabase: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Chuyển đổi chủ đề Light / Dark Mode ---
  const handleToggleTheme = () => {
    setIsDarkTheme(prev => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark-theme');
      } else {
        document.documentElement.classList.remove('dark-theme');
      }
      return next;
    });
  };

  // --- Xử lý nạp văn bản thô (khi dán hoặc kéo thả tệp) ---
  const handleRawInputLoad = (text) => {
    setRawInput(text);
    // Tự động kích hoạt tiền xử lý sau khi nạp tệp thành công
    setTimeout(() => {
      try {
        const parsed = parseHotelData(text);
        if (parsed.length > 0) {
          setOriginalData(parsed);
          setCurrentData(parsed);
          setActiveListId(''); // Reset activeListId vì đây là tệp mới import
          toast.success(`Đã nạp và xử lý tự động ${parsed.length} bản ghi!`);
        }
      } catch (err) {
        console.error(err);
      }
    }, 100);
  };

  // --- Hành động: Xử lý dữ liệu thô (nút thủ công) ---
  const handleProcessData = () => {
    if (!rawInput.trim()) {
      toast.warn('Vui lòng dán JSON/CSV hoặc kéo thả tệp trước khi xử lý.');
      return;
    }
    try {
      const parsed = parseHotelData(rawInput);
      if (parsed.length === 0) {
        toast.warn('Không tìm thấy dữ liệu hợp lệ. Hãy kiểm tra định dạng.');
        return;
      }
      setOriginalData(parsed);
      setCurrentData(parsed);
      setActiveListId('');
      toast.success(`Đã chuyển đổi và chuẩn hóa thành công ${parsed.length} bản ghi!`);
    } catch (err) {
      toast.error(`Lỗi xử lý cú pháp dữ liệu: ${err.message}`);
    }
  };

  // --- Hành động: Kiểm tra trùng lặp diện rộng (gọi đối chiếu Supabase) ---
  const handleCheckDuplicates = async () => {
    if (currentData.length === 0) return;
    
    setIsChecking(true);
    try {
      // Gọi đối chiếu với dữ liệu Supabase, truyền dataType và activeListId để làm exclude (loại trừ tỉnh đang xem)
      const { duplicateStts } = await dedupService.checkDuplicates(currentData, activeListId || null, dataType);
      
      const apiDupSet = new Set(duplicateStts);
      const localSeen = []; // Lưu các bản ghi đã duyệt qua để kiểm tra trùng chéo nội bộ

      const cleanString = (val) => String(val || '').trim().toLowerCase().normalize('NFC');
      const cleanPhone = (val) => String(val || '').replace(/\D/g, '');

      // Hàm đối chiếu khớp ít nhất 1 trong 4 điều kiện
      const isMatch1of4 = (r1, r2) => {
        const u1 = cleanString(r1.url);
        const u2 = cleanString(r2.url);
        if (u1 && u2 && u1 === u2) return true;

        const a1 = cleanString(r1.address);
        const a2 = cleanString(r2.address);
        if (a1 && a2 && a1 === a2) return true;

        const p1 = cleanPhone(r1.phone);
        const p2 = cleanPhone(r2.phone);
        if (p1 && p2 && p1 === p2) return true;

        const t1 = cleanString(r1.title);
        const t2 = cleanString(r2.title);
        if (t1 && t2 && t1 === t2) return true;

        return false;
      };

      // Cập nhật thuộc tính isDuplicate
      const updatedData = currentData.map(item => {
        let isDup = apiDupSet.has(item.stt);

        // Kiểm tra trùng chéo nội bộ (Internal Duplicates)
        if (!isDup) {
          for (const seenItem of localSeen) {
            if (isMatch1of4(item, seenItem)) {
              isDup = true;
              break;
            }
          }
        }

        localSeen.push(item);
        return {
          ...item,
          isDuplicate: isDup
        };
      });

      setCurrentData(updatedData);

      const duplicateCount = updatedData.filter(item => item.isDuplicate).length;
      if (duplicateCount > 0) {
        toast.warning(`Phát hiện ${duplicateCount} bản ghi bị trùng lặp (dòng màu vàng).`);
      } else {
        toast.success('Kiểm tra hoàn tất: Không phát hiện trùng lặp dữ liệu trên Supabase!');
      }
    } catch (err) {
      toast.error(`Kiểm tra trùng lặp thất bại: ${err.message}`);
    } finally {
      setIsChecking(false);
    }
  };

  // --- Hành động: Xóa các dòng trùng lặp khỏi bảng hiển thị ---
  const handleRemoveDuplicates = () => {
    const beforeCount = currentData.length;
    const cleanData = currentData.filter(item => !item.isDuplicate);
    
    if (cleanData.length === beforeCount) {
      toast.info('Bảng hiện tại không chứa dòng trùng lặp nào để xóa.');
      return;
    }

    // Sắp xếp và đánh lại số thứ tự STT bắt từ 1
    const reindexedData = cleanData.map((item, idx) => ({
      ...item,
      stt: idx + 1,
      isDuplicate: false // Reset cờ trùng
    }));

    setCurrentData(reindexedData);
    toast.success(`Đã loại bỏ thành công ${beforeCount - reindexedData.length} dòng trùng lặp!`);
  };

  // --- Hành động: Xem danh sách cũ lưu trữ trên Supabase ---
  const handleLoadSavedList = async () => {
    if (!selectedListId) return;
    setIsLoading(true);
    try {
      const list = await listService.getById(selectedListId, dataType);
      if (list) {
        const dbData = list.data || [];
        setOriginalData(dbData);
        setCurrentData(dbData);
        setActiveListId(list.id);
        
        // Dán chuỗi JSON của danh sách vào textarea để người dùng xem/chỉnh sửa
        setRawInput(JSON.stringify(dbData, null, 2));
        toast.success(`Đã tải dữ liệu tỉnh "${list.name}" (${dbData.length} bản ghi) từ Supabase.`);
      } else {
        toast.error('Không tìm thấy dữ liệu tỉnh thành yêu cầu.');
      }
    } catch (err) {
      toast.error(`Không thể nạp dữ liệu: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Hành động: Xóa toàn bộ dữ liệu của tỉnh thành đó trong bảng tương ứng ---
  const handleDeleteSavedList = () => {
    if (!selectedListId) return;
    const listToDelete = lists.find(l => l.id === selectedListId);
    if (!listToDelete) return;

    const displayType = dataType === 'hotels' ? 'khách sạn' : 'nhà hàng';

    // Hiển thị ConfirmModal
    setConfirmConfig({
      isOpen: true,
      title: 'Xác nhận xóa dữ liệu',
      message: `Bạn có chắc chắn muốn xóa toàn bộ danh sách ${displayType} của tỉnh "${listToDelete.name}" (${listToDelete.count} bản ghi) khỏi Supabase? Thao tác này không thể phục hồi.`,
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setIsLoading(true);
        try {
          await listService.delete(selectedListId, dataType);
          toast.success(`Đã xóa sạch dữ liệu ${displayType} của tỉnh "${listToDelete.name}" khỏi Supabase.`);
          
          if (activeListId === selectedListId) {
            setActiveListId('');
            setCurrentData([]);
            setOriginalData([]);
            setRawInput('');
          }
          
          setSelectedListId('');
          await loadSavedLists();
        } catch (err) {
          toast.error(`Lỗi khi xóa: ${err.message}`);
        } finally {
          setIsLoading(false);
        }
      },
      onCancel: () => setConfirmConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  // --- Hành động: Lưu/gộp danh sách lên Supabase ---
  const handleSaveData = async (provinceName, selectedId) => {
    if (currentData.length === 0) {
      toast.warn('Bảng hiện đang trống, không có dữ liệu để lưu.');
      return;
    }

    setIsLoading(true);
    try {
      const savedList = await listService.save(provinceName, currentData, selectedId, dataType, activeListId);
      const displayType = dataType === 'hotels' ? 'khách sạn' : 'nhà hàng';
      toast.success(`Đã lưu trữ thành công dữ liệu ${displayType} vào tỉnh "${provinceName}" trên Supabase.`);
      setIsSaveModalOpen(false);
      
      // Cập nhật lại dropdown danh sách
      await loadSavedLists();
      setSelectedListId(savedList.id);
      setActiveListId(savedList.id);
    } catch (err) {
      toast.error(`Không thể lưu dữ liệu: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Hành động: Xóa hàng thủ công khỏi bảng hiển thị ---
  const handleDeleteRow = (index) => {
    const updatedData = currentData.filter((_, idx) => idx !== index);
    
    // Đánh lại số thứ tự sau khi xóa
    const reindexedData = updatedData.map((item, idx) => ({
      ...item,
      stt: idx + 1
    }));
    
    setCurrentData(reindexedData);
    toast.success('Đã xóa dòng dữ liệu khỏi màn hình.');
  };

  // --- Sắp xếp ưu tiên: Nhiều thông tin hơn (Website -> Phone -> Score) ---
  const handleSortByScore = () => {
    if (currentData.length === 0) return;
    
    const sorted = [...currentData].sort((a, b) => {
      // 1. Ưu tiên có Website lên hàng đầu
      const hasWebA = a.website && a.website.trim() !== '' ? 1 : 0;
      const hasWebB = b.website && b.website.trim() !== '' ? 1 : 0;
      if (hasWebA !== hasWebB) {
        return hasWebB - hasWebA;
      }

      // 2. Đi kèm với Phone (có Phone lên trước)
      const hasPhoneA = a.phone && a.phone.trim() !== '' ? 1 : 0;
      const hasPhoneB = b.phone && b.phone.trim() !== '' ? 1 : 0;
      if (hasPhoneA !== hasPhoneB) {
        return hasPhoneB - hasPhoneA;
      }

      // 3. Đi kèm với Điểm đánh giá (Total Score) giảm dần
      const scoreA = parseFloat(a.totalScore);
      const scoreB = parseFloat(b.totalScore);
      const hasScoreA = !isNaN(scoreA);
      const hasScoreB = !isNaN(scoreB);

      if (hasScoreA && hasScoreB) {
        return scoreB - scoreA;
      }
      if (hasScoreA && !hasScoreB) return -1;
      if (!hasScoreA && hasScoreB) return 1;

      return 0;
    });

    const reindexedData = sorted.map((item, idx) => ({
      ...item,
      stt: idx + 1
    }));

    setCurrentData(reindexedData);
    toast.success('Đã sắp xếp danh sách ưu tiên (Website -> Số điện thoại -> Điểm số)!');
  };

  // --- Xuất tệp Excel chứa dữ liệu hiện tại ---
  const handleExportExcel = () => {
    if (currentData.length === 0) return;
    
    const cleanFileName = dataType === 'hotels' ? 'hotels_export.xlsx' : 'restaurants_export.xlsx';
    try {
      exportToExcel(currentData, cleanFileName, dataType);
      toast.success('Tải xuống file Excel thành công!');
    } catch (err) {
      toast.error(`Lỗi xuất Excel: ${err.message}`);
    }
  };

  return (
    <div className="app-container">
      {/* 1. Header Trang */}
      <Header isDark={isDarkTheme} onToggleTheme={handleToggleTheme} />

      {/* 2. Main Card - Khung Điều Khiển Nhập Liệu & Tác Vụ */}
      <main className="main-card glass-card">
        {/* NÚT TAB CHUYỂN ĐỔI SONG SONG GIỮA KHÁCH SẠN VÀ NHÀ HÀNG */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1.5rem',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '1rem'
        }}>
          <button
            type="button"
            onClick={() => setDataType('hotels')}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '12px',
              border: 'none',
              background: dataType === 'hotels' ? 'var(--primary)' : 'var(--bg-card)',
              color: dataType === 'hotels' ? '#fff' : 'var(--text-main)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: dataType === 'hotels' ? '0 4px 15px rgba(0, 115, 230, 0.3)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            🏨 Khách sạn (Hotels)
          </button>
          <button
            type="button"
            onClick={() => setDataType('restaurants')}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '12px',
              border: 'none',
              background: dataType === 'restaurants' ? 'var(--primary)' : 'var(--bg-card)',
              color: dataType === 'restaurants' ? '#fff' : 'var(--text-main)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: dataType === 'restaurants' ? '0 4px 15px rgba(0, 115, 230, 0.3)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            🍽️ Nhà hàng (Restaurants)
          </button>
        </div>

        {/* Vùng kéo thả dữ liệu JSON/CSV */}
        <DragDropInput 
          value={rawInput}
          onChange={setRawInput}
          onRawInputLoad={handleRawInputLoad}
        />

        {/* Thanh tác vụ: Xử lý, Kiểm tra trùng, Lọc trùng */}
        <ControlBar
          onProcess={handleProcessData}
          onCheckDuplicates={handleCheckDuplicates}
          onRemoveDuplicates={handleRemoveDuplicates}
          hasRawInput={!!rawInput.trim()}
          hasData={currentData.length > 0}
          isChecking={isChecking}
        />

        {/* Trình quản lý lưu trữ tỉnh thành: Xem, Xóa, Lưu */}
        <StorageManager
          lists={lists}
          selectedListId={selectedListId}
          onSelectChange={setSelectedListId}
          onLoadList={handleLoadSavedList}
          onDeleteList={handleDeleteSavedList}
          onOpenSaveModal={() => setIsSaveModalOpen(true)}
          hasData={currentData.length > 0}
        />
      </main>

      {/* 3. Result Section - Trực Quan Hóa Bảng/JSON Kết Quả */}
      <ResultSection
        data={currentData}
        dataType={dataType}
        onDeleteRow={handleDeleteRow}
        onSortByScore={handleSortByScore}
        onExportExcel={handleExportExcel}
      />

      {/* --- CÁC POPUP MODALS TÙY BIẾN --- */}

      {/* Modal Lưu danh sách tỉnh thành */}
      <SaveModal
        isOpen={isSaveModalOpen}
        lists={lists}
        dataType={dataType}
        onSave={handleSaveData}
        onCancel={() => setIsSaveModalOpen(false)}
      />

      {/* Modal Xác nhận */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={confirmConfig.onCancel}
      />

      {/* Vòng quay Loading toàn màn hình khi đồng bộ */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <span>Đang đồng bộ dữ liệu với Supabase...</span>
        </div>
      )}

      {/* Hệ thống thông báo Toast nổi */}
      <ToastContainer
        position="top-right"
        autoClose={3500}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={isDarkTheme ? 'dark' : 'light'}
      />
    </div>
  );
}

export default App;
