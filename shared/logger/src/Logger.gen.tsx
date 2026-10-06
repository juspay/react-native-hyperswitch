/* TypeScript file generated from Logger.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as LoggerJS from './Logger.bs.js';

import type {apiLogEvent as LoggerTypes_apiLogEvent} from './LoggerTypes.gen';

import type {environment as LoggerTypes_environment} from './LoggerTypes.gen';

import type {jsonValue as LoggerTypes_jsonValue} from './LoggerTypes.gen';

import type {logEvent as LoggerTypes_logEvent} from './LoggerTypes.gen';

import type {loggerConfig as LoggerTypes_loggerConfig} from './LoggerTypes.gen';

export type logger = {
  readonly configure: (_1:LoggerTypes_loggerConfig) => void; 
  readonly log: (_1:LoggerTypes_logEvent) => void; 
  readonly logApi: (_1:LoggerTypes_apiLogEvent) => void; 
  readonly logCrash: (_1:LoggerTypes_jsonValue) => void; 
  readonly dispose: () => void
};

export const createLogger: () => logger = LoggerJS.createLogger as any;

export const generateSessionId: () => string = LoggerJS.generateSessionId as any;

export const safeErrorResponse: (_1:LoggerTypes_jsonValue) => LoggerTypes_jsonValue = LoggerJS.safeErrorResponse as any;

export const redactSecrets: (_1:string) => string = LoggerJS.redactSecrets as any;

export const validateEndpoint: (url:string, environment:LoggerTypes_environment) => (undefined | string) = LoggerJS.validateEndpoint as any;
