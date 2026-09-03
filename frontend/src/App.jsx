import { useCallback, useEffect, useState } from 'react'
import { checkHealth, ensureProductor, loginUser, registerUser, syncPush } from './api'
import {
  applySession,
  estimarCarbono,
  getGps,
  hijueloApto,
  loadStore,
  recomendacionPh,
  resetStore,
  saveStore,
} from './store'

const TABS = [
  { id: 'inicio', icon: '🏠', label: 'Inicio' },
  { id: 'parcelas', icon: '🗺️', label: 'Parcelas' },
  { id: 'plantas', icon: '🌱', label: 'Plantas' },
  { id: 'mediciones', icon: '📏', label: 'Medir' },
  { id: 'bitacora', icon: '📋', label: 'Bitácora' },
]

const TIPOS_BITACORA = [
  { value: 'riego', label: 'Riego' },
  { value: 'poda_sanitaria', label: 'Poda sanitaria' },
  { value: 'fitosanitario', label: 'Fitosanitario' },
  { value: 'scouting_visual', label: 'Scouting visual' },
  { value: 'monitoreo', label: 'Monitoreo' },
]

const TIPOS_SUELO = ['franco', 'arenoso', 'arcilloso', 'limoso', 'franco-arenoso', 'franco-arcilloso']

function countPending(data) {
  const all = [...data.parcelas, ...data.plantas, ...data.mediciones, ...data.bitacora]
  return all.filter((r) => !r.synced_at).length
}

