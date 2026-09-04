import { useState } from 'react'
import { navigate } from '../routing'
import { MY_ACCOUNT } from '../myAccount'
import { AppIcon } from '../components/AppIcon'

const GUIAS = [
  {
    id: 'ph',
    titulo: 'pH del suelo',
    corto: 'Acidez de la tierra',
    texto:
      'Indica qué tan ácida o alcalina está tu tierra. El penco se desarrolla bien entre 6 y 7. Si está bajo de 6, conviene aplicar cal y composta. Si pasa de 8, yeso o azufre.',
  },
  {
    id: 'hijuelo',
    titulo: 'Hijuelo bueno',
    corto: 'La planta hija',
    texto:
      'Sale de la planta madre. Busca uno firme (no bofo), de 1.5 a 3 kg o roseta de 8 a 11 cm, con madre de 3 a 5 años. Corte limpio, 10 días al sol y listo para sembrar.',
  },
  {
    id: 'surcos',
    titulo: 'Calles de 3 metros',
    corto: 'Espacio entre surcos',
    texto:
      'Entre surcos deja unos 3 m. Ahí puedes sembrar papa, quinoa o chocho el primer año: ingreso temprano mientras el penco crece.',
  },
  {
    id: 'co2',
    titulo: 'Carbono / CO₂',
    corto: 'Aire que captura la planta',
    texto:
      'Cuánto CO₂ retiene tu lote. Hay estimado (con medidas) y verificado in situ. La meta del proyecto: 15 toneladas.',
  },
  {
    id: 'circular',
    titulo: 'Economía circular',
    corto: 'Nada se pierde',
    texto:
      'Fibra, kirillas, madera y hoja también generan valor: canastas, alpargatas, encurtidos y abono. No solo la leche del penco.',
  },
]

