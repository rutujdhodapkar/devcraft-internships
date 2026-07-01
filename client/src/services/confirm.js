const CONFIRM_EVENT = "devcraft-confirm";
const RESOLVE_EVENT = "devcraft-confirm-resolve";

let _resolve = null;

export function confirmAction(message) {
  return new Promise((resolve) => {
    _resolve = resolve;
    window.dispatchEvent(
      new CustomEvent(CONFIRM_EVENT, { detail: { message } })
    );
  });
}

export function resolveConfirm(value) {
  if (_resolve) {
    _resolve(value);
    _resolve = null;
  }
  window.dispatchEvent(new CustomEvent(RESOLVE_EVENT));
}
