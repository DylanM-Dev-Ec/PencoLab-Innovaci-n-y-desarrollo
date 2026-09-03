/** Constantes Agave Andino — .cursorrules operativas y comerciales */
export const META_CO2_TON = 15
export const HA_ACTUALES = 3
export const HA_META = 20
export const PRECIO_BOTELLA_USD = 2
export const GERMINACION_TEORICA_PCT = 5
export const MUJERES_RECOLECTORAS = 3
export const LITROS_DIA_POR_PLANTA = 4

/** Precio estimado USD/kg de residuo aproveado (economía circular) */
export const PRECIO_RESIDUO_USD_KG = {
  fibra_cabuya: 8.5,
  flores_kirillas: 18,
  chawarquero_madera: 6,
  hoja_para_abono: 1.2,
}

export const CIRCULAR_CARDS = [
  {
    id: 'fibra_cabuya',
    tipo_residuo: 'fibra_cabuya',
    destino: 'canastas',
    titulo: 'Fibra de Cabuya',
    subtitulo: 'Artesanías y alpargatas',
    descripcion: 'Kg para hilado de canastas o suelas de calzado tradicional.',
    icon: 'fibra',
    color: '#0d4f36',
    bg: '#e8f5e9',
  },
  {
    id: 'flores_kirillas',
    tipo_residuo: 'flores_kirillas',
    destino: 'encurtidos',
    titulo: 'Flores Kirillas',
    subtitulo: 'Alcaparras andinas',
    descripcion: 'Flores tiernas para encurtidos gourmet de alto valor.',
    icon: 'kirillas',
    color: '#9a5b12',
    bg: '#fff8ef',
  },
  {
    id: 'chawarquero_madera',
    tipo_residuo: 'chawarquero_madera',
    destino: 'construccion_vigas',
    titulo: 'Chawarquero',
    subtitulo: 'Madera de penco',
    descripcion: 'Troncos secos para vigas ecológicas o tambores artesanales.',
    icon: 'madera',
    color: '#5d4037',
    bg: '#efebe9',
  },
  {
    id: 'hoja_para_abono',
    tipo_residuo: 'hoja_para_abono',
    destino: 'abono_compost',
    titulo: 'Hojas residuales',
    subtitulo: 'Abono orgánico',
    descripcion: 'Biomasa triturada para compostaje y menos fertilizante químico.',
    icon: 'abono',
    color: '#146c48',
    bg: '#ecf6f0',
  },
]

export function ingresoResiduoUsd(tipoResiduo, kg) {
  const price = PRECIO_RESIDUO_USD_KG[tipoResiduo] || 0
  const n = Number(kg) || 0
  return Math.round(n * price * 100) / 100
}
