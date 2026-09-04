import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { certificarLote, ensureProductor, syncPush } from '../api'
import { currentPath, navigate } from '../routing'
import {
  calcularCarbonoInSitu,
  calcularPlanSiembra,
  estimarCarbono,
  loadStore,
  ownScope,
  recomendacionPh,
  CERT_PENDING_KEY,
  TIPOS_PLANTA,
  tipoPlantaById,
} from '../store'
import SimulacionAgricola from './SimulacionAgricola'
import QrLote from './QrLote'
import EconomiaCircular from './EconomiaCircular'
import RegistroSiembraAndina from '../components/RegistroSiembraAndina'
import VirtudesCultivoScreen from './VirtudesCultivoScreen'
import CalculadoraRiquezaFutura, { flushPlanesAccion } from '../components/CalculadoraRiquezaFutura'
import BitacoraCampo from './BitacoraCampo'
import AnalisisCostos from './AnalisisCostos'
import AnotarLote from './AnotarLote'
import GuiaInteractiva, { GuiaErrorBoundary } from './GuiaInteractiva'
import { AppIcon } from '../components/AppIcon'

const NAV = [
  {
    path: '/productor/suelos',
    icon: 'tierra',
    label: 'Suelo',
    desc: 'Mide el pH y prepara tu tierra antes de sembrar',
  },
  {
    path: '/productor/anotar',
    icon: 'anotar',
    label: 'Lote',
    desc: 'Registra un lote nuevo: plantas, surcos y ubicación',
  },
  {
    path: '/productor/andina',
    icon: 'guia',
    label: 'Guía',
    desc: 'Aprende paso a paso cómo sembrar el penco andino',
  },
  {
    path: '/productor/circular',
    icon: 'abono',
    label: 'Residuos',
    desc: 'Aprovecha fibra, hoja y kirillas: ingreso adicional',
  },
  {
    path: '/productor/riqueza',
    icon: 'plata',
    label: 'Plan',
    desc: 'Calcula el ingreso estimado de tus hectáreas',
  },
  {
    path: '/productor/bitacora',
    icon: 'bitacora',
    label: 'Diario',
    desc: 'Anota riego, podas y cómo va el lote hoy',
  },
]

function navMatch(path, item) {
  if (path === item.path) return true
  if (item.path === '/productor/suelos' && path === '/productor/suelo') return true
  if (item.path === '/productor/andina' && (path === '/productor/practica' || path === '/productor/metodo')) {
    return true
  }
  return false
}

