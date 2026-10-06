/* Copied from shared/logger/dist by scripts/sync-logger.mjs. Do not edit: change shared/logger and run `yarn sync:logger`. */
import type { jsonValue } from './LoggerTypes.gen';
export { make as LoggerProvider } from './LoggerContext.gen';
export { useLogger, useApiLogger } from './LoggerHook.gen';
export { createLogger, generateSessionId, safeErrorResponse, redactSecrets, validateEndpoint, } from './Logger.gen';
export type { logger } from './Logger.gen';
export type { logType, logCategory, apiLogType, eventName, environment, overrideEndpoints, customEndpoints, loggerConfig, logEvent, apiLogEvent, jsonValue, } from './LoggerTypes.gen';
export interface CrashBoundaryProps {
    onCrash?: (error: jsonValue) => void;
    children?: React.ReactNode;
}
export declare const CrashBoundary: React.ComponentType<CrashBoundaryProps>;
