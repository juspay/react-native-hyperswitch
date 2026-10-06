import * as logger from '../telemetry/vendor/hyperswitch-logger';
import type { RecordedCall } from './loggerMock';

/* What the mocked logger (loggerMock.ts) was asked to do, in order. Read through a normal import,
   not jest.requireMock: that keeps a separate registry, so it would be a second, empty instance. */
export function loggerCalls(): RecordedCall[] {
  return (logger as unknown as { recorded: RecordedCall[] }).recorded;
}

export function resetLoggerCalls(): void {
  loggerCalls().length = 0;
}

export interface LoggedEvent {
  eventName: string;
  value?: string;
  logType?: string;
  latency?: number;
  apiLogType?: string;
  statusCode?: string;
  url?: string;
  data?: unknown;
}

/* log() and logApi() calls flattened to the fields tests assert on. */
export function loggedEvents(): LoggedEvent[] {
  return loggerCalls().flatMap((call): LoggedEvent[] => {
    if (call.method === 'log') {
      const { eventName, value, logType, latency } = call.event;
      return [{ eventName, value, logType, latency }];
    }
    if (call.method === 'logApi') {
      const { eventName, apiLogType, statusCode, url, data, latency } =
        call.event;
      return [{ eventName, apiLogType, statusCode, url, data, latency }];
    }
    return [];
  });
}

export const eventNames = (): string[] =>
  loggedEvents().map((event) => event.eventName);
