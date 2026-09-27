/** Public connection settings only. Never place secrets in this file.
 * Set apiBaseUrl to the future backend origin, e.g. https://api.your-school.org/v1.
 * Keep empty until the backend exists. See BACKEND_INTEGRATION.md.
 */
export const backendConfig = {
  apiBaseUrl: '',
  realtimeUrl: '',
  pollIntervalMs: 15000,
  requestTimeoutMs: 15000,
};
export const isConnected = () => Boolean(backendConfig.apiBaseUrl);