export default function App() {
  const [tab, setTab] = useState('inicio')
  const [data, setData] = useState(loadStore)
  const [online, setOnline] = useState(navigator.onLine)
  const [apiOk, setApiOk] = useState(false)
  const [msg, setMsg] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authBusy, setAuthBusy] = useState(false)

  const persist = useCallback((next) => {
    setData(next)
    saveStore(next)
  }, [])

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    checkHealth().then(setApiOk)
    const timer = setInterval(() => checkHealth().then(setApiOk), 4000)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(timer)
    }
  }, [])

  const pending = countPending(data)

  async function handleSync() {
    if (!online) {
      setMsg({ type: 'warn', text: 'Sin conexión. Los datos se guardan localmente.' })
      return
    }
    setSyncing(true)
    setMsg(null)
    try {
      const ok = await checkHealth()
      setApiOk(ok)
      if (!ok) throw new Error('Backend no disponible en localhost:8000')

      if (!data.session?.access_token) throw new Error('Inicia sesión para sincronizar')
      if (data.session.rol === 'empresa') throw new Error('La cuenta empresa no sincroniza bitácora de campo')
      if (!data.session.productor_id && !data.productor.id) throw new Error('Esta cuenta no tiene productor_id')

      const productor = await ensureProductor({
        id: data.session.productor_id || data.productor.id,
        nombre: data.productor.nombre || data.session.email.split('@')[0],
        email: data.session.email || data.productor.email,
        comunidad: data.productor.comunidad,
        activo: true,
      }, data.session.access_token)

      const productorId = productor.id
      const remapId = (records, field) =>
        records.map((r) => (r[field] ? { ...r, [field]: productorId } : r))

      const parcelas = remapId(data.parcelas, 'productor_id').map((p) => ({
        ...p,
        productor_id: productorId,
      }))
      const bitacora = remapId(data.bitacora, 'productor_id').map((b) => ({
        ...b,
        productor_id: productorId,
        planta_id: b.planta_id || null,
      }))

      const payload = {
        productor_id: productorId,
        parcelas,
        plantas: data.plantas,
        mediciones: data.mediciones.map((m) => ({
          ...m,
          calcular_carbono: true,
          algoritmo_version: 'v1.0',
        })),
        bitacora,
      }
      await syncPush(payload, data.session.access_token)
      const now = new Date().toISOString()
      const synced = {
        ...data,
        productor: { ...data.productor, id: productorId },
        lastSync: now,
        parcelas: parcelas.map((p) => ({ ...p, synced_at: now })),
        plantas: data.plantas.map((p) => ({ ...p, synced_at: now })),
        mediciones: data.mediciones.map((m) => ({ ...m, synced_at: now })),
        bitacora: bitacora.map((b) => ({ ...b, synced_at: now })),
      }
      persist(synced)
      setMsg({ type: 'success', text: 'Sincronización completada con el servidor.' })
    } catch (e) {
      setMsg({ type: 'warn', text: `${e.message}. Modo offline activo — datos guardados localmente.` })
    } finally {
      setSyncing(false)
    }
  }

  function addParcela(form) {
    const ph = form.ph ? parseFloat(form.ph) : null
    const parcela = {
      id: crypto.randomUUID(),
      nombre: form.nombre,
      ubicacion_lat: form.lat || null,
      ubicacion_lng: form.lng || null,
      area_hectareas: form.area ? parseFloat(form.area) : null,
      ph,
      tipo_suelo: form.tipo_suelo || 'franco',
      permeabilidad: 'media',
      recomendacion_ph: recomendacionPh(ph),
      synced_at: null,
      created_at: new Date().toISOString(),
    }
    persist({ ...data, parcelas: [...data.parcelas, parcela] })
    setMsg({ type: 'success', text: `Parcela "${form.nombre}" guardada offline.` })
  }

  function addPlanta(form) {
    const apto = hijueloApto(form.peso, form.roseta, form.edad_madre)
    const planta = {
      id: crypto.randomUUID(),
      parcela_id: form.parcela_id,
      codigo: form.codigo || `P-${Date.now().toString(36)}`,
      fecha_siembra: form.fecha_siembra,
      edad_planta_madre_anios: form.edad_madre ? parseFloat(form.edad_madre) : null,
      peso_hijuelo_kg: form.peso ? parseFloat(form.peso) : null,
      tamano_roseta_inicial_cm: form.roseta ? parseFloat(form.roseta) : null,
      dias_cicatrizacion: 10,
      tratamiento_sanitario: form.tratamiento === 'si',
      estado: 'activa',
      hijuelo_apto: apto,
      synced_at: null,
      created_at: new Date().toISOString(),
    }
    persist({ ...data, plantas: [...data.plantas, planta] })
    setMsg({
      type: apto === false ? 'warn' : 'success',
      text: apto === false ? 'Planta guardada. Hijuelo NO apto según reglas agronómicas.' : 'Planta registrada correctamente.',
    })
  }

  function addMedicion(form) {
    const carbono = estimarCarbono(form.altura, form.diametro, parseInt(form.edad_meses || 12, 10))
    const medicion = {
      id: crypto.randomUUID(),
      planta_id: form.planta_id,
      fecha_medicion: form.fecha,
      altura_roseta_cm: parseFloat(form.altura),
      diametro_roseta_cm: parseFloat(form.diametro),
      numero_hojas: parseInt(form.hojas, 10),
      estado_general: 'sana',
      tipo_carbono: 'estimado',
      edad_planta_meses: parseInt(form.edad_meses || 12, 10),
      ...carbono,
      synced_at: null,
      created_at: new Date().toISOString(),
    }
    persist({ ...data, mediciones: [...data.mediciones, medicion] })
    setMsg({ type: 'success', text: `Carbono estimado: ${carbono.carbono_acumulado_kg} kg` })
  }

  async function addBitacora(form) {
    const gps = await getGps()
    const bitacora = {
      id: crypto.randomUUID(),
      productor_id: data.productor.id,
      parcela_id: form.parcela_id,
      planta_id: form.planta_id || null,
      tipo: form.tipo,
      fecha_programada: form.fecha,
      estado: 'completada',
      gps_lat: gps.lat,
      gps_lng: gps.lng,
      gps_precision_m: gps.precision,
      datos: form.tipo === 'riego' ? { estacion: form.estacion, litros: form.litros } : { nota: form.notas },
      notas: form.notas,
      synced_at: null,
      created_at: new Date().toISOString(),
    }
    persist({ ...data, bitacora: [...data.bitacora, bitacora] })
    setMsg({ type: 'info', text: `Bitácora de ${form.tipo} registrada${gps.lat ? ' con GPS' : ''}.` })
  }

  async function handleAuth(form) {
    setAuthBusy(true)
    setMsg(null)
    try {
      const auth = form.mode === 'register'
        ? await registerUser({
            email: form.email,
            password: form.password,
            rol: form.rol,
            nombre: form.nombre || undefined,
            comunidad: form.comunidad || undefined,
          })
        : await loginUser({ email: form.email, password: form.password })
      persist(applySession(data, auth, { nombre: form.nombre }))
      setMsg({ type: 'success', text: `Sesión iniciada como ${auth.rol}.` })
    } catch (e) {
      setMsg({ type: 'warn', text: e.message })
    } finally {
      setAuthBusy(false)
    }
  }

  function handleLogout() {
    persist(resetStore())
    setMsg({ type: 'info', text: 'Sesión cerrada.' })
  }

  const loggedIn = Boolean(data.session?.access_token)
  const isEmpresa = data.session?.rol === 'empresa'
  const totalCarbono = data.mediciones.reduce((s, m) => s + parseFloat(m.carbono_acumulado_kg || 0), 0).toFixed(2)

  if (!loggedIn) {
    return (
      <div className="app-shell">
        <header className="header">
          <h1>🌿 PencoLab</h1>
          <p>Inicia sesión para gestionar tu cultivo</p>
          <div className="status-bar">
            <span className={`badge ${online ? 'online' : 'offline'}`}>{online ? '● Online' : '● Offline'}</span>
            <span className={`badge ${apiOk ? 'online' : 'offline'}`}>API {apiOk ? 'OK' : 'Local'}</span>
          </div>
        </header>
        <main className="content">
          {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}
          <AuthScreen
            mode={authMode}
            busy={authBusy}
            onMode={setAuthMode}
            onSubmit={handleAuth}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="header">
        <h1>🌿 PencoLab</h1>
        <p>{data.productor.nombre || data.session.email} · {data.session.rol}{data.productor.comunidad ? ` · ${data.productor.comunidad}` : ''}</p>
        <div className="status-bar">
          <span className={`badge ${online ? 'online' : 'offline'}`}>
            {online ? '● Online' : '● Offline'}
          </span>
          <span className={`badge ${apiOk ? 'online' : 'offline'}`}>
            API {apiOk ? 'OK' : 'Local'}
          </span>
          {pending > 0 && <span className="badge pending">{pending} pendientes</span>}
          <span className="badge pending">{data.session.rol}</span>
        </div>
      </header>

      <main className="content">
        {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}

        {tab === 'inicio' && (
          <Inicio
            data={data}
            totalCarbono={totalCarbono}
            pending={pending}
            syncing={syncing}
            onSync={handleSync}
            onReset={() => { persist(resetStore()); setMsg({ type: 'info', text: 'Datos y sesión reiniciados.' }) }}
            onLogout={handleLogout}
            isEmpresa={isEmpresa}
          />
        )}
        {tab === 'parcelas' && (isEmpresa ? <EmpresaNotice /> : <Parcelas data={data} onAdd={addParcela} />)}
        {tab === 'plantas' && (isEmpresa ? <EmpresaNotice /> : <Plantas data={data} onAdd={addPlanta} />)}
        {tab === 'mediciones' && (isEmpresa ? <EmpresaNotice /> : <Mediciones data={data} onAdd={addMedicion} />)}
        {tab === 'bitacora' && (isEmpresa ? <EmpresaNotice /> : <Bitacora data={data} onAdd={addBitacora} />)}
      </main>

      <nav className="nav-bottom">
        {TABS.map((t) => (
          <button key={t.id} className={`nav-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <span className="icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

function AuthScreen({ mode, busy, onMode, onSubmit }) {
  const [form, setForm] = useState({
    email: '',
    password: '',
    rol: 'productor',
    nombre: '',
    comunidad: 'Pencos del Norte',
  })

  function submit(e) {
    e.preventDefault()
    onSubmit({ ...form, mode })
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h3>
      <p style={{ marginBottom: 14 }}>Roles: productor (campo) o empresa (solo consulta de cuenta).</p>
      {mode === 'register' && (
        <>
          <div className="form-group">
            <label>Nombre</label>
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="María Penco" />
          </div>
          <div className="form-group">
            <label>Rol</label>
            <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
              <option value="productor">Productor</option>
              <option value="empresa">Empresa</option>
            </select>
          </div>
        </>
      )}
      <div className="form-group">
        <label>Email</label>
        <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div className="form-group">
        <label>Contraseña</label>
        <input type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Enviando...' : mode === 'login' ? 'Entrar' : 'Registrarme'}
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        style={{ width: '100%', marginTop: 10 }}
        onClick={() => onMode(mode === 'login' ? 'register' : 'login')}
      >
        {mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
      </button>
    </form>
  )
}

function EmpresaNotice() {
  return (
    <div className="card">
      <h3>Cuenta empresa</h3>
      <p>El registro de parcelas, plantas y bitácora está reservado al rol productor. Tu JWT no incluye productor_id.</p>
    </div>
  )
}

function Inicio({ data, totalCarbono, pending, syncing, onSync, onReset, onLogout, isEmpresa }) {
  return (
    <>
      <div className="stats-grid">
        <div className="stat-card"><div className="value">{data.parcelas.length}</div><div className="label">Parcelas</div></div>
        <div className="stat-card"><div className="value">{data.plantas.length}</div><div className="label">Plantas</div></div>
        <div className="stat-card"><div className="value">{data.mediciones.length}</div><div className="label">Mediciones</div></div>
        <div className="stat-card"><div className="value">{totalCarbono}</div><div className="label">kg C total</div></div>
      </div>

      <div className="card">
        <h3>Modo Offline-First</h3>
        <p>Registra riego, podas y mediciones sin internet. Al recuperar conexión, sincroniza con el backend.</p>
        {data.lastSync && <p style={{ marginTop: 8 }}>Última sync: {new Date(data.lastSync).toLocaleString('es')}</p>}
        <button className="btn btn-sync" onClick={onSync} disabled={syncing || isEmpresa}>
          {isEmpresa ? 'Sync no disponible para empresa' : syncing ? 'Sincronizando...' : `🔄 Sincronizar${pending ? ` (${pending})` : ''}`}
        </button>
      </div>

      <div className="section-title">Reglas agronómicas activas</div>
      <div className="card">
        <span className="tag">pH 6.0–7.0 óptimo</span>
        <span className="tag">Hijuelo 1.5–3 kg</span>
        <span className="tag">Roseta 8–11 cm</span>
        <span className="tag">Madre 3–5 años</span>
        <span className="tag warn">Riego parco</span>
        <span className="tag">Carbono estimado</span>
      </div>

      <div className="fab-row">
        <button className="btn btn-secondary" onClick={onLogout}>Cerrar sesión</button>
        <button className="btn btn-secondary" onClick={onReset}>Reiniciar demo</button>
      </div>
    </>
  )
}

function Parcelas({ data, onAdd }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombre: '', ph: '', area: '', tipo_suelo: 'franco', lat: '', lng: '' })

  async function captureGps() {
    const gps = await getGps()
    setForm((f) => ({ ...f, lat: gps.lat || '', lng: gps.lng || '' }))
  }

  function submit(e) {
    e.preventDefault()
    onAdd(form)
    setShowForm(false)
    setForm({ nombre: '', ph: '', area: '', tipo_suelo: 'franco', lat: '', lng: '' })
  }

  return (
    <>
      <div className="fab-row">
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Nueva parcela'}
        </button>
      </div>

      {showForm && (
        <form className="card" onSubmit={submit}>
          <div className="form-group">
            <label>Nombre</label>
            <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Parcela Norte" />
          </div>
          <div className="form-group">
            <label>pH del suelo</label>
            <input type="number" step="0.1" min="0" max="14" value={form.ph} onChange={(e) => setForm({ ...form, ph: e.target.value })} placeholder="6.5" />
            {form.ph && <div className="alert info" style={{ marginTop: 8 }}>{recomendacionPh(form.ph)}</div>}
          </div>
          <div className="form-group">
            <label>Tipo de suelo</label>
            <select value={form.tipo_suelo} onChange={(e) => setForm({ ...form, tipo_suelo: e.target.value })}>
              {TIPOS_SUELO.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Área (ha)</label>
            <input type="number" step="0.01" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
          </div>
          <button type="button" className="btn btn-secondary" style={{ width: '100%', marginBottom: 10 }} onClick={captureGps}>
            📍 Capturar GPS
          </button>
          {form.lat && <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 10 }}>GPS: {form.lat}, {form.lng}</p>}
          <button type="submit" className="btn btn-primary">Guardar parcela</button>
        </form>
      )}

      {data.parcelas.length === 0 ? (
        <div className="empty-state"><div className="emoji">🗺️</div><p>Registra tu primera parcela con pH y georreferenciación</p></div>
      ) : (
        data.parcelas.map((p) => (
          <div key={p.id} className="card">
            <h3>{p.nombre} {!p.synced_at && <span className="tag warn">offline</span>}</h3>
            <p>pH: {p.ph ?? '—'} · Suelo: {p.tipo_suelo}</p>
            {p.recomendacion_ph && <div className="alert info" style={{ marginTop: 8 }}>{p.recomendacion_ph}</div>}
            {p.ubicacion_lat && <p style={{ marginTop: 6 }}>📍 {p.ubicacion_lat}, {p.ubicacion_lng}</p>}
          </div>
        ))
      )}
    </>
  )
}

function Plantas({ data, onAdd }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    parcela_id: '', codigo: '', fecha_siembra: new Date().toISOString().slice(0, 10),
    peso: '', roseta: '', edad_madre: '', tratamiento: 'si',
  })

  function submit(e) {
    e.preventDefault()
    onAdd(form)
    setShowForm(false)
  }

  const apto = hijueloApto(form.peso, form.roseta, form.edad_madre)

  return (
    <>
      <div className="fab-row">
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Nueva planta'}
        </button>
      </div>

      {showForm && (
        <form className="card" onSubmit={submit}>
          <div className="form-group">
            <label>Parcela</label>
            <select required value={form.parcela_id} onChange={(e) => setForm({ ...form, parcela_id: e.target.value })}>
              <option value="">Seleccionar...</option>
              {data.parcelas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Código</label>
            <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="P-001" />
          </div>
          <div className="form-group">
            <label>Fecha siembra</label>
            <input type="date" required value={form.fecha_siembra} onChange={(e) => setForm({ ...form, fecha_siembra: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Peso hijuelo (kg)</label>
            <input type="number" step="0.1" value={form.peso} onChange={(e) => setForm({ ...form, peso: e.target.value })} placeholder="1.5 - 3.0" />
          </div>
          <div className="form-group">
            <label>Roseta inicial (cm)</label>
            <input type="number" step="0.1" value={form.roseta} onChange={(e) => setForm({ ...form, roseta: e.target.value })} placeholder="8 - 11" />
          </div>
          <div className="form-group">
            <label>Edad planta madre (años)</label>
            <input type="number" step="0.5" value={form.edad_madre} onChange={(e) => setForm({ ...form, edad_madre: e.target.value })} placeholder="3 - 5" />
          </div>
          {apto !== null && (
            <div className={`alert ${apto ? 'success' : 'warn'}`}>
              {apto ? '✓ Hijuelo apto' : '✗ Hijuelo NO apto según reglas'}
            </div>
          )}
          <button type="submit" className="btn btn-primary">Registrar planta</button>
        </form>
      )}

      {data.plantas.length === 0 ? (
        <div className="empty-state"><div className="emoji">🌱</div><p>Registra hijuelos con validación agronómica</p></div>
      ) : (
        data.plantas.map((p) => {
          const parcela = data.parcelas.find((pa) => pa.id === p.parcela_id)
          return (
            <div key={p.id} className="card">
              <h3>{p.codigo} {!p.synced_at && <span className="tag warn">offline</span>}</h3>
              <p>{parcela?.nombre || 'Sin parcela'} · Siembra: {p.fecha_siembra}</p>
              <span className={`tag ${p.hijuelo_apto ? '' : 'danger'}`}>
                {p.hijuelo_apto ? 'Apto' : p.hijuelo_apto === false ? 'No apto' : 'Sin validar'}
              </span>
              <span className="tag">{p.estado}</span>
            </div>
          )
        })
      )}
    </>
  )
}

function Mediciones({ data, onAdd }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    planta_id: '', fecha: new Date().toISOString().slice(0, 10),
    altura: '', diametro: '', hojas: '', edad_meses: '12',
  })

  function submit(e) {
    e.preventDefault()
    onAdd(form)
    setShowForm(false)
  }

  const preview = form.altura && form.diametro ? estimarCarbono(form.altura, form.diametro, form.edad_meses) : null

  return (
    <>
      <div className="fab-row">
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Nueva medición'}
        </button>
      </div>

      {showForm && (
        <form className="card" onSubmit={submit}>
          <div className="form-group">
            <label>Planta</label>
            <select required value={form.planta_id} onChange={(e) => setForm({ ...form, planta_id: e.target.value })}>
              <option value="">Seleccionar...</option>
              {data.plantas.map((p) => <option key={p.id} value={p.id}>{p.codigo}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Fecha</label>
            <input type="date" required value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Altura roseta (cm)</label>
            <input type="number" step="0.1" required value={form.altura} onChange={(e) => setForm({ ...form, altura: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Diámetro roseta (cm)</label>
            <input type="number" step="0.1" required value={form.diametro} onChange={(e) => setForm({ ...form, diametro: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Número de hojas (pencas)</label>
            <input type="number" required value={form.hojas} onChange={(e) => setForm({ ...form, hojas: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Edad planta (meses)</label>
            <input type="number" value={form.edad_meses} onChange={(e) => setForm({ ...form, edad_meses: e.target.value })} />
          </div>
          {preview && (
            <div className="alert success">
              Carbono estimado: {preview.carbono_acumulado_kg} kg · CO₂: {preview.co2_equivalente_kg} kg
            </div>
          )}
          <button type="submit" className="btn btn-primary">Guardar medición</button>
        </form>
      )}

      {data.mediciones.length === 0 ? (
        <div className="empty-state"><div className="emoji">📏</div><p>Mide altura, diámetro y pencas para estimar carbono</p></div>
      ) : (
        data.mediciones.map((m) => {
          const planta = data.plantas.find((p) => p.id === m.planta_id)
          return (
            <div key={m.id} className="card">
              <h3>{planta?.codigo || 'Planta'} · {m.fecha_medicion} {!m.synced_at && <span className="tag warn">offline</span>}</h3>
              <p>Altura: {m.altura_roseta_cm} cm · Diámetro: {m.diametro_roseta_cm} cm · Hojas: {m.numero_hojas}</p>
              <span className="tag">C: {m.carbono_acumulado_kg} kg</span>
              <span className="tag">CO₂: {m.co2_equivalente_kg} kg</span>
              <span className="tag">{m.tipo_carbono}</span>
            </div>
          )
        })
      )}
    </>
  )
}

function Bitacora({ data, onAdd }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    parcela_id: '', planta_id: '', tipo: 'riego',
    fecha: new Date().toISOString().slice(0, 10),
    estacion: 'invierno', litros: '', notas: '',
  })

  function submit(e) {
    e.preventDefault()
    onAdd(form)
    setShowForm(false)
  }

  return (
    <>
      <div className="fab-row">
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Registrar actividad'}
        </button>
      </div>

      {showForm && (
        <form className="card" onSubmit={submit}>
          <div className="form-group">
            <label>Tipo de actividad</label>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              {TIPOS_BITACORA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Parcela</label>
            <select required value={form.parcela_id} onChange={(e) => setForm({ ...form, parcela_id: e.target.value })}>
              <option value="">Seleccionar...</option>
              {data.parcelas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Planta (opcional)</label>
            <select value={form.planta_id} onChange={(e) => setForm({ ...form, planta_id: e.target.value })}>
              <option value="">Ninguna</option>
              {data.plantas.filter((p) => p.parcela_id === form.parcela_id).map((p) => (
                <option key={p.id} value={p.id}>{p.codigo}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Fecha</label>
            <input type="date" required value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          </div>
          {form.tipo === 'riego' && (
            <>
              <div className="form-group">
                <label>Estación</label>
                <select value={form.estacion} onChange={(e) => setForm({ ...form, estacion: e.target.value })}>
                  <option value="invierno">Invierno (racionado)</option>
                  <option value="primavera">Primavera (según demanda)</option>
                  <option value="verano">Verano (reducción paulatina)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Litros</label>
                <input type="number" value={form.litros} onChange={(e) => setForm({ ...form, litros: e.target.value })} />
              </div>
            </>
          )}
          <div className="form-group">
            <label>Notas</label>
            <textarea rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary">Guardar en bitácora (con GPS)</button>
        </form>
      )}

      {data.bitacora.length === 0 ? (
        <div className="empty-state"><div className="emoji">📋</div><p>Registra riego, podas y fitosanitarios en campo</p></div>
      ) : (
        data.bitacora.map((b) => {
          const parcela = data.parcelas.find((p) => p.id === b.parcela_id)
          return (
            <div key={b.id} className="card">
              <h3>{b.tipo.replace('_', ' ')} · {b.fecha_programada} {!b.synced_at && <span className="tag warn">offline</span>}</h3>
              <p>{parcela?.nombre} · {b.estado}</p>
              {b.gps_lat && <p>📍 {b.gps_lat}, {b.gps_lng}</p>}
              {b.notas && <p>{b.notas}</p>}
            </div>
          )
        })
      )}
    </>
  )
}
