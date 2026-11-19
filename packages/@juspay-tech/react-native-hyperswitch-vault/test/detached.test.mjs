// The detached card form's two shared pieces that hold no card: its settings and its logger.
// Runs on the ReScript output (`rescript` first). The form itself needs a React renderer and
// React Native, so it is exercised where those exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeSettings } from '../src/detachedSettings.mjs';
import * as DetachedCardLink from '../src/DetachedCardLink.bs.js';

const LOG_URL = 'https://app.hyperswitch.io/api/logs/sdk';

test('settings: the defaults are a <CardForm>\'s, and the environment is read as the web spells it', () => {
  assert.equal(makeSettings().get().environment, 'PROD');
  assert.equal(makeSettings({ environment: 'sandbox' }).get().environment, 'SANDBOX');
  const settings = makeSettings({ locale: 'fr', disabled: true, enabledCardSchemes: ['visa'] }).get();
  assert.equal(settings.locale, 'fr');
  assert.equal(settings.disabled, true);
  assert.deepEqual(settings.enabledCardSchemes, ['visa']);
  assert.equal(settings.appearance, undefined);
});

test('settings: the callbacks are not settings, so replacing one tells no root', () => {
  const first = () => {};
  const second = () => {};
  const settings = makeSettings({ onChange: first });
  let told = 0;
  settings.subscribe(() => told++);
  assert.equal('onChange' in settings.get(), false);
  settings.update({ onChange: second });
  assert.equal(told, 0);
  assert.equal(settings.callbacks().onChange, second);
});

test('settings: get() is the same object until a setting really changes', () => {
  const settings = makeSettings({ appearance: { variables: { colorText: '#000' } } });
  const before = settings.get();
  assert.equal(settings.get(), before);

  let told = 0;
  settings.subscribe(() => told++);
  settings.update({ appearance: { variables: { colorText: '#000' } } });
  assert.equal(told, 0, 'an equal appearance, rebuilt by the caller, is not a change');
  assert.equal(settings.get(), before);

  settings.update({ appearance: { variables: { colorText: '#fff' } } });
  assert.equal(told, 1);
  assert.notEqual(settings.get(), before);
  assert.equal(settings.get().appearance.variables.colorText, '#fff');
});

test('settings: update merges, keeps what it was not given, and undefined returns a key to its default', () => {
  const vaultDetails = { vaultType: 'hyperswitch', vaultData: { sdkAuthorization: 'abc' } };
  const settings = makeSettings({ vaultDetails, locale: 'fr', environment: 'sandbox' });
  settings.update({ locale: 'de' });
  assert.equal(settings.get().locale, 'de');
  assert.equal(settings.get().vaultDetails, vaultDetails, 'an untouched setting keeps its object');
  assert.equal(settings.get().environment, 'SANDBOX');

  settings.update({ locale: undefined, environment: undefined });
  assert.equal(settings.get().locale, undefined);
  assert.equal(settings.get().environment, 'PROD');
});

test('settings: every subscribed root is told once per change, and not after it unsubscribes', () => {
  const settings = makeSettings();
  const told = { host: 0, number: 0 };
  settings.subscribe(() => told.host++);
  const leave = settings.subscribe(() => told.number++);
  settings.update({ disabled: true });
  leave();
  settings.update({ disabled: false });
  assert.deepEqual(told, { host: 2, number: 1 });
});

test('logger: every root of one form gets the same logger, so its logs carry one session_id', () => {
  const link = DetachedCardLink.make();
  const fromHost = DetachedCardLink.loggerFor(link, LOG_URL, 'android');
  const fromField = DetachedCardLink.loggerFor(link, LOG_URL, 'android');
  assert.equal(fromField, fromHost);
  assert.equal(fromField.sessionId, fromHost.sessionId);
});

test('logger: a new logging URL gets a new logger, and two forms never share one', () => {
  const link = DetachedCardLink.make();
  const first = DetachedCardLink.loggerFor(link, LOG_URL, 'android');
  const moved = DetachedCardLink.loggerFor(link, 'https://eu.hyperswitch.io/api/logs/sdk', 'android');
  assert.notEqual(moved, first);
  assert.equal(DetachedCardLink.loggerFor(link, 'https://eu.hyperswitch.io/api/logs/sdk', 'android'), moved);

  const silent = DetachedCardLink.loggerFor(link, undefined, 'android');
  assert.equal(silent.url, undefined);
  assert.equal(DetachedCardLink.loggerFor(link, undefined, 'android'), silent);

  const other = DetachedCardLink.loggerFor(DetachedCardLink.make(), LOG_URL, 'android');
  assert.notEqual(other, first);
});
