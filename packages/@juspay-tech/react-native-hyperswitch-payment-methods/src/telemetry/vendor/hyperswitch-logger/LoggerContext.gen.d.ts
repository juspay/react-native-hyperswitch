import type { loggerConfig as LoggerTypes_loggerConfig } from './LoggerTypes.gen';
export type props<config, children> = {
    readonly config: config;
    readonly children: children;
};
export declare const make: React.ComponentType<{
    readonly config: LoggerTypes_loggerConfig;
    readonly children: React.ReactNode;
}>;
