/*
 * The forms open in this engine, by formId. A form's hidden root registers it here; each field's
 * root finds it here. The two kinds of root share no React parent, so this map (and the detached
 * form it holds) is the only thing that joins them.
 *
 * The roots may start in either order, so a field root subscribes and renders once its form is
 * here, and renders nothing again when the form closes.
 */
const forms = new Map();
const listeners = new Set();

const tell = () => {
  for (const listener of [...listeners]) listener();
};

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getForm = (formId) => forms.get(formId);

/*
 * Registers `form` (a detached card form) under formId. Returns the function that closes exactly
 * this registration, or null when the id is already open: two hidden roots must never share a form.
 */
export function openForm(formId, form, rootTag) {
  if (forms.has(formId)) return null;
  const entry = { formId, form, rootTag, fields: new Map() };
  forms.set(formId, entry);
  tell();
  return () => {
    if (forms.get(formId) !== entry) return;
    forms.delete(formId);
    tell();
  };
}

/*
 * A mounted field tells its form how to reach it, for focus / blur / clear. `getHandle` is read
 * when a command arrives, so it always gives the field as it is then. Returns the detach function.
 */
export function attachField(formId, elementType, getHandle) {
  const entry = forms.get(formId);
  if (!entry) return () => {};
  entry.fields.set(elementType, getHandle);
  return () => {
    if (entry.fields.get(elementType) === getHandle) entry.fields.delete(elementType);
  };
}
