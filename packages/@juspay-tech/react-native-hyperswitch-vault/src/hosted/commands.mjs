/*
 * Commands from native code: tokenize and reset for a form; focus, blur and clear for one field.
 *
 * ONE ANSWER PER COMMAND. Whatever happens (no such form, no such field, an exception, a command
 * delivered twice), exactly one VAULT_COMMAND_RESULT goes back for a commandId, to the form's root.
 * The caller on the other side is a promise that must settle.
 */
import {
  tokenizeFailedWith,
  tokenizeIncompleteFieldSet,
  unknownOutcomeMessage,
} from '../VaultResult.bs.js';
import { COMMANDS, FIELD_COMMANDS, FormEvent } from './protocol.mjs';

const messageOf = (error) => (error instanceof Error ? error.message : 'The command failed.');

/*
 * `ok` says whether the command ran. A tokenize the vault refused still ran: its refusal is the result.
 *
 * A tokenize that THROWS is not a refusal. It may have failed after the request reached the vault,
 * and the card may be saved, so it is an unknown outcome, never "failed": the same answer the plain
 * <CardForm> gives when a request is cut off.
 */
export async function run(command, getForm) {
  const entry = getForm(command.formId);

  if (command.name === 'tokenize') {
    if (!entry) {
      return { ok: true, result: tokenizeIncompleteFieldSet(`No card form "${command.formId}" is open.`) };
    }
    try {
      return { ok: true, result: await entry.form.tokenize() };
    } catch {
      return { ok: true, result: tokenizeFailedWith('unknown_outcome', unknownOutcomeMessage) };
    }
  }

  if (!entry) return { ok: false, message: `No card form "${command.formId}" is open.` };

  if (command.name === 'reset') {
    entry.form.reset();
    return { ok: true };
  }

  if (FIELD_COMMANDS.includes(command.name)) {
    /* focus goes through the form, as <CardForm>'s focus(field) does; it needs no mounted handle. */
    if (command.name === 'focus') {
      entry.form.focus(command.elementType);
      return { ok: true };
    }
    const handle = entry.fields.get(command.elementType)?.();
    if (!handle) return { ok: false, message: `No "${command.elementType}" field is mounted.` };
    handle[command.name]();
    return { ok: true };
  }

  return { ok: false, message: `Unknown command "${command.name}".` };
}

/* How many answered commandIds are remembered, to drop a command that arrives twice. */
const REMEMBERED = 256;

/*
 * Starts listening. `bridge` is { onCommand(listener), emitForm(rootTag, eventName, payload) }.
 * Returns the function that stops listening.
 */
export function startCommands(bridge, getForm) {
  const seen = new Set();

  const answer = (command, outcome) =>
    bridge.emitForm(command.rootTag, FormEvent.CommandResult, {
      commandId: command.commandId,
      name: COMMANDS.includes(command.name) ? command.name : undefined,
      ...outcome,
    });

  return bridge.onCommand((command) => {
    if (!command || typeof command.commandId !== 'string' || seen.has(command.commandId)) return;
    seen.add(command.commandId);
    if (seen.size > REMEMBERED) seen.delete(seen.values().next().value);

    let pending;
    try {
      pending = run(command, getForm);
    } catch (error) {
      pending = Promise.resolve({ ok: false, message: messageOf(error) });
    }
    pending.then(
      (outcome) => answer(command, outcome),
      (error) => answer(command, { ok: false, message: messageOf(error) })
    );
  });
}
