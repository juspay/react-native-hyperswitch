import type { apiLogEvent as LoggerTypes_apiLogEvent } from './LoggerTypes.gen';
import type { environment as LoggerTypes_environment } from './LoggerTypes.gen';
import type { jsonValue as LoggerTypes_jsonValue } from './LoggerTypes.gen';
import type { logEvent as LoggerTypes_logEvent } from './LoggerTypes.gen';
import type { loggerConfig as LoggerTypes_loggerConfig } from './LoggerTypes.gen';
export type logger = {
    readonly configure: (_1: LoggerTypes_loggerConfig) => void;
    readonly log: (_1: LoggerTypes_logEvent) => void;
    readonly logApi: (_1: LoggerTypes_apiLogEvent) => void;
    readonly logCrash: (_1: LoggerTypes_jsonValue) => void;
    readonly dispose: () => void;
};
export declare const createLogger: () => logger;
export declare const generateSessionId: () => string;
export declare const safeErrorResponse: (_1: LoggerTypes_jsonValue) => LoggerTypes_jsonValue;
export declare const redactSecrets: (_1: string) => string;
export declare const validateEndpoint: (url: string, environment: LoggerTypes_environment) => (undefined | string);
