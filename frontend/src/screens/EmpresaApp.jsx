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
import ModelosEmpresaHub from '../components/ModelosEmpresaHub'
import CobrosPagosHub from '../components/CobrosPagosHub'
import AgroClimaticDashboard from '../components/AgroClimaticDashboard'
import { EMPRESA_DEMO, guiaFitoDe } from '../empresaDemo'
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
    path: '/empresa/modelos',
    label: 'Modelos',
    desc: 'Calculadoras: cosecha, supervivencia, escala y carbono',
    icon: IconFormula,
  },
  {
    path: '/empresa/cobros',
    label: 'Cobros',
    desc: 'Pagos, deudas del Pacto Social y acopio',
    icon: IconMoney,
  },
  {
    path: '/empresa/clima',
    label: 'Clima',
    desc: 'MAC, heladas, lluvia y bloqueo de riego',
    icon: IconCloud,
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
    desc: 'Plagas y enfermedades con qué hacer',
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
            {demo ? ' Mostrando mapa de referencia mientras sincroniza.' : ''}
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
              campoData={campoData}
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
          {path === '/empresa/modelos' && <ModelosEmpresaHub campoData={campoData} />}
          {path === '/empresa/cobros' && <CobrosPagosHub campoData={campoData} />}
          {path === '/empresa/clima' && <AgroClimaticDashboard />}
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

function formatFechaEs(fecha) {
  if (!fecha) return 'Sin fecha'
  const d = new Date(`${fecha}T12:00:00`)
  if (Number.isNaN(d.getTime())) return String(fecha)
  return d.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })
}

function severidadMeta(sev) {
  const s = String(sev || '').toLowerCase()
  if (s === 'critica' || s === 'crítica') return { label: 'Crítica', className: 'sev-critica' }
  if (s === 'alta') return { label: 'Alta', className: 'sev-alta' }
  if (s === 'media') return { label: 'Media', className: 'sev-media' }
  if (s === 'baja') return { label: 'Baja', className: 'sev-baja' }
  return { label: 'Por revisar', className: 'sev-media' }
}

function tipoReporteLabel(tipo) {
  const t = String(tipo || '').toLowerCase()
  if (t.includes('scouting')) return 'Scouting visual (foto / campo)'
  if (t.includes('fitosanitario')) return 'Reporte fitosanitario'
  return (tipo || 'Reporte').replaceAll('_', ' ')
}

