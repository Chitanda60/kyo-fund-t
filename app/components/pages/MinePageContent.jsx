'use client';

import dayjs from 'dayjs';
import { toast as sonnerToast } from 'sonner';
import MineTab from '@/app/components/MineTab';
import { useAppRuntime } from '@/app/contexts/AppRuntimeContext';

// Render-only content for the "mine" main tab.
// State/handlers come from page.jsx via the `rt` runtime bundle (moves to context in Task 3).
export default function MinePageContent() {
  const {
    mainTab,
    isMobile,
    user,
    userAvatar,
    lastSyncTime,
    handleOpenLogin,
    setPortfolioEarningsOpen,
    setTutorialDrawerOpen,
    setUpdateLogOpen,
    setFeedbackNonce,
    setFeedbackOpen,
    setDonateOpen,
    _ms
  } = useAppRuntime();

  return (
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
  );
}
