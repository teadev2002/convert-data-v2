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
  const [rawInput, setRawInput] = useState(''); // Lưu nội dung nhập liệu hoặc kéo thả thô
  const [originalData, setOriginalData] = useState([]); // Lưu dữ liệu thô sau khi parse (chưa qua lọc)
  const [currentData, setCurrentData] = useState([]); // Dữ liệu đang trực quan hóa (sau khi sắp xếp, lọc...)
  const [lists, setLists] = useState([]); // Danh mục danh sách đã lưu từ LocalStorage
  
  const [selectedListId, setSelectedListId] = useState(''); // ID danh sách đang chọn ở dropdown
  const [activeListId, setActiveListId] = useState(''); // ID danh sách cũ đang hiển thị trên bảng
  
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

  // --- Khởi tạo dữ liệu khi mở trang ---
  useEffect(() => {
    // Tải danh mục các danh sách từ LocalStorage
    loadSavedLists();
    
    // Tự động kiểm tra cài đặt Dark Mode của hệ thống
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (systemPrefersDark) {
      setIsDarkTheme(true);
      document.documentElement.classList.add('dark-theme');
    }
  }, []);

  // --- Lấy danh mục các tệp đã lưu trong LocalStorage ---
  const loadSavedLists = async () => {
    setIsLoading(true);
    try {
      const data = await listService.getAll();
      setLists(data || []);
    } catch (err) {
      toast.error(`Lỗi tải danh sách từ LocalStorage: ${err.message}`);
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

  // --- Xử lý nạp văn bản thô (khi kéo thả hoặc dán từ API bên ngoài) ---
  const handleRawInputLoad = (text) => {
    setRawInput(text);
    // Tự động kích hoạt tiền xử lý sau khi nạp tệp/dữ liệu API thành công
    setTimeout(() => {
      try {
        const parsed = parseHotelData(text);
        if (parsed.length > 0) {
          setOriginalData(parsed);
          setCurrentData(parsed);
          setActiveListId(''); // Đây là tệp mới, chưa được lưu trên DB
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
        toast.warn('Không tìm thấy dữ liệu khách sạn hợp lệ. Hãy kiểm tra định dạng.');
        return;
      }
      setOriginalData(parsed);
      setCurrentData(parsed);
      setActiveListId('');
      toast.success(`Đã chuyển đổi và chuẩn hóa thành công ${parsed.length} dòng khách sạn!`);
    } catch (err) {
      toast.error(`Lỗi xử lý cú pháp dữ liệu: ${err.message}`);
    }
  };

  // --- Hành động: Kiểm tra trùng lặp diện rộng (gọi đối chiếu LocalStorage) ---
  const handleCheckDuplicates = async () => {
    if (currentData.length === 0) return;
    
    setIsChecking(true);
    try {
      // Thu thập tất cả các URL có trong bảng hiển thị hiện tại
      const urlsToCheck = currentData
        .map(item => item.url)
        .filter(url => url && url.trim() !== '');

      if (urlsToCheck.length === 0) {
        toast.info('Không tìm thấy đường dẫn Google Maps (URL) nào để đối chiếu trùng lặp.');
        setIsChecking(false);
        return;
      }

      // Gọi đối chiếu với dữ liệu LocalStorage
      const { duplicateUrls } = await dedupService.checkDuplicates(urlsToCheck, activeListId || null);
      
      const apiDupSet = new Set(duplicateUrls.map(u => u.trim()));
      const localSeenUrls = new Set(); // Dùng Set kiểm tra trùng chéo nội bộ (Internal Duplicates)

      // Cập nhật thuộc tính isDuplicate
      const updatedData = currentData.map(item => {
        const cleanUrl = item.url ? item.url.trim() : '';
        let isDup = false;

        if (cleanUrl) {
          // 1. Kiểm tra xem có trùng với database diện rộng (các danh sách khác trên LocalStorage)
          if (apiDupSet.has(cleanUrl)) {
            isDup = true;
          }
          // 2. Kiểm tra trùng chéo nội bộ trong chính tệp hiển thị
          if (localSeenUrls.has(cleanUrl)) {
            isDup = true;
          }
          localSeenUrls.add(cleanUrl);
        }

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
        toast.success('Kiểm tra hoàn tất: Không phát hiện trùng lặp dữ liệu trên LocalStorage!');
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

    // Đánh lại số thứ tự STT bắt đầu từ 1 sau khi lọc
    const reindexedData = cleanData.map((item, idx) => ({
      ...item,
      stt: idx + 1,
      isDuplicate: false // Reset cờ trùng
    }));

    setCurrentData(reindexedData);
    toast.success(`Đã loại bỏ thành công ${beforeCount - reindexedData.length} dòng trùng lặp!`);
  };

  // --- Hành động: Xem danh sách cũ lưu trữ trên LocalStorage ---
  const handleLoadSavedList = async () => {
    if (!selectedListId) return;
    setIsLoading(true);
    try {
      const list = await listService.getById(selectedListId);
      if (list) {
        const dbData = list.data || [];
        setOriginalData(dbData);
        setCurrentData(dbData);
        setActiveListId(list.id);
        
        // Dán chuỗi JSON của danh sách vào textarea để người dùng có thể chỉnh sửa/sao chép trực tiếp
        setRawInput(JSON.stringify(dbData, null, 2));
        toast.success(`Đã tải lên danh sách "${list.name}" (${dbData.length} bản ghi) từ LocalStorage.`);
      } else {
        toast.error('Không tìm thấy danh sách.');
      }
    } catch (err) {
      toast.error(`Không thể nạp dữ liệu: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Hành động: Xóa hoàn toàn danh sách khỏi LocalStorage ---
  const handleDeleteSavedList = () => {
    if (!selectedListId) return;
    const listToDelete = lists.find(l => l.id === selectedListId);
    if (!listToDelete) return;

    // Hiển thị ConfirmModal tùy biến
    setConfirmConfig({
      isOpen: true,
      title: 'Xác nhận xóa danh sách',
      message: `Bạn có chắc chắn muốn xóa hoàn toàn danh sách "${listToDelete.name}" (${listToDelete.count} bản ghi) khỏi LocalStorage? Thao tác này không thể phục hồi.`,
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setIsLoading(true);
        try {
          await listService.delete(selectedListId);
          toast.success(`Đã xóa danh sách "${listToDelete.name}" khỏi LocalStorage.`);
          
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

  // --- Hành động: Lưu/gộp danh sách lên LocalStorage ---
  const handleSaveData = async (name, selectedId) => {
    if (currentData.length === 0) {
      toast.warn('Bảng hiện đang trống, không có dữ liệu để lưu.');
      return;
    }

    setIsLoading(true);
    try {
      const savedList = await listService.save(name, currentData, selectedId);
      toast.success(`Đã lưu trữ thành công danh sách "${name}" vào LocalStorage.`);
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

  // --- Hành động: Sắp xếp điểm đánh giá từ cao xuống thấp ---
  const handleSortByScore = () => {
    if (currentData.length === 0) return;
    
    const sorted = [...currentData].sort((a, b) => {
      const scoreA = parseFloat(a.totalScore);
      const scoreB = parseFloat(b.totalScore);
      
      const hasA = !isNaN(scoreA);
      const hasB = !isNaN(scoreB);
      
      if (hasA && hasB) return scoreB - scoreA; // Giảm dần
      if (hasA && !hasB) return -1; // Đẩy dòng không có điểm xuống cuối
      if (!hasA && hasB) return 1;
      return 0;
    });

    // Đánh số thứ tự STT lại
    const reindexedData = sorted.map((item, idx) => ({
      ...item,
      stt: idx + 1
    }));

    setCurrentData(reindexedData);
    toast.success('Đã sắp xếp danh sách theo điểm số đánh giá giảm dần!');
  };

  // --- Hành động: Xuất tệp Excel chứa dữ liệu hiện tại ---
  const handleExportExcel = () => {
    if (currentData.length === 0) return;
    
    const cleanFileName = 'hotels_export.xlsx';
    try {
      exportToExcel(currentData, cleanFileName);
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
        {/* Vùng kéo thả dữ liệu JSON/CSV & Import từ API */}
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

        {/* Trình quản lý lưu trữ: Xem danh sách, Xóa danh sách, Lưu danh sách */}
        <StorageManager
          lists={lists}
          selectedListId={selectedListId}
          onSelectChange={setSelectedListId}
          onLoadList={handleLoadSavedList}
          onDeleteList={handleDeleteSavedList}
          onOpenSaveModal={() => setIsSaveModalOpen(true)} // Mở modal nhập tên danh sách
          hasData={currentData.length > 0}
        />
      </main>

      {/* 3. Result Section - Trực Quan Hóa Bảng/JSON Kết Quả */}
      <ResultSection
        data={currentData}
        onDeleteRow={handleDeleteRow}
        onSortByScore={handleSortByScore}
        onExportExcel={handleExportExcel}
      />

      {/* --- CÁC POPUP MODALS TÙY BIẾN --- */}

      {/* Modal Lưu danh sách */}
      <SaveModal
        isOpen={isSaveModalOpen}
        lists={lists}
        onSave={handleSaveData}
        onCancel={() => setIsSaveModalOpen(false)}
      />

      {/* Modal Xác nhận (Thay thế confirm) */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={confirmConfig.onCancel}
      />

      {/* Vòng quay Loading toàn màn hình khi lưu dữ liệu */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <span>Đang đồng bộ dữ liệu với LocalStorage...</span>
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
