/*
 * Recording stand-in for the vendored shared logger, installed for every test by jest.setup.js.
 * No test POSTs to the logging endpoint, so the tests that count fetch calls stay exact. It
 * records what payment-methods asks the logger to do; the sanitizers and the crash boundary are
 * the real ones. src/telemetry/__tests__/security.test.tsx unmocks it to inspect real requests.
 */
import type * as Logger from '../telemetry/vendor/hyperswitch-logger';

/* Declared locally rather than imported from @jest/globals: that import would load Node's types
   ahead of React Native's globals in `tsc` (this file sorts early) and break AbortSignal. */
declare const jest: { requireActual<T>(moduleName: string): T };
const actual = jest.requireActual<typeof Logger>(
  '../telemetry/vendor/hyperswitch-logger'
);

export type RecordedCall =
  | { method: 'configure'; config: Logger.loggerConfig }
  | { method: 'log'; event: Logger.logEvent }
  | { method: 'logApi'; event: Logger.apiLogEvent }
  | { method: 'logCrash'; error: unknown }
  | { method: 'dispose' };

export const recorded: RecordedCall[] = [];

export const createLogger = (): Logger.logger => ({
  configure: (config) => {
    recorded.push({ method: 'configure', config });
  },
  log: (event) => {
    recorded.push({ method: 'log', event });
  },
  logApi: (event) => {
    recorded.push({ method: 'logApi', event });
  },
  logCrash: (error) => {
    recorded.push({ method: 'logCrash', error });
  },
  dispose: () => {
    recorded.push({ method: 'dispose' });
  },
});

export const {
  generateSessionId,
  safeErrorResponse,
  redactSecrets,
  validateEndpoint,
  CrashBoundary,
  LoggerProvider,
  useLogger,
  useApiLogger,
} = actual;
