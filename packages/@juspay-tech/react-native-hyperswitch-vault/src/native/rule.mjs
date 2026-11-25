/*
 * The part of "can the native path run here?" that is a judgement on plain data: what the vault's
 * native module reports about the app. Kept apart from availability.mjs so it can be tested
 * without React Native.
 */
import { PROTOCOL_VERSION, TESTED_REACT_NATIVE } from '../hosted/protocol.mjs';

export function supports(info) {
  return (
    typeof info === 'object' &&
    info !== null &&
    info.newArchitecture === true &&
    info.bundled === true &&
    info.protocolVersion === PROTOCOL_VERSION &&
    typeof info.reactNativeMinor === 'number' &&
    info.reactNativeMinor >= TESTED_REACT_NATIVE.from &&
    info.reactNativeMinor <= TESTED_REACT_NATIVE.to
  );
}
