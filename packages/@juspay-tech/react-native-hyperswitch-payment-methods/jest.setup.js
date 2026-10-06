/* global jest */
/* Every test gets the recording logger (src/__fixtures__/loggerMock.ts) instead of the real one. */
jest.mock('./src/telemetry/vendor/hyperswitch-logger', () =>
  jest.requireActual('./src/__fixtures__/loggerMock')
);
