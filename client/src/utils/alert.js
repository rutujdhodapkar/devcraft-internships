let alertFn = null;

export function setAlertHandler(fn) {
  alertFn = fn;
}

export function showAlert(message, type) {
  if (alertFn) {
    alertFn(message, type || 'error');
  } else {
    window.alert(message);
  }
}
