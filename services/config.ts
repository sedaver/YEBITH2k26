/** Public API addresses only; all credentials stay on the Node server. */
const env=(import.meta as ImportMeta & {env:Record<string,string|undefined>}).env;
export const backendConfig = {
  apiBaseUrl: env.VITE_API_BASE_URL ?? '/api',
  realtimeUrl: env.VITE_REALTIME_URL ?? ((env.VITE_API_BASE_URL ?? '/api')+'/live'),
  pollIntervalMs: 15000,
  requestTimeoutMs: 15000,
};
export const isConnected = () => Boolean(backendConfig.apiBaseUrl);

