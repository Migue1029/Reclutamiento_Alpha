// frontend/js/api.js


const origin = window.location.origin;
const FALLBACK = 'http://localhost:3001'; // por si se abre como file:// durante desarrollo

const base = origin.startsWith('http') ? origin : FALLBACK;

export const API_BASE = `${base}/api`;
// Punto base de la API (ajústalo si usas proxy diferente)

/* =============== Helpers =============== */
function safeJSON(res) {
  // Lanza un error legible si la respuesta no es OK
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json().catch(() => ({}));
}

// Convierte "yyyy-MM-dd" desde <input type="date">, o null si viene vacío
function toAPIDateFromInput(v) {
  if (!v) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

// Normaliza payloads para el backend (fechas y salario)
export function normalizePayload(p = {}) {
  return {
    ...p,
    fecha_nacimiento: toAPIDateFromInput(p.fecha_nacimiento),
    fecha_ingreso:    toAPIDateFromInput(p.fecha_ingreso),
    salario:          p.salario == null || p.salario === '' ? null : String(p.salario).replace(',', '.'),
  };
}

// Devuelve el ID desde la URL si existe (acepta ?id=, ?id_empleado= o ?empleadoId=)
export function getIdFromURL() {
  const qs = new URLSearchParams(window.location.search);
  return (
    Number(qs.get('id')) ||
    Number(qs.get('id_empleado')) ||
    Number(qs.get('empleadoId')) ||
    null
  );
}

/* =============== Endpoints =============== */

// Autocompletado: usa /empleados?query=
export async function buscarEmpleados(query) {
  const url = `${API_BASE}/empleados?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { cache: 'no-store' });
  return safeJSON(res);
}

// Obtener 1 empleado: acepta ambos formatos de respuesta
export async function obtenerEmpleado(id) {
  const res = await fetch(`${API_BASE}/empleados/${id}`, { cache: 'no-store' });
  const data = await safeJSON(res);
  // El backend puede responder { ok:true, item:{...} } o directamente el objeto
  return data?.item ?? data;
}

// Crear empleado
export async function crearEmpleado(data) {
  const body = JSON.stringify(normalizePayload(data));
  const res = await fetch(`${API_BASE}/empleados`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  });
  return safeJSON(res);
}

// Actualizar empleado
export async function actualizarEmpleado(id, data) {
  const body = JSON.stringify(normalizePayload(data));
  const res = await fetch(`${API_BASE}/empleados/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body
  });
  return safeJSON(res);
}

// (Opcional) Eliminar empleado
export async function eliminarEmpleado(id) {
  const res = await fetch(`${API_BASE}/empleados/${id}`, { method: 'DELETE' });
  return safeJSON(res);
}
