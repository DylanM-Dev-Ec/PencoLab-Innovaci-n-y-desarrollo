const API_V1 = '/api/v1';
const API_ROOT = '/api';

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

export async function syncPull(productorId, since, token) {
  const params = new URLSearchParams({ productor_id: productorId });
  if (since) params.set('since', since);
  return request(`/sync/pull?${params}`, { token });
}
