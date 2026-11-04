import { environmentOf } from '../session/config';
import { trimTrailingSlashes } from '../session/endpoint';
import { DEFAULT_BASE_URL } from '../session/fetchVaultDetails';

const LOGS_PATH = '/logs/sdk';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/* Where the logs go, as hyperswitch-client-core's GlobalHooks.getUrl(~urlType=#logs) and the
   vault: with overrideEndpoints, its customLoggingEndpoint; without, commonEndpoint's logs path;
   else the environment's. commonEndpoint is the API base the session lookup calls, which already
   holds client-core's /api. A blank logging endpoint sends no logs. */
export function loggingUrl(
  environment: unknown,
  customEndpoints: unknown
): string | undefined {
  const custom = isRecord(customEndpoints) ? customEndpoints : undefined;
  const override =
    custom && isRecord(custom.overrideEndpoints)
      ? custom.overrideEndpoints
      : undefined;
  const configured = override
    ? typeof override.customLoggingEndpoint === 'string'
      ? override.customLoggingEndpoint
      : undefined
    : typeof custom?.commonEndpoint === 'string'
      ? trimTrailingSlashes(custom.commonEndpoint.trim()) + LOGS_PATH
      : undefined;
  if (configured === undefined) {
    return DEFAULT_BASE_URL[environmentOf(environment)] + LOGS_PATH;
  }
  const url = configured.trim();
  return url === '' ? undefined : url;
}
