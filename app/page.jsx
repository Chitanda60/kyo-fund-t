'use client';

import MainTabsContent from './components/pages/MainTabsContent';

// Route content for `/`. All runtime state/effects/handlers live in the persistent
// AppShell (mounted from app/layout.jsx); this page renders only the main-tab content,
// which reads data/actions from AppRuntimeContext. Single-route phase: MainTabsContent
// still renders home/market/mine via the existing hidden-by-style guards.
export default function HomePage() {
  return <MainTabsContent />;
}
