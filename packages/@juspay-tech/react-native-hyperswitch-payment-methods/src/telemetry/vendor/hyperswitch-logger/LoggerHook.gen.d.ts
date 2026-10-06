import type { apiLogEvent as LoggerTypes_apiLogEvent } from './LoggerTypes.gen';
import type { logEvent as LoggerTypes_logEvent } from './LoggerTypes.gen';
export declare const useLogger: () => (_1: LoggerTypes_logEvent) => void;
export declare const useApiLogger: () => (_1: LoggerTypes_apiLogEvent) => void;
