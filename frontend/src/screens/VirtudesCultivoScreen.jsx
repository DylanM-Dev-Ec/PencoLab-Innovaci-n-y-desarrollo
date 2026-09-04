import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AppIcon } from '../components/AppIcon'
import { B2B, CHART_GRID, CHART_TOOLTIP } from '../empresaTheme'
import { navigate } from '../routing'

const TABS = [
  { id: 'economia', label: 'Económica', short: 'Retorno' },
  { id: 'ambiente', label: 'Ambiental', short: 'Tierra' },
  { id: 'salud', label: 'Salud', short: 'Familia' },
]

const RETORNO = [
  { nombre: 'Eucalipto', usd: 20, fill: '#94a3b8' },
  { nombre: 'Penco andino', usd: 160, fill: B2B.forest },
]

/**
 * Virtudes del cultivo — educa y convence de sembrar penco andino.
 * React móvil (portal productor); estilo rounded-2xl / sombras suaves.
 */
export default function VirtudesCultivoScreen() {
  const [tab, setTab] = useState('economia')

  return (
    <div className="virtudes-screen">
      <header className="virtudes-hero">
        <AppIcon name="penco" alt="" className="glyph-lg" />
        <p className="virtudes-kicker">Pencos del Norte · Agave Andino</p>
        <h2>¿Por qué sembrar penco?</h2>
        <p>
          Compara con eucalipto y ganadería tradicional: más retorno, menos daño al suelo y beneficios
          para tu familia.
        </p>
      </header>

      <div className="virtudes-tabs" role="tablist" aria-label="Comparaciones">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`virtudes-tab ${tab === t.id ? 'on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="virtudes-tab-ico" aria-hidden>
              {t.id === 'economia' && <IconCoins />}
              {t.id === 'ambiente' && <IconLeaf />}
              {t.id === 'salud' && <IconHeart />}
            </span>
            <strong>{t.label}</strong>
            <small>{t.short}</small>
          </button>
        ))}
      </div>

      <div className="virtudes-panel rounded-2xl" role="tabpanel">
        {tab === 'economia' && <TabEconomica />}
        {tab === 'ambiente' && <TabAmbiental />}
        {tab === 'salud' && <TabSalud />}
      </div>

      <button type="button" className="m-btn" onClick={() => navigate('/productor/andina')}>
        Quiero sembrar penco — ver guía
      </button>
    </div>
  )
}

function TabEconomica() {
  return (
    <section className="virtudes-section">
      <h3>El retorno financiero</h3>
      <p className="virtudes-lead">
        Retorno estimado por planta a los <strong>12 años</strong> (ciclo de cosecha certificado).
      </p>

      <div className="virtudes-chart rounded-2xl">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={RETORNO} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid {...CHART_GRID} vertical={false} />
            <XAxis dataKey="nombre" stroke={B2B.slateLight} tick={{ fontSize: 12, fill: B2B.slate }} />
            <YAxis
              stroke={B2B.slateLight}
              tick={{ fontSize: 11, fill: B2B.slateLight }}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP}
              formatter={(v) => [`$${Number(v).toLocaleString()} USD`, 'Retorno / planta']}
            />
            <Bar dataKey="usd" radius={[12, 12, 4, 4]} maxBarSize={64}>
              {RETORNO.map((e) => (
                <Cell key={e.nombre} fill={e.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="virtudes-compare-row">
        <article className="virtudes-mini rounded-2xl muted">
          <span>Eucalipto</span>
          <strong>$20</strong>
          <small>USD / árbol</small>
        </article>
        <article className="virtudes-mini rounded-2xl highlight">
          <span>Penco andino</span>
          <strong>$160</strong>
          <small>USD / planta · chawarmishky</small>
        </article>
      </div>

      <aside className="virtudes-note rounded-2xl">
        <IconBadge />
        <p>
          Pencos del Norte compra el litro de chawarmishky al <strong>doble del precio oficial de la
          leche</strong>, siempre que registres tus nuevas siembras en la app.
        </p>
      </aside>
    </section>
  )
}

function TabAmbiental() {
  return (
    <section className="virtudes-section">
      <h3>Cuidado de la tierra</h3>
      <p className="virtudes-lead">Qué deja cada opción en el suelo del lote.</p>

      <div className="virtudes-table rounded-2xl">
        <div className="virtudes-table-head">
          <span>Aspecto</span>
          <span>Daño / alternativa</span>
          <span>Penco andino</span>
        </div>

        <CompareRow
          icon={<IconDroplets />}
          title="Agua y suelo"
          bad="Eucalipto y ganadería tradicional secan y erosionan gravemente los suelos."
          good="Alta rusticidad: no exige riego constante ni abonos químicos."
        />
        <CompareRow
          icon={<IconTrees />}
          title="Biodiversidad"
          bad="Desplaza flora y fauna local; requiere deforestación constante."
          good="Cerca viva en laderas: frena la erosión de inmediato con zanjas y terrazas."
        />
        <CompareRow
          icon={<IconShield />}
          title="Insumos"
          bad="Pastoreo intensivo y monocultivo de eucalipto agotan el lote."
          good="Sin pesticidas de rutina. Agave americana se adapta a terrenos marginales."
        />
      </div>

      <div className="virtudes-eco-cards">
        <article className="virtudes-eco bad rounded-2xl">
          <div className="virtudes-eco-top">
            <IconAlert />
            <h4>Eucalipto / ganadería</h4>
          </div>
          <p>
            Seca y erosiona gravemente los suelos, desplaza la flora y fauna local, y requiere
            constante deforestación.
          </p>
        </article>
        <article className="virtudes-eco good rounded-2xl">
          <div className="virtudes-eco-top">
            <IconLeaf />
            <h4>Penco andino</h4>
          </div>
          <p>
            Planta rústica: sin riego constante, sin abono químico ni pesticidas. Se siembra en
            laderas y terrazas con zanjas — cerca viva que frena la erosión.
          </p>
        </article>
      </div>
    </section>
  )
}

function TabSalud() {
  return (
    <section className="virtudes-section">
      <h3>Para su familia</h3>
      <p className="virtudes-lead">
        El chawarmishky no solo es ingreso: es tradición andina con beneficios de salud.
      </p>

      <article className="virtudes-salud-card rounded-2xl">
        <div className="virtudes-salud-ico">
          <IconBone />
        </div>
        <div>
          <h4>Huesos y articulaciones</h4>
          <p>
            Ayuda a asimilar el calcio (previniendo la osteoporosis) y tiene propiedades
            desinflamatorias útiles frente a la artritis.
          </p>
        </div>
      </article>

      <article className="virtudes-salud-card rounded-2xl">
        <div className="virtudes-salud-ico">
          <IconHoney />
        </div>
        <div>
          <h4>Apto para diabéticos</h4>
          <p>
            Su miel o sirope tiene un índice glucémico entre <strong>4 y 5 veces menor</strong> que
            la miel de abeja: endulzante natural y más saludable para la comunidad.
          </p>
        </div>
      </article>

      <div className="virtudes-tradition rounded-2xl">
        <AppIcon name="penco" alt="" className="glyph-md" />
        <p>
          Sembrar penco es cuidar la tierra de tus hijos y mantener vivo el chawado — con un precio
          justo cuando registras tu lote en Pencos del Norte.
        </p>
      </div>
    </section>
  )
}

function CompareRow({ icon, title, bad, good }) {
  return (
    <div className="virtudes-table-row">
      <div className="virtudes-aspect">
        <span className="virtudes-aspect-ico">{icon}</span>
        <strong>{title}</strong>
      </div>
      <p className="bad">{bad}</p>
      <p className="good">{good}</p>
    </div>
  )
}

function IconCoins() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="8" cy="8" r="6" />
      <path d="M14.5 6.5A6 6 0 118.5 18.5" />
      <path d="M8 6v4M6.5 8h3" />
    </svg>
  )
}
function IconLeaf() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 19c8-1 14-8 14-16-8 0-15 6-16 14 3-1 6-1 8 0-2 1-4 2-6 2z" />
    </svg>
  )
}
function IconHeart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0112 6a5.5 5.5 0 019.5 6C19 16.5 12 21 12 21z" />
    </svg>
  )
}
function IconDroplets() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3s6 7 6 11a6 6 0 11-12 0c0-4 6-11 6-11z" />
    </svg>
  )
}
function IconTrees() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 22v-6" />
      <path d="M8 22h8" />
      <path d="M12 3l5 7H7l5-7z" />
      <path d="M12 10l6 7H6l6-7z" />
    </svg>
  )
}
function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" />
    </svg>
  )
}
function IconAlert() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3l10 18H2L12 3z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  )
}
function IconBadge() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3l2.2 4.5 5 .7-3.6 3.5.9 5L12 14.8 7.5 16.7l.9-5L4.8 8.2l5-.7L12 3z" />
    </svg>
  )
}
function IconBone() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17.5 6.5a2.5 2.5 0 11-3.2 3.8L8.3 16.3a2.5 2.5 0 11-3.8 3.2 2.5 2.5 0 013.2-3.8l6-6a2.5 2.5 0 013.8-3.2z" />
    </svg>
  )
}
function IconHoney() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 8h8l2 4H6l2-4z" />
      <path d="M7 12h10v7a2 2 0 01-2 2H9a2 2 0 01-2-2v-7z" />
      <path d="M10 3h4v3h-4z" />
    </svg>
  )
}
