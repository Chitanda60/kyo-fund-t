'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';

import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { CloseIcon, MoonIcon, SunIcon } from '@/app/components/Icons';
import Announcement from '@/app/components/Announcement';
import SearchBar from '@/app/components/SearchBar';
import RefreshButton from '@/app/components/RefreshButton';
import UserMenu from '@/app/components/UserMenu';
import MarketIndexAccordion from '@/app/components/MarketIndexAccordion';
import githubImg from '@/app/assets/github.svg';
import HomePageContent from './HomePageContent';
import MarketPageContent from './MarketPageContent';
import MinePageContent from './MinePageContent';
import { useAppRuntime } from '@/app/contexts/AppRuntimeContext';

const UpdateChecker = dynamic(() => import('@/app/components/UpdateChecker'), { ssr: false });

// Shared chrome (announcement + navbar + market index) for the home/market panel,
// plus the three render-only main-tab content components. State comes from the
// persistent AppShell via AppRuntimeContext. Single-route behavior is preserved
// via the existing display:contents / visible guards.
export default function MainTabsContent() {
  const {
    mobileHomeTabVisible,
    refreshing,
    isSearchFocused,
    selectedFunds,
    toggleSelectFund,
    isSyncing,
    dropdownRef,
    inputRef,
    searchTerm,
    handleSearchInput,
    showDropdown,
    setShowDropdown,
    setIsSearchFocused,
    searchResults,
    isSearching,
    isScanning,
    handleScanClick,
    addFund,
    error,
    setIsUpdateModalOpen,
    isMobile,
    handleMobileSearchClick,
    refreshMs,
    manualRefresh,
    funds,
    refreshCycleStartRef,
    navbarRef,
    theme,
    handleThemeToggle,
    user,
    userAvatar,
    navbarHeight,
    lastSyncTime,
    syncUserConfig,
    setSettingsOpen,
    setPortfolioEarningsOpen,
    handleOpenLogin,
    handleLogout,
    setIsLogoutConfirmOpen,
    setTutorialDrawerOpen,
    setUpdateLogOpen,
    shouldShowMarketIndex,
    triggerCustomSettingsSync,
    hasVisitedMarketTab
  } = useAppRuntime();

  return (
    <>
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
          <HomePageContent />
          {hasVisitedMarketTab && <MarketPageContent />}
        </>
      </div>
      {isMobile && <MinePageContent />}
    </>
  );
}
