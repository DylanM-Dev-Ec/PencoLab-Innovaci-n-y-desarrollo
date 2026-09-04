import { useMemo, useState } from 'react'
import { AppIcon } from '../components/AppIcon'
import { GERMINACION_TEORICA_PCT } from '../agaveAndino'

const FICHA_HIJUELO = [
  {
    icon: 'penco',
    titulo: 'Origen',
    texto: 'Planta madre de 3–5 años',
  },
  {
    icon: 'regla',
    titulo: 'Peso',
    texto: '1.5 – 3 kg (o roseta 8–11 cm)',
  },
  {
    icon: 'sol',
    titulo: 'Tratamiento',
    texto: 'Cicatrizado al sol 10 días e inoculado con bionutriprotección',
  },
]

const PAGOS = [
  {
    id: 'efectivo',
    label: 'Efectivo',
    hint: 'Pago al recibir el lote',
  },
  {
    id: 'credito_pacto',
    label: 'Crédito del Pacto Social',
    hint: 'Pagas después con litros de chawarmishky a Pencos del Norte',
  },
]

function readFoto(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null)
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Mercado de Propagación Sostenible — hijuelos certificados y semillas.
 * Offline-first: solicitudes y ofertas quedan en el store local del productor.
 */
export default function MercadoPropagacion({ data, onAdd, setMsg }) {
  const [tab, setTab] = useState('adquisicion')
  const [material, setMaterial] = useState('hijuelos')
  const [cantidad, setCantidad] = useState('20')
  const [pago, setPago] = useState('efectivo')

  const [ofertaCantidad, setOfertaCantidad] = useState('10')
  const [tamanoCm, setTamanoCm] = useState('9.5')
  const [pesoKg, setPesoKg] = useState('2.0')
  const [sano, setSano] = useState(false)
  const [sinPicudo, setSinPicudo] = useState(false)
  const [sinErwinia, setSinErwinia] = useState(false)
  const [foto, setFoto] = useState(null)
  const [localTip, setLocalTip] = useState(null)

  const solicitudes = data?.mercado_solicitudes || []
  const ofertas = data?.mercado_ofertas || []

  const tip = setMsg || setLocalTip

  const fichaOk = useMemo(
    () => ({
      origen: true,
      peso: true,
      tratamiento: true,
    }),
    []
  )

  function solicitar() {
    const n = Math.round(Number(cantidad) || 0)
    if (n < 1) {
      tip?.({ type: 'warn', text: 'Indica cuántas unidades necesitas.' })
      return
    }
    if (material === 'semillas' && n < 50) {
      tip?.({
        type: 'warn',
        text: `Con germinación ~${GERMINACION_TEORICA_PCT}% conviene pedir al menos 50 semillas para vivero.`,
      })
    }
    const item = {
      id: crypto.randomUUID(),
      tipo: material,
      cantidad: n,
      pago,
      ficha_certificada: material === 'hijuelos' ? { ...fichaOk, ...Object.fromEntries(FICHA_HIJUELO.map((f) => [f.titulo, f.texto])) } : null,
      germinacion_aviso_pct: material === 'semillas' ? GERMINACION_TEORICA_PCT : null,
      estado: 'solicitada',
      created_at: new Date().toISOString(),
      synced_at: null,
    }
    onAdd?.({ mercado_solicitudes: [...solicitudes, item] })
    tip?.({
      type: 'success',
      text:
        material === 'hijuelos'
          ? `Solicitud de ${n} hijuelos certificados enviada · ${pago === 'credito_pacto' ? 'Pacto Social' : 'efectivo'}`
          : `Solicitud de ${n} semillas registrada · vivero recomendado`,
    })
  }

  async function onFotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await readFoto(file)
      setFoto(dataUrl)
    } catch {
      tip?.({ type: 'warn', text: 'No se pudo leer la foto.' })
    }
  }

  function publicarOferta() {
    const n = Math.round(Number(ofertaCantidad) || 0)
    const cm = parseFloat(tamanoCm)
    const kg = parseFloat(pesoKg)

    if (n < 1) {
      tip?.({ type: 'warn', text: 'Indica cuántos hijuelos sobrantes ofreces.' })
      return
    }
    if (!Number.isFinite(cm) || cm < 8 || cm > 11) {
      tip?.({ type: 'warn', text: 'El tamaño de roseta debe estar entre 8 y 11 cm.' })
      return
    }
    if (!Number.isFinite(kg) || kg < 1.5 || kg > 3) {
      tip?.({ type: 'warn', text: 'El peso debe estar entre 1.5 y 3 kg (estándar certificado).' })
      return
    }
    if (!sano || !sinPicudo || !sinErwinia) {
      tip?.({
        type: 'warn',
        text: 'Debes certificar que están sanos y sin síntomas de picudo ni Erwinia.',
      })
      return
    }
    if (!foto) {
      tip?.({ type: 'warn', text: 'Adjunta una foto para validar la oferta.' })
      return
    }

    const item = {
      id: crypto.randomUUID(),
      cantidad: n,
      tamano_roseta_cm: cm,
      peso_kg: kg,
      sano: true,
      sin_picudo: true,
      sin_erwinia: true,
      foto,
      estandar_ok: true,
      estado: 'publicada',
      created_at: new Date().toISOString(),
      synced_at: null,
    }
    onAdd?.({ mercado_ofertas: [...ofertas, item] })
    setFoto(null)
    setSano(false)
    setSinPicudo(false)
    setSinErwinia(false)
    tip?.({ type: 'success', text: `Oferta publicada: ${n} hijuelos certificados` })
  }

  return (
    <div className="mercado-screen">
      <header className="mercado-hero">
        <p className="mercado-kicker">Suministro sostenible · Pencos del Norte</p>
        <h2>Mercado de Propagación</h2>
        <p>
          Solicita hijuelos certificados o semillas, o vende tus excedentes de plantas madre maduras.
        </p>
      </header>

      {localTip && !setMsg ? (
        <div className={`m-toast ${localTip.type}`}>{localTip.text}</div>
      ) : null}

      <div className="mercado-tabs" role="tablist" aria-label="Mercado de propagación">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'adquisicion'}
          className={tab === 'adquisicion' ? 'on' : ''}
          onClick={() => setTab('adquisicion')}
        >
          <AppIcon name="plantar" alt="" className="glyph-sm" />
          <span>
            <strong>Adquisición</strong>
            <small>Comprar / solicitar</small>
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'oferta'}
          className={tab === 'oferta' ? 'on' : ''}
          onClick={() => setTab('oferta')}
        >
          <AppIcon name="semilla" alt="" className="glyph-sm" />
          <span>
            <strong>Oferta</strong>
            <small>Vender excedentes</small>
          </span>
        </button>
      </div>

      {tab === 'adquisicion' && (
        <section className="mercado-panel">
          <h3 className="mercado-section-title">¿Qué necesitas?</h3>
          <div className="mercado-material">
            <button
              type="button"
              className={material === 'hijuelos' ? 'on' : ''}
              onClick={() => setMaterial('hijuelos')}
            >
              <AppIcon name="penco" alt="" className="glyph-md" />
              <strong>Hijuelos certificados</strong>
              <span>Lotes listos para siembra</span>
            </button>
            <button
              type="button"
              className={material === 'semillas' ? 'on' : ''}
              onClick={() => setMaterial('semillas')}
            >
              <AppIcon name="semilla" alt="" className="glyph-md" />
              <strong>Semillas de penco</strong>
              <span>Solo vivero / invernadero</span>
            </button>
          </div>

          {material === 'hijuelos' && (
            <article className="mercado-card mercado-ficha">
              <header>
                <AppIcon name="check" alt="" className="glyph-sm" />
                <div>
                  <h4>Ficha técnica certificada</h4>
                  <p>Estándar visual de hijuelo apto</p>
                </div>
              </header>
              <ul className="mercado-ficha-list">
                {FICHA_HIJUELO.map((f) => (
                  <li key={f.titulo}>
                    <span className="mercado-ficha-ico" aria-hidden>
                      <AppIcon name={f.icon} alt="" className="glyph-sm" />
                    </span>
                    <div>
                      <strong>{f.titulo}</strong>
                      <span>{f.texto}</span>
                    </div>
                    <em className="mercado-ok" aria-label="Certificado">
                      ✓
                    </em>
                  </li>
                ))}
              </ul>
            </article>
          )}

          {material === 'semillas' && (
            <aside className="mercado-banner-semilla" role="alert">
              <AppIcon name="alerta" alt="" className="glyph-sm" />
              <div>
                <strong>Atención · germinación baja</strong>
                <p>
                  La semilla de <em>Agave americana</em> tiene una viabilidad de germinación del{' '}
                  {GERMINACION_TEORICA_PCT}%. Recomendado solo para manejo en camas de vivero o
                  invernadero.
                </p>
              </div>
            </aside>
          )}

          <article className="mercado-card">
            <label className="mercado-field">
              <span>Cantidad a solicitar</span>
              <input
                type="number"
                min={1}
                step={1}
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                inputMode="numeric"
              />
              <small>
                {material === 'hijuelos' ? 'Unidades de hijuelo' : 'Semillas (vivero tecnificado)'}
              </small>
            </label>
          </article>

          <article className="mercado-card">
            <h4>Opción de pago</h4>
            <div className="mercado-pago">
              {PAGOS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={pago === p.id ? 'on' : ''}
                  onClick={() => setPago(p.id)}
                >
                  <strong>{p.label}</strong>
                  <span>{p.hint}</span>
                </button>
              ))}
            </div>
          </article>

          <button type="button" className="m-btn mercado-cta" onClick={solicitar}>
            Solicitar {material === 'hijuelos' ? 'hijuelos' : 'semillas'}
          </button>

          {solicitudes.length > 0 && (
            <div className="mercado-historial">
              <h4>Tus solicitudes</h4>
              <ul>
                {solicitudes
                  .slice()
                  .reverse()
                  .slice(0, 6)
                  .map((s) => (
                    <li key={s.id}>
                      <strong>
                        {s.cantidad} {s.tipo === 'hijuelos' ? 'hijuelos' : 'semillas'}
                      </strong>
                      <span>
                        {s.pago === 'credito_pacto' ? 'Pacto Social' : 'Efectivo'} ·{' '}
                        {new Date(s.created_at).toLocaleDateString('es-EC')}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {tab === 'oferta' && (
        <section className="mercado-panel">
          <article className="mercado-card mercado-intro-oferta">
            <AppIcon name="penco" alt="" className="glyph-md" />
            <div>
              <h3>Vende hijuelos sobrantes</h3>
              <p>
                Si tienes plantas madre maduras, registra los hijuelos que nacen de las raíces. Solo
                se publican si cumplen el estándar (8–11 cm, sanos, sin picudo ni Erwinia) con foto.
              </p>
            </div>
          </article>

          <article className="mercado-card">
            <label className="mercado-field">
              <span>Cantidad de hijuelos</span>
              <input
                type="number"
                min={1}
                step={1}
                value={ofertaCantidad}
                onChange={(e) => setOfertaCantidad(e.target.value)}
                inputMode="numeric"
              />
            </label>
            <div className="mercado-row2">
              <label className="mercado-field">
                <span>Tamaño de roseta (cm)</span>
                <input
                  type="number"
                  min={8}
                  max={11}
                  step={0.1}
                  value={tamanoCm}
                  onChange={(e) => setTamanoCm(e.target.value)}
                  inputMode="decimal"
                />
                <small>Obligatorio: 8 a 11 cm</small>
              </label>
              <label className="mercado-field">
                <span>Peso (kg)</span>
                <input
                  type="number"
                  min={1.5}
                  max={3}
                  step={0.1}
                  value={pesoKg}
                  onChange={(e) => setPesoKg(e.target.value)}
                  inputMode="decimal"
                />
                <small>Ideal: 1.5 a 3 kg</small>
              </label>
            </div>
          </article>

          <article className="mercado-card">
            <h4>Validación sanitaria</h4>
            <div className="mercado-checks">
              <label className={sano ? 'on' : ''}>
                <input type="checkbox" checked={sano} onChange={(e) => setSano(e.target.checked)} />
                <AppIcon name="firme" alt="" className="glyph-sm" />
                <span>Sanos y firmes (no bofos)</span>
              </label>
              <label className={sinPicudo ? 'on' : ''}>
                <input
                  type="checkbox"
                  checked={sinPicudo}
                  onChange={(e) => setSinPicudo(e.target.checked)}
                />
                <AppIcon name="picudo" alt="" className="glyph-sm" />
                <span>Sin síntomas de picudo</span>
              </label>
              <label className={sinErwinia ? 'on' : ''}>
                <input
                  type="checkbox"
                  checked={sinErwinia}
                  onChange={(e) => setSinErwinia(e.target.checked)}
                />
                <AppIcon name="erwinia" alt="" className="glyph-sm" />
                <span>Sin síntomas de Erwinia</span>
              </label>
            </div>
          </article>

          <article className="mercado-card">
            <h4>Foto de evidencia</h4>
            <p className="mercado-hint">Obligatoria para publicar. Muestra el hijuelo junto a una regla.</p>
            <label className="mercado-foto">
              <input type="file" accept="image/*" capture="environment" onChange={onFotoChange} />
              {foto ? (
                <img src={foto} alt="Evidencia del hijuelo ofertado" />
              ) : (
                <span>
                  <AppIcon name="mide" alt="" className="glyph-md" />
                  Tomar o subir foto
                </span>
              )}
            </label>
          </article>

          <button type="button" className="m-btn mercado-cta" onClick={publicarOferta}>
            Publicar oferta
          </button>

          {ofertas.length > 0 && (
            <div className="mercado-historial">
              <h4>Tus ofertas publicadas</h4>
              <ul>
                {ofertas
                  .slice()
                  .reverse()
                  .slice(0, 6)
                  .map((o) => (
                    <li key={o.id} className="mercado-oferta-item">
                      {o.foto ? <img src={o.foto} alt="" /> : null}
                      <div>
                        <strong>{o.cantidad} hijuelos</strong>
                        <span>
                          {o.tamano_roseta_cm} cm · {o.peso_kg} kg · estándar OK
                        </span>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