function AlertasFito({ alertas }) {
  if (!alertas.length) {
    return (
      <div className="b2b-card alerta-empty">
        <AppIcon name="check" alt="" className="glyph-lg" />
        <h3>Sin alertas activas</h3>
        <p className="muted">
          Cuando el productor reporte cochinilla, Erwinia o picudo desde el scouting, aparecerán aquí con
          protocolo claro.
        </p>
      </div>
    )
  }

  const resumen = alertas.reduce(
    (acc, a) => {
      const key = String(a.clasificacion || a.datos?.clasificacion || 'otra').toLowerCase()
      acc[key] = (acc[key] || 0) + 1
      return acc
    },
    {}
  )

  return (
    <div className="alertas-wrap">
      <section className="alerta-intro b2b-card">
        <div>
          <p className="alerta-kicker">Salud del cultivo · solo lectura</p>
          <h2>Alertas fitosanitarias</h2>
          <p>
            Cada tarjeta explica <strong>qué es</strong>, <strong>cómo se ve</strong> y{' '}
            <strong>qué hacer</strong>. Los iconos muestran la plaga o enfermedad reportada.
          </p>
        </div>
        <div className="alerta-resumen">
          <strong>{alertas.length}</strong>
          <span>activas</span>
          <ul>
            {Object.entries(resumen).map(([k, n]) => {
              const g = guiaFitoDe(k)
              return (
                <li key={k}>
                  <AppIcon name={g.icon} alt="" className="glyph-xs" />
                  {g.nombre}: {n}
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      <div className="alertas-grid">
        {alertas.map((a) => {
          const clasificacion = (a.clasificacion || a.datos?.clasificacion || '').toLowerCase()
          const guia = guiaFitoDe(clasificacion)
          const fotoRaw = typeof a.foto === 'string' ? a.foto : typeof a.datos?.foto === 'string' ? a.datos.foto : null
          const foto =
            fotoRaw &&
            (fotoRaw.startsWith('http') ||
              (fotoRaw.startsWith('data:image') && fotoRaw.length > 200))
              ? fotoRaw
              : null
          const sev = severidadMeta(a.severidad || (guia.id === 'pudricion_erwinia' ? 'critica' : 'alta'))
          const protocoloTexto = a.protocolo_mitigacion
          const pasos = guia.pasos

          return (
            <article
              key={a.id}
              className={`b2b-card alerta-card alerta-${guia.id}`}
              style={{ borderColor: `${guia.color}55` }}
            >
              <header className="alerta-card-head">
                <div className="alerta-ident" style={{ background: guia.bg }}>
                  <AppIcon name={guia.icon} alt={guia.nombre} className="glyph-lg" />
                  <div>
                    <p className="alerta-kicker" style={{ color: guia.color }}>
                      {tipoReporteLabel(a.tipo)}
                    </p>
                    <h3>{guia.nombre}</h3>
                    <p className="alerta-fecha">{formatFechaEs(a.fecha)}</p>
                  </div>
                </div>
                <div className="alerta-badges">
                  <span className={`alerta-sev ${sev.className}`}>{sev.label}</span>
                  <span className="alerta-estado">{a.estado === 'activa' || !a.estado ? 'Activa' : a.estado}</span>
                </div>
              </header>

              <div className="alerta-body">
                <div className="alerta-main">
                  <section className="alerta-block">
                    <h4>Qué está pasando</h4>
                    <p>{a.notas || guia.que_es}</p>
                  </section>

                  <section className="alerta-block">
                    <h4>Qué es {guia.nombre.toLowerCase()}</h4>
                    <p>{guia.que_es}</p>
                    <p className="alerta-riesgo">
                      <strong>Riesgo:</strong> {guia.riesgo}
                    </p>
                    <p className="alerta-urgencia">
                      <strong>Urgencia:</strong> {guia.urgencia}
                    </p>
                  </section>

                  <section className="alerta-meta">
                    {a.productor ? (
                      <div>
                        <span>Productor</span>
                        <strong>{a.productor}</strong>
                      </div>
                    ) : null}
                    {a.parcela ? (
                      <div>
                        <span>Parcela / lote</span>
                        <strong>{a.parcela}</strong>
                      </div>
                    ) : null}
                    {a.plantas_afectadas != null ? (
                      <div>
                        <span>Plantas reportadas</span>
                        <strong>{a.plantas_afectadas}</strong>
                      </div>
                    ) : null}
                    {a.gps_lat != null ? (
                      <div>
                        <span>Ubicación GPS</span>
                        <strong className="gps-line">
                          {Number(a.gps_lat).toFixed(4)}, {Number(a.gps_lng).toFixed(4)}
                        </strong>
                      </div>
                    ) : null}
                  </section>
                </div>

                <aside className="alerta-visual" style={{ background: guia.bg }}>
                  <p className="alerta-visual-label">Cómo reconocerla</p>
                  <div className="alerta-visual-ico">
                    <AppIcon name={guia.icon} alt="" className="glyph-step" />
                    <strong>{guia.nombre}</strong>
                  </div>
                  <ul>
                    {guia.como_se_ve.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                  {foto ? (
                    <figure className="alerta-foto-wrap">
                      <img src={foto} alt={`Evidencia de campo: ${guia.nombre}`} className="alerta-foto" />
                      <figcaption>Foto enviada desde el campo</figcaption>
                    </figure>
                  ) : (
                    <p className="alerta-sin-foto">
                      Sin foto adjunta. Usa el icono y la lista de signos para identificar el caso en
                      campo.
                    </p>
                  )}
                </aside>
              </div>

              <div className="protocolo-box" style={{ borderColor: `${guia.color}44`, background: guia.bg }}>
                <strong style={{ color: guia.color }}>Qué hacer ahora</strong>
                {protocoloTexto ? <p className="alerta-protocolo-extra">{protocoloTexto}</p> : null}
                <ol className="alerta-pasos">
                  {pasos.map((paso, i) => (
                    <li key={paso}>
                      <span>{i + 1}</span>
                      {paso}
                    </li>
                  ))}
                </ol>
              </div>
            </article>
          )
        })}
      </div>
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
function IconFormula() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M5 5h6M5 12h14M5 19h10" />
      <path d="M16 5l3 3-3 3" />
    </svg>
  )
}
function IconMoney() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h0.01M18 12h0.01" />
    </svg>
  )
}
function IconCloud() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M7 18h10a4 4 0 00.5-7.97A6 6 0 006.1 12.2 3.5 3.5 0 007 18z" />
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
