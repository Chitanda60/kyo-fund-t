'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { toast as sonnerToast } from 'sonner';

import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { GridIcon, ListIcon, PlusIcon, SettingsIcon, SortIcon } from '@/app/components/common/Icons';
import EmptyStateCard from '@/app/components/fund/EmptyStateCard';
import SummaryTabContent from '@/app/components/fund/SummaryTabContent';
import GroupSummary from '@/app/components/fund/GroupSummary';
import SearchFund from '@/app/components/search/SearchFund';
import FundListView from '@/app/components/tables/FundListView';
import { SUMMARY_TAB_ID } from '@/app/constants';
import { useAppRuntime } from '@/app/contexts/AppRuntimeContext';

// Render-only content for the "home" main tab.
// State/handlers come from the persistent AppShell via AppRuntimeContext.
export default function HomePageContent() {
  const {
    filterBarRef,
    navbarHeight,
    canLeft,
    canRight,
    hasTabOverflow,
    showGroupDropdown,
    tabsRef,
    scrollAreaRef,
    scrollTabsLeftBtn,
    scrollTabsRightBtn,
    handleMouseDown,
    handleMouseLeaveOrUp,
    handleMouseMove,
    handleWheel,
    updateTabOverflow,
    showPortfolioSummaryTab,
    currentTab,
    handleTabClick,
    funds,
    favorites,
    groups,
    setGroupModalOpen,
    setGroupManageOpen,
    viewMode,
    applyViewMode,
    setSortSettingOpen,
    isMobile,
    mobileSortDisplayMode,
    pcSortDisplayMode,
    sortBy,
    startTransition,
    setSortBy,
    setSortOrder,
    sortRules,
    sortOrder,
    scopedFunds,
    setAddFundToGroupOpen,
    displayFunds,
    holdingsForTabWithLinked,
    getHoldingProfitForTab,
    summaryTabPortfolioTotals,
    filterBarHeight,
    isGroupSummarySticky,
    setIsGroupSummarySticky,
    maskAmounts,
    setMaskAmounts,
    shouldShowMarketIndex,
    summaryCardItems,
    setCurrentTab,
    shouldShowGroupFundSearch,
    groupFundSearchTerm,
    setGroupFundSearchTerm,
    pcFundTableData,
    user,
    handleReorder,
    handleRemoveFundEntry,
    removeFundsFromCurrentTabHandler,
    handleMoveFunds,
    pcBatchClearSelectionRef,
    handleToggleFavoriteRow,
    handleHoldingAmountClickRow,
    handleHoldingProfitClickRow,
    triggerCustomSettingsSync,
    fundDetailDialogCloseRef,
    getFundCardPropsForRow,
    openFundTagsEdit,
    fundExtraDataByCode,
    fundDetailDrawerCloseRef,
    mobileBatchClearSelectionRef,
    handleFundCardDrawerOpenChange,
    handleMobileSettingModalOpenChange,
    linkedHoldingsForAllFav,
    todayStr,
    dcaPlansForTab,
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
    toggleFavorite,
    openHoldingModal,
    openActionModal,
    openDataSourceModal,
    togglePercentMode,
    toggleTodayPercentMode,
    toggleCollapse,
    toggleTrendCollapse,
    toggleValuationTrendCollapse,
    toggleEarningsCollapse,
    fundTagListsByCode,
    groupTotalHoldingAmount,
    fileInputRef,
    handleFilesUpload,
    setFeedbackNonce,
    setFeedbackOpen,
    _ms,
    setDonateOpen
  } = useAppRuntime();

  const isGroupDropdownTabActive = currentTab === 'fav' || groups.some((g) => g.id === currentTab);

  return (
    <div style={{ display: 'contents' }}>
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
              <div
                className="tabs-scroll-wrapper"
                style={{
                  position: 'relative',
                  flex: 1,
                  minWidth: 0,
                  paddingLeft: !showGroupDropdown && !isMobile && hasTabOverflow ? 32 : 0,
                  paddingRight: !showGroupDropdown && !isMobile && hasTabOverflow ? 32 : 0,
                  transition: 'padding 0.2s ease'
                }}
              >
                <AnimatePresence>
                  {!showGroupDropdown && !isMobile && hasTabOverflow && (
                    <>
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8, y: '-50%', x: 0 }}
                        animate={{ opacity: 1, scale: 1, y: '-50%', x: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: '-50%', x: 0 }}
                        whileHover={canLeft ? { scale: 1.1, y: '-50%', x: 0 } : {}}
                        whileTap={canLeft ? { scale: 0.95, y: '-50%', x: 0 } : {}}
                        transition={{ duration: 0.15 }}
                        className={`tabs-scroll-btn left ${!canLeft ? 'opacity-30 cursor-not-allowed' : ''}`}
                        disabled={!canLeft}
                        onClick={scrollTabsLeftBtn}
                      >
                        <ChevronLeft size={16} />
                      </motion.button>
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8, y: '-50%', x: 0 }}
                        animate={{ opacity: 1, scale: 1, y: '-50%', x: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: '-50%', x: 0 }}
                        whileHover={canRight ? { scale: 1.1, y: '-50%', x: 0 } : {}}
                        whileTap={canRight ? { scale: 0.95, y: '-50%', x: 0 } : {}}
                        transition={{ duration: 0.15 }}
                        className={`tabs-scroll-btn right ${!canRight ? 'opacity-30 cursor-not-allowed' : ''}`}
                        disabled={!canRight}
                        onClick={scrollTabsRightBtn}
                      >
                        <ChevronRight size={16} />
                      </motion.button>
                    </>
                  )}
                </AnimatePresence>
                <div
                  className="tabs-scroll-area"
                  ref={scrollAreaRef}
                  data-mask-left={!showGroupDropdown && canLeft}
                  data-mask-right={!showGroupDropdown && canRight}
                  onMouseDown={handleMouseDown}
                  onMouseLeave={handleMouseLeaveOrUp}
                  onMouseUp={handleMouseLeaveOrUp}
                  onMouseMove={handleMouseMove}
                  onWheel={handleWheel}
                  onScroll={updateTabOverflow}
                >
                  <div className="tabs" ref={tabsRef}>
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
                      {!showGroupDropdown && (
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
                      )}
                      {!showGroupDropdown &&
                        groups.map((g) => (
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
                      {showGroupDropdown && (
                        <div
                          key="group-dropdown"
                          style={{ minWidth: isMobile ? 170 : 210, maxWidth: isMobile ? 230 : 300 }}
                        >
                          <Select
                            value={isGroupDropdownTabActive ? currentTab : ''}
                            onValueChange={(value) => handleTabClick(value)}
                          >
                            <SelectTrigger
                              className={cn(
                                'h-4 py-0 text-xs shadow-none',
                                isGroupDropdownTabActive && 'border-primary/70 text-primary ring-1 ring-primary/25'
                              )}
                              style={{
                                background: isGroupDropdownTabActive
                                  ? 'color-mix(in srgb, var(--primary) 12%, var(--card-bg))'
                                  : 'var(--card-bg)',
                                boxShadow: isGroupDropdownTabActive
                                  ? '0 0 0 1px rgba(255, 255, 255, 0.05), 0 6px 18px rgba(34, 211, 238, 0.12)'
                                  : undefined,
                                height: 32
                              }}
                              aria-label="选择分组"
                            >
                              <SelectValue placeholder="选择分组" />
                            </SelectTrigger>
                            <SelectContent
                              position="popper"
                              align="start"
                              className="max-h-none"
                              style={{
                                width: isMobile ? 230 : 300,
                                maxHeight: 'none'
                              }}
                            >
                              <SelectGroup>
                                <SelectItem value="fav">自选 ({favorites.size})</SelectItem>
                                {groups.map((g) => (
                                  <SelectItem key={g.id} value={g.id}>
                                    {g.name} ({g.codes.length})
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
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
                          <EmptyDescription>试试搜索基金名称的部分关键词，或直接输入 6 位基金代码。</EmptyDescription>
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
  );
}
