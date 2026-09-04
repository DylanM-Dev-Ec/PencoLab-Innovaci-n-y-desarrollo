import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { MapContainer, TileLayer, Polygon, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  fetchDashboardAlertas,
  fetchDashboardCrecimiento,
  fetchDashboardStats,
} from '../api'
import EficienciaMexico from '../components/EficienciaMexico'
import DashboardCorporativo from '../components/DashboardCorporativo'
import { EMPRESA_DEMO, PROTOCOLO_COCHINILLA } from '../empresaDemo'
import { B2B, CHART_GRID, CHART_TOOLTIP } from '../empresaTheme'
import { currentPath, navigate } from '../routing'
import { AppIcon } from '../components/AppIcon'
import EconomiaCircular from './EconomiaCircular'
import AnalisisCostos from './AnalisisCostos'
import { HA_ACTUALES } from '../agaveAndino'
import { loadCampoSnapshot, CAMPO_SNAPSHOT_KEY } from '../store'
import { buildProductorDemoSeed } from '../demoSeed'

const NAV = [
  {
    path: '/empresa',
    label: 'Resumen',
    desc: 'Vista general del proyecto y proyección',
    icon: IconGrid,
  },
  {
    path: '/empresa/costos',
    label: 'Costos',
    desc: 'Cuánto cuesta producir por hectárea',
    icon: IconTrend,
  },
  {
    path: '/empresa/circular',
    label: 'Residuos',
    desc: 'Ingresos extra con fibra, hoja y kirillas',
    icon: IconCycle,
  },
  {
    path: '/empresa/eficiencia',
    label: 'Método MX',
    desc: 'Comparación con el protocolo mexicano',
    icon: IconLeaf,
  },
  {
    path: '/empresa/mapa',
    label: 'Mapa',
    desc: 'Ubicación de las parcelas del productor',
    icon: IconMap,
  },
  {
    path: '/empresa/alertas',
    label: 'Alertas',
    desc: 'Avisos de plagas y salud del cultivo',
    icon: IconAlert,
  },
]

/** Valores de pitch hacia meta 15 t CO₂e y 3→20 ha */
const PITCH_STATS = {
  co2_verificado_ton: 4.8,
  co2_estimado_ton: 5.9,
  hectareas_actuales: HA_ACTUALES,
}

function co2Color(co2Ha) {
  if (co2Ha >= 3000) return B2B.forest
  if (co2Ha >= 1500) return B2B.teal
  if (co2Ha >= 700) return B2B.warn
  return B2B.danger
}

/** Solo lectura: instantánea del productor (nunca se escribe desde empresa). */
function readCampoData() {
  const snap = loadCampoSnapshot()
  if (snap && ((snap.residuos || []).length || (snap.parcelas || []).length)) {
    return { ...snap, from_snapshot: true, read_only: true }
  }
  const demo = buildProductorDemoSeed({
    email: 'dylan@pencolab.ec',
    nombre: 'Dylan · Agricultor (demo campo)',
  })
  return { ...demo, from_snapshot: false, updated_at: null, read_only: true }
}

