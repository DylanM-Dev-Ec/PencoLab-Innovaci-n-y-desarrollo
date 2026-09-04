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
  const next = path.startsWith('#') ? path : `#${path}`
  const changing = window.location.hash !== next
  window.location.hash = next
  // Si el hash no cambia, hashchange no dispara: igual subimos.
  if (!changing) scrollRouteToTop()
}

export function currentPath() {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  const withoutQuery = raw.split('?')[0]
  const normalized = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`
  return normalized.replace(/\/$/, '') || '/'
}

/** Al cambiar de pestaña/pantalla, volver al inicio del contenido. */
export function scrollRouteToTop() {
  const jump = () => {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    document.querySelectorAll('.content, .b2b-body, .b2b-main, main, .m-app').forEach((el) => {
      el.scrollTop = 0
    })
  }
  jump()
  requestAnimationFrame(jump)
  setTimeout(jump, 40)
}
