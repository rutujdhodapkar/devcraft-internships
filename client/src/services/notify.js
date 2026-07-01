const NOTIFY_EVENT = "devcraft-notify";

export function notify(message, type = "info", duration = 4000) {
  window.dispatchEvent(
    new CustomEvent(NOTIFY_EVENT, { detail: { message, type, duration } })
  );
}
