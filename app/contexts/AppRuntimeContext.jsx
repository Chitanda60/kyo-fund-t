'use client';

import { createContext, useContext } from 'react';

const AppRuntimeStateContext = createContext(null);
const AppRuntimeActionsContext = createContext(null);

export function AppRuntimeProvider({ state, actions, children }) {
  return (
    <AppRuntimeActionsContext.Provider value={actions}>
      <AppRuntimeStateContext.Provider value={state}>{children}</AppRuntimeStateContext.Provider>
    </AppRuntimeActionsContext.Provider>
  );
}

export function useAppRuntimeState() {
  const value = useContext(AppRuntimeStateContext);
  if (!value) {
    throw new Error('useAppRuntimeState must be used within AppRuntimeProvider');
  }
  return value;
}

export function useAppRuntimeActions() {
  const value = useContext(AppRuntimeActionsContext);
  if (!value) {
    throw new Error('useAppRuntimeActions must be used within AppRuntimeProvider');
  }
  return value;
}

export function useAppRuntime() {
  return {
    ...useAppRuntimeState(),
    ...useAppRuntimeActions()
  };
}
