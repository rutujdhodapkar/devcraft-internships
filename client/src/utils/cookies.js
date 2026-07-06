const PREFIX = "dc_";
const EXPIRY_DAYS = 30;

export function setCookie(key, value) {
  try {
    const json = JSON.stringify(value);
    const d = new Date();
    d.setDate(d.getDate() + EXPIRY_DAYS);
    document.cookie = `${PREFIX}${encodeURIComponent(key)}=${encodeURIComponent(json)}; expires=${d.toUTCString()}; path=/; SameSite=Lax`;
  } catch {}
}

export function getCookie(key) {
  try {
    const match = document.cookie.match(new RegExp(`(?:^| )${PREFIX}${encodeURIComponent(key)}=([^;]*)`));
    if (!match) return null;
    return JSON.parse(decodeURIComponent(match[1]));
  } catch { return null; }
}

export function removeCookie(key) {
  document.cookie = `${PREFIX}${encodeURIComponent(key)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
}

export function clearCookies() {
  const prefix = PREFIX;
  document.cookie.split(";").forEach(c => {
    const trimmed = c.trim();
    if (trimmed.startsWith(prefix)) {
      const eq = trimmed.indexOf("=");
      const name = eq > -1 ? trimmed.substring(0, eq) : trimmed;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
    }
  });
}