export default function EmpresaApp({ token, email, onLogout, onHome }) {
  const path = currentPath()
  const [collapsed, setCollapsed] = useState(false)
  const [stats, setStats] = useState(EMPRESA_DEMO.dashboard)
  const [parcelas, setParcelas] = useState(EMPRESA_DEMO.parcelas)
  const [alertas, setAlertas] = useState(EMPRESA_DEMO.alertas)
  const [crecimiento, setCrecimiento] = useState(EMPRESA_DEMO.crecimiento)
  const [demo, setDemo] = useState(true)
  const [campoData, setCampoData] = useState(() => readCampoData())
  const [lastRefresh, setLastRefresh] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  async function refreshDashboard({ silent = false } = {}) {
    if (!token) return
    if (!silent) setRefreshing(true)
    try {
      const [s, a, c] = await Promise.all([
        fetchDashboardStats(token),
        fetchDashboardAlertas(token),
        fetchDashboardCrecimiento(token),
      ])
      const empty = !s.parcelas && !s.plantas
      const geo = s.parcelas_geo?.length ? s.parcelas_geo : EMPRESA_DEMO.parcelas
      setStats(
        empty
          ? EMPRESA_DEMO.dashboard
          : {
              ...s,
              demo: false,
              serie_carbono: s.serie_carbono?.length ? s.serie_carbono : EMPRESA_DEMO.dashboard.serie_carbono,
              comparativo: s.comparativo?.length ? s.comparativo : EMPRESA_DEMO.dashboard.comparativo,
            }
      )
      setParcelas(geo)
      setAlertas(a?.length ? a : EMPRESA_DEMO.alertas)
      setCrecimiento(c?.productores?.length ? { ...c, series: {} } : EMPRESA_DEMO.crecimiento)
      setDemo(empty || !geo?.length)
      setLastRefresh(new Date())
      setCampoData(readCampoData())
    } catch {
      setDemo(true)
      setCampoData(readCampoData())
    } finally {
      if (!silent) setRefreshing(false)
    }
  }

  // Carga inicial + refresco periódico del dashboard (cada 15 s)
  useEffect(() => {
    let cancelled = false
    async function boot() {
      if (cancelled) return
      await refreshDashboard({ silent: true })
    }
    boot()
    const iv = setInterval(() => {
      if (!cancelled) refreshDashboard({ silent: true })
    }, 15000)
    return () => {
      cancelled = true
      clearInterval(iv)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Escucha cambios del snapshot del productor — solo lectura
  useEffect(() => {
    function onStorage(e) {
      if (e.key === CAMPO_SNAPSHOT_KEY) setCampoData(readCampoData())
    }
    window.addEventListener('storage', onStorage)
    const iv = setInterval(() => setCampoData(readCampoData()), 12000)
    return () => {
      window.removeEventListener('storage', onStorage)
      clearInterval(iv)
    }
  }, [])

  const kpis = useMemo(() => {
    const totalCo2 = Number(stats.co2_total_ton || 0)
    const ver = Number(stats.co2_verificado_ton || 0)
    const est = Number(stats.co2_estimado_ton || 0)
    const pctVer = totalCo2 > 0 ? (ver / totalCo2) * 100 : 0
    const pctEst = totalCo2 > 0 ? (est / totalCo2) * 100 : 0
    const ha = parcelas.reduce((s, p) => s + (Number(p.area_hectareas) || 0), 0)
    const alertasActivas = alertas.length
    return {
      totalCo2,
      pctVer,
      pctEst,
      productores: stats.productores || 0,
      hectareas: ha,
      alertasActivas,
    }
  }, [stats, parcelas, alertas])

  const pageTitle = NAV.find((n) => n.path === path)?.label || 'Resumen'
  const pageDesc = NAV.find((n) => n.path === path)?.desc || ''

  return (
    <div className={`b2b-shell ${collapsed ? 'is-collapsed' : ''}`}>
      <aside className="b2b-sidebar">
        <div className="b2b-brand">
          <span className="b2b-mark" aria-hidden>
            <AppIcon name="logo" alt="" />
          </span>
          {!collapsed && (
            <div>
              <strong>Pencos del Norte</strong>
              <span>Consola empresarial</span>
            </div>
          )}
        </div>
        <nav className="b2b-nav" aria-label="Menú empresa">
          {NAV.map((t) => {
            const Icon = t.icon
            const on = path === t.path
            return (
              <button
                key={t.path}
                type="button"
                className={on ? 'on' : ''}
                title={t.desc}
                aria-label={`${t.label}: ${t.desc}`}
                aria-current={on ? 'page' : undefined}
                onClick={() => navigate(t.path)}
              >
                <Icon />
                {!collapsed && (
                  <span className="b2b-nav-copy">
                    <strong>{t.label}</strong>
                    <small>{t.desc}</small>
                  </span>
                )}
              </button>
            )
          })}
        </nav>
        <div className="b2b-side-foot">
          <button type="button" className="b2b-ghost" onClick={() => setCollapsed((v) => !v)} title="Colapsar menú">
            <IconPanel />
            {!collapsed && <span>Colapsar</span>}
          </button>
          <button type="button" className="b2b-ghost" onClick={onHome}>
            <IconHome />
            {!collapsed && <span>Inicio</span>}
          </button>
          <button type="button" className="b2b-ghost" onClick={onLogout}>
            <IconExit />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      <div className="b2b-main">
        <header className="b2b-topbar">
          <div>
            <p className="b2b-kicker">Pencos del Norte · auto-refresh 15s</p>
            <h1>{pageTitle}</h1>
            {pageDesc ? <p className="b2b-page-desc">{pageDesc}</p> : null}
            {lastRefresh && (
              <p className="b2b-refresh-meta">
                Actualizado {lastRefresh.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                {refreshing ? ' · refrescando…' : ''}
              </p>
            )}
          </div>
          <div className="b2b-user">
            <button
              type="button"
              className="b2b-ghost b2b-refresh-btn"
              onClick={() => refreshDashboard()}
              disabled={refreshing}
              title="Actualizar ahora"
            >
              {refreshing ? '…' : '↻'}
            </button>
            <span className="b2b-avatar">{(email || 'E')[0].toUpperCase()}</span>
            <div>
              <strong>{email}</strong>
              <span>Empresa</span>
            </div>
          </div>
        </header>

        <div className="b2b-body">
          <div className="b2b-banner">
            Solo lectura: residuos, parcelas y campo vienen de la app del productor. La empresa no puede
            modificarlos.
            {campoData.from_snapshot
              ? campoData.updated_at
                ? ` · Actualizado ${new Date(campoData.updated_at).toLocaleString('es-EC')}`
                : ''
              : ' · Mostrando demo de campo hasta que el productor registre datos.'}
            {demo ? ' Dashboard geo de referencia Carchi mientras sincroniza.' : ''}
          </div>

          {path === '/empresa' && (
            <DashboardCorporativo
              stats={
                demo
                  ? PITCH_STATS
                  : {
                      co2_verificado_ton: Number(stats.co2_verificado_ton || PITCH_STATS.co2_verificado_ton),
                      co2_estimado_ton: Number(stats.co2_estimado_ton || PITCH_STATS.co2_estimado_ton),
                      hectareas_actuales:
                        Number(
                          parcelas.reduce((s, p) => s + (Number(p.area_hectareas) || 0), 0).toFixed(1)
                        ) || PITCH_STATS.hectareas_actuales,
                    }
              }
              residuos={campoData.residuos || []}
            />
          )}
          {path === '/empresa/costos' && (
            <AnalisisCostos
              mode="empresa"
              residuos={campoData.residuos || []}
              hectareasFijas={(campoData.parcelas || []).reduce(
                (s, p) => s + (Number(p.area_hectareas) || 0),
                0
              )}
              readOnlyCampo
            />
          )}
          {path === '/empresa/circular' && (
            <EconomiaCircular data={campoData} mode="empresa" />
          )}
          {path === '/empresa/eficiencia' && (
            <>
              <KpiRow kpis={kpis} />
              <EficienciaMexico token={token} demo={demo} />
            </>
          )}
          {path === '/empresa/mapa' && <MapaCalor parcelas={parcelas} />}
          {path === '/empresa/crecimiento' && (
            <HistorialCrecimiento token={token} crecimiento={crecimiento} demo={demo} />
          )}
          {path === '/empresa/alertas' && <AlertasFito alertas={alertas} />}
          {path === '/empresa/carbono' && (
            <>
              <KpiRow kpis={kpis} />
              <DashboardCarbono stats={stats} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function KpiRow({ kpis }) {
  return (
    <section className="b2b-kpis" aria-label="Indicadores ejecutivos">
      <article className="b2b-kpi">
        <span className="b2b-kpi-ico co2" aria-hidden>
          <AppIcon name="co2" alt="" />
        </span>
        <span className="b2b-kpi-label">t CO₂ capturado</span>
        <strong className="b2b-kpi-value">{kpis.totalCo2.toFixed(1)}</strong>
        <div className="b2b-split">
          <span className="ver">Verificado {kpis.pctVer.toFixed(0)}%</span>
          <span className="est">Estimado {kpis.pctEst.toFixed(0)}%</span>
        </div>
        <div className="b2b-meter" aria-hidden>
          <i className="ver" style={{ width: `${kpis.pctVer}%` }} />
          <i className="est" style={{ width: `${kpis.pctEst}%` }} />
        </div>
      </article>
      <article className="b2b-kpi">
        <span className="b2b-kpi-ico people" aria-hidden>
          <AppIcon name="productores" alt="" />
        </span>
        <span className="b2b-kpi-label">Productores activos</span>
        <strong className="b2b-kpi-value">{kpis.productores}</strong>
        <p className="b2b-kpi-hint">Red Pencos del Norte</p>
      </article>
      <article className="b2b-kpi">
        <span className="b2b-kpi-ico land" aria-hidden>
          <AppIcon name="hectareas" alt="" />
        </span>
        <span className="b2b-kpi-label">Hectáreas</span>
        <strong className="b2b-kpi-value">{kpis.hectareas.toFixed(1)}</strong>
        <p className="b2b-kpi-hint">Parcelas registradas</p>
      </article>
      <article className={`b2b-kpi ${kpis.alertasActivas > 0 ? 'kpi-alert' : ''}`}>
        <span className="b2b-kpi-ico alert" aria-hidden>
          <AppIcon name="alerta" alt="" />
        </span>
        <span className="b2b-kpi-label">Alertas fito</span>
        <strong className="b2b-kpi-value">{kpis.alertasActivas}</strong>
        <p className="b2b-kpi-hint">Plagas activas</p>
      </article>
    </section>
  )
}

function DashboardCarbono({ stats }) {
  const comparativo = stats.comparativo || [
    { tipo: 'Estimado', carbono_kg: stats.carbono_estimado_kg || 0 },
    { tipo: 'Verificado', carbono_kg: stats.carbono_verificado_kg || 0 },
  ]
  const serie = stats.serie_carbono || []

  return (
    <div className="b2b-grid-2">
      <div className="b2b-card">
        <h3>Carbono estimado vs verificado in situ</h3>
        <p>Estimado: proyección teórica. Verificado: altura de roseta y hojas medidas en campo.</p>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={comparativo} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...CHART_GRID} vertical={false} />
              <XAxis dataKey="tipo" stroke={B2B.slateLight} tick={{ fill: B2B.slateLight, fontSize: 12 }} />
              <YAxis
                stroke={B2B.slateLight}
                tick={{ fill: B2B.slateLight, fontSize: 12 }}
                label={{ value: 'Carbono (kg)', angle: -90, position: 'insideLeft', fill: B2B.slate, fontSize: 11 }}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP}
                formatter={(v) => [`${Number(v).toLocaleString()} kg`, 'Carbono']}
              />
              <Legend />
              <Bar dataKey="carbono_kg" name="Carbono (kg)" fill={B2B.teal} radius={[6, 6, 0, 0]} maxBarSize={72} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="b2b-card">
        <h3>Serie temporal de acumulación</h3>
        <p>Evolución mensual de carbono estimado y verificado.</p>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...CHART_GRID} />
              <XAxis
                dataKey="periodo"
                stroke={B2B.slateLight}
                tick={{ fill: B2B.slateLight, fontSize: 12 }}
                label={{ value: 'Periodo', position: 'insideBottom', offset: -2, fill: B2B.slate, fontSize: 11 }}
              />
              <YAxis
                stroke={B2B.slateLight}
                tick={{ fill: B2B.slateLight, fontSize: 12 }}
                label={{ value: 'kg C', angle: -90, position: 'insideLeft', fill: B2B.slate, fontSize: 11 }}
              />
              <Tooltip contentStyle={CHART_TOOLTIP} />
              <Legend />
              <Line
                type="monotone"
                dataKey="carbono_estimado_kg"
                name="Estimado (kg)"
                stroke={B2B.gray}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="carbono_verificado_kg"
                name="Verificado (kg)"
                stroke={B2B.forest}
                strokeWidth={2.5}
                dot={{ r: 3, fill: B2B.forest }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function MapaCalor({ parcelas }) {
  const geo = parcelas.filter((p) => p.lat != null && p.lng != null)
  const center = useMemo(() => {
    if (!geo.length) return [0.55, -77.95]
    const lat = geo.reduce((s, p) => s + p.lat, 0) / geo.length
    const lng = geo.reduce((s, p) => s + p.lng, 0) / geo.length
    return [lat, lng]
  }, [geo])

  return (
    <div className="b2b-card">
      <h3>Mapa de calor · densidad de CO₂ / ha</h3>
      <p>Parcelas georreferenciadas con linderos GPS. Color según captura de CO₂ por hectárea.</p>
      <div className="leaflet-wrap b2b-map">
        <MapContainer center={center} zoom={9} scrollWheelZoom style={{ height: '420px', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {geo.map((p) => {
            const color = co2Color(p.co2_kg_ha || 0)
            return (
              <Fragment key={p.id}>
                {p.linderos?.length >= 3 && (
                  <Polygon
                    positions={p.linderos}
                    pathOptions={{ color, fillColor: color, fillOpacity: 0.28, weight: 1.5 }}
                  >
                    <Popup>
                      <strong>{p.nombre}</strong>
                      <br />
                      {p.productor || '—'}
                      <br />
                      {(p.co2_kg_ha || 0).toFixed(0)} kg CO₂/ha
                    </Popup>
                  </Polygon>
                )}
                <CircleMarker
                  center={[p.lat, p.lng]}
                  radius={8}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 1 }}
                >
                  <Popup>
                    <strong>{p.nombre}</strong>
                    <br />
                    {(p.co2_kg_ha || 0).toFixed(0)} kg CO₂/ha
                  </Popup>
                </CircleMarker>
              </Fragment>
            )
          })}
        </MapContainer>
      </div>
      <div className="map-legend b2b-legend">
        <span>
          <i style={{ background: B2B.danger }} /> Baja
        </span>
        <span>
          <i style={{ background: B2B.warn }} /> Media
        </span>
        <span>
          <i style={{ background: B2B.teal }} /> Alta
        </span>
        <span>
          <i style={{ background: B2B.forest }} /> Muy alta
        </span>
      </div>
      {parcelas.map((p) => (
        <p key={p.id} className="muted">
          {p.nombre} · {p.productor || '—'} · {(p.co2_kg_ha || 0).toFixed(0)} kg CO₂/ha · GPS{' '}
          {p.lat ?? 's/d'}, {p.lng ?? 's/d'}
        </p>
      ))}
    </div>
  )
}

function HistorialCrecimiento({ token, crecimiento, demo }) {
  const [productorId, setProductorId] = useState(crecimiento.productores?.[0]?.id || '')
  const [plantaId, setPlantaId] = useState('')
  const [serie, setSerie] = useState([])
  const [plantas, setPlantas] = useState(crecimiento.plantas || [])

  useEffect(() => {
    const filtered = (crecimiento.plantas || []).filter(
      (p) => !productorId || p.productor_id === productorId
    )
    setPlantas(filtered)
    setPlantaId(filtered[0]?.id || '')
  }, [productorId, crecimiento])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!plantaId) {
        setSerie([])
        return
      }
      if (demo && EMPRESA_DEMO.crecimiento.series[plantaId]) {
        setSerie(EMPRESA_DEMO.crecimiento.series[plantaId])
        return
      }
      try {
        const data = await fetchDashboardCrecimiento(token, { productorId, plantaId })
        if (!cancelled) setSerie(data.serie || [])
      } catch {
        if (!cancelled) setSerie(EMPRESA_DEMO.crecimiento.series[plantaId] || [])
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [token, productorId, plantaId, demo])

  return (
    <div className="b2b-card">
      <h3>Historial de crecimiento por planta</h3>
      <p>Altura de roseta (cm) a lo largo del tiempo para una planta seleccionada.</p>
      <div className="growth-filters">
        <div className="form-group">
          <label>Productor</label>
          <select value={productorId} onChange={(e) => setProductorId(e.target.value)}>
            {(crecimiento.productores || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Planta</label>
          <select value={plantaId} onChange={(e) => setPlantaId(e.target.value)}>
            {plantas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={serie}>
            <CartesianGrid {...CHART_GRID} />
            <XAxis
              dataKey="fecha"
              stroke={B2B.slateLight}
              tick={{ fill: B2B.slateLight, fontSize: 12 }}
              label={{ value: 'Fecha de medición', position: 'insideBottom', offset: -2, fill: B2B.slate, fontSize: 11 }}
            />
            <YAxis
              stroke={B2B.slateLight}
              tick={{ fill: B2B.slateLight, fontSize: 12 }}
              label={{ value: 'Altura roseta (cm)', angle: -90, position: 'insideLeft', fill: B2B.slate, fontSize: 11 }}
            />
            <Tooltip contentStyle={CHART_TOOLTIP} />
            <Legend />
            <Line
              type="monotone"
              dataKey="altura_roseta_cm"
              name="Altura roseta (cm)"
              stroke={B2B.teal}
              strokeWidth={2.5}
              dot={{ r: 3, fill: B2B.forest }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {!serie.length && <p className="muted">Sin mediciones para esta planta.</p>}
    </div>
  )
}

function AlertasFito({ alertas }) {
  if (!alertas.length) {
    return (
      <div className="b2b-card">
        <p className="muted">Sin reportes fitosanitarios activos.</p>
      </div>
    )
  }

  return (
    <div className="alertas-grid">
      {alertas.map((a) => {
        const clasificacion = (a.clasificacion || a.datos?.clasificacion || '').toLowerCase()
        const esCochinilla = clasificacion === 'cochinilla'
        const foto = a.foto || (typeof a.datos?.foto === 'string' ? a.datos.foto : null)
        const protocolo = a.protocolo_mitigacion || (esCochinilla ? PROTOCOLO_COCHINILLA : null)
        return (
          <article key={a.id} className={`b2b-card alerta-card ${esCochinilla ? 'alerta-cochinilla' : ''}`}>
            <header>
              <h3>
                {(a.tipo || '').replaceAll('_', ' ')} · {a.fecha}
              </h3>
              {clasificacion && <span className="tag danger">{clasificacion}</span>}
            </header>
            {a.productor && <p className="muted">Productor: {a.productor}</p>}
            <p>{a.notas}</p>
            {foto && <img src={foto} alt="evidencia in situ" className="alerta-foto" />}
            {a.gps_lat != null && (
              <p className="gps-line">
                GPS {a.gps_lat}, {a.gps_lng}
              </p>
            )}
            {esCochinilla && protocolo && (
              <div className="protocolo-box">
                <strong>Protocolo de mitigación rápida</strong>
                <p>{protocolo}</p>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

function IconGrid() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  )
}
function IconLeaf() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M5 19c8-1 14-8 14-16-8 0-15 6-16 14 3-1 6-1 8 0-2 1-4 2-6 2z" />
    </svg>
  )
}
function IconCycle() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 12a8 8 0 0113.5-5.8L20 8" />
      <path d="M20 4v4h-4" />
      <path d="M20 12a8 8 0 01-13.5 5.8L4 16" />
      <path d="M4 20v-4h4" />
    </svg>
  )
}
function IconMap() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2-6-2z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  )
}
function IconTrend() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 18l5-6 4 3 7-9" />
      <path d="M14 6h6v6" />
    </svg>
  )
}
function IconAlert() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 3l10 18H2L12 3z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  )
}
function IconPanel() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  )
}
function IconHome() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9z" />
    </svg>
  )
}
function IconExit() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M10 6H6a2 2 0 00-2 2v8a2 2 0 002 2h4" />
      <path d="M14 16l4-4-4-4M10 12h8" />
    </svg>
  )
}
