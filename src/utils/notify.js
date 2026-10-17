/**
 * Browser notifications for new consultation requests.
 *
 * Notifications only fire after the user grants permission from the
 * Consultations page. Nothing is requested automatically, and a browser
 * that does not support the API degrades to the in-app badge only.
 */

const SUPPORTED =
  typeof window !== 'undefined' && 'Notification' in window;

export function notificationsSupported() {
  return SUPPORTED;
}

export function notificationPermission() {
  return SUPPORTED ? Notification.permission : 'unsupported';
}

/** Resolves to the resulting permission ('granted' | 'denied' | 'default'). */
export async function requestNotificationPermission() {
  if (!SUPPORTED) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch (err) {
    return Notification.permission;
  }
}

/**
 * Shows a notification. Returns true when one was displayed; silent
 * otherwise — denied permission, an unsupported browser or a thrown
 * constructor must never break the caller.
 */
export function showNotification(title, body, tag) {
  if (!SUPPORTED || Notification.permission !== 'granted') return false;
  try {
    const options = { body, tag };
    if (document.visibilityState !== 'visible') options.silent = false;
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch (err) {
    return false;
  }
}
