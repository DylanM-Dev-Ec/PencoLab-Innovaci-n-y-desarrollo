import { useMemo, useState } from 'react'
import { AppIcon } from './AppIcon'
import { GERMINACION_TEORICA_PCT } from '../agaveAndino'
import { recomendacionPh } from '../store'
import { navigate } from '../routing'

const CHAPTERS = [
  {
    id: 'terreno',
    icon: 'surcos',
    title: 'Terreno y erosión',
    lead: 'El penco andino se planta donde otros cultivos no alcanzan: laderas y terrazas.',
  },
  {
    id: 'suelo',
    icon: 'tierra',
    title: 'Suelo y pH',
    lead: 'Antes de abrir surcos, entiende si tu tierra ayuda o castiga a la raíz.',
  },
  {
    id: 'origen',
    icon: 'plantar',
    title: 'Hijuelo o semilla',
    lead: 'No hay un solo camino: elige según tu vivero, tiempo y riesgo.',
  },
  {
    id: 'hijuelo',
    icon: 'firme',
    title: 'Elegir hijuelo',
    lead: 'Un hijuelo malo se ve bien al principio y falla a los meses. Aquí cómo filtrarlo.',
  },
  {
    id: 'cicatriz',
    icon: 'sol',
    title: 'Corte y cicatriz',
    lead: 'El corte limpio y el sol de 10 días evitan pudrición al plantar.',
  },
  {
    id: 'plantar',
    icon: 'apisonar',
    title: 'Cómo plantar',
    lead: 'Profundidad, apisonado y calles: lo que hace la diferencia en Carchi.',
  },
  {
    id: 'riego',
    icon: 'riego',
    title: 'Primeros cuidados',
    lead: 'El riego del penco es parco. Mejor poco y a tiempo que encharcar.',
  },
]

/**
 * Guía de siembra andina — herramienta de consejo, no asistente rígido.
 * El registro del lote vive en la pestaña Anotar (/productor/anotar).
 */
