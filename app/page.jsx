'use client';

import { useEffect, useRef, useState, useMemo, useCallback, useTransition, useDeferredValue } from 'react';
import dynamic from 'next/dynamic';
import SearchBar from './components/SearchBar';
import SummaryTabContent from './components/SummaryTabContent';
import FundListView from './components/FundListView';
import NavLayout from './components/NavLayout';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

import { createAvatar } from '@dicebear/core';
import { identicon } from '@dicebear/collection';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import { isArray, isBoolean, isFunction, isNumber, isObject, isPlainObject, isString } from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { toast as sonnerToast } from 'sonner';

import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Announcement from './components/Announcement';
import EmptyStateCard from './components/EmptyStateCard';

import GroupSummary from './components/GroupSummary';
import { CloseIcon, GridIcon, ListIcon, MoonIcon, PlusIcon, SettingsIcon, SortIcon, SunIcon } from './components/Icons';
import UserMenu from './components/UserMenu';
import RefreshButton from './components/RefreshButton';
const UpdateChecker = dynamic(() => import('./components/UpdateChecker'), { ssr: false });
import MarketIndexAccordion from './components/MarketIndexAccordion';
import githubImg from './assets/github.svg';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { getAllValuationSeries } from './lib/valuationTimeseries';
import { asyncPool } from './lib/asyncHelper';
import { fetchFundPeriodReturns } from './api/fund';
import MineTab from './components/MineTab';
import MarketTab from './components/MarketTab';
import SearchFund from './components/SearchFund';
import { useTheme } from './hooks/useTheme';
import { useTradingDay } from './hooks/useTradingDay';
import { useHoldingProfit } from './hooks/useHoldingProfit';
import { useGroupActions } from './hooks/useGroupActions';
import { useSummaryCalculations } from './hooks/useSummaryCalculations';
import { useNavHeights } from './hooks/useNavHeights';
import { useScanImport } from './hooks/useScanImport';
import { useRefreshManager } from './hooks/useRefreshManager';
import { useSyncManager, normalizeFundDailyEarningsScoped } from './hooks/useSyncManager';
import { useIsMobile } from './hooks/useIsMobile';
import {
  useUserStore,
  clearAuthUser,
  setAuthUser,
  useStorageStore,
  storageStore,
  useModalStore,
  useSettingsStore
} from './stores';
import ModalsLayer from './components/ModalsLayer';

import {
  DEFAULT_SORT_RULES,
  SORT_DISPLAY_MODES,
  SUMMARY_TAB_ID,
  SUMMARY_SOURCE_GLOBAL,
  DEFAULT_FUND_TAG_THEME
} from '@/app/constants';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);

import {
  nowInTz,
  formatDate,
  normalizeFundTagTheme,
  stripLegacyTagsFromFundObject,
  getFundCodesFromTagRecord,
  sanitizeTagRowForStorage,
  seedGroupHoldingsFromGlobal,
  migrateDcaPlansToScoped
} from './lib/fundHelpers';

import { dedupeByCode, normalizeCode, cleanCodeArray } from './lib/normalize';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  usePortfolioScope,
  usePortfolioScopeCleanup,
  useFundDisplayList,
  useFundTableRows,
  useFundMutations
} from './features/portfolio';
import { useFundTags } from './features/tags';
import { useTradingActions, useDcaScheduler } from './features/trading';
import { useFundSearchBox } from './features/search';

