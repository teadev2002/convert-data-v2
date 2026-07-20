import { useState, useEffect, useMemo, useCallback } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Alert, Button, Popconfirm } from 'antd';

// Import các components
import Header from './components/Header.jsx';
import DragDropInput from './components/DragDropInput.jsx';
import ControlBar from './components/ControlBar.jsx';
import StorageManager from './components/StorageManager.jsx';
import ResultSection from './components/ResultSection.jsx';
import SaveModal from './components/SaveModal.jsx';
import ConfirmModal from './components/ConfirmModal.jsx';
import MergeFile from './components/MergeFile.jsx';

// Import các dịch vụ API & tiện ích
import { listService } from './services/listService.js';
import { dedupService } from './services/dedupService.js';
import { storageService } from './services/storageService.js';
import { parseHotelData } from './utils/parser.js';
import { exportToExcel } from './utils/excelExporter.js';

// Styles chính
import './App.css';

// Bản đồ đồng nghĩa cho các tỉnh thành lớn để lọc địa chỉ thông minh
const PROVINCE_SYNONYMS = [
  {
    keys: ['ho chi minh', 'hồ chí minh', 'hcm', 'tp.hcm', 'tphcm', 'sai gon', 'sài gòn', 'saigon', 'Ho Chi Minh', 'Hồ Chí Minh', 'TP.HCN', 'TP.Hồ Chí Minh'],
    variants: [
      'hồ chí minh', 'ho chi minh', 'hcm', 'tp.hcm', 'tphcm',
      'sài gòn', 'sai gon', 'saigon', 'ho chi minh, vietnam', 'Ho Chi Minh',
      'hồ chí minh, vietnam', 'hồ chí minh, việt nam', 'ho chi minh, viet nam'
    ]
  },
  {
    keys: ['ha noi', 'hà nội', 'hn', 'tp.hn', 'tphn'],
    variants: ['hà nội', 'ha noi', 'hn', 'tp.hn', 'tphn', 'hà nội, việt nam', 'ha noi, vietnam']
  },
  {
    keys: ['da nang', 'đà nẵng', 'tp.dn', 'tpdn'],
    variants: ['đà nẵng', 'da nang', 'tp.dn', 'tpdn']
  },
  {
    keys: ['dong nai', 'đồng nai'],
    variants: ['đồng nai', 'dong nai']
  },
  {
    keys: ['binh duong', 'bình dương'],
    variants: ['bình dương', 'binh duong']
  },
  {
    keys: ['nha trang', 'khanh hoa', 'khánh hòa'],
    variants: ['nha trang', 'khánh hòa', 'khanh hoa']
  },
  {
    keys: ['hai phong', 'hải phòng'],
    variants: ['hải phòng', 'hai phong']
  },
  {
    keys: ['can tho', 'cần thơ'],
    variants: ['cần thơ', 'can tho']
  },
  {
    keys: ['vung tau', 'vũng tàu'],
    variants: ['vũng tàu', 'vung tau']
  },
  {
    keys: ['hue', 'huế'],
    variants: ['huế', 'hue', 'thừa thiên huế', 'thua thien hue']
  }
];

// Chuẩn hoá chuỗi: bỏ dấu, chữ thường, trim
const normalizeStr = (str) =>
  str.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').normalize('NFC');

// Đối chiếu địa chỉ có hỗ trợ từ khóa đồng nghĩa tỉnh thành
const matchAddressWithSynonyms = (addressStr, filterText) => {
  if (!filterText) return true;
  if (!addressStr) return false;

  const normFilter = normalizeStr(filterText);
  const normAddress = normalizeStr(addressStr);

  // Tìm nhóm đồng nghĩa phù hợp với từ khóa
  const matchedGroup = PROVINCE_SYNONYMS.find(group =>
    group.keys.some(key => {
      const normKey = normalizeStr(key);
      return normFilter === normKey ||
        (normFilter.length >= 2 && normKey.includes(normFilter)) ||
        (normFilter.length >= 2 && normFilter.includes(normKey));
    })
  );

  if (matchedGroup) {
    // Kiểm tra địa chỉ có chứa bất kỳ biến thể đồng nghĩa nào không
    return matchedGroup.variants.some(variant =>
      normAddress.includes(normalizeStr(variant))
    );
  }

  // Fallback: tìm kiếm chuỗi con thông thường
  return normAddress.includes(normFilter);
};

