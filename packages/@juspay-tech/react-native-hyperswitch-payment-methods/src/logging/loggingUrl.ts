import { environmentOf } from '../session/config';
import { trimTrailingSlashes } from '../session/endpoint';
import { DEFAULT_BASE_URL } from '../session/fetchVaultDetails';

const LOGS_PATH = '/logs/sdk';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/* A string field that holds something: a missing, non-string or blank value is not passed. */
function passed(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined;
}

/* Where the logs go:
   1. customLoggingEndpoint, when passed: that URL;
   2. else commonEndpoint, when passed: its logs path. commonEndpoint is the API base the session
      lookup calls, which already holds client-core's /api;
   3. else customBackendEndpoint, when passed: no logs, as client-core's GlobalHooks.getLoggingUrl,
      so a merchant with its own backend never sends logs to Hyperswitch;
   4. else Hyperswitch for the environment.
   A blank value counts as not passed. */
export function loggingUrl(
  environment: unknown,
  customEndpoints: unknown
): string | undefined {
  const custom = isRecord(customEndpoints) ? customEndpoints : undefined;
  const override =
    custom && isRecord(custom.overrideEndpoints)
      ? custom.overrideEndpoints
      : undefined;
  const logging = passed(override?.customLoggingEndpoint);
  if (logging !== undefined) return logging;
  const common = passed(custom?.commonEndpoint);
  if (common !== undefined) return trimTrailingSlashes(common) + LOGS_PATH;
  if (passed(override?.customBackendEndpoint) !== undefined) return undefined;
  return DEFAULT_BASE_URL[environmentOf(environment)] + LOGS_PATH;
}