export default function HomePage() {
  const {
    funds,
    setFunds,
    initFunds,
    groups,
    setGroups,
    initGroups,
    favorites,
    setFavorites,
    initFavorites,
    collapsedCodes,
    setCollapsedCodes,
    collapsedTrends,
    setCollapsedTrends,
    collapsedValuationTrends,
    setCollapsedValuationTrends,
    collapsedEarnings,
    setCollapsedEarnings,
    refreshMs,
    setRefreshMs,
    holdings,
    setHoldings,
    groupHoldings,
    setGroupHoldings,
    pendingTrades,
    setPendingTrades,
    transactions,
    setTransactions,
    dcaPlans,
    setDcaPlans,
    customSettings,
    setCustomSettings,
    fundDailyEarnings,
    setFundDailyEarnings,
    valuationSeries,
    setValuationSeries,
    initCollapsed,
    initRefreshMs,
    initHoldings,
    initGroupHoldings,
    initPendingTrades,
    initTransactions,
    initDcaPlans,
    initCustomSettings,
    initFundDailyEarnings,
    initFundDividends,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    pcSortDisplayMode,
    setPcSortDisplayMode,
    mobileSortDisplayMode,
    setMobileSortDisplayMode,
    sortRules,
    setSortRules,
    initSort
  } = useStorageStore();
  /** 基金标签（独立 localStorage 键 `tags`）：{ id, name, theme, fundCodes: string[] }[] */
  const [fundTagRecords, setFundTagRecords] = useState([]);
  /**
   * 每只基金已选标签实例：仅由 `tags` 推导生成（不再持久化 fundTagLists）。
   * 形状保持为 { [code]: {id,name,theme}[] }，便于复用现有组件接口。
   */
  const fundTagListsByCode = useMemo(() => {
    const out = {};
    const codeSet = new Set((isArray(funds) ? funds : []).map((f) => String(f?.code ?? '').trim()).filter(Boolean));
    for (const r of fundTagRecords || []) {
      if (!r || !isObject(r)) continue;
      const id = String(r.id ?? '').trim();
      const name = String(r.name ?? '').trim();
      if (!id || !name) continue;
      const theme = normalizeFundTagTheme(r.theme);
      for (const c of getFundCodesFromTagRecord(r)) {
        if (!codeSet.has(c)) continue;
        if (!out[c]) out[c] = [];
        out[c].push({ id, name, theme });
      }
    }
    Object.keys(out).forEach((c) => {
      out[c] = out[c].filter((x) => x?.name).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    });
    return out;
  }, [fundTagRecords, funds]);

  const [error, setError] = useState('');
  const isLoggingOutRef = useRef(false);
  const isExplicitLoginRef = useRef(false);

  // 刷新频率与布局配置状态
  const {
    tempSeconds,
    setTempSeconds,
    containerWidth,
    setContainerWidth,
    showMarketIndexPc,
    setShowMarketIndexPc,
    showMarketIndexMobile,
    setShowMarketIndexMobile,
    showGroupFundSearchPc,
    setShowGroupFundSearchPc,
    showGroupFundSearchMobile,
    setShowGroupFundSearchMobile,
    dynamicStylePc,
    setDynamicStylePc,
    dynamicStyleMobile,
    setDynamicStyleMobile,
    isGroupSummarySticky,
    setIsGroupSummarySticky,
    syncFromCustomSettings
  } = useSettingsStore();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    syncFromCustomSettings(customSettings);
  }, [customSettings, syncFromCustomSettings]);

  // 自选状态
  const [currentTab, setCurrentTab] = useState('all');
  const [, startTransition] = useTransition();
  const hasLocalTabInitRef = useRef(false);

  // 调用 store 的 initSort，在 mount 时恢复持久化的排序偏好
  useEffect(() => {
    if (typeof window !== 'undefined') {
      initSort();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 当用户关闭某个排序规则时，如果当前 sortBy 不再可用，则自动切换到第一个启用的规则
  useEffect(() => {
    const enabledRules = (sortRules || []).filter((r) => r.enabled);
    const enabledIds = enabledRules.map((r) => r.id);
    if (!enabledIds.length) {
      // 至少保证默认存在
      setSortRules(DEFAULT_SORT_RULES);
      setSortBy('default');
      return;
    }
    if (!enabledIds.includes(sortBy)) {
      setSortBy(enabledIds[0]);
    }
  }, [sortRules, sortBy]);

  // 视图模式
  const [viewMode, setViewMode] = useState('list'); // card, list
  // 全局隐藏金额状态（影响分组汇总、列表和卡片）
  const [maskAmounts, setMaskAmounts] = useState(false);

  // 用户认证状态（Supabase 会话仍由客户端持久化；用户信息由 zustand 全局管理）
  const user = useUserStore((s) => s.user);
  const userAvatar = useMemo(() => {
    if (!user?.id) return '';
    return createAvatar(identicon, {
      seed: user.id,
      size: 80
    }).toDataUri();
  }, [user?.id]);

  // 分组内基金列表搜索（点击按钮后才应用）
  const [groupFundSearchTerm, setGroupFundSearchTerm] = useState('');
  const deferredGroupFundSearchTerm = useDeferredValue(groupFundSearchTerm);

  // --- 主题管理（抽离到 useTheme）---
  const { theme, showThemeTransition, setShowThemeTransition, handleThemeToggle } = useTheme();

  // 动态计算 Navbar 和 FilterBar 高度（抽离到 useNavHeights）
  // 注意：isMobile 在此处尚未声明，shouldShowMarketIndex 由 page.jsx 内独立 useEffect 处理
  const containerRef = useRef(null);
  const { navbarRef, filterBarRef, navbarHeight, filterBarHeight } = useNavHeights({ groups, currentTab });

  const [percentModes, setPercentModes] = useState({}); // { [code]: boolean }
  const [todayPercentModes, setTodayPercentModes] = useState({}); // { [code]: boolean }

  const tabsRef = useRef(null);

  // ---- Modal store setter compatibility wrappers ----
  const _ms = useModalStore.setState;
  const _gs = useModalStore.getState;
  const setSettingsOpen = (v) => _ms({ settingsOpen: isFunction(v) ? v(_gs().settingsOpen) : v });
  const setGroupModalOpen = (v) => _ms({ groupModalOpen: isFunction(v) ? v(_gs().groupModalOpen) : v });
  const setGroupManageOpen = (v) => _ms({ groupManageOpen: isFunction(v) ? v(_gs().groupManageOpen) : v });
  const setAddFundToGroupOpen = (v) => _ms({ addFundToGroupOpen: isFunction(v) ? v(_gs().addFundToGroupOpen) : v });
  const setSortSettingOpen = (v) => _ms({ sortSettingOpen: isFunction(v) ? v(_gs().sortSettingOpen) : v });
  const setLoginModalOpen = (v) => _ms({ loginModalOpen: isFunction(v) ? v(_gs().loginModalOpen) : v });
  const setLoginInitialError = (v) => _ms({ loginInitialError: isFunction(v) ? v(_gs().loginInitialError) : v });
  const setFeedbackOpen = (v) => _ms({ feedbackOpen: isFunction(v) ? v(_gs().feedbackOpen) : v });
  const setFeedbackNonce = (v) => _ms({ feedbackNonce: isFunction(v) ? v(_gs().feedbackNonce) : v });
  const setDonateOpen = (v) => _ms({ donateOpen: isFunction(v) ? v(_gs().donateOpen) : v });
  const setIsLogoutConfirmOpen = (v) => _ms({ isLogoutConfirmOpen: isFunction(v) ? v(_gs().isLogoutConfirmOpen) : v });
  const setPortfolioEarningsOpen = (v) =>
    _ms({ portfolioEarningsOpen: isFunction(v) ? v(_gs().portfolioEarningsOpen) : v });
  const setMobileFundDrawerOpen = (v) =>
    _ms({ mobileFundDrawerOpen: isFunction(v) ? v(_gs().mobileFundDrawerOpen) : v });
  const setTutorialDrawerOpen = (v) => _ms({ tutorialDrawerOpen: isFunction(v) ? v(_gs().tutorialDrawerOpen) : v });
  const setUpdateLogOpen = (v) => _ms({ updateLogOpen: isFunction(v) ? v(_gs().updateLogOpen) : v });
  const setMobileTableSettingModalOpen = (v) =>
    _ms({ mobileTableSettingModalOpen: isFunction(v) ? v(_gs().mobileTableSettingModalOpen) : v });
  const setIsUpdateModalOpen = (v) => _ms({ isUpdateModalOpen: isFunction(v) ? v(_gs().isUpdateModalOpen) : v });
  const setHoldingModal = (v) => _ms({ holdingModal: isFunction(v) ? v(_gs().holdingModal) : v });
  const setActionModal = (v) => _ms({ actionModal: isFunction(v) ? v(_gs().actionModal) : v });
  const setTradeModal = (v) => _ms({ tradeModal: isFunction(v) ? v(_gs().tradeModal) : v });
  const setConvertModal = (v) => _ms({ convertModal: isFunction(v) ? v(_gs().convertModal) : v });
  const setDividendMethodModal = (v) => _ms({ dividendMethodModal: isFunction(v) ? v(_gs().dividendMethodModal) : v });
  const setSelectHoldingGroupModal = (v) =>
    _ms({ selectHoldingGroupModal: isFunction(v) ? v(_gs().selectHoldingGroupModal) : v });
  const setDataSourceModal = (v) => _ms({ dataSourceModal: isFunction(v) ? v(_gs().dataSourceModal) : v });
  const setDcaModal = (v) => _ms({ dcaModal: isFunction(v) ? v(_gs().dcaModal) : v });
  const setClearConfirm = (v) => _ms({ clearConfirm: isFunction(v) ? v(_gs().clearConfirm) : v });
  const setHoldingMigrateDialog = (v) =>
    _ms({ holdingMigrateDialog: isFunction(v) ? v(_gs().holdingMigrateDialog) : v });
  const setHistoryModal = (v) => _ms({ historyModal: isFunction(v) ? v(_gs().historyModal) : v });
  const setSuccessModal = (v) => _ms({ successModal: isFunction(v) ? v(_gs().successModal) : v });

  const fundDetailDrawerCloseRef = useRef(null); // 由 MobileFundTable 注入，用于确认删除时关闭基金详情 Drawer
  const fundDetailDialogCloseRef = useRef(null); // 由 PcFundTable 注入，用于确认删除时关闭基金详情 Dialog
  const pcBatchClearSelectionRef = useRef(null); // 由 PcFundTable 注入，批量删除二次确认成功后清空表格多选
  const mobileBatchClearSelectionRef = useRef(null); // 由 MobileFundTable 注入，批量删除二次确认成功后退出编辑态

  const todayStr = formatDate();

  const isMobile = useIsMobile();

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const isDynamic = isMobile ? dynamicStyleMobile : dynamicStylePc;
      if (!isDynamic) {
        document.documentElement.classList.add('reduce-dynamic-style');
      } else {
        document.documentElement.classList.remove('reduce-dynamic-style');
      }
    }
  }, [isMobile, dynamicStyleMobile, dynamicStylePc]);

  const [mainTab, setMainTab] = useState('home');
  const [hasVisitedMarketTab, setHasVisitedMarketTab] = useState(false);

  useEffect(() => {
    if (mainTab === 'market' && !hasVisitedMarketTab) {
      setHasVisitedMarketTab(true);
    }
  }, [mainTab, hasVisitedMarketTab]);

  const [mobileBottomNavHidden, setMobileBottomNavHidden] = useState(false);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    if (!isMobile) {
      setMobileFundDrawerOpen(false);
      setMobileTableSettingModalOpen(false);
    }
  }, [isMobile]);

  const handleFundCardDrawerOpenChange = useCallback((open) => {
    setMobileFundDrawerOpen(Boolean(open));
  }, []);

  const handleMobileSettingModalOpenChange = useCallback((open) => {
    setMobileTableSettingModalOpen(Boolean(open));
  }, []);

  const shouldShowMarketIndex = (isMobile ? showMarketIndexMobile : showMarketIndexPc) || mainTab === 'market';
  const shouldShowGroupFundSearch = isMobile ? showGroupFundSearchMobile : showGroupFundSearchPc;

  // 交易日检测（抽离到 useTradingDay）
  const { isTradingDay } = useTradingDay();

  const activeGroupId =
    currentTab !== 'all' &&
    currentTab !== 'fav' &&
    currentTab !== SUMMARY_TAB_ID &&
    groups.some((g) => g.id === currentTab)
      ? currentTab
      : null;

  // 计算持仓收益（抽离至自定义 Hook 管理）
  const { getHoldingProfit } = useHoldingProfit({ activeGroupId });

  const {
    groupsWithHoldings,
    summaryTabPortfolioTotals,
    showPortfolioSummaryTab,
    summaryMergedHoldings,
    summaryHoldingSourceGroupByCode,
    summaryCardItems
  } = useSummaryCalculations({ currentTab, setCurrentTab, getHoldingProfit });

  const getHoldingProfitForTab = useCallback(
    (fund, holding) => {
      if (currentTab === SUMMARY_TAB_ID) {
        const src = summaryHoldingSourceGroupByCode[fund?.code];
        if (src === undefined) return null;
        const scopeGid = src === SUMMARY_SOURCE_GLOBAL ? null : src;
        return getHoldingProfit(fund, holding, scopeGid);
      }
      return getHoldingProfit(fund, holding);
    },
    [currentTab, summaryHoldingSourceGroupByCode, getHoldingProfit]
  );

  /**
   * 全部/自选：当全局 holdings 无该基金持仓，但自定义分组存在持仓时，
   * 仅用于展示地将其它分组的持仓汇总到当前 tab（不写入 localStorage）。
   */
  const {
    linkedHoldingsForAllFav,
    currentFundDailyEarnings,
    portfolioDailySeries,
    holdingsForTabWithLinked,
    dcaPlansForTab,
    transactionsForTab,
    getScopedGroupId,
    getScopedHolding,
    getScopedDcaPlan,
    activeGroupCodeSet
  } = usePortfolioScope({
    currentTab,
    activeGroupId,
    groups,
    funds,
    holdings,
    groupHoldings,
    dcaPlans,
    transactions,
    fundDailyEarnings,
    summaryMergedHoldings,
    summaryHoldingSourceGroupByCode,
    groupsWithHoldings,
    getHoldingProfit
  });

  // 联动 linked 基金的全局 fundDailyEarnings 清理副作用（原 page.jsx 内 effect 抽离至此 Hook）
  usePortfolioScopeCleanup({ linkedHoldingsForAllFav, setFundDailyEarnings });

  // 当前 tab 作用域下的基金（不包含“列表搜索”过滤）
  const scopedFunds = useMemo(() => {
    return funds.filter((f) => {
      if (currentTab === 'all') return true;
      if (currentTab === 'fav') return favorites.has(f.code);
      if (!activeGroupCodeSet) return true;
      return activeGroupCodeSet.has(f.code);
    });
  }, [funds, currentTab, favorites, activeGroupCodeSet]);

  const [fundExtraDataByCode, setFundExtraDataByCode] = useState({});
  const fundExtraDataCacheRef = useRef(new Map());

  useEffect(() => {
    // 始终尝试为当前列表基金获取额外数据（阶段涨跌幅、连涨连跌），用于展示图标或排序
    const codes = scopedFunds.map((f) => f.code);
    if (codes.length === 0) return;

    let cancelled = false;
    const missing = [];
    const cachedBatch = {};

    for (const code of codes) {
      if (!fundExtraDataCacheRef.current.has(code)) {
        missing.push(code);
      } else {
        cachedBatch[code] = fundExtraDataCacheRef.current.get(code);
      }
    }

    if (Object.keys(cachedBatch).length > 0) {
      setFundExtraDataByCode((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [code, value] of Object.entries(cachedBatch)) {
          if (next[code] !== value) {
            next[code] = value;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }

    if (missing.length === 0) return;

    (async () => {
      // 这里的 fetchFundPeriodReturns 已包含阶段涨跌幅和连涨连跌数据
      await asyncPool(4, missing, async (code) => {
        const value = await fetchFundPeriodReturns(code);
        fundExtraDataCacheRef.current.set(code, value);
        if (cancelled) return;
        setFundExtraDataByCode((prev) => {
          if (prev[code] === value) return prev;
          return { ...prev, [code]: value };
        });
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [scopedFunds]);

  const { displayFunds } = useFundDisplayList({
    scopedFunds,
    currentTab,
    groups,
    sortBy,
    sortOrder,
    holdingsForTabWithLinked,
    getHoldingProfitForTab,
    deferredGroupFundSearchTerm,
    shouldShowGroupFundSearch,
    currentFundDailyEarnings,
    fundExtraDataByCode,
    todayStr,
    fundTagListsByCode
  });

  const { groupTotalHoldingAmount, pendingCodesForTab, pcFundTableData } = useFundTableRows({
    displayFunds,
    holdingsForTabWithLinked,
    isTradingDay,
    todayStr,
    getHoldingProfitForTab,
    dcaPlansForTab,
    pendingTrades,
    activeGroupId,
    currentFundDailyEarnings,
    currentTab,
    summaryHoldingSourceGroupByCode,
    linkedHoldingsForAllFav,
    fundTagListsByCode
  });

  // 自动滚动选中 Tab 到可视区域
  useEffect(() => {
    if (!tabsRef.current) return;
    if (currentTab === 'all' || currentTab === SUMMARY_TAB_ID) {
      tabsRef.current.scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }
    const activeTab = tabsRef.current.querySelector('.tab.active');
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [currentTab]);

  // 鼠标拖拽滚动逻辑
  const dragStateRef = useRef({ isDragging: false, startX: 0, startY: 0, hasDragged: false });
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const handleAction = (type, fund, groupIdOverride) => {
    const groupId = getScopedGroupId(groupIdOverride);
    if (type !== 'history') {
      setActionModal({ open: false, fund: null });
    }

    if (type === 'edit') {
      setHoldingModal({ open: true, fund, groupId });
    } else if (type === 'clear') {
      setClearConfirm({ fund, groupId });
    } else if (type === 'buy' || type === 'sell') {
      setTradeModal({ open: true, fund, type, groupId });
    } else if (type === 'history') {
      setHistoryModal({ open: true, fund, groupId });
    } else if (type === 'dca') {
      setDcaModal({ open: true, fund, groupId });
    } else if (type === 'convert') {
      setConvertModal({ open: true, fund, groupId });
    } else if (type === 'dividend') {
      setDividendMethodModal({ open: true, fund, groupId });
    }
  };

  const handleMouseDown = (e) => {
    if (!tabsRef.current) return;
    dragStateRef.current = { isDragging: true, startX: e.clientX, startY: e.clientY, hasDragged: false };
  };

  const handleMouseLeaveOrUp = () => {
    dragStateRef.current.isDragging = false;
  };

  const handleMouseMove = (e) => {
    const ds = dragStateRef.current;
    if (!ds.isDragging || !tabsRef.current) return;
    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    if (!ds.hasDragged && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
    ds.hasDragged = true;
    e.preventDefault();
    tabsRef.current.scrollLeft -= e.movementX;
  };

  const handleWheel = (e) => {
    if (!tabsRef.current) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    tabsRef.current.scrollLeft += delta;
  };

  const handleTabClick = (tabId) => {
    if (dragStateRef.current.hasDragged) return;
    startTransition(() => setCurrentTab(tabId));
  };

  const updateTabOverflow = () => {
    if (!tabsRef.current) return;
    const el = tabsRef.current;
    setCanLeft(el.scrollLeft > 0);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  };

  useEffect(() => {
    updateTabOverflow();
    let rafId = null;
    const onResize = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateTabOverflow();
      });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [groups, funds.length, favorites.size]);

  // 轻提示 (Toast)
  const showToast = (message, type = 'info') => {
    if (type === 'success') {
      sonnerToast.success(message);
    } else if (type === 'error') {
      sonnerToast.error(message);
    } else {
      sonnerToast.info(message);
    }
  };

  const {
    handleSaveHolding,
    handleClearConfirm,
    processPendingQueue,
    handleDeleteTransaction,
    handleMergeAllGroupTransactionsToCurrent,
    handleAddHistory,
    handleTrade
  } = useTradingActions({ currentTab, groups, getScopedGroupId, showToast });

  // 定投计划自动生成买入队列的逻辑会在 storageHelper 定义之后实现

  const handleOpenLogin = () => {
    if (!isSupabaseConfigured) {
      showToast('未配置 Supabase，无法登录', 'error');
      return;
    }
    setLoginModalOpen(true);
  };

  const {
    setScanConfirmModalOpen,
    scannedFunds,
    setScannedFunds,
    selectedScannedCodes,
    setSelectedScannedCodes,
    isScanning,
    scanImportProgress,
    scanProgress,
    isOcrScan,
    setIsOcrScan,
    fileInputRef,
    handleScanClick,
    handleScanPick,
    handleRetryOcr,
    cancelScan,
    handleFilesUpload,
    handleFilesDrop,
    toggleScannedCode,
    confirmScanImport
  } = useScanImport({
    setCurrentTab,
    setValuationSeries,
    showToast,
    normalizeCode,
    dedupeByCode
  });

  const refreshAllRef = useRef(null);
  const {
    isSyncing,
    lastSyncTime,
    syncUserConfig,
    fetchCloudConfig,
    applyCloudConfig,
    handleSyncLocalConfig,
    triggerCustomSettingsSync,
    skipSyncRef,
    deviceConflictModalOpenRef,
    storageHelper
  } = useSyncManager({
    showToast,
    refreshAllRef,
    setTempSeconds,
    setFundTagRecords
  });

  // 搜索框 UI 状态（抽离到 useFundSearchBox）
  const {
    searchTerm,
    isSearchFocused,
    setIsSearchFocused,
    searchResults,
    selectedFunds,
    isSearching,
    dropdownRef,
    inputRef,
    showDropdown,
    setShowDropdown,
    handleMobileSearchClick,
    handleSearchInput,
    toggleSelectFund,
    addFund
  } = useFundSearchBox({
    funds,
    setScannedFunds,
    setSelectedScannedCodes,
    setIsOcrScan,
    setScanConfirmModalOpen,
    setError
  });
  const {
    openFundTagsEdit,
    handleSaveFundTags,
    handleAddPoolTag,
    handleDeleteGlobalTag,
    handleUpdateGlobalTag,
    getTagUsageLabels
  } = useFundTags({ funds, fundTagRecords, setFundTagRecords, storageHelper });

  const toggleValuationTrendCollapse = useCallback(
    (code) => {
      setCollapsedValuationTrends((prev) => {
        const next = new Set(prev);
        if (next.has(code)) {
          next.delete(code);
        } else {
          next.add(code);
        }
        return next;
      });
    },
    [setCollapsedValuationTrends]
  );

  const applyViewMode = useCallback(
    (mode) => {
      if (mode !== 'card' && mode !== 'list') return;
      if (mode !== viewMode) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      setViewMode(mode);
      storageHelper.setItem('viewMode', mode);
    },
    [storageHelper, viewMode]
  );

  const toggleFavorite = useCallback(
    (code) => {
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(code)) {
          next.delete(code);
        } else {
          next.add(code);
        }
        if (next.size === 0) setCurrentTab('all');
        return next;
      });
    },
    [storageHelper]
  );

  const toggleCollapse = useCallback(
    (code) => {
      setCollapsedCodes((prev) => {
        const next = new Set(prev);
        if (next.has(code)) {
          next.delete(code);
        } else {
          next.add(code);
        }
        return next;
      });
    },
    [setCollapsedCodes]
  );

  const toggleTrendCollapse = useCallback(
    (code) => {
      setCollapsedTrends((prev) => {
        const next = new Set(prev);
        if (next.has(code)) {
          next.delete(code);
        } else {
          next.add(code);
        }
        return next;
      });
    },
    [setCollapsedTrends]
  );

  const toggleEarningsCollapse = useCallback(
    (code) => {
      setCollapsedEarnings((prev) => {
        const next = new Set(prev);
        if (next.has(code)) {
          next.delete(code);
        } else {
          next.add(code);
        }
        return next;
      });
    },
    [setCollapsedEarnings]
  );

  const { scheduleDcaTrades } = useDcaScheduler({ isTradingDay, showToast });

  const { refreshing, refreshCycleStartRef, manualRefresh, refreshAll } = useRefreshManager({
    scheduleDcaTrades,
    processPendingQueue,
    deviceConflictModalOpenRef
  });
  useEffect(() => {
    refreshAllRef.current = refreshAll;
  }, [refreshAll]);

  const {
    handleAddGroup,
    handleUpdateGroups,
    handleAddFundsToGroup,
    stripFundFromGroupScope,
    stripManyFundsFromGroupScope
  } = useGroupActions({ currentTab, setCurrentTab });

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      initFunds();
      initGroups();
      initFavorites();
      initCollapsed();
      initRefreshMs();
      initHoldings();
      initGroupHoldings();
      initPendingTrades();
      initTransactions();
      initDcaPlans();
      initCustomSettings();
      initFundDailyEarnings();
      initFundDividends();
      initSort();
      try {
        // 已登录用户：不在此处调用 refreshAll，等 fetchCloudConfig 完成后由 applyCloudConfig 统一刷新
        let shouldRefreshFromLocal = true;
        if (isSupabaseConfigured) {
          const { data, error } = await supabase.auth.getSession();
          if (!cancelled && !error && data?.session?.user) {
            shouldRefreshFromLocal = false;
          }
        }
        if (cancelled) return;

        const saved = storageStore.getItem('funds', []);
        if (isArray(saved) && saved.length) {
          const deduped = dedupeByCode(saved);
          const fundCodeSet = new Set(deduped.map((f) => f?.code).filter(Boolean));
          let storedTagRows = [];
          try {
            storedTagRows = storageStore.getItem('tags', []);
          } catch {
            /* empty */
          }
          if (!isArray(storedTagRows)) storedTagRows = [];
          const normalizedTags = storedTagRows
            .map((r) => {
              const codes = getFundCodesFromTagRecord(r).filter((c) => fundCodeSet.has(c));
              return {
                id: String(r.id || '').trim() || uuidv4(),
                name: String(r.name || '').trim(),
                theme: String(r.theme || '').trim() || DEFAULT_FUND_TAG_THEME,
                fundCodes: codes.sort()
              };
            })
            .filter((r) => r.name);
          const cleanedFunds = deduped.map(stripLegacyTagsFromFundObject);
          setFundTagRecords(normalizedTags);
          const codes = Array.from(new Set(cleanedFunds.map((f) => f.code)));
          if (codes.length && shouldRefreshFromLocal) refreshAll(codes);
        } else {
          try {
            const t = storageStore.getItem('tags', []);
            const arr = isArray(t) ? t : [];
            const normalized = arr
              .map((r) => {
                const codes = getFundCodesFromTagRecord(r);
                const name = String(r.name || '').trim();
                if (!name) return null;
                return {
                  id: String(r.id || '').trim() || uuidv4(),
                  name,
                  theme: String(r.theme || '').trim() || DEFAULT_FUND_TAG_THEME,
                  fundCodes: codes.sort()
                };
              })
              .filter(Boolean);
            setFundTagRecords(normalized);
          } catch {
            setFundTagRecords([]);
          }
        }
        setTempSeconds(Math.round(useStorageStore.getState().refreshMs / 1000));
        // 加载估值分时记录（用于分时图）
        setValuationSeries(getAllValuationSeries(funds));
        // 加载自选状态：只保留存在于 funds 中的 code，避免“自选数量 > 全部数量”
        const savedFavorites = Array.from(favorites);
        const storedFundCodeSet = new Set(funds.map((f) => f?.code).filter(Boolean));
        const cleanedFavorites = cleanCodeArray(savedFavorites, storedFundCodeSet);
        if (cleanedFavorites.length !== savedFavorites.length) {
          setFavorites(new Set(cleanedFavorites));
        }
        // 加载待处理交易
        const savedPending = storageStore.getItem('pendingTrades', []);
        if (isArray(savedPending)) {
          setPendingTrades(savedPending);
        }
        // 加载分组状态
        // 读取用户上次选择的分组（仅本地存储，不同步云端）
        const savedTab = storageStore.getItem('currentTab');
        if (
          savedTab === 'all' ||
          savedTab === 'fav' ||
          (savedTab && isArray(groups) && groups.some((g) => g?.id === savedTab))
        ) {
          setCurrentTab(savedTab);
        } else if (savedTab) {
          setCurrentTab('all');
        }
        // 加载持仓数据
        const seedGh = seedGroupHoldingsFromGlobal(holdings, isArray(groups) ? groups : [], groupHoldings);
        if (seedGh.changed) {
          setGroupHoldings(seedGh.next);
        }
        const migratedDca = migrateDcaPlansToScoped(isPlainObject(dcaPlans) ? dcaPlans : {});
        if (JSON.stringify(migratedDca) !== JSON.stringify(dcaPlans)) {
          setDcaPlans(migratedDca);
        }
        const savedTheme = storageStore.getItem('theme');
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setTheme(savedTheme);
        }
      } catch {}
      if (!cancelled) {
        hasLocalTabInitRef.current = true;
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [isSupabaseConfigured]);

  // 切换分组后，页面自动回到顶部（跳过首次初始化恢复）
  useEffect(() => {
    if (!hasLocalTabInitRef.current) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentTab]);

  // 全局持仓或分组成员变化时，按分组幂等补全子账本（不覆盖已有分组持仓）
  useEffect(() => {
    if (!hasLocalTabInitRef.current) return;
    setGroupHoldings((prev) => {
      const { next, changed } = seedGroupHoldingsFromGlobal(holdings, groups, prev);
      if (!changed) return prev;
      return next;
    });
  }, [holdings, groups]);

  // 记录用户当前选择的分组（仅本地存储，不同步云端）
  useEffect(() => {
    if (!hasLocalTabInitRef.current) return;
    try {
      storageStore.setItem('currentTab', currentTab);
    } catch {}
  }, [currentTab]);

  // 主题同步：已由 useTheme hook 内部的 useEffect 处理，此处无需重复

  // 初始化认证状态监听
  useEffect(() => {
    if (!isSupabaseConfigured) {
      clearAuthUser();
      return;
    }
    const clearAuthState = () => {
      clearAuthUser();
      skipSyncRef.current = false;
    };

    const handleSession = async (session, event, isExplicitLogin = false) => {
      if (!session?.user) {
        if (event === 'SIGNED_OUT' && !isLoggingOutRef.current) {
          setLoginInitialError('会话已过期，请重新登录');
          setLoginModalOpen(true);
        }
        isLoggingOutRef.current = false;
        clearAuthState();
        skipSyncRef.current = false;
        return;
      }
      if (session.expires_at && session.expires_at * 1000 <= Date.now()) {
        isLoggingOutRef.current = true;
        await supabase.auth.signOut({ scope: 'local' });
        try {
          // 例外：Supabase 会话键清理（auth SDK 持有 sb-*-auth-token，非 app 业务存储），保留直连枚举。
          const storageKeys = Object.keys(localStorage);
          storageKeys.forEach((key) => {
            if (key === 'supabase.auth.token' || (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
              storageHelper.removeItem(key);
            }
          });
        } catch {}
        try {
          const sessionKeys = Object.keys(sessionStorage);
          sessionKeys.forEach((key) => {
            if (key === 'supabase.auth.token' || (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
              sessionStorage.removeItem(key);
            }
          });
        } catch {}
        clearAuthState();
        setLoginInitialError('会话已过期，请重新登录');
        showToast('会话已过期，请重新登录', 'error');
        setLoginModalOpen(true);
        return;
      }
      setAuthUser(session.user);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        setLoginModalOpen(false);
        setLoginInitialError('');
      }
      // 仅在明确的登录动作（SIGNED_IN）时检查冲突；INITIAL_SESSION（刷新页面等）不检查，直接以云端为准
      fetchCloudConfig(session.user.id, isExplicitLogin, {
        refreshAfterApply: event === 'INITIAL_SESSION'
      });
    };

    supabase.auth.getSession().then(async ({ data, error }) => {
      if (error) {
        clearAuthState();
        return;
      }
      await handleSession(data?.session ?? null, 'INITIAL_SESSION');
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // INITIAL_SESSION 会由 getSession() 主动触发，这里不再重复处理
      if (event === 'INITIAL_SESSION') return;
      const isExplicitLogin = event === 'SIGNED_IN' && isExplicitLoginRef.current;
      await handleSession(session ?? null, event, isExplicitLogin);
      if (event === 'SIGNED_IN') {
        isExplicitLoginRef.current = false;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // // 实时同步
  // useEffect(() => {
  //   if (!isSupabaseConfigured || !user?.id) return;
  //   const deviceId = deviceIdRef.current;
  //   if (!deviceId) return; // 确保设备ID已初始化
  //
  //   const channel = supabase
  //     .channel(`user-configs-${user.id}`)
  //     .on('postgres_changes', { event: '*', schema: 'public', table: 'user_configs', filter: `last_device_id=neq.${deviceId}` }, async (payload) => {
  //       if (deviceConflictModalOpenRef.current) return; // 如果有拦截弹窗，忽略实时推送，防止覆盖本地数据
  //       if (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') return;
  //       const incoming = payload?.new?.data;
  //       if (!isPlainObject(incoming)) return;
  //       const incomingDeviceId = incoming?._syncMeta?.deviceId ? String(incoming._syncMeta.deviceId) : '';
  //       if (incomingDeviceId && deviceIdRef.current && incomingDeviceId === deviceIdRef.current) return;
  //       const incomingComparable = getComparablePayload(incoming);
  //       if (!incomingComparable || incomingComparable === lastSyncedRef.current) return;
  //       await applyCloudConfig(incoming, payload.new.updated_at);
  //     })
  //     .subscribe();
  //   return () => {
  //     supabase.removeChannel(channel);
  //   };
  // }, [user?.id]);

  // 登出
  const handleLogout = async () => {
    isLoggingOutRef.current = true;
    if (!isSupabaseConfigured) {
      setLoginModalOpen(false);
      setLoginInitialError('');
      clearAuthUser();
      return;
    }
    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (session) {
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error && error.code !== 'session_not_found') {
          throw error;
        }
      }
    } catch (err) {
      showToast(err.message, 'error');
      console.error('登出失败', err);
    } finally {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {}
      try {
        // 例外：Supabase 会话键清理（auth SDK 持有 sb-*-auth-token，非 app 业务存储），保留直连枚举。
        const storageKeys = Object.keys(localStorage);
        storageKeys.forEach((key) => {
          if (key === 'supabase.auth.token' || (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
            storageHelper.removeItem(key);
          }
        });
      } catch {}
      try {
        const sessionKeys = Object.keys(sessionStorage);
        sessionKeys.forEach((key) => {
          if (key === 'supabase.auth.token' || (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
            sessionStorage.removeItem(key);
          }
        });
      } catch {}
      setLoginModalOpen(false);
      setLoginInitialError('');
      clearAuthUser();
    }
  };

  const {
    handleReorder,
    requestRemoveFund,
    removeFundsFromCurrentTabHandler,
    handleMoveFunds,
    removeFund,
    removeFundsBulk
  } = useFundMutations({
    currentTab,
    setCurrentTab,
    displayFunds,
    setFundTagRecords,
    storageHelper,
    stripFundFromGroupScope,
    stripManyFundsFromGroupScope,
    showToast,
    fundDetailDrawerCloseRef,
    fundDetailDialogCloseRef
  });

  const handleMarketTabAddFund = (fundInfo) => {
    const { code, name } = fundInfo;
    const fundsToConfirm = [
      {
        code,
        name,
        status: 'pending'
      }
    ];
    setScannedFunds(fundsToConfirm);
    setSelectedScannedCodes(new Set([code]));
    setIsOcrScan(false);
    setScanConfirmModalOpen(true);
  };

  const saveSettings = (
    e,
    secondsOverride,
    showMarketIndexOverride,
    showGroupFundSearchOverride,
    isMobileOverride,
    dynamicStyleOverride
  ) => {
    e?.preventDefault?.();
    const seconds = secondsOverride ?? tempSeconds;
    const ms = Math.max(30, Number(seconds)) * 1000;
    setTempSeconds(Math.round(ms / 1000));
    setRefreshMs(ms);
    const nextShowMarketIndex = isBoolean(showMarketIndexOverride)
      ? showMarketIndexOverride
      : isMobileOverride
        ? showMarketIndexMobile
        : showMarketIndexPc;

    const targetIsMobile = Boolean(isMobileOverride);
    if (targetIsMobile) setShowMarketIndexMobile(nextShowMarketIndex);
    else setShowMarketIndexPc(nextShowMarketIndex);

    const nextShowGroupFundSearch = isBoolean(showGroupFundSearchOverride)
      ? showGroupFundSearchOverride
      : targetIsMobile
        ? showGroupFundSearchMobile
        : showGroupFundSearchPc;
    if (targetIsMobile) setShowGroupFundSearchMobile(nextShowGroupFundSearch);
    else setShowGroupFundSearchPc(nextShowGroupFundSearch);

    const nextDynamicStyle = isBoolean(dynamicStyleOverride)
      ? dynamicStyleOverride
      : targetIsMobile
        ? dynamicStyleMobile
        : dynamicStylePc;
    if (targetIsMobile) setDynamicStyleMobile(nextDynamicStyle);
    else setDynamicStylePc(nextDynamicStyle);

    // 在移动端不裁剪也不修改 pcContainerWidth，直接保留原值
    let w = Number(containerWidth) || 1200;
    if (!targetIsMobile) {
      w = Math.min(window.innerWidth, Math.max(600, w));
      setContainerWidth(w);
    }

    try {
      const parsed = customSettings || {};
      if (targetIsMobile) {
        // 仅更新当前运行端对应的开关键，不覆盖 PC 端宽度
        setCustomSettings({
          ...parsed,
          showMarketIndexMobile: nextShowMarketIndex,
          showGroupFundSearchMobile: nextShowGroupFundSearch,
          dynamicStyleMobile: nextDynamicStyle
        });
      } else {
        setCustomSettings({
          ...parsed,
          pcContainerWidth: w,
          showMarketIndexPc: nextShowMarketIndex,
          showGroupFundSearchPc: nextShowGroupFundSearch,
          dynamicStylePc: nextDynamicStyle
        });
      }
    } catch {}
    setSettingsOpen(false);
  };

  const handleResetContainerWidth = () => {
    setContainerWidth(1200);
    try {
      const parsed = customSettings || {};
      setCustomSettings({ ...parsed, pcContainerWidth: 1200 });
    } catch {}
  };

  const importFileRef = useRef(null);
  const [importMsg, setImportMsg] = useState('');

  const exportLocalData = async () => {
    try {
      const payload = {
        funds,
        tags: storageStore.getItem('tags', []),
        favorites: Array.from(favorites),
        groups,
        collapsedCodes: Array.from(collapsedCodes),
        collapsedTrends: Array.from(collapsedTrends),
        collapsedEarnings: Array.from(collapsedEarnings),
        refreshMs,
        viewMode: storageStore.getItem('viewMode') === 'list' ? 'list' : 'card',
        holdings,
        groupHoldings,
        pendingTrades,
        transactions,
        dcaPlans,
        customSettings: customSettings || {},
        fundDailyEarnings,
        exportedAt: nowInTz().toISOString()
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: `realtime-fund-config-${Date.now()}.json`,
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        setSuccessModal({ open: true, message: '导出成功' });
        setSettingsOpen(false);
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `realtime-fund-config-${Date.now()}.json`;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        URL.revokeObjectURL(url);
        setSuccessModal({ open: true, message: '导出成功' });
        setSettingsOpen(false);
      };
      const onVisibility = () => {
        if (document.visibilityState === 'hidden') return;
        finish();
        document.removeEventListener('visibilitychange', onVisibility);
      };
      document.addEventListener('visibilitychange', onVisibility, { once: true });
      a.click();
      setTimeout(finish, 3000);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  const handleImportFileChange = async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const data = JSON.parse(text);
      if (isPlainObject(data)) {
        // 从 localStorage 读取最新数据进行合并，防止状态滞后导致的数据丢失
        const currentFunds = storageStore.getItem('funds', []);
        const currentFavorites = storageStore.getItem('favorites', []);
        const currentGroups = storageStore.getItem('groups', []);
        const currentCollapsed = storageStore.getItem('collapsedCodes', []);
        const currentTrends = storageStore.getItem('collapsedTrends', []);
        const currentEarnings = storageStore.getItem('collapsedEarnings', []);
        const currentPendingTrades = storageStore.getItem('pendingTrades', []);
        const currentDcaPlans = storageStore.getItem('dcaPlans', {});
        const currentGroupHoldings = storageStore.getItem('groupHoldings', {});

        let mergedFunds = currentFunds;
        let appendedCodes = [];

        if (isArray(data.funds)) {
          const incomingFunds = dedupeByCode(data.funds.map(stripLegacyTagsFromFundObject));
          const existingCodes = new Set(currentFunds.map((f) => f.code));
          const newItems = incomingFunds.filter((f) => f && f.code && !existingCodes.has(f.code));
          appendedCodes = newItems.map((f) => f.code);
          mergedFunds = [...currentFunds, ...newItems];
          setFunds(mergedFunds);
        }

        if (isArray(data.favorites)) {
          const fundCodeSet = new Set(mergedFunds.map((f) => f?.code).filter(Boolean));
          const mergedFav = cleanCodeArray([...currentFavorites, ...data.favorites], fundCodeSet);
          setFavorites(new Set(mergedFav));
        }

        if (isArray(data.tags)) {
          const currentTags = storageStore.getItem('tags', []);
          const fundCodeSet = new Set(mergedFunds.map((f) => f?.code).filter(Boolean));
          const byId = new Map((isArray(currentTags) ? currentTags : []).map((r) => [String(r.id), r]));
          for (const r of data.tags) {
            if (!r || !isObject(r)) continue;
            const codes = getFundCodesFromTagRecord(r).filter((c) => fundCodeSet.has(c));
            const name = String(r.name ?? '').trim();
            if (!name) continue;
            const id = String(r.id ?? '').trim() || uuidv4();
            const existing = byId.get(id);
            const mergedCodes = existing
              ? [...new Set([...getFundCodesFromTagRecord(existing), ...codes])].sort()
              : codes.sort();
            const row = sanitizeTagRowForStorage({
              id,
              name,
              theme: String(r.theme ?? '').trim() || DEFAULT_FUND_TAG_THEME,
              fundCodes: mergedCodes
            });
            if (row) byId.set(id, row);
          }
          const mergedTags = Array.from(byId.values())
            .map(sanitizeTagRowForStorage)
            .filter(Boolean)
            .sort((a, b) => String(a.id).localeCompare(String(b.id)));
          setFundTagRecords(mergedTags);
          storageHelper.setItem('tags', JSON.stringify(mergedTags));
        }

        // fundTagLists 已废弃：导入时无需处理该字段

        if (isArray(data.groups)) {
          // 合并分组：如果 ID 相同则合并 codes，否则添加新分组
          const mergedGroups = [...currentGroups];
          data.groups.forEach((incomingGroup) => {
            const existingIdx = mergedGroups.findIndex((g) => g.id === incomingGroup.id);
            if (existingIdx > -1) {
              mergedGroups[existingIdx] = {
                ...mergedGroups[existingIdx],
                codes: Array.from(new Set([...mergedGroups[existingIdx].codes, ...(incomingGroup.codes || [])]))
              };
            } else {
              mergedGroups.push(incomingGroup);
            }
          });
          setGroups(mergedGroups);
        }

        if (isArray(data.collapsedCodes)) {
          const mergedCollapsed = Array.from(new Set([...currentCollapsed, ...data.collapsedCodes]));
          setCollapsedCodes(new Set(mergedCollapsed));
        }

        if (isArray(data.collapsedTrends)) {
          const mergedTrends = Array.from(new Set([...currentTrends, ...data.collapsedTrends]));
          setCollapsedTrends(new Set(mergedTrends));
        }

        if (isArray(data.collapsedEarnings)) {
          const mergedEarnings = Array.from(new Set([...currentEarnings, ...data.collapsedEarnings]));
          setCollapsedEarnings(new Set(mergedEarnings));
        }

        if (isNumber(data.refreshMs) && data.refreshMs >= 5000) {
          setRefreshMs(data.refreshMs);
          setTempSeconds(Math.round(data.refreshMs / 1000));
        }
        if (data.viewMode === 'card' || data.viewMode === 'list') {
          applyViewMode(data.viewMode);
        }

        if (isPlainObject(data.holdings)) {
          const mergedHoldings = { ...storageStore.getItem('holdings', {}), ...data.holdings };
          setHoldings(mergedHoldings);
        }

        if (isPlainObject(data.groupHoldings)) {
          const mergedGH = { ...(isPlainObject(currentGroupHoldings) ? currentGroupHoldings : {}) };
          Object.entries(data.groupHoldings).forEach(([gid, bucket]) => {
            if (!isPlainObject(bucket)) return;
            mergedGH[gid] = { ...(mergedGH[gid] || {}), ...bucket };
          });
          setGroupHoldings(mergedGH);
        }

        if (isPlainObject(data.transactions)) {
          const currentTransactions = storageStore.getItem('transactions', {});
          const mergedTransactions = { ...currentTransactions };
          Object.entries(data.transactions).forEach(([code, txs]) => {
            if (!isArray(txs)) return;
            const existing = mergedTransactions[code] || [];
            const existingIds = new Set(existing.map((t) => t.id));
            const newTxs = txs.filter((t) => !existingIds.has(t.id));
            mergedTransactions[code] = [...existing, ...newTxs].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          });
          setTransactions(mergedTransactions);
        }

        if (isArray(data.pendingTrades)) {
          const existingPending = isArray(currentPendingTrades) ? currentPendingTrades : [];
          const incomingPending = data.pendingTrades.filter((trade) => trade && trade.fundCode);
          const fundCodeSet = new Set(mergedFunds.map((f) => f.code));
          const keyOf = (trade) => {
            if (trade?.id) return `id:${trade.id}`;
            return `k:${trade?.groupId || ''}:${trade?.fundCode || ''}:${trade?.type || ''}:${trade?.date || ''}:${trade?.share || ''}:${trade?.amount || ''}:${trade?.isAfter3pm ? 1 : 0}`;
          };
          const mergedPendingMap = new Map();
          existingPending.forEach((trade) => {
            if (!trade || !fundCodeSet.has(trade.fundCode)) return;
            mergedPendingMap.set(keyOf(trade), trade);
          });
          incomingPending.forEach((trade) => {
            if (!fundCodeSet.has(trade.fundCode)) return;
            mergedPendingMap.set(keyOf(trade), trade);
          });
          const mergedPending = Array.from(mergedPendingMap.values());
          setPendingTrades(mergedPending);
        }

        if (isPlainObject(data.dcaPlans)) {
          const mergedDca = { ...migrateDcaPlansToScoped(currentDcaPlans) };
          const incomingScoped = migrateDcaPlansToScoped(data.dcaPlans);
          Object.keys(incomingScoped).forEach((scope) => {
            mergedDca[scope] = {
              ...(isPlainObject(mergedDca[scope]) ? mergedDca[scope] : {}),
              ...(isPlainObject(incomingScoped[scope]) ? incomingScoped[scope] : {})
            };
          });
          setDcaPlans(mergedDca);
        }
        if (isPlainObject(data.customSettings)) {
          try {
            const currentCustomSettings = customSettings || {};
            const mergedSettings = {
              ...(isPlainObject(currentCustomSettings) ? currentCustomSettings : {}),
              ...data.customSettings
            };
            setCustomSettings(mergedSettings);
            if (mergedSettings.localSortRules && isArray(mergedSettings.localSortRules)) {
              setSortRules(mergedSettings.localSortRules);
            }
            if (mergedSettings.localSortDisplayMode && SORT_DISPLAY_MODES.has(mergedSettings.localSortDisplayMode)) {
              setPcSortDisplayMode(mergedSettings.localSortDisplayMode);
              setMobileSortDisplayMode(mergedSettings.localSortDisplayMode);
            } else {
              if (
                mergedSettings.pcLocalSortDisplayMode &&
                SORT_DISPLAY_MODES.has(mergedSettings.pcLocalSortDisplayMode)
              ) {
                setPcSortDisplayMode(mergedSettings.pcLocalSortDisplayMode);
              }
              if (
                mergedSettings.mobileLocalSortDisplayMode &&
                SORT_DISPLAY_MODES.has(mergedSettings.mobileLocalSortDisplayMode)
              ) {
                setMobileSortDisplayMode(mergedSettings.mobileLocalSortDisplayMode);
              }
            }
            if (isNumber(mergedSettings.pcContainerWidth) && Number.isFinite(mergedSettings.pcContainerWidth)) {
              const maxWidth = window.matchMedia('(max-width: 640px)').matches ? 99999 : window.innerWidth;
              setContainerWidth(Math.min(maxWidth, Math.max(600, mergedSettings.pcContainerWidth)));
            }
            if (isBoolean(mergedSettings.showMarketIndexPc)) setShowMarketIndexPc(mergedSettings.showMarketIndexPc);
            if (isBoolean(mergedSettings.showMarketIndexMobile))
              setShowMarketIndexMobile(mergedSettings.showMarketIndexMobile);
            if (isBoolean(mergedSettings.showGroupFundSearchPc))
              setShowGroupFundSearchPc(mergedSettings.showGroupFundSearchPc);
            if (isBoolean(mergedSettings.showGroupFundSearchMobile))
              setShowGroupFundSearchMobile(mergedSettings.showGroupFundSearchMobile);
          } catch {}
        }

        if (isPlainObject(data.fundDailyEarnings)) {
          try {
            const incomingScoped = normalizeFundDailyEarningsScoped(data.fundDailyEarnings);
            const currentScoped = normalizeFundDailyEarningsScoped(fundDailyEarnings);
            const mergedDaily = { ...currentScoped };
            Object.entries(incomingScoped).forEach(([scope, bucket]) => {
              if (!isPlainObject(bucket)) return;
              const existingBucket = isPlainObject(mergedDaily[scope]) ? mergedDaily[scope] : {};
              const mergedBucket = { ...existingBucket };
              Object.entries(bucket).forEach(([code, list]) => {
                if (!isArray(list)) return;
                const existingList = isArray(mergedBucket[code]) ? mergedBucket[code] : [];
                const existingByDate = new Map(existingList.map((item) => [item.date, item]));
                list.forEach((item) => {
                  if (!item || !item.date || !Number.isFinite(item.earnings)) return;
                  existingByDate.set(item.date, item);
                });
                mergedBucket[code] = Array.from(existingByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
              });
              mergedDaily[scope] = mergedBucket;
            });
            setFundDailyEarnings(mergedDaily);
          } catch {}
        }

        // 导入成功后，仅刷新新追加的基金
        if (appendedCodes.length) {
          // 这里需要确保 refreshAll 不会因为闭包问题覆盖掉刚刚合并好的 mergedFunds
          // 我们直接传入所有代码执行一次全量刷新是最稳妥的，或者修改 refreshAll 支持增量更新
          const allCodes = mergedFunds.map((f) => f.code);
          await refreshAll(allCodes);
        }

        setSuccessModal({ open: true, message: '导入成功' });
        setSettingsOpen(false); // 导入成功自动关闭设置弹框
        if (importFileRef.current) importFileRef.current.value = '';
      }
    } catch (err) {
      console.error('Import error:', err);
      setImportMsg('导入失败，请检查文件格式');
      setTimeout(() => setImportMsg(''), 4000);
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  useEffect(() => {
    if (!isMobile || mainTab !== 'home') return;

    let ticking = false;
    const handleScroll = () => {
      // 如果 body 已经被锁定了滚动（说明有弹窗打开），直接忽略滚动事件
      if (document.body.style.overflow === 'hidden') return;
      if (!ticking) {
        requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const lastScrollY = lastScrollYRef.current;
          const scrollDelta = currentScrollY - lastScrollY;
          const threshold = 10;

          if (scrollDelta > threshold && currentScrollY > 50) {
            setMobileBottomNavHidden(true);
          } else if (scrollDelta < -threshold) {
            setMobileBottomNavHidden(false);
          } else if (currentScrollY <= 0) {
            setMobileBottomNavHidden(false);
          }

          lastScrollYRef.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobile, mainTab]);

  useEffect(() => {
    if (!isMobile || mainTab !== 'home') {
      setMobileBottomNavHidden(false);
    }
  }, [isMobile, mainTab]);

  const settingsOpenRef = useRef(false);
  useEffect(() => {
    const unsub = useModalStore.subscribe(
      (s) => s.settingsOpen,
      (open) => {
        settingsOpenRef.current = open;
      }
    );
    settingsOpenRef.current = useModalStore.getState().settingsOpen;
    return unsub;
  }, []);
  useEffect(() => {
    const onKey = (ev) => {
      if (ev.key === 'Escape' && settingsOpenRef.current) setSettingsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const containerClassName = [
    'container',
    isMobile && mainTab === 'mine' ? 'mine-mobile-root' : 'content',
    isMobile && mainTab === 'home' ? 'content-with-mobile-tabbar' : ''
  ]
    .filter(Boolean)
    .join(' ');

  /** 移动端底部 Tab 切换时保留首页 DOM，用显隐代替卸载 */
  const mobileHomeTabVisible = mainTab === 'home' || mainTab === 'market';

  /** PC / 移动端行、FundCard 共用：统一 name / fundName 后走单删逻辑 */
  const handleRemoveFundEntry = useCallback(
    (rowOrFund) => {
      if (!rowOrFund?.code) return;
      const name = rowOrFund.name ?? rowOrFund.fundName ?? rowOrFund.code;
      requestRemoveFund({ code: rowOrFund.code, name });
    },
    [requestRemoveFund]
  );

  const handleToggleFavoriteRow = useCallback(
    (row) => {
      if (!row || !row.code) return;
      toggleFavorite(row.code);
    },
    [toggleFavorite]
  );

  const handleHoldingAmountClickRow = useCallback(
    (row, meta) => {
      if (!row || !row.code) return;
      if ((currentTab === 'all' || currentTab === 'fav') && row.isHoldingLinked) {
        const fund = row.rawFund || { code: row.code, name: row.fundName };
        setSelectHoldingGroupModal({ open: true, fund });
        return;
      }

      // 自定义分组：未设置持仓时，如果“全部”存在全局持仓，则提示迁移
      if (activeGroupId && meta?.hasHolding === false) {
        const gh = groupHoldings?.[activeGroupId]?.[row.code];
        const hasGroupShare = gh && isNumber(gh.share) && gh.share > 0;
        const global = holdings?.[row.code];
        const hasGlobalShare = global && isNumber(global.share) && global.share > 0;
        if (!hasGroupShare && hasGlobalShare) {
          const name = row.rawFund?.name ?? row.fundName ?? row.code;
          setHoldingMigrateDialog({
            open: true,
            code: row.code,
            name,
            targetGroupId: activeGroupId
          });
          return;
        }
      }

      const fund = row.rawFund || { code: row.code, name: row.fundName };
      if (meta?.hasHolding) {
        setActionModal({ open: true, fund });
      } else {
        setHoldingModal({ open: true, fund });
      }
    },
    [activeGroupId, currentTab, groupHoldings, holdings]
  );

  const handleHoldingProfitClickRow = useCallback((row) => {
    if (!row || !row.code) return;
    if (row.holdingProfitValue == null) return;
    setPercentModes((prev) => ({ ...prev, [row.code]: !prev[row.code] }));
  }, []);

  const openHoldingModal = useCallback(
    (fund) => {
      const code = fund?.code;
      if ((currentTab === 'all' || currentTab === 'fav') && code && linkedHoldingsForAllFav.linked?.has?.(code)) {
        setSelectHoldingGroupModal({ open: true, fund });
        return;
      }

      // 自定义分组：卡片视图/抽屉中“未设置持仓”点击时也走同样迁移提示
      if (activeGroupId && code) {
        const gh = groupHoldings?.[activeGroupId]?.[code];
        const hasGroupShare = gh && isNumber(gh.share) && gh.share > 0;
        const global = holdings?.[code];
        const hasGlobalShare = global && isNumber(global.share) && global.share > 0;
        if (!hasGroupShare && hasGlobalShare) {
          const name = fund?.name ?? code;
          setHoldingMigrateDialog({
            open: true,
            code,
            name,
            targetGroupId: activeGroupId
          });
          return;
        }
      }

      setHoldingModal({ open: true, fund });
    },
    [activeGroupId, currentTab, groupHoldings, holdings, linkedHoldingsForAllFav]
  );
  const openDataSourceModal = useCallback((fund) => {
    setDataSourceModal({ open: true, fund });
  }, []);

  const handleDataSourceSelect = useCallback(
    (fundCode, sourceId) => {
      setFunds((prev) => {
        const next = [...prev];
        const idx = next.findIndex((f) => f.code === fundCode);
        if (idx !== -1) {
          next[idx] = {
            ...next[idx],
            dataSource: sourceId,
            gsz: null,
            gszzl: null,
            gztime: null,
            valuationSource: null,
            noValuation: false
          };
        }
        return next;
      });

      if (typeof window !== 'undefined') {
        try {
          const saved = storageStore.getItem('rtf_unadded_ds', {});
          saved[fundCode] = sourceId;
          storageStore.setItem('rtf_unadded_ds', JSON.stringify(saved));
        } catch {}
        window.dispatchEvent(new CustomEvent('rtf_unadded_datasource_change', { detail: { fundCode, sourceId } }));
      }

      // Immediately fetch new data for this fund so the UI updates
      refreshAll([fundCode]);
      showToast('切换数据源成功', 'success');
    },
    [setFunds]
  ); // refreshAll is omitted from deps to avoid loop, it's stable enough in page scope

  const openActionModal = useCallback(
    (fund) => {
      const code = fund?.code;
      if ((currentTab === 'all' || currentTab === 'fav') && code && linkedHoldingsForAllFav.linked?.has?.(code)) {
        setSelectHoldingGroupModal({ open: true, fund });
        return;
      }
      setActionModal({ open: true, fund });
    },
    [currentTab, linkedHoldingsForAllFav]
  );
  const togglePercentMode = useCallback((code) => {
    setPercentModes((prev) => ({ ...prev, [code]: !prev[code] }));
  }, []);
  const toggleTodayPercentMode = useCallback((code) => {
    setTodayPercentModes((prev) => ({ ...prev, [code]: !prev[code] }));
  }, []);

  const getFundCardPropsForRow = useCallback(
    (row) => {
      const fund = row?.rawFund || (row ? { code: row.code, name: row.fundName } : null);
      if (!fund) return {};
      return {
        fundCode: fund.code,
        fallbackFund: fund,
        todayStr,
        currentTab,
        favorites,
        dcaPlans: dcaPlansForTab,
        holdings: holdingsForTabWithLinked,
        percentModes,
        todayPercentModes,
        fundDailyEarnings: currentFundDailyEarnings,
        valuationSeries,
        collapsedCodes,
        collapsedTrends,
        collapsedValuationTrends,
        collapsedEarnings,
        transactions: transactionsForTab,
        theme,
        isTradingDay,
        getHoldingProfit: getHoldingProfitForTab,
        onToggleFavorite: toggleFavorite,
        onAddFund: handleMarketTabAddFund,
        onRemoveFund: handleRemoveFundEntry,
        onHoldingClick: openHoldingModal,
        onActionClick: openActionModal,
        onDataSourceClick: openDataSourceModal,
        onPercentModeToggle: togglePercentMode,
        onTodayPercentModeToggle: toggleTodayPercentMode,
        onToggleCollapse: toggleCollapse,
        onToggleTrendCollapse: toggleTrendCollapse,
        onToggleValuationTrendCollapse: toggleValuationTrendCollapse,
        onToggleEarningsCollapse: toggleEarningsCollapse,
        masked: maskAmounts,
        layoutMode: 'drawer',
        isHoldingLinked: !!row?.isHoldingLinked,
        fundTags: row?.fundTags || [],
        onFundTagsClick: openFundTagsEdit,
        fundExtraData: fundExtraDataByCode[fund.code] || fund.fundExtraData,
        groupTotalHoldingAmount,
        hasPending: pendingCodesForTab.has(fund.code),
        userId: user?.id
      };
    },
    [
      todayStr,
      currentTab,
      favorites,
      dcaPlansForTab,
      holdingsForTabWithLinked,
      percentModes,
      todayPercentModes,
      currentFundDailyEarnings,
      valuationSeries,
      collapsedCodes,
      collapsedTrends,
      collapsedValuationTrends,
      collapsedEarnings,
      transactionsForTab,
      theme,
      isTradingDay,
      getHoldingProfitForTab,
      toggleFavorite,
      handleRemoveFundEntry,
      openHoldingModal,
      openActionModal,
      openDataSourceModal,
      togglePercentMode,
      toggleTodayPercentMode,
      toggleCollapse,
      toggleTrendCollapse,
      toggleValuationTrendCollapse,
      toggleEarningsCollapse,
      maskAmounts,
      openFundTagsEdit,
      fundExtraDataByCode,
      groupTotalHoldingAmount,
      pendingCodesForTab,
      user?.id
    ]
  );

  // ModalsLayer 回调 ref：页面级回调与数据通过 ref 注入，不触发重渲染
  const modalCbRef = useRef({});
  modalCbRef.current = {
    // 业务回调
    handleClearConfirm,
    handleDeleteTransaction,
    handleAddHistory,
    handleAction,
    handleTrade,
    handleSaveHolding,
    handleAddGroup,
    handleUpdateGroups,
    handleAddFundsToGroup,
    handleDataSourceSelect,
    handleSyncLocalConfig,
    handleSaveFundTags,
    handleAddPoolTag,
    handleDeleteGlobalTag,
    handleUpdateGlobalTag,
    getTagUsageLabels,
    handleMoveFunds,
    handleMergeAllGroupTransactionsToCurrent,
    stripFundFromGroupScope,
    removeFund,
    removeFundsBulk,
    stripManyFundsFromGroupScope,
    applyCloudConfig: (data) => {
      applyCloudConfig(data);
    },
    syncUserConfig,
    fetchCloudConfig: (userId, isInitialSync, remoteData, isPartial, opts) =>
      fetchCloudConfig?.(userId, isInitialSync, remoteData, isPartial, opts),
    refreshAll: (codes) => refreshAll?.(codes),
    showToast,
    cancelScan,
    handleScanPick: (e) => handleScanPick?.(e),
    handleRetryOcr: () => handleRetryOcr?.(),
    handleFilesDrop: (e) => handleFilesDrop?.(e),
    toggleScannedCode: (code) => toggleScannedCode?.(code),
    confirmScanImport: (targetGroupId, expandAfterAdd) => confirmScanImport?.(targetGroupId, expandAfterAdd),
    // 辅助函数
    getScopedHolding: (code, groupIdOverride) => getScopedHolding?.(code, groupIdOverride),
    getScopedGroupId: (groupIdOverride) => getScopedGroupId?.(groupIdOverride),
    getHoldingProfit: getHoldingProfitForTab,
    getScopedDcaPlan: (code, groupIdOverride) => getScopedDcaPlan?.(code, groupIdOverride),
    // 数据
    funds,
    groups,
    groupHoldings,
    transactions,
    holdings,
    dcaPlans,
    pendingTrades,
    fundTagRecords,
    fundTagListsByCode,
    favorites,
    scannedFunds: scannedFunds ?? [],
    selectedScannedCodes: selectedScannedCodes ?? new Set(),
    isOcrScan: isOcrScan ?? false,
    refreshing,
    user,
    portfolioDailySeries,
    currentTab,
    // Settings
    tempSeconds,
    setTempSeconds,
    containerWidth,
    setContainerWidth,
    importMsg: isString(importMsg) ? importMsg : '',
    saveSettings,
    exportLocalData,
    handleResetContainerWidth,
    handleImportFileChange,
    importFileRef: importFileRef ?? { current: null },
    fileInputRef: fileInputRef ?? { current: null },
    showMarketIndexPc,
    showMarketIndexMobile,
    showGroupFundSearchPc,
    showGroupFundSearchMobile,
    dynamicStylePc,
    dynamicStyleMobile,
    scanProgress: scanProgress ?? { stage: 'ocr', current: 0, total: 0 },
    scanImportProgress: scanImportProgress ?? { current: 0, total: 0, success: 0, failed: 0 },
    // Refs
    fundDetailDrawerCloseRef,
    fundDetailDialogCloseRef,
    pcBatchClearSelectionRef,
    mobileBatchClearSelectionRef,
    skipSyncRef,
    refreshCycleStartRef,
    isExplicitLoginRef,
    // Setters
    setPendingTrades,
    setHoldings,
    setGroupHoldings,
    setTransactions,
    setDcaPlans,
    setFundTagRecords,
    setFunds,
    setFavorites
  };

  return (
    <NavLayout
      mainTab={mainTab}
      setMainTab={setMainTab}
      isMobile={isMobile}
      containerRef={containerRef}
      containerClassName={containerClassName}
      containerWidth={containerWidth}
      showThemeTransition={showThemeTransition}
      setShowThemeTransition={setShowThemeTransition}
      mobileBottomNavHidden={mobileBottomNavHidden}
    >
      <div
        className="mobile-main-tab-panel mobile-main-tab-panel--home"
        style={{ display: mobileHomeTabVisible ? 'contents' : 'none' }}
        aria-hidden={!mobileHomeTabVisible || undefined}
      >
        <>
          <Announcement />
          <div className="navbar glass" ref={navbarRef}>
            {refreshing && <div className="loading-bar"></div>}
            <div className={`brand ${isSearchFocused || selectedFunds.length > 0 ? 'search-focused-sibling' : ''}`}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      marginRight: 4,
                      position: 'relative',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden'
                    }}
                  >
                    {/* 同步中图标 */}
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        margin: 'auto',
                        opacity: isSyncing ? 1 : 0,
                        transform: isSyncing ? 'translateY(0px)' : 'translateY(4px)',
                        transition: 'opacity 0.25s ease, transform 0.25s ease'
                      }}
                    >
                      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" stroke="var(--primary)" />
                      <path d="M12 12v9" stroke="var(--accent)" />
                      <path d="m16 16-4-4-4 4" stroke="var(--accent)" />
                    </svg>
                    {/* 默认图标 */}
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        margin: 'auto',
                        opacity: isSyncing ? 0 : 1,
                        transform: isSyncing ? 'translateY(-4px)' : 'translateY(0px)',
                        transition: 'opacity 0.25s ease, transform 0.25s ease'
                      }}
                    >
                      <circle cx="12" cy="12" r="10" stroke="var(--accent)" strokeWidth="2" />
                      <path d="M5 14c2-4 7-6 14-5" stroke="var(--primary)" strokeWidth="2" />
                    </svg>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isSyncing ? '正在同步到云端...' : undefined}</p>
                </TooltipContent>
              </Tooltip>
              <span>基估宝</span>
            </div>
            <div
              className={`glass add-fund-section navbar-add-fund ${isSearchFocused || selectedFunds.length > 0 ? 'search-focused' : ''}`}
              role="region"
              aria-label="添加基金"
            >
              <div className="search-container" ref={dropdownRef}>
                {selectedFunds.length > 0 && (
                  <div className="selected-inline-chips" style={{ marginBottom: 8, marginLeft: 0 }}>
                    {selectedFunds.map((fund) => (
                      <div key={fund.CODE} className="fund-chip">
                        <span>{fund.NAME}</span>
                        <button onClick={() => toggleSelectFund(fund)} className="remove-chip">
                          <CloseIcon width="14" height="14" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <SearchBar
                  inputRef={inputRef}
                  searchTerm={searchTerm}
                  handleSearchInput={handleSearchInput}
                  showDropdown={showDropdown}
                  setShowDropdown={setShowDropdown}
                  isSearchFocused={isSearchFocused}
                  setIsSearchFocused={setIsSearchFocused}
                  searchResults={searchResults}
                  isSearching={isSearching}
                  selectedFunds={selectedFunds}
                  toggleSelectFund={toggleSelectFund}
                  isScanning={isScanning}
                  handleScanClick={handleScanClick}
                  addFund={addFund}
                />
              </div>
              {error && (
                <div className="muted" style={{ marginTop: 8, color: 'var(--danger)' }}>
                  {error}
                </div>
              )}
            </div>
            <div className={`actions ${isSearchFocused || selectedFunds.length > 0 ? 'search-focused-sibling' : ''}`}>
              <UpdateChecker onModalOpenChange={setIsUpdateModalOpen} />
              <span className="github-icon-wrap">
                <Image
                  unoptimized
                  alt="项目Github地址"
                  src={githubImg}
                  style={{ width: '30px', height: '30px', cursor: 'pointer' }}
                  onClick={() => window.open('https://github.com/hzm0321/real-time-fund')}
                />
              </span>
              {isMobile && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="icon-button mobile-search-btn"
                      aria-label="筛选基金"
                      onClick={handleMobileSearchClick}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                        <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>筛选</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <RefreshButton
                refreshMs={refreshMs}
                manualRefresh={manualRefresh}
                refreshing={refreshing}
                fundsLength={funds.length}
                refreshCycleStartRef={refreshCycleStartRef}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="icon-button"
                    aria-label={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
                    onClick={handleThemeToggle}
                  >
                    {theme === 'dark' ? <SunIcon width="18" height="18" /> : <MoonIcon width="18" height="18" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{theme === 'dark' ? '亮色' : '暗色'}</p>
                </TooltipContent>
              </Tooltip>
              <UserMenu
                user={user}
                userAvatar={userAvatar}
                navbarHeight={navbarHeight}
                lastSyncTime={lastSyncTime}
                isSyncing={isSyncing}
                onSync={() => user?.id && syncUserConfig(user.id)}
                onOpenSettings={() => setSettingsOpen(true)}
                onOpenPortfolioEarnings={() => setPortfolioEarningsOpen(true)}
                onOpenLogin={handleOpenLogin}
                onLogout={handleLogout}
                onLogoutConfirmOpenChange={setIsLogoutConfirmOpen}
                onTutorial={() => {
                  if (isMobile) {
                    setTutorialDrawerOpen(true);
                  } else {
                    window.open('https://www.yuque.com/u267605/ookgim/im06q8tembbld6im?singleDoc', '_blank');
                  }
                }}
                onUpdateLog={() => setUpdateLogOpen(true)}
              />
            </div>
          </div>
          {shouldShowMarketIndex && (
            <MarketIndexAccordion
              navbarHeight={navbarHeight}
              onCustomSettingsChange={triggerCustomSettingsSync}
              refreshing={refreshing}
            />
          )}
          <div style={{ display: mainTab === 'home' ? 'contents' : 'none' }}>
            <div className="grid">
              <div className="col-12">
                <div
                  ref={filterBarRef}
                  className="filter-bar"
                  style={{
                    top: `calc(${navbarHeight}px + var(--market-index-height, 0px))`,
                    marginTop: 0,
                    marginBottom: 8,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12
                  }}
                >
                  <div className="tabs-container">
                    <div className="tabs-scroll-area" data-mask-left={canLeft} data-mask-right={canRight}>
                      <div
                        className="tabs"
                        ref={tabsRef}
                        onMouseDown={handleMouseDown}
                        onMouseLeave={handleMouseLeaveOrUp}
                        onMouseUp={handleMouseLeaveOrUp}
                        onMouseMove={handleMouseMove}
                        onWheel={handleWheel}
                        onScroll={updateTabOverflow}
                      >
                        <AnimatePresence mode="popLayout">
                          {showPortfolioSummaryTab && (
                            <motion.button
                              layout
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              key="portfolio-summary"
                              className={`tab ${currentTab === SUMMARY_TAB_ID ? 'active' : ''}`}
                              onClick={() => handleTabClick(SUMMARY_TAB_ID)}
                              transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 1 }}
                            >
                              汇总
                            </motion.button>
                          )}
                          <motion.button
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            key="all"
                            className={`tab ${currentTab === 'all' ? 'active' : ''}`}
                            onClick={() => handleTabClick('all')}
                            transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 1 }}
                          >
                            全部 ({funds.length})
                          </motion.button>
                          <motion.button
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            key="fav"
                            className={`tab ${currentTab === 'fav' ? 'active' : ''}`}
                            onClick={() => handleTabClick('fav')}
                            transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 1 }}
                          >
                            自选 ({favorites.size})
                          </motion.button>
                          {groups.map((g) => (
                            <motion.button
                              layout
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              key={g.id}
                              className={`tab ${currentTab === g.id ? 'active' : ''}`}
                              onClick={() => handleTabClick(g.id)}
                              transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 1 }}
                            >
                              {g.name} ({g.codes.length})
                            </motion.button>
                          ))}
                        </AnimatePresence>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="icon-button add-group-btn" onClick={() => setGroupModalOpen(true)}>
                              <PlusIcon width="16" height="16" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>新增分组</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                    {groups.length > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="icon-button manage-groups-btn" onClick={() => setGroupManageOpen(true)}>
                            <SortIcon width="16" height="16" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>管理分组</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  <div
                    className="sort-group"
                    style={{
                      display: currentTab === SUMMARY_TAB_ID ? 'none' : 'flex',
                      alignItems: 'center',
                      gap: 12
                    }}
                  >
                    <div
                      className="view-toggle"
                      style={{
                        display: 'flex',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '10px',
                        padding: '2px'
                      }}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className={`icon-button ${viewMode === 'card' ? 'active' : ''}`}
                            onClick={() => {
                              applyViewMode('card');
                            }}
                            style={{
                              border: 'none',
                              width: '32px',
                              height: '32px',
                              background: viewMode === 'card' ? 'var(--primary)' : 'transparent',
                              color: viewMode === 'card' ? '#05263b' : 'var(--muted)'
                            }}
                          >
                            <GridIcon width="16" height="16" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>卡片视图</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className={`icon-button ${viewMode === 'list' ? 'active' : ''}`}
                            onClick={() => {
                              applyViewMode('list');
                            }}
                            style={{
                              border: 'none',
                              width: '32px',
                              height: '32px',
                              background: viewMode === 'list' ? 'var(--primary)' : 'transparent',
                              color: viewMode === 'list' ? '#05263b' : 'var(--muted)'
                            }}
                          >
                            <ListIcon width="16" height="16" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>表格视图</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    <div className="divider" style={{ width: '1px', height: '20px', background: 'var(--border)' }} />

                    <div className="sort-items" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => setSortSettingOpen(true)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: '12px',
                              color: 'var(--muted-foreground)',
                              cursor: 'pointer',
                              width: '50px'
                            }}
                          >
                            <span className="muted">排序</span>
                            <SettingsIcon width="14" height="14" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>排序个性化设置</p>
                        </TooltipContent>
                      </Tooltip>
                      {(isMobile ? mobileSortDisplayMode : pcSortDisplayMode) === 'dropdown' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Select
                            value={sortBy}
                            onValueChange={(nextSortBy) => {
                              startTransition(() => {
                                setSortBy(nextSortBy);
                                if (nextSortBy !== sortBy) setSortOrder('desc');
                              });
                            }}
                          >
                            <SelectTrigger
                              className="h-4 min-w-[110px] py-0 text-xs shadow-none"
                              style={{ background: 'var(--card-bg)', height: 36 }}
                            >
                              <SelectValue placeholder="选择排序规则" />
                            </SelectTrigger>
                            <SelectContent>
                              {sortRules
                                .filter((s) => s.enabled)
                                .map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.alias || s.label}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={sortOrder}
                            onValueChange={(value) => {
                              startTransition(() => {
                                setSortOrder(value);
                              });
                            }}
                          >
                            <SelectTrigger
                              className="h-4 min-w-[84px] py-0 text-xs shadow-none"
                              style={{ background: 'var(--card-bg)', height: 36 }}
                            >
                              <SelectValue placeholder="排序方向" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="desc">降序</SelectItem>
                              <SelectItem value="asc">升序</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="chips">
                          {sortRules
                            .filter((s) => s.enabled)
                            .map((s) => (
                              <button
                                key={s.id}
                                className={`chip ${sortBy === s.id ? 'active' : ''}`}
                                onClick={() => {
                                  startTransition(() => {
                                    if (sortBy === s.id) {
                                      // 同一按钮重复点击，切换升序/降序
                                      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                                    } else {
                                      // 切换到新的排序字段，默认用降序
                                      setSortBy(s.id);
                                      setSortOrder('desc');
                                    }
                                  });
                                }}
                                style={{
                                  height: '28px',
                                  fontSize: '12px',
                                  padding: '0 10px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                <span>{s.alias || s.label}</span>
                                {s.id !== 'default' && sortBy === s.id && (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      flexDirection: 'column',
                                      lineHeight: 1,
                                      fontSize: '8px'
                                    }}
                                  >
                                    <span style={{ opacity: sortOrder === 'asc' ? 1 : 0.3 }}>▲</span>
                                    <span style={{ opacity: sortOrder === 'desc' ? 1 : 0.3 }}>▼</span>
                                  </span>
                                )}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {scopedFunds.length === 0 && !(currentTab === SUMMARY_TAB_ID && showPortfolioSummaryTab) ? (
                  <EmptyStateCard
                    fundsLength={funds.length}
                    currentTab={currentTab}
                    onAddToGroup={() => setAddFundToGroupOpen(true)}
                  />
                ) : (
                  <>
                    {currentTab === SUMMARY_TAB_ID ? (
                      <SummaryTabContent
                        funds={displayFunds}
                        holdings={holdingsForTabWithLinked}
                        groups={groups}
                        getProfit={getHoldingProfitForTab}
                        summaryTabPortfolioTotals={summaryTabPortfolioTotals}
                        navbarHeight={navbarHeight}
                        filterBarHeight={filterBarHeight}
                        isGroupSummarySticky={isGroupSummarySticky}
                        setIsGroupSummarySticky={setIsGroupSummarySticky}
                        maskAmounts={maskAmounts}
                        setMaskAmounts={setMaskAmounts}
                        shouldShowMarketIndex={shouldShowMarketIndex}
                        summaryCardItems={summaryCardItems}
                        isMobile={isMobile}
                        startTransition={startTransition}
                        setCurrentTab={setCurrentTab}
                      />
                    ) : (
                      <GroupSummary
                        funds={displayFunds}
                        holdings={holdingsForTabWithLinked}
                        portfolioTabId={currentTab}
                        groups={groups}
                        getProfit={getHoldingProfitForTab}
                        summaryTotalsOverride={null}
                        stickyTop={navbarHeight + filterBarHeight + (isMobile ? -14 : 0)}
                        isSticky={isGroupSummarySticky}
                        onToggleSticky={(next) => setIsGroupSummarySticky(next)}
                        masked={maskAmounts}
                        onToggleMasked={() => setMaskAmounts((v) => !v)}
                        shouldShowMarketIndex={shouldShowMarketIndex}
                        navbarHeight={navbarHeight}
                      />
                    )}
                    {currentTab !== SUMMARY_TAB_ID && (
                      <>
                        {shouldShowGroupFundSearch && (
                          <SearchFund value={groupFundSearchTerm} onSearch={(next) => setGroupFundSearchTerm(next)} />
                        )}

                        {displayFunds.length === 0 ? (
                          <div className="glass" style={{ marginTop: 10 }}>
                            <Empty className="border-border/60">
                              <EmptyHeader>
                                <EmptyMedia variant="icon">
                                  <span className="text-3xl" aria-hidden="true">
                                    📂
                                  </span>
                                </EmptyMedia>
                                <EmptyTitle>未找到相关基金</EmptyTitle>
                                <EmptyDescription>
                                  试试搜索基金名称的部分关键词，或直接输入 6 位基金代码。
                                </EmptyDescription>
                              </EmptyHeader>
                            </Empty>
                          </div>
                        ) : (
                          <FundListView
                            viewMode={viewMode}
                            isMobile={isMobile}
                            isGroupSummarySticky={isGroupSummarySticky}
                            navbarHeight={navbarHeight}
                            filterBarHeight={filterBarHeight}
                            pcFundTableData={pcFundTableData}
                            userId={user?.id}
                            currentTab={currentTab}
                            groups={groups}
                            favorites={favorites}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                            sortRules={sortRules}
                            setSortBy={setSortBy}
                            setSortOrder={setSortOrder}
                            startTransition={startTransition}
                            handleReorder={handleReorder}
                            handleRemoveFundEntry={handleRemoveFundEntry}
                            removeFundsFromCurrentTabHandler={removeFundsFromCurrentTabHandler}
                            handleMoveFunds={handleMoveFunds}
                            pcBatchClearSelectionRef={pcBatchClearSelectionRef}
                            handleToggleFavoriteRow={handleToggleFavoriteRow}
                            handleHoldingAmountClickRow={handleHoldingAmountClickRow}
                            handleHoldingProfitClickRow={handleHoldingProfitClickRow}
                            triggerCustomSettingsSync={triggerCustomSettingsSync}
                            fundDetailDialogCloseRef={fundDetailDialogCloseRef}
                            maskAmounts={maskAmounts}
                            getFundCardPropsForRow={getFundCardPropsForRow}
                            openFundTagsEdit={openFundTagsEdit}
                            fundExtraDataByCode={fundExtraDataByCode}
                            fundDetailDrawerCloseRef={fundDetailDrawerCloseRef}
                            mobileBatchClearSelectionRef={mobileBatchClearSelectionRef}
                            handleFundCardDrawerOpenChange={handleFundCardDrawerOpenChange}
                            handleMobileSettingModalOpenChange={handleMobileSettingModalOpenChange}
                            displayFunds={displayFunds}
                            linkedHoldingsForAllFav={linkedHoldingsForAllFav}
                            todayStr={todayStr}
                            dcaPlansForTab={dcaPlansForTab}
                            holdingsForTabWithLinked={holdingsForTabWithLinked}
                            percentModes={percentModes}
                            todayPercentModes={todayPercentModes}
                            currentFundDailyEarnings={currentFundDailyEarnings}
                            valuationSeries={valuationSeries}
                            collapsedCodes={collapsedCodes}
                            collapsedTrends={collapsedTrends}
                            collapsedValuationTrends={collapsedValuationTrends}
                            collapsedEarnings={collapsedEarnings}
                            transactionsForTab={transactionsForTab}
                            theme={theme}
                            isTradingDay={isTradingDay}
                            getHoldingProfitForTab={getHoldingProfitForTab}
                            toggleFavorite={toggleFavorite}
                            openHoldingModal={openHoldingModal}
                            openActionModal={openActionModal}
                            openDataSourceModal={openDataSourceModal}
                            togglePercentMode={togglePercentMode}
                            toggleTodayPercentMode={toggleTodayPercentMode}
                            toggleCollapse={toggleCollapse}
                            toggleTrendCollapse={toggleTrendCollapse}
                            toggleValuationTrendCollapse={toggleValuationTrendCollapse}
                            toggleEarningsCollapse={toggleEarningsCollapse}
                            fundTagListsByCode={fundTagListsByCode}
                            groupTotalHoldingAmount={groupTotalHoldingAmount}
                          />
                        )}
                      </>
                    )}

                    {currentTab !== 'all' && currentTab !== 'fav' && currentTab !== SUMMARY_TAB_ID && (
                      <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="button-dashed"
                        onClick={() => setAddFundToGroupOpen(true)}
                        style={{
                          width: '100%',
                          height: '48px',
                          border: '2px dashed var(--border)',
                          background: 'transparent',
                          borderRadius: '12px',
                          color: 'var(--muted)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          marginTop: '16px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          fontSize: '14px',
                          fontWeight: 500
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--primary)';
                          e.currentTarget.style.color = 'var(--primary)';
                          e.currentTarget.style.background = 'rgba(34, 211, 238, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.color = 'var(--muted)';
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <PlusIcon width="18" height="18" />
                        <span>添加基金到此分组</span>
                      </motion.button>
                    )}
                  </>
                )}
              </div>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleFilesUpload}
            />

            <div className="footer">
              {!isMobile && (
                <>
                  <p style={{ marginBottom: 8 }}>
                    数据源：实时估值与重仓直连东方财富，仅供个人学习及参考使用。数据可能存在延迟，不作为任何投资建议
                  </p>
                  <p style={{ marginBottom: 12 }}>注：估算数据与真实结算数据会有1%左右误差，非股票型基金误差较大</p>
                  <div
                    style={{
                      marginTop: 12,
                      opacity: 0.8,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    <p style={{ margin: 0 }}>
                      遇到任何问题或需求建议可
                      <button
                        className="link-button"
                        onClick={() => {
                          if (!user?.id) {
                            sonnerToast.error('请先登录后再提交反馈');
                            return;
                          }
                          setFeedbackNonce((n) => n + 1);
                          setFeedbackOpen(true);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          cursor: 'pointer',
                          padding: '0 4px',
                          textDecoration: 'underline',
                          fontSize: 'inherit',
                          fontWeight: 600
                        }}
                      >
                        点此提交反馈
                      </button>
                      ，或
                      <button
                        className="link-button"
                        onClick={() => _ms({ weChatOpen: true })}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          cursor: 'pointer',
                          padding: '0 4px',
                          textDecoration: 'underline',
                          fontSize: 'inherit',
                          fontWeight: 600
                        }}
                      >
                        加入微信用户支持群
                      </button>
                    </p>
                    <button
                      onClick={() => setDonateOpen(true)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--muted)',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 8px',
                        borderRadius: '6px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--primary)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--muted)';
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span>☕</span>
                      <span>点此请作者喝杯咖啡</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          {hasVisitedMarketTab && (
            <div style={{ display: mainTab === 'market' ? 'contents' : 'none' }}>
              <MarketTab
                onAddFund={handleMarketTabAddFund}
                getFundCardProps={getFundCardPropsForRow}
                isActive={mainTab === 'market'}
              />
            </div>
          )}
        </>
      </div>
      {isMobile && (
        <MineTab
          visible={mainTab === 'mine'}
          user={user}
          userAvatar={userAvatar}
          lastSyncDisplay={lastSyncTime ? dayjs(lastSyncTime).format('MM-DD HH:mm') : null}
          onLogin={handleOpenLogin}
          onMyEarnings={() => setPortfolioEarningsOpen(true)}
          onTutorial={() => {
            if (isMobile) {
              setTutorialDrawerOpen(true);
            } else {
              window.open('https://www.yuque.com/u267605/ookgim/im06q8tembbld6im?singleDoc', '_blank');
            }
          }}
          onUpdateLog={() => setUpdateLogOpen(true)}
          onFeedback={() => {
            if (!user?.id) {
              sonnerToast.error('请先登录后再提交反馈');
              return;
            }
            setFeedbackNonce((n) => n + 1);
            setFeedbackOpen(true);
          }}
          onSponsorSupport={() => setDonateOpen(true)}
          onOpenWeChat={() => _ms({ weChatOpen: true })}
        />
      )}
      {/* 弹框渲染层 - 独立组件，订阅 useModalStore，不触发 page.jsx 重渲染 */}
      <ModalsLayer callbacksRef={modalCbRef} />
    </NavLayout>
  );
}
