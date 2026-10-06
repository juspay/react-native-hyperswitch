/*
 * Runtime entry for the package root. `src/index.ts` is the parallel type-only surface (tsc runs
 * with emitDeclarationOnly); the two must export the same names.
 *
 * ReScript packages skip this entry and use the modules directly via bs-dependencies.
 */

import { make as LoggerProviderImpl } from './LoggerContext.bs.js';
import { useLogger as useLoggerImpl, useApiLogger as useApiLoggerImpl } from './LoggerHook.bs.js';
import {
  createLogger as createLoggerImpl,
  generateSessionId as generateSessionIdImpl,
  safeErrorResponse as safeErrorResponseImpl,
  redactSecrets as redactSecretsImpl,
  validateEndpoint as validateEndpointImpl,
} from './Logger.bs.js';
import { CrashBoundary as CrashBoundaryImpl } from './CrashBoundary.mjs';

export const LoggerProvider = LoggerProviderImpl;
export const useLogger = useLoggerImpl;
export const useApiLogger = useApiLoggerImpl;

export const createLogger = createLoggerImpl;
export const generateSessionId = generateSessionIdImpl;
export const safeErrorResponse = safeErrorResponseImpl;
export const redactSecrets = redactSecretsImpl;
export const validateEndpoint = validateEndpointImpl;

export const CrashBoundary = CrashBoundaryImpl;