function loadCertPending() {
  try {
    const raw = localStorage.getItem(CERT_PENDING_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveCertPending(list) {
  localStorage.setItem(CERT_PENDING_KEY, JSON.stringify(list))
}

async function flushCertificaciones(token) {
  const queue = loadCertPending()
  if (!queue.length || !token) return queue
  const remaining = []
  for (const payload of queue) {
    try {
      await certificarLote(payload, token)
    } catch {
      remaining.push(payload)
    }
  }
  saveCertPending(remaining)
  return remaining
}

const PH_SHORT = {
  acido: { icon: 'ph-acido', title: 'Suelo ácido', action: 'Cal + composta' },
  alcalino: { icon: 'ph-alcalino', title: 'Suelo alcalino', action: 'Yeso o azufre' },
  optimo: { icon: 'ph-optimo', title: 'pH bueno', action: 'Listo para sembrar' },
  atencion: { icon: 'ph-atencion', title: 'pH al límite', action: 'Vigilar el suelo' },
}

function Stepper({ value, onChange, min, max, step = 1, decimals = 0 }) {
  const n = parseFloat(value) || 0
  const clamp = (v) => Math.min(max, Math.max(min, v))
  return (
    <div className="m-stepper">
      <button
        type="button"
        aria-label="menos"
        onClick={() => onChange(String(clamp(Number((n - step).toFixed(decimals)))))}
      >
        −
      </button>
      <span>{decimals ? n.toFixed(decimals) : n}</span>
      <button
        type="button"
        aria-label="más"
        onClick={() => onChange(String(clamp(Number((n + step).toFixed(decimals)))))}
      >
        +
      </button>
    </div>
  )
}

function TapToggle({ on, onToggle, icon, title }) {
  return (
    <button type="button" className={`m-tap ${on ? 'on' : ''}`} onClick={onToggle}>
      <AppIcon name={icon} alt="" className="glyph-sm" />
      <strong>{title}</strong>
      <span className="m-tap-mark">{on ? '✓' : ''}</span>
    </button>
  )
}

export default function ProductorApp({ data, persist, online, apiOk, onLogout, onHome }) {
  const path = currentPath()
  const scope = useMemo(() => ownScope(data), [data])
  const [msg, setMsg] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const syncLock = useRef(false)
  const lastAutoSyncAt = useRef(0)
  const pending = [...scope.parcelas, ...scope.plantas, ...scope.mediciones, ...scope.bitacora].filter(
    (r) => !r.synced_at
  ).length
  const pendingPlanes = (data.planes_accion || []).filter((p) => !p.synced_at).length
  const pendingCert = loadCertPending().length
  const totalPending = pending + pendingPlanes + pendingCert

  // La home del productor es Suelo (no hay pestaña "inicio" suelta)
  useEffect(() => {
    if (path === '/productor' || path === '/productor/') {
      navigate('/productor/suelos')
    }
  }, [path])

  const handleSync = useCallback(
    async ({ auto = false } = {}) => {
      if (syncLock.current) return
      if (!online) {
        if (!auto) setMsg({ type: 'warn', text: 'Sin conexión. Se guarda en local.' })
        return
      }
      if (!data.session?.access_token) return
      if (auto && totalPending === 0) return

      syncLock.current = true
      setSyncing(true)
      try {
        const token = data.session.access_token
        const productor = await ensureProductor(
          {
            id: data.session.productor_id,
            nombre: data.productor.nombre || data.session.email.split('@')[0],
            email: data.session.email,
            comunidad: data.productor.comunidad,
            activo: true,
          },
          token
        )
        const productorId = productor.id
        const live = ownScope({ ...data, productor: { ...data.productor, id: productorId } })
        await syncPush(
          {
            productor_id: productorId,
            parcelas: live.parcelas.map((p) => ({ ...p, productor_id: productorId })),
            plantas: live.plantas,
            mediciones: live.mediciones.map((m) => ({
              ...m,
              calcular_carbono: true,
              algoritmo_version: m.algoritmo_version || 'alometrico_v1',
            })),
            bitacora: live.bitacora.map((b) => ({
              ...b,
              productor_id: productorId,
              planta_id: b.planta_id || null,
            })),
          },
          token
        )
        const { syncedIds: planesSynced } = await flushPlanesAccion(token, data.planes_accion || [])
        await flushCertificaciones(token)
        const now = new Date().toISOString()
        const latest = loadStore()
        const base = {
          ...latest,
          session: data.session,
          productor: { ...latest.productor, ...data.productor, id: productorId },
        }
        persist({
          ...base,
          lastSync: now,
          parcelas: (base.parcelas || []).map((p) =>
            live.parcelas.some((s) => s.id === p.id)
              ? { ...p, productor_id: productorId, synced_at: now }
              : p
          ),
          plantas: (base.plantas || []).map((p) =>
            live.plantas.some((s) => s.id === p.id) ? { ...p, synced_at: now } : p
          ),
          mediciones: (base.mediciones || []).map((m) =>
            live.mediciones.some((s) => s.id === m.id) ? { ...m, synced_at: now } : m
          ),
          bitacora: (base.bitacora || []).map((b) =>
            live.bitacora.some((s) => s.id === b.id) ? { ...b, synced_at: now } : b
          ),
          planes_accion: (base.planes_accion || []).map((p) =>
            planesSynced.includes(p.id) ? { ...p, synced_at: now } : p
          ),
        })
        setMsg({
          type: 'success',
          text: auto
            ? 'Sincronización automática completada.'
            : 'Sincronización diferida completada.',
        })
      } catch (e) {
        if (!auto) setMsg({ type: 'warn', text: e.message })
        else setMsg({ type: 'warn', text: `Sync auto pendiente: ${e.message}` })
      } finally {
        setSyncing(false)
        syncLock.current = false
      }
    },
    [online, data, persist, totalPending]
  )

  // Al recuperar internet / API: subir pendientes automáticamente
  useEffect(() => {
    if (!online || !apiOk || totalPending === 0) return
    const now = Date.now()
    if (now - lastAutoSyncAt.current < 10000) return
    const t = setTimeout(() => {
      lastAutoSyncAt.current = Date.now()
      handleSync({ auto: true })
    }, 900)
    return () => clearTimeout(t)
  }, [online, apiOk, totalPending, handleSync])

  // Reintento periódico mientras haya pendientes y haya red
  useEffect(() => {
    if (!online || !apiOk) return
    const iv = setInterval(() => {
      if (totalPending > 0 && !syncLock.current) {
        lastAutoSyncAt.current = Date.now()
        handleSync({ auto: true })
      }
    }, 20000)
    return () => clearInterval(iv)
  }, [online, apiOk, totalPending, handleSync])

  function addRecords(partial) {
    persist({ ...data, ...partial })
  }

  const firstName = (data.productor.nombre || data.session.email || 'Agricultor').split(' ')[0].split('@')[0]
  const activeNav = NAV.find((t) => navMatch(path, t))

  return (
    <div className="app-shell portal-productor m-app">
      <header className="m-top">
        <button type="button" className="m-avatar" onClick={onHome} aria-label="Inicio">
          <AppIcon name="logo" alt="PencoLab" />
        </button>
        <div className="m-hello">
          <h1>Hola, {firstName}</h1>
          <p>
            {activeNav
              ? activeNav.desc
              : online
                ? apiOk
                  ? syncing
                    ? 'Sincronizando…'
                    : totalPending
                      ? `${totalPending} por subir`
                      : 'Conectado · auto-sync'
                  : 'Sin servidor'
                : 'Modo campo · offline'}
          </p>
        </div>
        <div className={`m-pill ${online ? 'ok' : 'off'}`} title={online ? 'En línea' : 'Sin red'}>
          {totalPending > 0 ? `${totalPending}` : online ? '●' : '○'}
        </div>
      </header>
      <main className="content">
        {msg && <div className={`m-toast ${msg.type}`}>{msg.text}</div>}
        {(path === '/productor/suelos' || path === '/productor/suelo' || path === '/productor') && (
          <FormularioSuelos data={data} scope={scope} onAdd={addRecords} />
        )}
        {path === '/productor/andina' && (
          <RegistroSiembraAndina setMsg={setMsg} />
        )}
        {(path === '/productor/practica' || path === '/productor/metodo') && (
          <GuiaErrorBoundary>
            <GuiaInteractiva
              data={data}
              scope={scope}
              onAdd={addRecords}
              online={online}
              setMsg={setMsg}
            />
          </GuiaErrorBoundary>
        )}
        {path === '/productor/anotar' && (
          <AnotarLote data={data} onAdd={addRecords} setMsg={setMsg} />
        )}
        {path === '/productor/virtudes' && <VirtudesCultivoScreen />}
        {path === '/productor/riqueza' && (
          <CalculadoraRiquezaFutura
            data={data}
            onAdd={addRecords}
            online={online}
            setMsg={setMsg}
          />
        )}
        {path === '/productor/costos' && (
          <AnalisisCostos mode="agricultor" residuos={data.residuos || []} />
        )}
        {path === '/productor/circular' && (
          <EconomiaCircular data={data} onAdd={addRecords} mode="productor" />
        )}
        {path === '/productor/simular' && <SimulacionAgricola />}
        {path === '/productor/qr' && <QrLote data={data} scope={scope} />}
        {path === '/productor/bitacora' && <BitacoraCampo data={data} scope={scope} onAdd={addRecords} />}
        {path === '/productor/metricas' && <MetricasPropias data={data} scope={scope} onAdd={addRecords} />}
        <button type="button" className="m-logout" onClick={onLogout}>
          Salir
        </button>
      </main>
      <nav className="m-dock" aria-label="Menú del agricultor">
        {activeNav && (
          <p className="m-dock-hint" role="status">
            <span className="m-dock-hint-label">{activeNav.label}</span>
            {activeNav.desc}
          </p>
        )}
        <div className="m-dock-inner">
          {NAV.map((t) => {
            const on = navMatch(path, t)
            return (
              <button
                key={t.path}
                type="button"
                className={`m-dock-btn ${on ? 'active' : ''}`}
                onClick={() => navigate(t.path)}
                title={t.desc}
                aria-label={`${t.label}: ${t.desc}`}
                aria-current={on ? 'page' : undefined}
              >
                <AppIcon name={t.icon} alt="" className="dock-ico" />
                <span className="lbl">{t.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

function FormularioSuelos({ data, scope, onAdd }) {
  const [form, setForm] = useState({
    nombre: '',
    area: '1.5',
    ph: '6.5',
    tipo_planta: 'penco_andino',
  })
  const tipo = tipoPlantaById(form.tipo_planta)
  const rec = recomendacionPh(form.ph)
  const plan = useMemo(
    () =>
      calcularPlanSiembra(form.area, {
        id: tipo.id,
        label: tipo.label,
        entre_plantas_m: tipo.entre_plantas_m,
        entre_surcos_m: tipo.entre_surcos_m,
        vivero: tipo.vivero,
      }),
    [form.area, tipo]
  )

  function save(e) {
    e.preventDefault()
    const parcelaId = crypto.randomUUID()
    const planActual = calcularPlanSiembra(form.area, {
      id: tipo.id,
      label: tipo.label,
      entre_plantas_m: tipo.entre_plantas_m,
      entre_surcos_m: tipo.entre_surcos_m,
      vivero: tipo.vivero,
    })
    onAdd({
      parcelas: [
        ...data.parcelas,
        {
          id: parcelaId,
          productor_id: data.session.productor_id,
          nombre: form.nombre || 'Mi parcela',
          area_hectareas: parseFloat(form.area) || null,
          fecha_establecimiento: new Date().toISOString().slice(0, 10),
          ph: parseFloat(form.ph),
          tipo_suelo: 'franco',
          permeabilidad: 'media',
          tipo_planta: tipo.id,
          recomendacion_ph: rec?.texto || null,
          plan_siembra: planActual,
          synced_at: null,
        },
      ],
    })
    setForm({ nombre: '', area: '1.5', ph: '6.5', tipo_planta: 'penco_andino' })
  }

  const phHint = rec ? PH_SHORT[rec.nivel] : null
  const fueraRango = rec && rec.nivel !== 'optimo'

  return (
    <>
      <form className="m-card" onSubmit={save}>
        <input
          className="m-name"
          required
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          placeholder="Nombre del lote"
        />

        <p className="tierra-label">Tipo de planta</p>
        <div className="tierra-plantas">
          {TIPOS_PLANTA.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tierra-planta ${form.tipo_planta === t.id ? 'on' : ''}`}
              onClick={() => setForm({ ...form, tipo_planta: t.id })}
            >
              <AppIcon name={t.icon} alt="" className="glyph-md" />
              <strong>{t.label}</strong>
              <span>{t.especie}</span>
            </button>
          ))}
        </div>
        <p className="tierra-tip">{tipo.tip}</p>

        <div className="m-hero-num">
          <span>Hectáreas</span>
          <Stepper
            value={form.area}
            min={0.25}
            max={50}
            step={0.25}
            decimals={2}
            onChange={(area) => setForm({ ...form, area })}
          />
        </div>

        <div className="m-ph-block">
          <div className="m-ph-big">{parseFloat(form.ph).toFixed(1)}</div>
          <span>pH del suelo</span>
          <input
            type="range"
            min="4"
            max="10"
            step="0.1"
            value={form.ph}
            onChange={(e) => setForm({ ...form, ph: e.target.value })}
          />
          <div className="m-ph-bar" aria-hidden>
            <i className="z-acid" />
            <i className="z-ok" />
            <i className="z-alk" />
          </div>
          <p className="tierra-ph-range">Óptimo penco: 6.0 – 7.0</p>
        </div>

        {phHint && rec && (
          <div className={`m-action tierra-ph-card ${rec.nivel}`}>
            <AppIcon name={phHint.icon} alt="" className="glyph-md" />
            <div>
              <strong>{rec.titulo || phHint.title}</strong>
              {rec.advertencia && <p className="tierra-warn">{rec.advertencia}</p>}
              {!fueraRango && <p>{phHint.action}</p>}
              {fueraRango && (
                <ol className="tierra-soluciones">
                  {(rec.soluciones || []).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              )}
              {!fueraRango && rec.soluciones?.[0] && <p>{rec.soluciones[0]}</p>}
            </div>
          </div>
        )}

        {plan && <PlanSiembraPanel plan={plan} tipo={tipo} />}

        <button className="m-btn" type="submit">
          Guardar lote
        </button>
      </form>
      {scope.parcelas.map((p) => (
        <div key={p.id} className="m-lote">
          <div className="m-lote-ico">
            <AppIcon name="tierra" alt="" />
          </div>
          <div>
            <strong>{p.nombre}</strong>
            <p>
              {p.area_hectareas ?? '—'} ha · pH {p.ph ?? '—'}
              {p.tipo_planta ? ` · ${tipoPlantaById(p.tipo_planta).label}` : ''}
            </p>
            <p className="qr-hint-line">
              {p.estado_lote ? `Estado: ${p.estado_lote}` : 'Sin estado'}
              {' · '}
              Riego: {p.ultimo_riego || 'sin registro'}
            </p>
          </div>
          <div className="m-lote-actions">
            <button type="button" className="m-lote-qr" onClick={() => navigate('/productor/bitacora')}>
              <AppIcon name="bitacora" alt="" className="glyph-xs" />
              Diario
            </button>
            <button type="button" className="m-lote-qr" onClick={() => navigate('/productor/qr')}>
              <AppIcon name="qr" alt="QR" className="glyph-xs" />
              QR
            </button>
          </div>
        </div>
      ))}
    </>
  )
}

function PlanSiembraPanel({ plan, tipo }) {
  const r = plan.rendimiento
  const ha = plan.hectareas || 0
  const showPapa = tipo?.id === 'intercalado_papa'
  const baseIcon = tipo?.id === 'vivero_semilla' ? 'penco' : tipo?.icon === 'papa' ? 'penco' : tipo?.icon || 'penco'

  // Más hectáreas → más iconos; menos → iconos más grandes (sin huecos)
  const visualCount = Math.min(48, Math.max(4, Math.round(2.8 + ha * 2.4)))
  const cols = Math.max(2, Math.round(Math.sqrt(visualCount * 1.25)))
  const rows = Math.max(2, Math.ceil(visualCount / cols))
  const cells = cols * rows
  const iconPx = Math.round(Math.min(56, Math.max(16, 200 / Math.sqrt(cells))))

  return (
    <div className="m-plan">
      <div className="m-plan-stats">
        <div>
          <strong>{plan.pencos_totales.toLocaleString()}</strong>
          <span>{plan.vivero ? 'plantines' : 'plantas'}</span>
        </div>
        <div>
          <strong>{ha}</strong>
          <span>hectáreas</span>
        </div>
        <div>
          <strong>
            {plan.vivero ? `${tipo.entre_plantas_m}m` : `${Math.round(r.litros_chaguarmishky_mid / 1000)}k`}
          </strong>
          <span>{plan.vivero ? 'marco' : 'litros'}</span>
        </div>
      </div>
      <p className="m-plan-layout">{plan.division.layout}</p>
      <p className="m-plan-esp">{plan.espaciamiento}</p>

      <div
        className="plan-icon-field"
        aria-label={`Vista del lote: ${plan.pencos_totales} plantas en ${ha} ha`}
        style={{
          '--plan-cols': cols,
          '--plan-rows': rows,
          '--plan-ico': `${iconPx}px`,
        }}
      >
        {Array.from({ length: cells }).map((_, i) => {
          const c = i % cols
          const usePapa = showPapa && c % 2 === 1
          return (
            <span key={i} className="plan-icon-cell">
              <AppIcon name={usePapa ? 'papa' : baseIcon} alt="" />
            </span>
          )
        })}
      </div>

      <p className="plan-grid-caption">
        Cada ícono representa el lote: con menos hectáreas se ven más grandes; con más, se llenan
        más plantas. Estimado real: {plan.pencos_totales.toLocaleString()}{' '}
        {plan.vivero ? 'plantines' : 'plantas'} en {ha} ha.
      </p>
      <p className="m-plan-consejo">{plan.division.consejo}</p>
    </div>
  )
}

function MetricasPropias({ data, scope, onAdd }) {
  const rows = [...scope.mediciones].sort((a, b) =>
    String(a.fecha_medicion).localeCompare(String(b.fecha_medicion))
  )
  const totalC = rows.reduce((s, m) => s + parseFloat(m.carbono_acumulado_kg || 0), 0)
  const maxAlt = Math.max(1, ...rows.map((m) => parseFloat(m.altura_roseta_cm || 0)))

  const [form, setForm] = useState({
    planta_id: scope.plantas[0]?.id || '',
    fecha: new Date().toISOString().slice(0, 10),
    altura: '25',
    diametro: '30',
    hojas: '18',
    in_situ: true,
  })

  function save(e) {
    e.preventDefault()
    if (!form.planta_id) return
    const carbono = form.in_situ
      ? calcularCarbonoInSitu(form.altura, form.hojas)
      : estimarCarbono(form.altura, form.diametro, 12)
    onAdd({
      mediciones: [
        ...data.mediciones,
        {
          id: crypto.randomUUID(),
          planta_id: form.planta_id,
          fecha_medicion: form.fecha,
          altura_roseta_cm: parseFloat(form.altura),
          diametro_roseta_cm: parseFloat(form.diametro),
          numero_hojas: parseInt(form.hojas, 10),
          tipo_carbono: form.in_situ ? 'verificado_in_situ' : 'estimado',
          carbono_verificado: Boolean(form.in_situ),
          ...carbono,
          algoritmo_version: form.in_situ ? 'alometrico_v1' : 'teorico_v1',
          synced_at: null,
        },
      ],
    })
  }

  const preview = form.in_situ
    ? calcularCarbonoInSitu(form.altura, form.hojas)
    : estimarCarbono(form.altura, form.diametro, 12)

  return (
    <>
      <div className="m-stats">
        <div className="m-stat">
          <strong>{scope.plantas.length}</strong>
          <span>plantas</span>
        </div>
        <div className="m-stat">
          <strong>{totalC.toFixed(1)}</strong>
          <span>kg C</span>
        </div>
      </div>
      {rows.length > 0 && (
        <div className="m-card">
          <div className="chart">
            {rows.map((m) => (
              <div key={m.id} className="bar-wrap">
                <div
                  className="bar"
                  style={{ height: `${(parseFloat(m.altura_roseta_cm) / maxAlt) * 100}%` }}
                />
                <span>{String(m.fecha_medicion).slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {scope.plantas[0] ? (
        <form className="m-card" onSubmit={save}>
          <select
            className="m-select"
            value={form.planta_id}
            onChange={(e) => setForm({ ...form, planta_id: e.target.value })}
          >
            {scope.plantas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo}
              </option>
            ))}
          </select>
          <TapToggle
            on={form.in_situ}
            icon="check"
            title="Carbono verificado"
            onToggle={() => setForm({ ...form, in_situ: !form.in_situ })}
          />
          <div className="m-hero-num">
            <span>Altura cm</span>
            <Stepper
              value={form.altura}
              min={5}
              max={200}
              step={1}
              onChange={(altura) => setForm({ ...form, altura })}
            />
          </div>
          <div className="m-hero-num">
            <span>Diámetro cm</span>
            <Stepper
              value={form.diametro}
              min={5}
              max={200}
              step={1}
              onChange={(diametro) => setForm({ ...form, diametro })}
            />
          </div>
          <div className="m-hero-num">
            <span>Hojas</span>
            <Stepper
              value={form.hojas}
              min={1}
              max={80}
              step={1}
              onChange={(hojas) => setForm({ ...form, hojas })}
            />
          </div>
          <div className="m-co2">
            <strong>{preview.co2_equivalente_kg}</strong>
            <span>kg CO₂</span>
          </div>
          <button className="m-btn" type="submit">
            Guardar medida
          </button>
        </form>
      ) : (
        <div className="m-toast warn">Planta primero en Plantar</div>
      )}
    </>
  )
}
