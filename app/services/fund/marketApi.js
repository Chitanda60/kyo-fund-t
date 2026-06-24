import { isString } from 'lodash';

export const fetchShanghaiIndexDate = async () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://qt.gtimg.cn/q=sh000001&_t=${Date.now()}`;
    let done = false;
    const cleanup = () => {
      done = true;
      if (timer) clearTimeout(timer);
      if (document.body.contains(script)) document.body.removeChild(script);
    };
    const timer = setTimeout(() => {
      if (done) return;
      cleanup();
      reject(new Error('数据请求超时'));
    }, 10000);

    script.onload = () => {
      if (done) return;
      const data = window.v_sh000001;
      let dateStr = null;
      if (data) {
        const parts = data.split('~');
        if (parts.length > 30) {
          dateStr = parts[30].slice(0, 8);
        }
      }
      cleanup();
      resolve(dateStr);
    };
    script.onerror = () => {
      if (done) return;
      cleanup();
      reject(new Error('指数数据加载失败'));
    };
    document.body.appendChild(script);
  });
};

/** 大盘指数项：name, code, price, change, changePercent
 *  同时用于：
 *  - qt.gtimg.cn 实时快照（code 用于 q= 参数，varKey 为全局变量名）
 *  - 分时 mini 图（code 传给 minute/query，当不支持分时时会自动回退占位折线）
 *
 *  参照产品图：覆盖主要 A 股宽基 + 创业/科创 + 部分海外与港股指数。
 */
const MARKET_INDEX_KEYS = [
  // 行 1：上证 / 深证
  { code: 'sh000001', varKey: 'v_sh000001', name: '上证指数' },
  { code: 'sh000016', varKey: 'v_sh000016', name: '上证50' },
  { code: 'sz399001', varKey: 'v_sz399001', name: '深证成指' },
  { code: 'sz399330', varKey: 'v_sz399330', name: '深证100' },

  // 行 2：北证 / 沪深300 / 创业板
  { code: 'bj899050', varKey: 'v_bj899050', name: '北证50' },
  { code: 'sh000300', varKey: 'v_sh000300', name: '沪深300' },
  { code: 'sz399006', varKey: 'v_sz399006', name: '创业板指' },
  { code: 'sz399102', varKey: 'v_sz399102', name: '创业板综' },

  // 行 3：创业板 50 / 科创
  { code: 'sz399673', varKey: 'v_sz399673', name: '创业板50' },
  { code: 'sh000688', varKey: 'v_sh000688', name: '科创50' },
  { code: 'sz399005', varKey: 'v_sz399005', name: '中小100' },

  // 行 4：中证系列
  { code: 'sh000905', varKey: 'v_sh000905', name: '中证500' },
  { code: 'sh000906', varKey: 'v_sh000906', name: '中证800' },
  { code: 'sh000852', varKey: 'v_sh000852', name: '中证1000' },
  { code: 'sh000903', varKey: 'v_sh000903', name: '中证A100' },

  // 行 5：等权 / 国证 / 纳指
  { code: 'sh000932', varKey: 'v_sh000932', name: '500等权' },
  { code: 'sz399303', varKey: 'v_sz399303', name: '国证2000' },
  { code: 'usIXIC', varKey: 'v_usIXIC', name: '纳斯达克' },
  { code: 'usNDX', varKey: 'v_usNDX', name: '纳斯达克100' },

  // 行 6：美股三大 + 恒生
  { code: 'usINX', varKey: 'v_usINX', name: '标普500' },
  { code: 'usDJI', varKey: 'v_usDJI', name: '道琼斯' },
  { code: 'hkHSI', varKey: 'v_hkHSI', name: '恒生指数' },
  { code: 'hkHSTECH', varKey: 'v_hkHSTECH', name: '恒生科技指数' },

  // 行 7：欧洲三大股指
  { code: 'gzFTSE', varKey: 'v_gzFTSE', name: '富时100' },
  { code: 'gzFCHI', varKey: 'v_gzFCHI', name: 'CAC40' },
  { code: 'gzGDAXI', varKey: 'v_gzGDAXI', name: '德国DAX' },

  // 行 8：日本股指
  { code: 'gzN225', varKey: 'v_gzN225', name: '日经225' },
  { code: 'gzTPX', varKey: 'v_gzTPX', name: '东证指数' },

  // 行 9：韩国股指
  { code: 'gzKS11', varKey: 'v_gzKS11', name: '韩国综合' },
  { code: 'gzKOSDAQ', varKey: 'v_gzKOSDAQ', name: '韩国创业板' }
];

function parseIndexRaw(data) {
  if (!data || !isString(data)) return null;
  const parts = data.split('~');
  if (parts.length < 33) return null;
  const name = parts[1] || '';
  const price = parseFloat(parts[3], 10);
  const change = parseFloat(parts[31], 10);
  const changePercent = parseFloat(parts[32], 10);
  if (Number.isNaN(price)) return null;
  return {
    name,
    price: Number.isFinite(price) ? price : 0,
    change: Number.isFinite(change) ? change : 0,
    changePercent: Number.isFinite(changePercent) ? changePercent : 0
  };
}

function parseGlobalIndexRaw(data) {
  if (!data || !isString(data)) return null;
  const parts = data.split('~');
  if (parts.length < 6) return null;
  const name = parts[1] || '';
  const price = parseFloat(parts[3], 10);
  const change = parseFloat(parts[4], 10);
  const changePercent = parseFloat(parts[5], 10);
  if (Number.isNaN(price)) return null;
  return {
    name,
    price: Number.isFinite(price) ? price : 0,
    change: Number.isFinite(change) ? change : 0,
    changePercent: Number.isFinite(changePercent) ? changePercent : 0
  };
}

export const fetchMarketIndices = async () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return [];
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const codes = MARKET_INDEX_KEYS.map((item) => item.code).join(',');
    script.src = `https://qt.gtimg.cn/q=${codes}&_t=${Date.now()}`;
    let done = false;
    const cleanup = () => {
      done = true;
      if (timer) clearTimeout(timer);
      if (document.body.contains(script)) document.body.removeChild(script);
    };
    const timer = setTimeout(() => {
      if (done) return;
      cleanup();
      reject(new Error('数据请求超时'));
    }, 10000);

    script.onload = () => {
      if (done) return;
      const list = MARKET_INDEX_KEYS.map(({ name: defaultName, varKey, code }) => {
        const raw = window[varKey];
        const isGlobal = code.startsWith('gz');
        const parsed = isGlobal ? parseGlobalIndexRaw(raw) : parseIndexRaw(raw);
        if (!parsed) return { name: defaultName, code: '', price: 0, change: 0, changePercent: 0 };
        return { ...parsed, name: defaultName, code: varKey.replace('v_', '') };
      });
      cleanup();
      resolve(list);
    };
    script.onerror = () => {
      if (done) return;
      cleanup();
      reject(new Error('指数数据加载失败'));
    };
    document.body.appendChild(script);
  });
};
