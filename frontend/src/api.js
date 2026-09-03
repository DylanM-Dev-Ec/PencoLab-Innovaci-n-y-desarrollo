/**
 * Base URL del API.
 * - Producción (Vercel): VITE_API_URL = https://tu-api.onrender.com
 * - Local: vacío → rutas relativas /api (proxy de Vite a :8000)
 */
const API_BASE = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const API_V1 = `${API_BASE}/api/v1`;
const API_ROOT = `${API_BASE}/api`;

function parseError(err) {
  if (!err) return 'Error desconocido';
  if (typeof err.detail === 'string') return err.detail;
  if (Array.isArray(err.detail)) {
    return err.detail.map((d) => d.msg || JSON.stringify(d)).join('; ');
  }
  return `Error ${err.status || ''}`.trim();
}

async function request(path, options = {}, base = API_V1) {
  const { token, headers: extraHeaders, ...rest } = options;
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${base}${path}`, { headers, ...rest });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(parseError({ ...err, status: res.status }));
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function checkHealth() {
  try {
    await request('/v1/health', {}, API_ROOT);
    return true;
  } catch {
    return false;
  }
}

export async function registerUser(data) {
  return request('/auth/register', { method: 'POST', body: JSON.stringify(data) }, API_ROOT);
}

export async function loginUser(data) {
  return request('/auth/login', { method: 'POST', body: JSON.stringify(data) }, API_ROOT);
}

export async function ensureProductor(data, token) {
  return request('/productores/ensure', { method: 'POST', body: JSON.stringify(data), token });
}

export async function syncPush(payload, token) {
  return request('/sync/push', { method: 'POST', body: JSON.stringify(payload), token });
}

export async function pushPlanAccion(plan, token) {
  const body = {
    id: plan.id || undefined,
    productor_id: plan.productor_id,
    hectareas_planificadas: plan.hectareas_planificadas ?? plan.hectareas,
    cultivo_intercalado_elegido: plan.cultivo_intercalado_elegido || plan.cultivo_intercalado,
    latitud_inicial: plan.latitud_inicial ?? null,
    longitud_inicial: plan.longitud_inicial ?? null,
    fecha_inicio_plan: plan.fecha_inicio_plan || (plan.created_at || '').slice(0, 10) || undefined,
    densidad_plantas_ha: plan.densidad_plantas_ha || 1000,
  };
  return request('/planes-accion', { method: 'POST', body: JSON.stringify(body), token }, API_ROOT);
}

export async function fetchEmpresaDashboard(token) {
  return request('/empresa/dashboard', { token });
}

export async function fetchEmpresaParcelas(token) {
  return request('/empresa/parcelas', { token });
}

export async function fetchEmpresaAlertas(token) {
  return request('/empresa/alertas', { token });
}

export async function fetchDashboardStats(token) {
  return request('/dashboard/stats', { token }, API_ROOT);
}

export async function fetchDashboardCrecimiento(token, { productorId, plantaId } = {}) {
  const params = new URLSearchParams();
  if (productorId) params.set('productor_id', productorId);
  if (plantaId) params.set('planta_id', plantaId);
  const qs = params.toString();
  return request(`/dashboard/crecimiento${qs ? `?${qs}` : ''}`, { token }, API_ROOT);
}

export async function fetchDashboardAlertas(token) {
  return request('/dashboard/alertas', { token }, API_ROOT);
}

export async function fetchDashboardEficiencia(token, hectareas = 1) {
  const params = new URLSearchParams({ hectareas: String(hectareas) });
  return request(`/dashboard/eficiencia-mexico?${params}`, { token }, API_ROOT);
}

export async function certificarLote(payload, token) {
  return request('/certificar', { method: 'POST', body: JSON.stringify(payload), token }, API_ROOT);
}
