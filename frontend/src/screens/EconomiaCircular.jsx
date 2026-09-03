import { useMemo, useState } from 'react'
import {
  CIRCULAR_CARDS,
  ingresoResiduoUsd,
  PRECIO_RESIDUO_USD_KG,
} from '../agaveAndino'
import { AppIcon } from '../components/AppIcon'

/**
 * Economía circular de residuos del penco — Agricultor (escribe) y Empresa (solo lectura).
 */
export default function EconomiaCircular({ data, onAdd, mode = 'productor' }) {
  const readOnly = mode === 'empresa'
  const [kg, setKg] = useState(() =>
    Object.fromEntries(CIRCULAR_CARDS.map((c) => [c.id, '']))
  )
  const [msg, setMsg] = useState(null)

  const residuos = data?.residuos || []

  const totals = useMemo(() => {
    const byType = {}
    for (const c of CIRCULAR_CARDS) {
      byType[c.id] = { kg: 0, usd: 0 }
    }
    for (const r of residuos) {
      const key = r.tipo_residuo
      if (!byType[key]) byType[key] = { kg: 0, usd: 0 }
      byType[key].kg += Number(r.cantidad_kg) || 0
      byType[key].usd += Number(r.ingreso_adicional_usd) || 0
    }
    const usdTotal = Object.values(byType).reduce((s, v) => s + v.usd, 0)
    const kgTotal = Object.values(byType).reduce((s, v) => s + v.kg, 0)
    return { byType, usdTotal, kgTotal }
  }, [residuos])

  function register(card) {
    if (readOnly) return
    const cantidad = parseFloat(kg[card.id])
    if (!cantidad || cantidad <= 0) {
      setMsg({ type: 'warn', text: 'Ingresa kg válidos.' })
      return
    }
    const plantaId = data?.plantas?.[0]?.id || null
    if (!plantaId) {
      setMsg({ type: 'warn', text: 'Registra primero una planta o siembra andina.' })
      return
    }
    const usd = ingresoResiduoUsd(card.tipo_residuo, cantidad)
    const item = {
      id: crypto.randomUUID(),
      planta_id: plantaId,
      tipo_residuo: card.tipo_residuo,
      destino_producto: card.destino,
      cantidad_kg: cantidad,
      ingreso_adicional_usd: usd,
      created_at: new Date().toISOString(),
      synced_at: null,
    }
    onAdd?.({ residuos: [...residuos, item] })
    setKg((prev) => ({ ...prev, [card.id]: '' }))
    setMsg({ type: 'success', text: `+$${usd.toFixed(2)} USD estimados · ${card.titulo}` })
  }

  return (
    <div className={`circular-screen ${mode}${readOnly ? ' readonly' : ''}`}>
      <header className="circular-hero">
        <p className="circular-kicker">
          Economía circular · 100% de la planta
          {readOnly ? ' · solo lectura' : ''}
        </p>
        <h2>Residuos con valor</h2>
        <p>
          {readOnly
            ? 'Datos enviados por los productores. La empresa no puede modificarlos aquí.'
            : 'Tras el chawado, cada residuo se convierte en ingreso extra.'}
        </p>
        <div className="circular-totals">
          <div>
            <strong>{totals.kgTotal.toFixed(1)}</strong>
            <span>kg recuperados</span>
          </div>
          <div>
            <strong>${totals.usdTotal.toFixed(0)}</strong>
            <span>USD extra</span>
          </div>
        </div>
      </header>

      {msg && <div className={`m-toast ${msg.type}`}>{msg.text}</div>}

      <div className="circular-grid">
        {CIRCULAR_CARDS.map((card) => {
          const live = Number(kg[card.id]) || 0
          const preview = ingresoResiduoUsd(card.tipo_residuo, live)
          const hist = totals.byType[card.id] || { kg: 0, usd: 0 }
          return (
            <article key={card.id} className="circular-card" style={{ '--c': card.color, '--bg': card.bg }}>
              <div className="circular-card-top">
                <span className="circular-ico" aria-hidden>
                  <AppIcon name={card.icon} alt="" />
                </span>
                <div>
                  <h3>{card.titulo}</h3>
                  <p>{card.subtitulo}</p>
                </div>
              </div>
              <p className="circular-desc">{card.descripcion}</p>
              <div className="circular-price">
                ${PRECIO_RESIDUO_USD_KG[card.tipo_residuo]}/kg estimado
              </div>
              {!readOnly && (
                <>
                  <label className="circular-input">
                    <span>Kg obtenidos</span>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={kg[card.id]}
                      onChange={(e) => setKg({ ...kg, [card.id]: e.target.value })}
                      placeholder="0"
                    />
                  </label>
                  <div className="circular-live">
                    Ingreso extra: <strong>${preview.toFixed(2)}</strong>
                  </div>
                  <button type="button" className="m-btn" onClick={() => register(card)}>
                    Registrar
                  </button>
                </>
              )}
              <p className="circular-hist">
                {readOnly ? 'Reportado por campo' : 'Acumulado'}: {hist.kg.toFixed(1)} kg · $
                {hist.usd.toFixed(2)}
              </p>
            </article>
          )
        })}
      </div>
    </div>
  )
}
