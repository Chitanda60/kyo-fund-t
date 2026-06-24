import { useState, useEffect, useRef, useDeferredValue } from 'react';
import { searchFunds } from '../../api/fund';

/**
 * 搜索框 UI 状态 Hook：从 page.jsx 抽离的基金搜索/选择/添加（纯 UI 状态，不写业务存储）。
 *
 * 设计约束（行为保持）：
 * - 所有状态、refs、click-outside effect、防抖搜索 effect、handler 逻辑与原 page.jsx 一致。
 * - 添加基金仅暂存待确认列表并打开扫码确认弹框（不直接写 funds）；扫码相关 setter、funds、
 *   setError 作为入参传入（addFund 需在 useScanImport 之后调用）。
 * - 搜索阈值 val.length < 2、chip 行为、错误文案、手动 6 位代码解析均保持不变。
 */
export function useFundSearchBox({
  funds,
  setScannedFunds,
  setSelectedScannedCodes,
  setIsOcrScan,
  setScanConfirmModalOpen,
  setError
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedFunds, setSelectedFunds] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMobileSearchClick = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    setIsSearchFocused(true);
    // 等待动画完成后聚焦，避免 iOS 键盘弹出问题
    setTimeout(() => {
      inputRef.current?.focus();
    }, 350);
  };

  useEffect(() => {
    const val = String(deferredSearchTerm ?? '').trim();
    if (!val) {
      setSearchResults([]);
      return;
    }

    if (val.length < 2) return;

    setIsSearching(true);
    searchFunds(val)
      .then((results) => {
        setSearchResults(results);
      })
      .catch((e) => {
        console.error('搜索失败', e);
      })
      .finally(() => {
        setIsSearching(false);
      });
  }, [deferredSearchTerm]);

  const handleSearchInput = (e) => {
    setSearchTerm(e.target.value);
  };

  const toggleSelectFund = (fund) => {
    setSelectedFunds((prev) => {
      const exists = prev.find((f) => f.CODE === fund.CODE);
      if (exists) {
        return prev.filter((f) => f.CODE !== fund.CODE);
      }
      return [...prev, fund];
    });
  };

  const addFund = async (e) => {
    e?.preventDefault?.();
    setError('');
    const manualTokens = String(searchTerm || '')
      .split(/[^0-9A-Za-z]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    const selectedCodes = Array.from(
      new Set([...selectedFunds.map((f) => f.CODE), ...manualTokens.filter((t) => /^\d{6}$/.test(t))])
    );
    if (selectedCodes.length === 0) {
      setError('请输入或选择基金代码');
      return;
    }
    const nameMap = {};
    selectedFunds.forEach((f) => {
      nameMap[f.CODE] = f.NAME;
    });
    const fundsToConfirm = selectedCodes.map((code) => ({
      code,
      name: nameMap[code] || '',
      status: funds.some((f) => f.code === code) ? 'added' : 'pending'
    }));
    setScannedFunds(fundsToConfirm);
    setSelectedScannedCodes(new Set(selectedCodes));
    setIsOcrScan(false);
    setScanConfirmModalOpen(true);
    setSearchTerm('');
    setSelectedFunds([]);
    setShowDropdown(false);
    inputRef.current?.blur();
    setIsSearchFocused(false);
  };

  return {
    searchTerm,
    setSearchTerm,
    isSearchFocused,
    setIsSearchFocused,
    searchResults,
    selectedFunds,
    setSelectedFunds,
    isSearching,
    dropdownRef,
    inputRef,
    showDropdown,
    setShowDropdown,
    handleMobileSearchClick,
    handleSearchInput,
    toggleSelectFund,
    addFund
  };
}
