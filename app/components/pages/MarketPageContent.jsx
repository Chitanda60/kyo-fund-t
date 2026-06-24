'use client';

import MarketTab from '@/app/components/MarketTab';
import { useAppRuntime } from '@/app/contexts/AppRuntimeContext';

// Render-only content for the "market" main tab. Routed at /market, so it mounts
// only when active; state/handlers come from the persistent AppShell via AppRuntimeContext.
export default function MarketPageContent() {
  const { handleMarketTabAddFund, getFundCardPropsForRow } = useAppRuntime();

  return <MarketTab onAddFund={handleMarketTabAddFund} getFundCardProps={getFundCardPropsForRow} isActive />;
}
