export const apiUrl = path => `${(import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "")}${path}`;

export async function api(path, { token, body, signal } = {}) {
  let response;
  try { response = await fetch(apiUrl(path), {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: signal || AbortSignal.timeout(12000),
  }); } catch {
    const error = new Error('Unable to reach the plaza server. Please try again.');
    error.network = true;
    throw error;
  }
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.error || 'Unable to connect. Please try again.'); error.status = response.status; throw error; }
  return data;
}