function App() {
  // --- Cơ chế định tuyến nhẹ (Routing) ---
  const [currentRoute, setCurrentRoute] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path) => {
    window.history.pushState(null, '', path);
    setCurrentRoute(path);
  };

  // --- States toàn cục quản lý luồng dữ liệu ---
  const [dataType, setDataType] = useState('hotels'); // 'hotels', 'restaurants' hoặc 'spa'
  const [rawInput, setRawInput] = useState(''); // Lưu nội dung nhập liệu hoặc kéo thả thô
  const [currentData, setCurrentData] = useState([]); // Dữ liệu đang trực quan hóa (sau khi sắp xếp, lọc...)
  const [lists, setLists] = useState([]); // Danh mục các tỉnh thành từ Local Storage (provinces)
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(''); // Bộ lọc Phường / Xã đang chọn
  const [addressFilterText, setAddressFilterText] = useState(''); // Chuỗi tìm kiếm địa chỉ đang chọn

  const [selectedListId, setSelectedListId] = useState(''); // ID tỉnh thành đang chọn ở dropdown
  const [activeListId, setActiveListId] = useState(''); // ID tỉnh thành cũ đang hiển thị trên bảng

  // --- States quản lý hiển thị các Modals ---
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    onCancel: () => { }
  });

  // --- Lọc đồng thời quản lý đóng/mở Alerts ---
  const [prevData, setPrevData] = useState([]);
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);
  const [customErrorAlert, setCustomErrorAlert] = useState(null);

  if (currentData !== prevData) {
    setPrevData(currentData);
    setIsAlertDismissed(false);
    setCustomErrorAlert(null);
  }

  const [isLoading, setIsLoading] = useState(false); // Trạng thái tải dữ liệu chung
  const [isChecking, setIsChecking] = useState(false); // Trạng thái gọi API check trùng lặp
  const [dupFields, setDupFields] = useState({
    url: true,
    address: false,
    phone: false,
    title: false
  }); // Trạng thái các checkbox chọn trường lọc trùng
  const handleDupFieldsChange = (field) => {
    setDupFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (systemPrefersDark) {
      document.documentElement.classList.add('dark-theme');
      return true;
    }
    return false;
  }); // Trạng thái giao diện Tối/Sáng
  const [lastSavedTime, setLastSavedTime] = useState(0); // Trigger để tính toán lại hasUnsavedData sau khi lưu/xóa

  // --- Các hàm hỗ trợ dùng useCallback để tránh vấn đề hoisting/đệ quy ---
  // --- Lấy danh mục các tỉnh thành từ Local Storage ---
  const loadSavedLists = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listService.getAll(dataType);
      setLists(data || []);
    } catch (err) {
      toast.error(`Lỗi tải danh sách tỉnh thành: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [dataType]);

  // --- Hành động: Xóa các dòng trùng lặp khỏi bảng hiển thị ---
  const handleRemoveDuplicates = useCallback(() => {
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
  }, [currentData]);

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

  const handleCloseAlert = () => {
    setIsAlertDismissed(true);
    setCustomErrorAlert(null);
  };

  // --- Tự động kiểm tra xem bảng hiển thị có chứa bản ghi chưa được lưu hay không ---
  const [hasUnsavedData, setHasUnsavedData] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkUnsaved = async () => {
      if (currentData.length === 0) {
        if (isMounted) setHasUnsavedData(false);
        return;
      }

      const allKeys = await storageService.getAllKeys();
      let allDbRecords = [];
      for (const key of allKeys) {
        if (key && (key.startsWith('hotels-') || key.startsWith('restaurants-') || key.startsWith('spa-'))) {
          const data = (await storageService.getItem(key)) || [];
          allDbRecords = [...allDbRecords, ...data];
        }
      }

      const cleanString = (val) => String(val || '').trim().toLowerCase().normalize('NFC');
      const cleanPhone = (val) => String(val || '').replace(/\D/g, '');

      const result = currentData.some(item => {
        const isSaved = allDbRecords.some(dbRec => {
          let hasCheckedField = false;

          if (dupFields.url) {
            hasCheckedField = true;
            const u1 = cleanString(item.url);
            const u2 = cleanString(dbRec.url);
            if (!u1 || !u2 || u1 !== u2) return false;
          }

          if (dupFields.address) {
            hasCheckedField = true;
            const a1 = cleanString(item.address);
            const a2 = cleanString(dbRec.address);
            if (!a1 || !a2 || a1 !== a2) return false;
          }

          if (dupFields.phone) {
            hasCheckedField = true;
            const p1 = cleanPhone(item.phone);
            const p2 = cleanPhone(dbRec.phone);
            if (!p1 || !p2 || p1 !== p2) return false;
          }

          if (dupFields.title) {
            hasCheckedField = true;
            const t1 = cleanString(item.title);
            const t2 = cleanString(dbRec.title);
            if (!t1 || !t2 || t1 !== t2) return false;
          }

          return hasCheckedField;
        });

        return !isSaved;
      });

      if (isMounted) {
        setHasUnsavedData(result);
      }
    };

    checkUnsaved();

    return () => {
      isMounted = false;
    };
  }, [currentData, dupFields, lastSavedTime]);

  // --- Tự động cập nhật thông tin cảnh báo bằng Ant Design Alert dựa trên dữ liệu hiện tại ---
  const activeAlert = useMemo(() => {
    if (isAlertDismissed) return null;
    if (customErrorAlert) return customErrorAlert;

    if (currentData.length === 0) {
      return null;
    }

    const duplicateCount = currentData.filter(item => item.isDuplicate).length;

    if (duplicateCount > 0) {
      const storageCount = currentData.filter(item => item.duplicateSource === 'storage').length;
      const fileCount = currentData.filter(item => item.duplicateSource === 'file').length;

      // Nếu toàn bộ dữ liệu bị trùng lặp (không có dòng mới)
      if (duplicateCount === currentData.length) {
        return {
          type: 'info',
          message: 'Toàn bộ dữ liệu đã trùng khớp (Trùng 100%)',
          description: `Tất cả ${duplicateCount} bản ghi vừa nạp đều đã tồn tại trong kho lưu trữ Local Storage (${storageCount} dòng trùng trong kho, ${fileCount} dòng trùng chéo trong tệp). Vui lòng nhấn nút bên phải để xóa các bản ghi trùng lặp. Đảm bảo bạn chọn đúng loại hình dịch vụ và đúng phường/xã để kiểm trùng cho lần sau.`,
          action: (
            <Button size="small" type="primary" onClick={handleRemoveDuplicates}>
              Xóa trùng lặp
            </Button>
          )
        };
      } else {
        // Trùng lặp một phần
        return {
          type: 'warning',
          message: `Phát hiện ${duplicateCount} dòng trùng lặp`,
          description: `Tìm thấy ${storageCount} dòng trùng trong kho Local Storage và ${fileCount} dòng trùng chéo trong tệp vừa nạp. Các bản ghi này đã được tô màu vàng trên bảng hiển thị.`,
          action: (
            <Button size="small" danger onClick={handleRemoveDuplicates}>
              Xóa trùng lặp
            </Button>
          )
        };
      }
    } else {
      // Không có dòng trùng nào
      if (hasUnsavedData) {
        return {
          type: 'warning',
          message: 'Cảnh báo: Dữ liệu chưa được lưu (Unsaved Changes)',
          description: 'Bạn có các thay đổi chưa được lưu vào Local Storage. Nếu tải lại trang (Reload) hoặc đóng tab trình duyệt, toàn bộ dữ liệu này sẽ bị mất.',
          action: (
            <Button size="small" type="primary" onClick={() => setIsSaveModalOpen(true)}>
              Lưu ngay
            </Button>
          )
        };
      }
    }
    return null;
  }, [isAlertDismissed, customErrorAlert, currentData, hasUnsavedData, handleRemoveDuplicates]);

  // --- Tự động tải lại danh sách tỉnh thành mỗi khi đổi Tab Hotels / Restaurants / Spa ---
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSavedLists();
  }, [dataType, loadSavedLists]);

  // --- Kiểm tra và chuyển đổi Tab loại hình dịch vụ ---
  const handleTabChange = (newType) => {
    if (newType === dataType) return;
    setDataType(newType);

    // Reset toàn bộ trạng thái dữ liệu cũ khi đổi tab (thực hiện đồng bộ trong Event Handler)
    setSelectedListId('');
    setActiveListId('');
    setCurrentData([]);
    setRawInput('');
    setSelectedNeighborhood('');
    setAddressFilterText('');
    setIsAlertDismissed(false);
    setCustomErrorAlert(null);
  };

  // --- Xử lý nạp văn bản thô (khi dán hoặc kéo thả tệp) ---
  const handleRawInputLoad = (text) => {
    setRawInput(text);
    setSelectedNeighborhood('');
    // Tự động kích hoạt tiền xử lý sau khi nạp tệp thành công
    setTimeout(() => {
      try {
        const parsed = parseHotelData(text);
        if (parsed.length > 0) {
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
    setSelectedNeighborhood('');
    try {
      const parsed = parseHotelData(rawInput);
      if (parsed.length === 0) {
        toast.warn('Không tìm thấy dữ liệu hợp lệ. Hãy kiểm tra định dạng.');
        return;
      }
      setCurrentData(parsed);
      setActiveListId('');
      toast.success(`Đã chuyển đổi và chuẩn hóa thành công ${parsed.length} bản ghi!`);
    } catch (err) {
      toast.error(`Lỗi xử lý cú pháp dữ liệu: ${err.message}`);
    }
  };

  // --- Hành động: Kiểm tra trùng lặp diện rộng (gọi đối chiếu Local Storage) ---
  const handleCheckDuplicates = async () => {
    if (currentData.length === 0) return;

    // Kiểm tra xem có ít nhất 1 checkbox được tick hay không
    const anyChecked = Object.values(dupFields).some(v => v);
    if (!anyChecked) {
      toast.warn('Vui lòng tích chọn ít nhất 1 trường để đối chiếu trùng lặp!');
      return;
    }

    setIsChecking(true);
    const toastId = toast.loading('Đang tiến hành đối chiếu trùng lặp diện rộng...');

    try {
      // Trễ nhân tạo 900ms để hiệu ứng trực quan hiển thị rõ ràng và người dùng yên tâm
      await new Promise(resolve => setTimeout(resolve, 900));

      // Gọi đối chiếu với dữ liệu Local Storage
      const { duplicateStts } = await dedupService.checkDuplicates(currentData, activeListId || null, dataType, dupFields);

      const apiDupSet = new Set(duplicateStts);
      const localSeen = []; // Lưu các bản ghi đã duyệt qua để kiểm tra trùng chéo nội bộ

      const cleanString = (val) => String(val || '').trim().toLowerCase().normalize('NFC');
      const cleanPhone = (val) => String(val || '').replace(/\D/g, '');

      // Hàm đối chiếu xem hai bản ghi có trùng khớp dựa trên tất cả các trường được chọn (điều kiện AND)
      const isMatchSelected = (r1, r2) => {
        let hasCheckedField = false;

        if (dupFields.url) {
          hasCheckedField = true;
          const u1 = cleanString(r1.url);
          const u2 = cleanString(r2.url);
          if (!u1 || !u2 || u1 !== u2) return false;
        }

        if (dupFields.address) {
          hasCheckedField = true;
          const a1 = cleanString(r1.address);
          const a2 = cleanString(r2.address);
          if (!a1 || !a2 || a1 !== a2) return false;
        }

        if (dupFields.phone) {
          hasCheckedField = true;
          const p1 = cleanPhone(r1.phone);
          const p2 = cleanPhone(r2.phone);
          if (!p1 || !p2 || p1 !== p2) return false;
        }

        if (dupFields.title) {
          hasCheckedField = true;
          const t1 = cleanString(r1.title);
          const t2 = cleanString(r2.title);
          if (!t1 || !t2 || t1 !== t2) return false;
        }

        return hasCheckedField;
      };

      // Cập nhật thuộc tính isDuplicate và duplicateSource
      const updatedData = currentData.map(item => {
        let isDup = apiDupSet.has(item.stt);
        let dupSource = null;

        if (isDup) {
          dupSource = 'storage'; // Trùng với dữ liệu đã lưu trong kho Local Storage
        }

        // Kiểm tra trùng chéo nội bộ (Internal Duplicates)
        if (!isDup) {
          for (const seenItem of localSeen) {
            if (isMatchSelected(item, seenItem)) {
              isDup = true;
              dupSource = 'file'; // Trùng nội bộ trong tệp vừa nạp
              break;
            }
          }
        }

        localSeen.push(item);
        return {
          ...item,
          isDuplicate: isDup,
          duplicateSource: dupSource
        };
      });

      setCurrentData(updatedData);

      const dupCount = updatedData.filter(item => item.isDuplicate).length;
      if (dupCount > 0) {
        toast.update(toastId, {
          render: `Kiểm tra hoàn tất! Phát hiện ${dupCount} dòng trùng lặp.`,
          type: 'warning',
          isLoading: false,
          autoClose: 3000
        });
      } else {
        toast.update(toastId, {
          render: 'Kiểm tra hoàn tất! Không phát hiện bản ghi trùng lặp nào.',
          type: 'success',
          isLoading: false,
          autoClose: 3000
        });
      }
    } catch (err) {
      toast.update(toastId, {
        render: `Lỗi kiểm tra trùng lặp: ${err.message}`,
        type: 'error',
        isLoading: false,
        autoClose: 3500
      });
      setCustomErrorAlert({
        type: 'error',
        message: 'Lỗi kiểm tra trùng lặp',
        description: err.message
      });
    } finally {
      setIsChecking(false);
    }
  };

  // --- Hành động: Xem danh sách cũ lưu trữ trên Local Storage ---
  const handleLoadSavedList = async () => {
    if (!selectedListId) return;
    setIsLoading(true);
    setSelectedNeighborhood('');
    try {
      const list = await listService.getById(selectedListId, dataType);
      if (list) {
        const dbData = list.data || [];
        setCurrentData(dbData);
        setActiveListId(list.id);

        // Dán chuỗi JSON của danh sách vào textarea để người dùng xem/chỉnh sửa
        setRawInput(JSON.stringify(dbData, null, 2));
        toast.success(`Đã tải dữ liệu tỉnh "${list.name}" (${dbData.length} bản ghi) từ Local Storage.`);
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

    const displayType = dataType === 'hotels' ? 'khách sạn' : dataType === 'restaurants' ? 'nhà hàng' : 'spa';

    // Hiển thị ConfirmModal
    setConfirmConfig({
      isOpen: true,
      title: 'Xác nhận xóa dữ liệu',
      message: `Bạn có chắc chắn muốn xóa toàn bộ danh sách ${displayType} của tỉnh "${listToDelete.name}" (${listToDelete.count} bản ghi) khỏi Local Storage? Thao tác này không thể phục hồi.`,
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setIsLoading(true);
        try {
          await listService.delete(selectedListId, dataType);
          toast.success(`Đã xóa sạch dữ liệu ${displayType} của tỉnh "${listToDelete.name}" khỏi Local Storage.`);

          if (activeListId === selectedListId) {
            setActiveListId('');
            setCurrentData([]);
            setRawInput('');
            setSelectedNeighborhood('');
          }

          setSelectedListId('');
          await loadSavedLists();
          setLastSavedTime(Date.now());
        } catch (err) {
          toast.error(`Lỗi khi xóa: ${err.message}`);
        } finally {
          setIsLoading(false);
        }
      },
      onCancel: () => setConfirmConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  // --- Hành động: Lưu/gộp danh sách lên Local Storage ---
  const handleSaveData = async (provinceName, selectedId) => {
    if (currentData.length === 0) {
      toast.warn('Bảng hiện đang trống, không có dữ liệu để lưu.');
      return;
    }

    setIsLoading(true);
    try {
      const savedList = await listService.save(provinceName, currentData, selectedId, dataType, activeListId, dupFields);
      const displayType = dataType === 'hotels' ? 'khách sạn' : dataType === 'restaurants' ? 'nhà hàng' : 'spa';
      toast.success(`Đã lưu trữ thành công dữ liệu ${displayType} vào tỉnh "${provinceName}" trên Local Storage.`);
      setIsSaveModalOpen(false);

      // Cập nhật lại dropdown danh sách
      await loadSavedLists();
      setSelectedListId(savedList.id);
      setActiveListId(savedList.id);
      setLastSavedTime(Date.now());
    } catch (err) {
      toast.error(`Không thể lưu dữ liệu: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Hành động: Xóa hàng thủ công khỏi bảng hiển thị ---
  const handleDeleteRow = (index) => {
    const targetItem = displayedData[index];
    if (!targetItem) return;

    // Lọc bỏ đối tượng này khỏi currentData
    const updatedData = currentData.filter(item => item !== targetItem);

    // Đánh lại số thứ tự sau khi xóa
    const reindexedData = updatedData.map((item, idx) => ({
      ...item,
      stt: idx + 1
    }));

    setCurrentData(reindexedData);
    toast.success('Đã xóa dòng dữ liệu khỏi màn hình.');
  };

  // --- Hành động: Bật/Tắt đánh dấu quan trọng (isFlag) ---
  const handleToggleFlag = (index) => {
    const targetItem = displayedData[index];
    if (!targetItem) return;

    const updatedData = currentData.map(item => {
      if (item === targetItem) {
        return { ...item, isFlag: !item.isFlag };
      }
      return item;
    });

    setCurrentData(updatedData);
  };

  // --- Hành động: Loại bỏ đồng loạt các bản ghi không khớp bộ lọc địa chỉ ---
  const handleDiscardNonMatchingRows = () => {
    if (!addressFilterText.trim()) return;

    const kept = currentData.filter(item => matchAddressWithSynonyms(item.address, addressFilterText));
    const discardedCount = currentData.length - kept.length;

    if (discardedCount === 0) {
      toast.info('Không có dòng nào không khớp địa chỉ để loại bỏ.');
      return;
    }

    const reindexed = kept.map((item, idx) => ({
      ...item,
      stt: idx + 1
    }));

    setCurrentData(reindexed);
    setAddressFilterText('');
    toast.success(`Đã loại bỏ đồng loạt ${discardedCount} dòng không khớp địa chỉ khỏi bảng.`);
  };

  // --- Hành động: Lưu các bản ghi không khớp địa chỉ vào kho Temp riêng trên Local Storage ---
  const handleSaveNonMatchingRowsToTemp = async () => {
    if (!addressFilterText.trim()) return;

    const nonMatching = currentData.filter(item => !matchAddressWithSynonyms(item.address, addressFilterText));
    if (nonMatching.length === 0) {
      toast.info('Mọi bản ghi đều khớp địa chỉ, không có bản ghi nào để lưu vào kho Temp.');
      return;
    }

    setIsLoading(true);
    try {
      let baseProvinceName = 'Chưa lưu';

      if (activeListId) {
        const activeList = lists.find(l => l.id === activeListId);
        if (activeList) {
          baseProvinceName = activeList.name;
        }
      } else if (selectedListId) {
        const selectedList = lists.find(l => l.id === selectedListId);
        if (selectedList) {
          baseProvinceName = selectedList.name;
        }
      }

      const cleanBase = baseProvinceName.replace(/\s*-\s*Temp$/, '');
      const tempProvinceName = `${cleanBase} - Temp`;

      await listService.save(
        tempProvinceName,
        nonMatching,
        '',
        dataType,
        null,
        dupFields
      );

      toast.success(`Đã lưu ${nonMatching.length} bản ghi không khớp địa chỉ vào danh sách "${tempProvinceName}" trên Local Storage.`);

      await loadSavedLists();
      setLastSavedTime(Date.now());
    } catch (err) {
      toast.error(`Lỗi khi lưu vào kho Temp: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Sắp xếp ưu tiên: Nhiều thông tin hơn (Email -> Website -> Phone -> Score) ---
  const handleSortByScore = () => {
    if (currentData.length === 0) return;

    const sorted = [...currentData].sort((a, b) => {
      // 1. Ưu tiên có Email lên hàng đầu
      const hasEmailA = a.email && a.email.trim() !== '' ? 1 : 0;
      const hasEmailB = b.email && b.email.trim() !== '' ? 1 : 0;
      if (hasEmailA !== hasEmailB) {
        return hasEmailB - hasEmailA;
      }

      // 2. Ưu tiên có Website tiếp theo
      const hasWebA = a.website && a.website.trim() !== '' ? 1 : 0;
      const hasWebB = b.website && b.website.trim() !== '' ? 1 : 0;
      if (hasWebA !== hasWebB) {
        return hasWebB - hasWebA;
      }

      // 3. Đi kèm với Phone (có Phone lên trước)
      const hasPhoneA = a.phone && a.phone.trim() !== '' ? 1 : 0;
      const hasPhoneB = b.phone && b.phone.trim() !== '' ? 1 : 0;
      if (hasPhoneA !== hasPhoneB) {
        return hasPhoneB - hasPhoneA;
      }

      // 4. Đi kèm với Điểm đánh giá (Total Score) giảm dần
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
    toast.success('Đã sắp xếp danh sách ưu tiên (Email -> Website -> Số điện thoại -> Điểm số)!');
  };

  // --- Xuất tệp Excel chứa dữ liệu hiện tại ---
  const handleExportExcel = () => {
    if (displayedData.length === 0) return;

    const cleanFileName = dataType === 'hotels'
      ? 'hotels_export.xlsx'
      : dataType === 'restaurants'
        ? 'restaurants_export.xlsx'
        : 'spa_export.xlsx';

    try {
      exportToExcel(displayedData, cleanFileName, dataType);
      toast.success('Tải xuống file Excel thành công!');
    } catch (err) {
      toast.error(`Lỗi xuất Excel: ${err.message}`);
    }
  };

  // Lọc và tính toán danh sách Phường / Xã duy nhất cho dropdown
  const getNeighborhoodOptions = () => {
    const neighborhoods = new Set();
    currentData.forEach(item => {
      if (item.neighborhood && item.neighborhood.trim() !== '') {
        neighborhoods.add(item.neighborhood.trim());
      }
    });
    return Array.from(neighborhoods).sort((a, b) => a.localeCompare(b));
  };

  // Dữ liệu được hiển thị sau khi qua bộ lọc Phường/Xã và lọc Địa chỉ
  const getDisplayedData = () => {
    let data = currentData;

    // 1. Lọc theo Phường / Xã
    if (selectedNeighborhood) {
      data = data.filter(item => item.neighborhood && item.neighborhood.trim() === selectedNeighborhood);
    }

    // 2. Lọc theo Địa chỉ (thông minh, hỗ trợ từ khóa đồng nghĩa tỉnh thành)
    if (addressFilterText.trim()) {
      data = data.filter(item => matchAddressWithSynonyms(item.address, addressFilterText));
    }

    return data;
  };

  const displayedData = getDisplayedData();

  return (
    <div className="app-container">
      {/* 1. Header Trang */}
      <Header
        isDark={isDarkTheme}
        onToggleTheme={handleToggleTheme}
        currentRoute={currentRoute}
        onNavigate={navigate}
      />

      {currentRoute === '/merge-file' ? (
        <MergeFile isDark={isDarkTheme} setIsLoading={setIsLoading} />
      ) : (
        <>
          {/* 2. Main Card - Khung Điều Khiển Nhập Liệu & Tác Vụ */}
          <main className="main-card glass-card">
            {/* NÚT TAB CHUYỂN ĐỔI SONG SONG GIỮA KHÁCH SẠN, NHÀ HÀNG VÀ SPA */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              marginBottom: '1.5rem',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '1rem',
              flexWrap: 'wrap'
            }}>
              <button
                type="button"
                onClick={() => handleTabChange('hotels')}
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
                onClick={() => handleTabChange('restaurants')}
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
              <button
                type="button"
                onClick={() => handleTabChange('spa')}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: dataType === 'spa' ? 'var(--primary)' : 'var(--bg-card)',
                  color: dataType === 'spa' ? '#fff' : 'var(--text-main)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: dataType === 'spa' ? '0 4px 15px rgba(0, 115, 230, 0.3)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                💆 Spa & Massage (Spa)
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
              dupFields={dupFields}
              onDupFieldsChange={handleDupFieldsChange}
            />

            {/* Trình quản lý lưu trữ tỉnh thành: Xem, Xóa, Lưu */}
            <StorageManager
              lists={lists}
              selectedListId={selectedListId}
              onSelectChange={setSelectedListId}
              onLoadList={handleLoadSavedList}
              onDeleteList={handleDeleteSavedList}
              onOpenSaveModal={() => setIsSaveModalOpen(true)}
              hasUnsavedData={hasUnsavedData}
            />

            {/* Khung hiển thị thông báo động bằng Ant Design Alert */}
            {activeAlert && (
              <div style={{ marginTop: '1.5rem', textAlign: 'left' }}>
                <Alert
                  title={activeAlert.message}
                  message={activeAlert.message}
                  description={activeAlert.description}
                  type={activeAlert.type}
                  showIcon
                  action={activeAlert.action}
                  closable
                  onClose={handleCloseAlert}
                />
              </div>
            )}
          </main>

          {/* Vùng bộ lọc Phường/Xã nếu có dữ liệu */}
          {currentData.length > 0 && (
            <div className="filter-bar glass-card" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              margin: '0rem 1.5rem 1.5rem 1.5rem',
              padding: '0.75rem 1.25rem',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              flexWrap: 'wrap'
            }}>
              {/* Dropdown lọc Phường / Xã */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '220px' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                  📍 Phường / Xã:
                </label>
                <select
                  className="form-select"
                  value={selectedNeighborhood}
                  onChange={(e) => setSelectedNeighborhood(e.target.value)}
                  style={{ minWidth: '160px', margin: 0, padding: '0.375rem 1.75rem 0.375rem 0.75rem' }}
                >
                  <option value="">-- Tất cả Phường / Xã --</option>
                  {getNeighborhoodOptions().map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              {/* Ô nhập lọc theo địa chỉ */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexGrow: 1, minWidth: '280px' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                  🔍 Lọc địa chỉ:
                </label>
                <input
                  type="text"
                  value={addressFilterText}
                  onChange={(e) => setAddressFilterText(e.target.value)}
                  placeholder="Nhập từ khóa (ví dụ: Hồ Chí Minh)..."
                  style={{
                    flexGrow: 1,
                    padding: '0.375rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-main)',
                    fontSize: '0.875rem',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Các nút hành động nâng cao dựa trên lọc địa chỉ */}
              {addressFilterText.trim() && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Popconfirm
                    title="Xác nhận loại bỏ?"
                    description="Hành động này sẽ loại bỏ vĩnh viễn toàn bộ các bản ghi không khớp khỏi bảng hiển thị hiện tại trên màn hình."
                    onConfirm={handleDiscardNonMatchingRows}
                    okText="Đồng ý xóa"
                    cancelText="Hủy"
                  >
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.25rem', border: 'none', cursor: 'pointer' }}
                    >
                      🗑️ Xóa không khớp
                    </button>
                  </Popconfirm>
                  <Popconfirm
                    title="Lưu bản ghi không khớp vào kho Temp?"
                    description="Hành động này sẽ tách các dòng không khớp địa chỉ ra và lưu thành một danh sách tạm thời riêng biệt (Temp) trong Local Storage để tránh mất dữ liệu."
                    onConfirm={handleSaveNonMatchingRowsToTemp}
                    okText="Đồng ý lưu"
                    cancelText="Hủy"
                  >
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.25rem', border: 'none', cursor: 'pointer' }}
                    >
                      💾 Lưu vào Temp ( kho tạm)
                    </button>
                  </Popconfirm>
                </div>
              )}

              {/* Thông tin đếm số dòng hiển thị */}
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                Đang hiển thị: <strong>{displayedData.length}</strong> trên tổng số <strong>{currentData.length}</strong> bản ghi
              </span>
            </div>
          )}

          {/* 3. Result Section - Trực Quan Hóa Bảng/JSON Kết Quả */}
          <ResultSection
            data={displayedData}
            dataType={dataType}
            onDeleteRow={handleDeleteRow}
            onSortByScore={handleSortByScore}
            onExportExcel={handleExportExcel}
            onToggleFlag={handleToggleFlag}
          />

          {/* --- CÁC POPUP MODALS TÙY BIẾN --- */}

          {/* Modal Lưu danh sách tỉnh thành */}
          <SaveModal
            isOpen={isSaveModalOpen}
            lists={lists}
            dataType={dataType}
            onSave={handleSaveData}
            onCancel={() => setIsSaveModalOpen(false)}
            isLoading={isLoading}
          />

          {/* Modal Xác nhận */}
          <ConfirmModal
            isOpen={confirmConfig.isOpen}
            title={confirmConfig.title}
            message={confirmConfig.message}
            onConfirm={confirmConfig.onConfirm}
            onCancel={confirmConfig.onCancel}
          />
        </>
      )}

      {/* Vòng quay Loading toàn màn hình khi đồng bộ */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <span>Đang đồng bộ dữ liệu...</span>
        </div>
      )}

      {isChecking && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <span>Đang tiến hành kiểm tra trùng lặp diện rộng, vui lòng đợi...</span>
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
