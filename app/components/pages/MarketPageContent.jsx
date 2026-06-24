'use client';

import MarketTab from '@/app/components/MarketTab';
import { useAppRuntime } from '@/app/contexts/AppRuntimeContext';

// Render-only content for the "market" main tab.
// State/handlers come from page.jsx via the `rt` runtime bundle (moves to context in Task 3).
export default function MarketPageContent() {
  const { mainTab, handleMarketTabAddFund, getFundCardPropsForRow } = useAppRuntime();

  return (
    <div style={{ display: mainTab === 'market' ? 'contents' : 'none' }}>
      <MarketTab
        onAddFund={handleMarketTabAddFund}
        getFundCardProps={getFundCardPropsForRow}
        isActive={mainTab === 'market'}
      />
    </div>
  );
}
