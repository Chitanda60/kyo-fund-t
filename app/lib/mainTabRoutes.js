export const MAIN_TAB_IDS = {
  HOME: 'home',
  MARKET: 'market',
  MINE: 'mine'
};

export const MAIN_TAB_ROUTES = {
  [MAIN_TAB_IDS.HOME]: '/',
  [MAIN_TAB_IDS.MARKET]: '/market',
  [MAIN_TAB_IDS.MINE]: '/mine'
};

export function getMainTabFromPathname(pathname) {
  if (pathname && pathname.startsWith('/market')) return MAIN_TAB_IDS.MARKET;
  if (pathname && pathname.startsWith('/mine')) return MAIN_TAB_IDS.MINE;
  return MAIN_TAB_IDS.HOME;
}