/**
 * Pantalla de bienvenida — estilo guía de amigo, marca Pencos del Norte.
 */
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
  const [paso, setPaso] = useState(loggedIn ? 'entrar' : 'bienvenida')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [tipOpen, setTipOpen] = useState(null)

  async function enter(portal) {
    if (loggedIn && rol === portal) {
      navigate(portal === 'empresa' ? '/empresa' : '/productor/suelos')
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

  function toggleTip(id) {
    setTipOpen((cur) => (cur === id ? null : id))
  }

  return (
    <div className="welcome-shell">
      <nav className="welcome-nav" aria-label="Principal">
        <div className="welcome-nav-brand">
          <AppIcon name="logo" alt="" />
          <div>
            <strong>PencoLab</strong>
            <span>Pencos del Norte</span>
          </div>
        </div>
        <div className="welcome-nav-links">
          <button type="button" className={paso === 'bienvenida' ? 'on' : ''} onClick={() => setPaso('bienvenida')}>
            Inicio
          </button>
          <button type="button" className={paso === 'quehace' ? 'on' : ''} onClick={() => setPaso('quehace')}>
            ¿Qué hace?
          </button>
          <button type="button" className={paso === 'entrar' ? 'on' : ''} onClick={() => setPaso('entrar')}>
            Entrar
          </button>
        </div>
      </nav>

      {paso === 'bienvenida' && (
        <section className="welcome-hero">
          <p className="welcome-kicker">Herramienta para productores</p>
          <h1>Bienvenido a PencoLab</h1>
          <p className="welcome-lead">
            Los agricultores trabajan con la educación de la experiencia. Aquí registras el lote,
            cuidas el penco y revisas ingresos, carbono y alertas de forma clara.
          </p>
          <div className="welcome-cta-row">
            <button type="button" className="welcome-cta primary" onClick={() => setPaso('entrar')}>
              <AppIcon name="plantar" alt="" className="glyph-xs" />
              Bienvenidos
            </button>
            <button type="button" className="welcome-cta ghost" onClick={() => setPaso('quehace')}>
              ¿Qué puedo hacer?
            </button>
          </div>
          <div className="welcome-status">
            <span className={online ? 'ok' : 'off'}>{online ? 'Con red' : 'Sin red'}</span>
            <span className={apiOk ? 'ok' : 'off'}>{apiOk ? 'API lista' : 'Demo local'}</span>
          </div>
        </section>
      )}

      {paso === 'quehace' && (
        <section className="welcome-explain">
          <header>
            <h2>¿Qué puedes hacer aquí?</h2>
            <p>
              Hay dos accesos: uno para el productor en el lote (desde el móvil) y otro para la
              empresa (indicadores y mapa). Toca el <strong>?</strong> si necesitas una explicación.
            </p>
          </header>

          <div className="welcome-guide-grid">
            {GUIAS.map((g) => (
              <article key={g.id} className={`welcome-guide-card ${tipOpen === g.id ? 'open' : ''}`}>
                <div className="welcome-guide-top">
                  <div>
                    <h3>{g.titulo}</h3>
                    <p>{g.corto}</p>
                  </div>
                  <button
                    type="button"
                    className="welcome-q"
                    aria-expanded={tipOpen === g.id}
                    aria-label={`Qué es ${g.titulo}`}
                    onClick={() => toggleTip(g.id)}
                  >
                    ?
                  </button>
                </div>
                {tipOpen === g.id && <p className="welcome-guide-tip">{g.texto}</p>}
              </article>
            ))}
          </div>

          <ul className="welcome-bullets">
            <li>
              <AppIcon name="anotar" alt="" className="glyph-sm" />
              <span>
                <strong>Registrar el lote</strong> con GPS, pH y estado — aunque no haya señal.
              </span>
            </li>
            <li>
              <AppIcon name="bitacora" alt="" className="glyph-sm" />
              <span>
                <strong>Diario</strong>: riego, plagas y fotos para llevar el seguimiento del lote.
              </span>
            </li>
            <li>
              <AppIcon name="empresa" alt="" className="glyph-sm" />
              <span>
                <strong>Empresa</strong>: ve lo del productor (solo lectura) y la proyección a 12 años.
              </span>
            </li>
          </ul>

          <button type="button" className="welcome-cta primary wide" onClick={() => setPaso('entrar')}>
            Bienvenidos
          </button>
        </section>
      )}

      {paso === 'entrar' && (
        <section className="welcome-enter">
          <header>
            <h2>¿Cómo quieres entrar?</h2>
            <p>Elige tu acceso: productor en el lote, o empresa para seguimiento de la red.</p>
          </header>

          {error && <div className="m-toast warn">{error}</div>}

          {loggedIn && (
            <div className="welcome-session">
              <p>
                Ya estás dentro como <strong>{session.email}</strong>
              </p>
              <div className="welcome-session-actions">
                <button type="button" className="welcome-cta primary" onClick={onContinue}>
                  Seguir donde quedé
                </button>
                {onReloadDemo && (
                  <button type="button" className="welcome-cta ghost" onClick={onReloadDemo}>
                    Recargar demo
                  </button>
                )}
                <button type="button" className="welcome-cta ghost" onClick={onLogout}>
                  Salir
                </button>
              </div>
            </div>
          )}

          <div className="welcome-portals">
            <button
              type="button"
              className="welcome-portal"
              disabled={busy !== null}
              onClick={() => enter('productor')}
            >
              <span className="welcome-portal-ico">
                <AppIcon name="plantar" alt="" />
              </span>
              <div>
                <strong>
                  Agricultor
                  <HelpQ
                    open={tipOpen === 'portal-agri'}
                    onToggle={() => toggleTip('portal-agri')}
                    text="Aquí registras siembra, riego, plagas y el ingreso estimado del penco. Es la herramienta del productor."
                  />
                </strong>
                <span>Siembra · bitácora · CO₂</span>
                {tipOpen === 'portal-agri' && (
                  <em className="welcome-inline-tip">
                    Aquí registras siembra, riego, plagas y el ingreso estimado del penco. Es la
                    herramienta del productor.
                  </em>
                )}
              </div>
              <b>{busy === 'productor' ? '…' : 'Entrar'}</b>
            </button>

            <button
              type="button"
              className="welcome-portal"
              disabled={busy !== null}
              onClick={() => enter('empresa')}
            >
              <span className="welcome-portal-ico biz">
                <AppIcon name="empresa" alt="" />
              </span>
              <div>
                <strong>
                  Empresa
                  <HelpQ
                    open={tipOpen === 'portal-emp'}
                    onToggle={() => toggleTip('portal-emp')}
                    text="Panel para consultar productores, mapa, alertas y la proyección de ingresos más carbono. No modifica los datos del lote."
                  />
                </strong>
                <span>Resumen · mapa · alertas</span>
                {tipOpen === 'portal-emp' && (
                  <em className="welcome-inline-tip">
                    Panel para consultar productores, mapa, alertas y la proyección de ingresos más
                    carbono. No modifica los datos del lote.
                  </em>
                )}
              </div>
              <b>{busy === 'empresa' ? '…' : 'Entrar'}</b>
            </button>
          </div>

          <p className="welcome-hint">
            Demo Dylan · misma clave · {MY_ACCOUNT.password}
            <HelpQ
              open={tipOpen === 'clave'}
              onToggle={() => toggleTip('clave')}
              text="Es la clave de prueba del hackathon. Un clic en Agricultor o Empresa carga datos de ejemplo."
            />
          </p>
          {tipOpen === 'clave' && (
            <p className="welcome-inline-tip center">
              Es la clave de prueba del hackathon. Un clic en Agricultor o Empresa carga datos de
              ejemplo.
            </p>
          )}

          <button type="button" className="welcome-cta ghost wide" onClick={() => onGoLogin('productor')}>
            Otra cuenta
          </button>
          <button type="button" className="welcome-back" onClick={() => setPaso('bienvenida')}>
            ← Volver al inicio
          </button>
        </section>
      )}
    </div>
  )
}

function HelpQ({ open, onToggle, text }) {
  return (
    <button
      type="button"
      className={`welcome-q mini ${open ? 'on' : ''}`}
      aria-label={text}
      title={text}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      ?
    </button>
  )
}
