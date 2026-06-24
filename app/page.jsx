'use client';

import HomePageContent from './components/pages/HomePageContent';

// Route content for `/`. Shared chrome (navbar/announcement/market index), all state,
// and ModalsLayer live in the persistent AppShell (app/layout.jsx); this page renders
// only the home portfolio content, which reads data/actions from AppRuntimeContext.
export default function HomePage() {
  return <HomePageContent />;
}