export default function RegistroSiembraAndina({ setMsg }) {
  const [chapter, setChapter] = useState(0)
  const [seen, setSeen] = useState(() => new Set())
  const [ph, setPh] = useState('6.5')
  const [origen, setOrigen] = useState('hijuelo')
  const [edadMadre, setEdadMadre] = useState(4)
  const [peso, setPeso] = useState(2)
  const [roseta, setRoseta] = useState(9.5)
  const [diasSol, setDiasSol] = useState(10)

  const current = CHAPTERS[chapter]
  const phTip = useMemo(() => recomendacionPh(ph), [ph])
  const edadOk = edadMadre >= 3 && edadMadre <= 5
  const pesoOk = peso >= 1.5 && peso <= 3
  const rosetaOk = roseta >= 8 && roseta <= 11
  const solOk = diasSol >= 10

  function markSeen(i = chapter) {
    setSeen((prev) => new Set(prev).add(CHAPTERS[i].id))
  }

  function go(i) {
    markSeen(chapter)
    setChapter(Math.max(0, Math.min(CHAPTERS.length - 1, i)))
  }

  return (
    <div className="guia-siembra">
      <header className="guia-hero">
        <AppIcon name="guia" alt="" className="glyph-lg" />
        <p className="guia-kicker">Guía de campo · no es un examen</p>
        <h2>Siembra andina paso a paso</h2>
        <p>
          Consejos prácticos para laderas y terrazas. Salta al tema que necesites; nada se bloquea.
        </p>
        <button
          type="button"
          className="m-btn practica-cta"
          onClick={() => navigate('/productor/practica')}
        >
          <AppIcon name="plantar" alt="" className="glyph-xs" />
          Abrir guía interactiva
        </button>
        <p className="guia-cta-note">
          Practica elegir hijuelo, curar el corte, trazar surcos y apisonar — con verdicto en vivo.
        </p>
        <div className="guia-progress" aria-label="Temas revisados">
          {CHAPTERS.map((c, i) => (
            <button
              key={c.id}
              type="button"
              className={`guia-dot ${i === chapter ? 'on' : ''} ${seen.has(c.id) ? 'seen' : ''}`}
              title={c.title}
              onClick={() => go(i)}
            >
              <AppIcon name={c.icon} alt="" className="glyph-xs" />
            </button>
          ))}
        </div>
        <p className="guia-progress-label">
          {seen.size} de {CHAPTERS.length} temas revisados · puedes ir en cualquier orden
        </p>
      </header>

      <nav className="guia-chapters" aria-label="Capítulos">
        {CHAPTERS.map((c, i) => (
          <button
            key={c.id}
            type="button"
            className={`guia-chip ${i === chapter ? 'on' : ''}`}
            onClick={() => go(i)}
          >
            {c.title}
          </button>
        ))}
      </nav>

      <article className="m-card guia-panel">
        <div className="guia-panel-head">
          <AppIcon name={current.icon} alt="" className="glyph-md" />
          <div>
            <span className="guia-num">
              Consejo {chapter + 1}/{CHAPTERS.length}
            </span>
            <h3>{current.title}</h3>
            <p>{current.lead}</p>
          </div>
        </div>

        {current.id === 'terreno' && (
          <div className="guia-body">
            <Tip title="Por qué importa">
              En terrenos pronunciados el agua se lleva la tierra fértil. Las zanjas y terrazas frenan esa
              pérdida y dan asiento al penco.
            </Tip>
            <ul className="guia-list">
              <li>
                <strong>Laderas:</strong> planta siguiendo la curva de nivel, nunca de arriba hacia abajo en
                línea recta (eso forma canales de erosión).
              </li>
              <li>
                <strong>Zanjas / terrazas:</strong> abren un escalón que retiene humedad y materia orgánica.
                Ideal en Carchi.
              </li>
              <li>
                <strong>Plano:</strong> solo si no hay riesgo de encharque. El penco odia raíz ahogada.
              </li>
            </ul>
            <div className="guia-callout">
              Evita suelos impermeables. Prefiere franco, arenoso o arcilloso permeable.
            </div>
          </div>
        )}

        {current.id === 'suelo' && (
          <div className="guia-body">
            <Tip title="Rango óptimo">
              pH entre <strong>6.0 y 7.0</strong>. Fuera de ese rango la planta come mal aunque abones.
            </Tip>
            <div className="m-hero-num">
              <span>Prueba el pH de tu lote</span>
              <div className="m-ph-big">{parseFloat(ph).toFixed(1)}</div>
              <input
                type="range"
                min="4"
                max="9"
                step="0.1"
                value={ph}
                onChange={(e) => setPh(e.target.value)}
              />
            </div>
            {phTip && (
              <div className={`guia-advice ${phTip.nivel}`}>
                <AppIcon name={`ph-${phTip.nivel}`} alt="" className="glyph-sm" />
                <p>{phTip.texto}</p>
              </div>
            )}
            <ul className="guia-list">
              <li>pH &lt; 6 → cal y composta antes de sembrar.</li>
              <li>pH &gt; 8 → yeso o azufre agrícola, poco a poco.</li>
              <li>Si no tienes kit de pH, pregunta en tu asociación o usa tiras reactivas baratas.</li>
            </ul>
          </div>
        )}

        {current.id === 'origen' && (
          <div className="guia-body">
            <div className="m-chip-row">
              <button
                type="button"
                className={`m-chip ${origen === 'hijuelo' ? 'on' : ''}`}
                onClick={() => setOrigen('hijuelo')}
              >
                <AppIcon name="firme" alt="" className="glyph-xs" />
                Hijuelo
              </button>
              <button
                type="button"
                className={`m-chip ${origen === 'semilla' ? 'on' : ''}`}
                onClick={() => setOrigen('semilla')}
              >
                <AppIcon name="semilla" alt="" className="glyph-xs" />
                Semilla
              </button>
            </div>
            {origen === 'hijuelo' ? (
              <>
                <Tip title="Camino más seguro en campo">
                  El hijuelo ya trae “arranque”. Si escoges bien (peso, firmeza, madre joven), la planta
                  se establece más rápido que por semilla.
                </Tip>
                <ul className="guia-list">
                  <li>Ideal para ampliar laderas ya conocidas.</li>
                  <li>Puedes plantar directo tras cicatrizar 10 días al sol.</li>
                  <li>Marca de qué madre salió si quieres trazabilidad.</li>
                </ul>
              </>
            ) : (
              <>
                <div className="andina-banner">
                  <strong>Semilla: paciencia y vivero</strong>
                  <p>
                    La germinación del penco andino es ~{GERMINACION_TEORICA_PCT}%. Siembra muchas más de las
                    que necesitas y revisa la humedad del vivero todos los días.
                  </p>
                </div>
                <ul className="guia-list">
                  <li>Usa bandejas o almácigos con buen drenaje.</li>
                  <li>No dejes secar la superficie ni la dejes empapada.</li>
                  <li>Trasplanta solo plantitas firmes; el resto se compostea.</li>
                </ul>
              </>
            )}
          </div>
        )}

        {current.id === 'hijuelo' && (
          <div className="guia-body">
            <Tip title="La prueba de la mano">
              Aprieta suave la base. Si se siente <strong>bofo</strong> (esponjoso), descártalo. Busca firme,
              vivo, sin manchas blandas.
            </Tip>
            <AdviceMeter
              label="Edad de la madre (años)"
              value={edadMadre}
              min={1}
              max={10}
              step={0.5}
              ok={edadOk}
              okText="Madre en edad ideal (3–5 años)"
              badText="Fuera de 3–5 años: el hijuelo suele ser más débil o viejo"
              onChange={setEdadMadre}
            />
            <AdviceMeter
              label="Peso del hijuelo (kg)"
              value={peso}
              min={0.5}
              max={4}
              step={0.1}
              ok={pesoOk}
              okText="Peso idóneo (1.5–3.0 kg)"
              badText="Muy liviano o muy pesado: busca otro"
              onChange={setPeso}
            />
            <AdviceMeter
              label="Roseta (cm)"
              value={roseta}
              min={4}
              max={16}
              step={0.1}
              ok={rosetaOk}
              okText="Tamaño bueno (8–11 cm)"
              badText="Fuera de 8–11 cm: espera o elige otro hijuelo"
              onChange={setRoseta}
            />
          </div>
        )}

        {current.id === 'cicatriz' && (
          <div className="guia-body">
            <ol className="guia-steps-soft">
              <li>
                <strong>Desinfecta</strong> el machete o cuchillo al fuego antes de cada corte.
              </li>
              <li>
                Corta el rizoma limpio; no desgarres. Luego aplica pasta con fungicida + bactericida +
                insecticida (según etiqueta local).
              </li>
              <li>
                Deja el hijuelo <strong>al sol 10 días</strong> para que cicatrice. No enterrar fresco.
              </li>
            </ol>
            <div className="m-sun guia-sun">
              <AppIcon name="sol" alt="" className="glyph-lg" />
              <div className="m-ph-big">{diasSol}</div>
              <strong>días al sol</strong>
              <input
                type="range"
                min="0"
                max="14"
                value={diasSol}
                onChange={(e) => setDiasSol(parseInt(e.target.value, 10))}
              />
              <p className={solOk ? 'ok' : 'warn'}>
                {solOk
                  ? 'Cicatriz lista: puedes plantar con menos riesgo de pudrición.'
                  : `Aún faltan ${10 - diasSol} día(s). Plantar antes es arriesgar la piña.`}
              </p>
            </div>
          </div>
        )}

        {current.id === 'plantar' && (
          <div className="guia-body">
            <ul className="guia-list">
              <li>
                Entierra <strong>¾ de la piña</strong> (o al menos ½). Deja la roseta libre, sin tierra en el
                cogollo.
              </li>
              <li>
                <strong>Apisona</strong> bien alrededor: el viento de Carchi tumba hijuelos flojos.
              </li>
              <li>
                Surcos a ~3 m; entre plantas 1.0–1.5 m. Deja calles para papa o quinoa el primer año.
              </li>
              <li>En ladera: traza en curva de nivel y abre zanja corta arriba del hijuelo para retener agua.</li>
            </ul>
            <div className="guia-callout soft">
              Después de plantar, anota fecha y GPS cuando puedas. Te sirve para riego, carbono y venta.
            </div>
          </div>
        )}

        {current.id === 'riego' && (
          <div className="guia-body">
            <div className="guia-season">
              <div>
                <AppIcon name="riego" alt="" className="glyph-sm" />
                <strong>Invierno</strong>
                <p>Riego mínimo: húmedo, no mojado.</p>
              </div>
              <div>
                <AppIcon name="primavera" alt="" className="glyph-sm" />
                <strong>Primavera</strong>
                <p>Según demanda del suelo, sin encharcar.</p>
              </div>
              <div>
                <AppIcon name="sol" alt="" className="glyph-sm" />
                <strong>Verano / lluvia</strong>
                <p>Reduce riego. En lluvia extrema, no riegues.</p>
              </div>
            </div>
            <Tip title="Poda sanitaria">
              Quita solo hojas secas. Sirven de puente a picudo y cochinilla si las dejas pegadas.
            </Tip>
            <ul className="guia-list">
              <li>Mide cada tanto: altura de roseta, diámetro y número de pencas.</li>
              <li>Eso alimenta el carbono estimado vs verificado in situ.</li>
            </ul>
            <div className="guia-callout soft">
              ¿Quieres practicar en vivo? Abre la guía interactiva (elige, cura, traza y apisona).
            </div>
            <button type="button" className="m-btn" onClick={() => navigate('/productor/practica')}>
              Ir a la guía interactiva
            </button>
            <div className="guia-callout soft">
              ¿Listo para registrar el lote? Usa la pestaña <strong>Lote</strong> del menú inferior.
            </div>
            <button type="button" className="m-btn ghost" onClick={() => navigate('/productor/anotar')}>
              Ir a registrar lote
            </button>
          </div>
        )}

        <div className="guia-nav">
          <button type="button" className="m-btn ghost" disabled={chapter === 0} onClick={() => go(chapter - 1)}>
            Anterior
          </button>
          <button
            type="button"
            className="m-btn ghost"
            onClick={() => {
              markSeen(chapter)
              setMsg?.({ type: 'info', text: `«${current.title}» marcado como revisado.` })
            }}
          >
            Ya lo revisé
          </button>
          {chapter < CHAPTERS.length - 1 ? (
            <button type="button" className="m-btn" onClick={() => go(chapter + 1)}>
              Siguiente consejo
            </button>
          ) : (
            <button type="button" className="m-btn" onClick={() => go(0)}>
              Volver al inicio
            </button>
          )}
        </div>
      </article>
    </div>
  )
}

function Tip({ title, children }) {
  return (
    <div className="guia-tip">
      <strong>{title}</strong>
      <div>{children}</div>
    </div>
  )
}

function AdviceMeter({ label, value, min, max, step, ok, okText, badText, onChange }) {
  return (
    <div className="m-hero-num guia-meter">
      <span>{label}</span>
      <div className="m-ph-big">{Number(value).toFixed(step < 1 ? 1 : 0)}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <p className={ok ? 'ok' : 'warn'}>{ok ? okText : badText}</p>
    </div>
  )
}
