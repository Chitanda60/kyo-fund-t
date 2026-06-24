import * as qk from '../../lib/query-keys';
import { getQueryClient } from '../../lib/get-query-client';
import { ONE_DAY_MS } from '@/app/constants';

export const searchFunds = async (val) => {
  const normalized = String(val || '').trim();
  if (!normalized) return [];
  if (typeof window === 'undefined' || typeof document === 'undefined') return [];

  const qc = getQueryClient();
  try {
    return await qc.fetchQuery({
      queryKey: qk.fundSearch(normalized),
      queryFn: async () => {
        const callbackName = `SuggestData_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(normalized)}&callback=${callbackName}&_=${Date.now()}`;

        return new Promise((resolve, reject) => {
          let done = false;
          const cleanup = () => {
            done = true;
            if (timer) clearTimeout(timer);
            if (document.body.contains(script)) document.body.removeChild(script);
          };

          const timer = setTimeout(() => {
            if (done) return;
            cleanup();
            delete window[callbackName];
            reject(new Error('搜索请求超时'));
          }, 10000);

          window[callbackName] = (data) => {
            if (done) return;
            let results = [];
            if (data && data.Datas) {
              results = data.Datas.filter(
                (d) => d.CATEGORY === 700 || d.CATEGORY === '700' || d.CATEGORYDESC === '基金'
              );
            }
            cleanup();
            delete window[callbackName];
            resolve(results);
          };

          const script = document.createElement('script');
          script.src = url;
          script.async = true;
          script.onload = () => {
            // Callback usually handles cleanup, but onload is a backup
          };
          script.onerror = () => {
            if (done) return;
            cleanup();
            delete window[callbackName];
            reject(new Error('搜索请求失败'));
          };
          document.body.appendChild(script);
        });
      },
      staleTime: ONE_DAY_MS
    });
  } catch (e) {
    return [];
  }
};
