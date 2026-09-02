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

/**
 * ✅ MEJORADO: Establece valor en un control (input/select)
 * Si es un select y el valor no existe, lo agrega dinámicamente
 */
export function setControlValue(elOrId, value) {
  if (value === undefined || value === null) return;
  
  const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
  if (!el) return;

  // ===== INPUT/TEXTAREA: Asignar directamente =====
  if (el.tagName !== 'SELECT') {
    el.value = value;
    return;
  }

  // ===== SELECT: Buscar por value, texto, o agregar dinámicamente =====
  
  // 1) Intentar por value exacto
  el.value = value;
  if (el.value === value) return;

  // 2) Intentar por value normalizado (sin acentos/mayúsculas)
  const vNorm = strip(value);
  for (const opt of el.options) {
    if (strip(opt.value) === vNorm) {
      el.value = opt.value;
      return;
    }
  }
  
  // 3) Intentar por texto visible normalizado
  for (const opt of el.options) {
    if (strip(opt.textContent) === vNorm) {
      el.value = opt.value;
      return;
    }
  }

  // 4) ✅ NUEVO: Si no existe, agregarlo dinámicamente
  console.log(`📝 [setControlValue] Agregando opción dinámica: "${value}" en select #${el.id}`);
  
  const newOption = document.createElement('option');
  newOption.value = value;
  newOption.textContent = value;
  newOption.setAttribute('data-dynamic', 'true'); // Marcar como agregada dinámicamente
  
  // Agregar después de la opción "Seleccione..."
  if (el.options.length > 0 && el.options[0].value === '') {
    el.insertBefore(newOption, el.options[1]);
  } else {
    el.appendChild(newOption);
  }
  
  el.value = value;
}

/**
 * Obtiene el primer valor no nulo/vacío de una lista de claves
 */
export function valFrom(data, keys) {
  for (const k of keys) {
    const v = data?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return null;
}