/* TypeScript file generated from LoggerHook.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as LoggerHookJS from './LoggerHook.bs.js';

import type {apiLogEvent as LoggerTypes_apiLogEvent} from './LoggerTypes.gen';

import type {logEvent as LoggerTypes_logEvent} from './LoggerTypes.gen';

export const useLogger: () => (_1:LoggerTypes_logEvent) => void = LoggerHookJS.useLogger as any;

export const useApiLogger: () => (_1:LoggerTypes_apiLogEvent) => void = LoggerHookJS.useApiLogger as any;
