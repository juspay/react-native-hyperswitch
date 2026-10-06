import type { HyperswitchEnvironment } from './fetchVaultDetails';

/* The vault's rule for a backend URL, applied to this package's own session lookup: https, or
   http to a loopback host outside PROD; no credentials, query or hash. Matched by pattern, as the
   vault does, since React Native's URL getters throw before 0.80. */
const ENDPOINT =
  /^(https?):\/\/([A-Za-z0-9.-]+|\[[0-9A-Fa-f:.]+\])(:[0-9]{1,5})?(\/[^\s?#@\\]*)?$/i;

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set([
  'localhost',
  '127.0.0.1',
  '10.0.2.2',
]);

/* A loop rather than /\/+$/, which backtracks quadratically on a URL with many slashes. */
function trimTrailingSlashes(text: string): string {
  let end = text.length;
  while (end > 0 && text[end - 1] === '/') end -= 1;
  return text.slice(0, end);
}

/* The URL normalised (lower-case scheme and host, no trailing slash), or undefined when it must
   not be called. */
export function validateEndpoint(
  url: string,
  environment: HyperswitchEnvironment
): string | undefined {
  const match = ENDPOINT.exec(url.trim());
  if (!match) return undefined;
  const scheme = (match[1] ?? '').toLowerCase();
  const host = (match[2] ?? '').toLowerCase();
  const cleartext =
    (environment === 'SANDBOX' || environment === 'INTEG') &&
    LOOPBACK_HOSTS.has(host);
  if (scheme !== 'https' && !(scheme === 'http' && cleartext)) return undefined;
  return `${scheme}://${host}${match[3] ?? ''}${trimTrailingSlashes(match[4] ?? '')}`;
}
