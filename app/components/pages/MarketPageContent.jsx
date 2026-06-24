'use client';

import MarketTab from '@/app/components/MarketTab';

// Render-only content for the "market" main tab.
// State/handlers come from page.jsx via the `rt` runtime bundle (moves to context in Task 3).
export default function MarketPageContent({ rt }) {
  const { mainTab, handleMarketTabAddFund, getFundCardPropsForRow } = rt;

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
