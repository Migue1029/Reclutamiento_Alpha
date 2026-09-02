// Helpers de normalización y utilidades UI

export const strip = (s) =>
  (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.\-_/]/g, '')
    .trim()
    .toUpperCase();

export function normalizaSexo(v) {
  const s = strip(v);
  if (s.startsWith('M')) return 'M';
  if (s.startsWith('F')) return 'F';
  return v ?? '';
}

export function normalizaEstadoForCURP(v) {
  if (!v) return 'TLAXCALA';
  if (v.length === 2) return v;
  return v || 'TLAXCALA';
}

export function setControlValue(elOrId, value) {
  if (value === undefined || value === null) return;
  const el =
    typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
  if (!el) return;

  if (el.tagName === 'SELECT') {
    // 1) por value exacto
    el.value = value;
    if (el.value === value) return;

    // 2) por value normalizado
    const vNorm = strip(value);
    for (const opt of el.options) {
      if (strip(opt.value) === vNorm) {
        el.value = opt.value;
        return;
      }
    }
    // 3) por texto visible normalizado
    for (const opt of el.options) {
      if (strip(opt.textContent) === vNorm) {
        el.value = opt.value;
        return;
      }
    }
    // 4) como venga (si no hay coincidencia no seleccionará nada)
    el.value = value;
    return;
  }

  el.value = value;
}

export function valFrom(data, keys) {
  for (const k of keys) {
    const v = data?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return null;
}
