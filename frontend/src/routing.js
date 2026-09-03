export function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function tokenRol(token) {
  const claims = decodeJwt(token);
  return claims?.rol || null;
}

export function navigate(path) {
  window.location.hash = path.startsWith('#') ? path : `#${path}`;
}

export function currentPath() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const withoutQuery = raw.split('?')[0];
  const normalized = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  return normalized.replace(/\/$/, '') || '/';
}
