/*
 * Type-only surface for the package root; `src/index.mjs` supplies the runtime values. The two
 * must export the same names.
 */

/*
 * No `import ... from 'react'` anywhere in the published declarations: `React.*` below is the
 * global namespace @types/react declares, so a consumer's own @types/react is the only copy.
 */

import type { jsonValue } from './LoggerTypes.gen';

export { make as LoggerProvider } from './LoggerContext.gen';
export { useLogger, useApiLogger } from './LoggerHook.gen';
export {
  createLogger,
  generateSessionId,
  safeErrorResponse,
  redactSecrets,
  validateEndpoint,
} from './Logger.gen';
export type { logger } from './Logger.gen';
export type {
  logType,
  logCategory,
  apiLogType,
  eventName,
  environment,
  overrideEndpoints,
  customEndpoints,
  loggerConfig,
  logEvent,
  apiLogEvent,
  jsonValue,
} from './LoggerTypes.gen';

export interface CrashBoundaryProps {
  onCrash?: (error: jsonValue) => void;
  children?: React.ReactNode;
}

/* Reports a render crash in its subtree, then rethrows it unchanged. */
export declare const CrashBoundary: React.ComponentType<CrashBoundaryProps>;
