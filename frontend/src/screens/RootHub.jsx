import { useState } from 'react'
import { navigate } from '../routing'
import { MY_ACCOUNT } from '../myAccount'
import { AppIcon } from '../components/AppIcon'

export default function RootHub({
  apiOk,
  online,
  session,
  onGoLogin,
  onContinue,
  onLogout,
  onQuickLogin,
  onReloadDemo,
}) {
  const loggedIn = Boolean(session?.access_token)
  const rol = session?.rol
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  async function enter(portal) {
    if (loggedIn && rol === portal) {
      navigate(portal === 'empresa' ? '/empresa' : '/productor')
      return
    }
    setBusy(portal)
    setError(null)
    try {
      await onQuickLogin(portal)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="hub-shell light-hub">
      <header className="hub-hero">
        <div className="hub-brand-row">
          <AppIcon name="logo" alt="" className="hub-logo-img" />
          <strong>pencolab</strong>
        </div>
        <h1>Elige tu aplicación</h1>
        <p>
          Campo en el teléfono · métricas en la empresa. Al entrar se cargan{' '}
          <strong>datos de ejemplo Carchi</strong> para recorrer todas las pantallas.
        </p>
        <div className="hub-status">
          <span className={online ? 'ok' : 'off'}>{online ? 'Online' : 'Offline'}</span>
          <span className={apiOk ? 'ok' : 'off'}>API {apiOk ? 'lista' : 'local'}</span>
        </div>
      </header>

      <main className="hub-main">
        {error && <div className="m-toast warn">{error}</div>}

        {loggedIn && (
          <div className="hub-session">
            <p>
              Sesión: <strong>{session.email}</strong>
            </p>
            <div className="hub-session-actions">
              <button type="button" className="hub-cta-btn" onClick={onContinue}>
                Continuar
              </button>
              {onReloadDemo && (
                <button type="button" className="hub-ghost-btn" onClick={onReloadDemo}>
                  Recargar datos demo
                </button>
              )}
              <button type="button" className="hub-ghost-btn" onClick={onLogout}>
                Salir
              </button>
            </div>
          </div>
        )}

        <section className="hub-apps" aria-label="Aplicaciones">
          <button
            type="button"
            className="hub-app-card"
            disabled={busy !== null}
            onClick={() => enter('productor')}
          >
            <span className="hub-app-ico soil">
              <AppIcon name="plantar" alt="" />
            </span>
            <div>
              <strong>Agricultor</strong>
              <span>Siembra · bitácora · CO₂</span>
            </div>
            <em>{busy === 'productor' ? '…' : 'Abrir'}</em>
          </button>

          <button
            type="button"
            className="hub-app-card"
            disabled={busy !== null}
            onClick={() => enter('empresa')}
          >
            <span className="hub-app-ico biz">
              <AppIcon name="empresa" alt="" />
            </span>
            <div>
              <strong>Empresa</strong>
              <span>Dashboard · mapa · alertas</span>
            </div>
            <em>{busy === 'empresa' ? '…' : 'Abrir'}</em>
          </button>
        </section>

        <p className="hub-hint">
          Dylan · misma clave · {MY_ACCOUNT.password}
        </p>

        <button type="button" className="hub-ghost-btn wide" onClick={() => onGoLogin('productor')}>
          Otra cuenta
        </button>
      </main>
    </div>
  )
}
