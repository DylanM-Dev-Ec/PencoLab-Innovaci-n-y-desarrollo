const STORAGE_KEY = 'pencolab_offline_v1';

const defaultData = () => ({
  session: {
    access_token: null,
    user_id: null,
    rol: null,
    productor_id: null,
    email: null,
  },
  productor: {
    id: null,
    nombre: '',
    email: '',
    comunidad: 'Pencos del Norte',
  },
  parcelas: [],
  plantas: [],
  mediciones: [],
  bitacora: [],
  lastSync: null,
});

export function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    const defaults = defaultData();
    return {
      ...defaults,
      ...parsed,
      session: { ...defaults.session, ...(parsed.session || {}) },
      productor: { ...defaults.productor, ...(parsed.productor || {}) },
    };
  } catch {
    return defaultData();
  }
}

export function saveStore(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function resetStore() {
  const data = defaultData();
  saveStore(data);
  return data;
}

export function applySession(data, auth, extra = {}) {
  return {
    ...data,
    session: {
      access_token: auth.access_token,
      user_id: auth.id,
      rol: auth.rol,
      productor_id: auth.productor_id || null,
      email: auth.email,
    },
    productor: {
      ...data.productor,
      id: auth.productor_id || data.productor.id,
      email: auth.email,
      nombre: extra.nombre || data.productor.nombre || auth.email.split('@')[0],
    },
  };
}

export function clearSession(data) {
  const next = defaultData();
  return {
    ...next,
    parcelas: data.parcelas || [],
    plantas: data.plantas || [],
    mediciones: data.mediciones || [],
    bitacora: data.bitacora || [],
  };
}

export function recomendacionPh(ph) {
  const value = parseFloat(ph);
  if (Number.isNaN(value)) return null;
  if (value < 6) return 'Aplicar cal y composta para elevar el pH (6.0-7.0)';
  if (value > 8) return 'Aplicar yeso o azufre para reducir el pH (6.0-7.0)';
  if (value >= 6 && value <= 7) return 'pH en rango óptimo para Penco/Agave';
  return 'pH fuera del rango ideal, monitorear';
}

export function hijueloApto(peso, roseta, edadMadre) {
  if (!edadMadre) return null;
  const edad = parseFloat(edadMadre);
  if (edad < 3 || edad > 5) return false;
  const pesoOk = peso && parseFloat(peso) >= 1.5 && parseFloat(peso) <= 3;
  const rosetaOk = roseta && parseFloat(roseta) >= 8 && parseFloat(roseta) <= 11;
  return pesoOk || rosetaOk;
}

export function estimarCarbono(altura, diametro, edadMeses = 12) {
  const h = parseFloat(altura);
  const d = parseFloat(diametro);
  const radio = d / 2;
  const volumen = Math.PI * radio * radio * h;
  const factor = 0.00035 + edadMeses * 0.00001;
  const biomasa = volumen * factor;
  const carbono = biomasa * 0.47;
  const co2 = carbono * 3.67;
  return {
    biomasa_kg: biomasa.toFixed(3),
    carbono_acumulado_kg: carbono.toFixed(3),
    co2_equivalente_kg: co2.toFixed(3),
  };
}

export function getGps() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: null, lng: null, precision: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
          precision: pos.coords.accuracy?.toFixed(1),
        }),
      () => resolve({ lat: null, lng: null, precision: null }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}
