import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { certificarLote, ensureProductor, syncPush } from '../api'
import { currentPath, navigate } from '../routing'
import {
  calcularCarbonoInSitu,
  calcularPlanSiembra,
  densidadPorSeparacion,
  ESPACIO_SURCO_M,
  estimarCarbono,
  getGps,
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
import { AppIcon } from '../components/AppIcon'

const NAV = [
  { path: '/productor/suelos', icon: 'tierra', label: 'Tierra' },
  { path: '/productor/anotar', icon: 'anotar', label: 'Anotar' },
  { path: '/productor/andina', icon: 'guia', label: 'Guía' },
  { path: '/productor/circular', icon: 'abono', label: 'Circular' },
  { path: '/productor/riqueza', icon: 'plata', label: 'Plan $' },
  { path: '/productor/bitacora', icon: 'bitacora', label: 'Campo' },
]

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

  return (
    <div className="app-shell portal-productor m-app">
      <header className="m-top">
        <button type="button" className="m-avatar" onClick={onHome} aria-label="Inicio">
          <AppIcon name="logo" alt="PencoLab" />
        </button>
        <div className="m-hello">
          <h1>Hola, {firstName}</h1>
          <p>
            {online
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
        {(path === '/productor/suelos' || path === '/productor/suelo') && (
          <FormularioSuelos data={data} scope={scope} onAdd={addRecords} />
        )}
        {path === '/productor/andina' && (
          <RegistroSiembraAndina setMsg={setMsg} />
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
        {(path === '/productor' || path === '/productor/metodo') && (
          <AsistenteSiembra
            data={data}
            scope={scope}
            onAdd={addRecords}
            onSync={handleSync}
            syncing={syncing}
            pending={totalPending}
            online={online}
            setMsg={setMsg}
          />
        )}
        {path === '/productor/simular' && <SimulacionAgricola />}
        {path === '/productor/qr' && <QrLote data={data} scope={scope} />}
        {path === '/productor/bitacora' && <BitacoraCampo data={data} scope={scope} onAdd={addRecords} />}
        {path === '/productor/metricas' && <MetricasPropias data={data} scope={scope} onAdd={addRecords} />}
        <button type="button" className="m-logout" onClick={onLogout}>
          Salir
        </button>
      </main>
      <nav className="m-dock" aria-label="Navegación">
        <div className="m-dock-inner">
          {NAV.map((t) => (
            <button
              key={t.path}
              type="button"
              className={`m-dock-btn ${path === t.path ? 'active' : ''}`}
              onClick={() => navigate(t.path)}
            >
              <AppIcon name={t.icon} alt="" className="dock-ico" />
              <span className="lbl">{t.label}</span>
            </button>
          ))}
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
              Campo
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
  const cols = plan.preview_cols || Math.min(10, plan.plantas_por_surco)
  const rows = plan.preview_rows || Math.min(6, plan.surcos)
  const showPapa = tipo?.id === 'intercalado_papa'
  const baseIcon = tipo?.id === 'vivero_semilla' ? 'penco' : tipo?.icon === 'papa' ? 'penco' : tipo?.icon || 'penco'

  return (
    <div className="m-plan">
      <div className="m-plan-stats">
        <div>
          <strong>{plan.pencos_totales.toLocaleString()}</strong>
          <span>{plan.vivero ? 'plantines' : 'pencos'}</span>
        </div>
        <div>
          <strong>{plan.cuarteles}</strong>
          <span>cuarteles</span>
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
      <div className="plan-grid plan-field" aria-label="Vista previa de plantación">
        {Array.from({ length: rows }).map((_, ri) => (
          <div key={ri} className="plan-row">
            {Array.from({ length: cols }).map((__, ci) => (
              <span key={ci} className="plan-plant">
                <AppIcon name={showPapa && ci % 2 === 1 ? 'papa' : baseIcon} alt="" />
              </span>
            ))}
          </div>
        ))}
      </div>
      <p className="plan-grid-caption">
        Cada ícono = 1 planta en el marco. Vista esquemática ({rows} surcos × {cols} plantas). Total real:{' '}
        {plan.pencos_totales.toLocaleString()}.
      </p>
      <p className="m-plan-consejo">{plan.division.consejo}</p>
    </div>
  )
}

function AsistenteSiembra({ data, scope, onAdd, onSync, syncing, pending, online, setMsg }) {
  const [step, setStep] = useState(0)
  const [certMsg, setCertMsg] = useState(null)
  const [form, setForm] = useState({
    parcela_id: scope.parcelas[0]?.id || '',
    edad_madre: '4',
    peso: '2.0',
    roseta: '9.5',
    no_bofo: false,
    desinfeccion: false,
    sanitario: false,
    cicatrizacion: false,
    dias_cicatrizacion: 0,
    entre_plantas_m: '1.5',
    trazado_ok: false,
    intercalado_ok: false,
    profundidad: '3/4',
    apisonado: false,
  })

  const edadVal = parseFloat(form.edad_madre)
  const rosetaVal = parseFloat(form.roseta) || 0
  const pesoVal = parseFloat(form.peso) || 0
  const edadOk = edadVal >= 3 && edadVal <= 5
  const rosetaOk = rosetaVal >= 8 && rosetaVal <= 11
  const pesoOk = pesoVal >= 1.5 && pesoVal <= 3.0
  const apto = edadOk && rosetaOk && pesoOk && form.no_bofo
  const dens = densidadPorSeparacion(form.entre_plantas_m)
  const steps = ['Hijuelo', 'Sol', 'Surcos', 'Plantar']
  const stepIco = ['firme', 'sol', 'surcos', 'apisonar']

  async function finish(e) {
    e.preventDefault()
    const incomplete =
      !apto ||
      !form.desinfeccion ||
      !form.sanitario ||
      !form.cicatrizacion ||
      !form.trazado_ok ||
      !form.apisonado

    let parcelaId = form.parcela_id
    let nextParcelas = data.parcelas
    if (!parcelaId) {
      parcelaId = crypto.randomUUID()
      nextParcelas = [
        ...data.parcelas,
        {
          id: parcelaId,
          productor_id: data.session.productor_id,
          nombre: 'Parcela Método Mexicano',
          ph: 6.5,
          fecha_establecimiento: new Date().toISOString().slice(0, 10),
          tipo_suelo: 'franco',
          permeabilidad: 'media',
          recomendacion_ph: 'pH en rango óptimo para Penco/Agave (6.0–7.0)',
          synced_at: null,
        },
      ]
    }
    const plantaId = crypto.randomUUID()
    onAdd({
      parcelas: nextParcelas,
      plantas: [
        ...data.plantas,
        {
          id: plantaId,
          parcela_id: parcelaId,
          codigo: `MX-${Date.now().toString(36)}`,
          fecha_siembra: new Date().toISOString().slice(0, 10),
          peso_hijuelo_kg: pesoVal,
          tamano_roseta_inicial_cm: rosetaVal,
          edad_planta_madre_anios: edadVal,
          dias_cicatrizacion: form.dias_cicatrizacion,
          tratamiento_sanitario: Boolean(form.sanitario),
          metodo_desinfeccion: form.desinfeccion ? 'fuego' : 'pendiente',
          hijuelo_apto: Boolean(apto),
          estado: 'activa',
          notas: `Método Mexicano. Profundidad ${form.profundidad}. Surco ${ESPACIO_SURCO_M} m · planta ${dens.entre_plantas_m} m (${dens.plantas_por_ha}/ha).${incomplete ? ' Registro parcial — revisar guía.' : ' Apisonado Carchi.'}`,
          synced_at: null,
        },
      ],
    })

    if (incomplete) {
      setCertMsg({
        type: 'warn',
        text: 'Guardado. Faltan algunos consejos de la guía; revísalos cuando puedas.',
      })
    }

    const certPayload = {
      parcela_id: parcelaId,
      hijuelos_seleccionados_ok: Boolean(apto),
      herramientas_desinfectadas: Boolean(form.desinfeccion),
      cicatrizacion_sol_completa: Boolean(form.cicatrizacion && form.dias_cicatrizacion >= 10),
      trazo_tres_metros_ok: Boolean(form.trazado_ok),
    }

    if (!incomplete && online && data.session?.access_token) {
      try {
        // Asegurar que la parcela exista en el servidor antes de certificar
        await ensureProductor(
          {
            id: data.session.productor_id,
            nombre: data.productor.nombre || data.session.email.split('@')[0],
            email: data.session.email,
            comunidad: data.productor.comunidad,
            activo: true,
          },
          data.session.access_token
        )
        await syncPush(
          {
            productor_id: data.session.productor_id,
            parcelas: nextParcelas
              .filter((p) => p.id === parcelaId)
              .map((p) => ({ ...p, productor_id: data.session.productor_id })),
            plantas: [],
            mediciones: [],
            bitacora: [],
          },
          data.session.access_token
        )
        const cert = await certificarLote(certPayload, data.session.access_token)
        setCertMsg({
          type: cert.apto_pago_preferencial ? 'success' : 'warn',
          text: cert.mensaje || cert.estado,
        })
        if (setMsg) setMsg({ type: cert.apto_pago_preferencial ? 'success' : 'warn', text: cert.mensaje })
      } catch (err) {
        setCertMsg({
          type: 'warn',
          text: `Guardado. Certificación luego: ${err.message}`,
        })
      }
    } else if (!incomplete) {
      setCertMsg({
        type: 'info',
        text: 'Guardado en el teléfono. Se certifica al sincronizar.',
      })
      try {
        const queue = loadCertPending()
        queue.push(certPayload)
        saveCertPending(queue)
      } catch {
        /* ignore */
      }
    }

    setStep(0)
    setForm((f) => ({
      ...f,
      no_bofo: false,
      desinfeccion: false,
      sanitario: false,
      cicatrizacion: false,
      dias_cicatrizacion: 0,
      trazado_ok: false,
      intercalado_ok: false,
      apisonado: false,
    }))
  }

  return (
    <>
      {certMsg && <div className={`m-toast ${certMsg.type === 'info' ? 'info' : certMsg.type}`}>{certMsg.text}</div>}

      <div className="guia-hero compact">
        <p className="guia-kicker">Método mexicano · guía flexible</p>
        <h2>Consejos de siembra</h2>
        <p>Toca cualquier paso. Nada se bloquea: es una guía, no un examen.</p>
      </div>

      <div className="m-steps">
        {steps.map((s, i) => (
          <button
            key={s}
            type="button"
            className={`m-step ${i === step ? 'on' : i < step ? 'done' : ''}`}
            onClick={() => setStep(i)}
          >
            <span>
              <AppIcon name={stepIco[i]} alt="" className="glyph-step" />
            </span>
            <small>{s}</small>
          </button>
        ))}
      </div>

      <form className="m-card" onSubmit={finish}>
        {step === 0 && (
          <section>
            <p className="guia-inline-tip">
              Madre 3–5 años, roseta 8–11 cm, peso 1.5–3 kg, firme (no bofo).
            </p>
            {scope.parcelas.length > 0 && (
              <select
                className="m-select"
                value={form.parcela_id}
                onChange={(e) => setForm({ ...form, parcela_id: e.target.value })}
              >
                {scope.parcelas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            )}
            <div className="m-hero-num">
              <span>Madre · años {edadOk ? '✓' : '3–5'}</span>
              <Stepper
                value={form.edad_madre}
                min={1}
                max={12}
                step={0.5}
                decimals={1}
                onChange={(edad_madre) => setForm({ ...form, edad_madre })}
              />
            </div>
            <div className="m-hero-num">
              <span>Roseta · cm {rosetaOk ? '✓' : '8–11'}</span>
              <div className="m-ph-big">{rosetaVal.toFixed(1)}</div>
              <input
                type="range"
                min="0"
                max="15"
                step="0.1"
                value={form.roseta}
                onChange={(e) => setForm({ ...form, roseta: e.target.value })}
              />
            </div>
            <div className="m-hero-num">
              <span>Peso · kg {pesoOk ? '✓' : '1.5–3'}</span>
              <Stepper
                value={form.peso}
                min={0.5}
                max={5}
                step={0.1}
                decimals={1}
                onChange={(peso) => setForm({ ...form, peso })}
              />
            </div>
            <TapToggle
              on={form.no_bofo}
              icon="firme"
              title="Firme, no bofo"
              onToggle={() => setForm({ ...form, no_bofo: !form.no_bofo })}
            />
          </section>
        )}

        {step === 1 && (
          <section>
            <p className="guia-inline-tip">
              Desinfecta al fuego, pasta sanitaria y 10 días al sol antes de enterrar.
            </p>
            <TapToggle
              on={form.desinfeccion}
              icon="fuego"
              title="Cuchillo al fuego"
              onToggle={() => setForm({ ...form, desinfeccion: !form.desinfeccion })}
            />
            <TapToggle
              on={form.sanitario}
              icon="pasta"
              title="Pasta sanitaria"
              onToggle={() => setForm({ ...form, sanitario: !form.sanitario })}
            />
            <div className="m-sun">
              <AppIcon name="sol" alt="" className="glyph-lg" />
              <div className="m-ph-big">{form.dias_cicatrizacion}</div>
              <strong>días al sol</strong>
              <input
                type="range"
                min="0"
                max="14"
                step="1"
                value={form.dias_cicatrizacion}
                onChange={(e) => {
                  const d = parseInt(e.target.value, 10)
                  setForm({ ...form, dias_cicatrizacion: d, cicatrizacion: d >= 10 })
                }}
              />
              <p>
                {form.dias_cicatrizacion >= 10
                  ? 'Cicatriz lista para plantar'
                  : `Consejo: espera ${10 - form.dias_cicatrizacion} día(s) más`}
              </p>
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <p className="guia-inline-tip">
              Surcos ~{ESPACIO_SURCO_M} m; deja calles para papa/quinoa el primer año.
            </p>
            <div className="trazado-visual">
              <svg viewBox="0 0 320 140" width="100%" aria-hidden>
                {[40, 120, 200, 280].map((x) => (
                  <g key={x}>
                    <line x1={x} y1="16" x2={x} y2="118" stroke="#7cb342" strokeWidth="4" />
                    {[32, 62, 92].map((y) => (
                      <circle key={y} cx={x} cy={y} r="9" fill="#aed581" />
                    ))}
                  </g>
                ))}
                <line x1="40" y1="128" x2="120" y2="128" stroke="#ffb74d" strokeWidth="3" />
              </svg>
            </div>
            <div className="m-hero-num">
              <span>Entre plantas</span>
              <div className="m-ph-big">{dens.entre_plantas_m.toFixed(1)} m</div>
              <input
                type="range"
                min="1"
                max="1.5"
                step="0.1"
                value={form.entre_plantas_m}
                onChange={(e) => setForm({ ...form, entre_plantas_m: e.target.value })}
              />
              <p>
                Surco {ESPACIO_SURCO_M} m · {dens.plantas_por_ha.toLocaleString()}/ha
              </p>
            </div>
            <TapToggle
              on={form.trazado_ok}
              icon="regla"
              title={`Surcos a ${ESPACIO_SURCO_M} m`}
              onToggle={() => setForm({ ...form, trazado_ok: !form.trazado_ok })}
            />
            <TapToggle
              on={form.intercalado_ok}
              icon="papa"
              title="Calles para papa / quinoa"
              onToggle={() => setForm({ ...form, intercalado_ok: !form.intercalado_ok })}
            />
          </section>
        )}

        {step === 3 && (
          <section>
            <p className="guia-inline-tip">
              Entierra ¾ de la piña y apisona bien: el viento de Carchi tumba hijuelos flojos.
            </p>
            <div className="siembra-visual">
              <svg viewBox="0 0 280 160" width="100%" className="siembra-svg">
                <rect x="0" y="100" width="280" height="60" fill="#5d4037" />
                <ellipse cx="140" cy="88" rx="40" ry="30" fill="#8d6e63" />
                <path d="M140 62 L118 12 L140 28 L162 10 Z" fill="#7cb342" />
                <path d="M140 64 L96 34 L136 48 Z" fill="#9ccc65" />
                <path d="M140 64 L184 32 L144 48 Z" fill="#9ccc65" />
              </svg>
            </div>
            <div className="m-chip-row">
              <button
                type="button"
                className={`m-chip ${form.profundidad === '1/2' ? 'on' : ''}`}
                onClick={() => setForm({ ...form, profundidad: '1/2' })}
              >
                ½ piña
              </button>
              <button
                type="button"
                className={`m-chip ${form.profundidad === '3/4' ? 'on' : ''}`}
                onClick={() => setForm({ ...form, profundidad: '3/4' })}
              >
                ¾ piña
              </button>
            </div>
            <TapToggle
              on={form.apisonado}
              icon="apisonar"
              title="Apisonar (viento Carchi)"
              onToggle={() => setForm({ ...form, apisonado: !form.apisonado })}
            />
          </section>
        )}

        <div className="m-nav-btns">
          {step > 0 && (
            <button type="button" className="m-btn ghost" onClick={() => setStep(step - 1)}>
              Anterior
            </button>
          )}
          {step < 3 && (
            <button type="button" className="m-btn" onClick={() => setStep(step + 1)}>
              Siguiente consejo
            </button>
          )}
          {step === 3 && (
            <button type="submit" className="m-btn">
              Guardar planta
            </button>
          )}
        </div>
      </form>
      <button className="m-btn sync" onClick={onSync} disabled={syncing} type="button">
        {syncing ? 'Enviando…' : pending ? `Subir ${pending}` : 'Sincronizar'}
      </button>
    </>
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
