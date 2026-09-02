// frontend/js/lib/fill-form.js - VERSIÓN FINAL CORREGIDA

// ========== IMPORTS ==========
import { 
  strip, 
  setControlValue, 
  valFrom, 
  normalizaSexo 
} from './normalizers.js';

// ====== FUNCIONES AUXILIARES ======

/**
 * Convierte fecha ISO (YYYY-MM-DD) o Date a formato yyyy-mm-dd para <input type="date">
 */
function toInputDate(fecha) {
  if (!fecha) return '';
  
  try {
    // Si ya viene en formato correcto
    if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return fecha;
    }
    
    // Si viene como Date o string parseable
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return '';
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.warn('[toInputDate] Error:', e);
    return '';
  }
}

/**
 * Calcula edad desde fecha de nacimiento
 */
function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  
  try {
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    
    if (isNaN(nacimiento.getTime())) return null;
    
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    
    return edad >= 0 ? edad : null;
  } catch (e) {
    console.warn('[calcularEdad] Error:', e);
    return null;
  }
}

// ====== MAPAS DE APOYO ======
const MAP_ESCOLARIDAD = {
  'PRIMARIA': 'Primaria',
  'SECUNDARIA': 'Secundaria',
  'PREPARATORIA': 'Bachillerato',
  'BACHILLERATO': 'Bachillerato',
  'LICENCIATURA': 'Licenciatura',
  'MAESTRIA': 'Maestría',
  'DOCTORADO': 'Doctorado'
};

const MAP_TIPO_NOMINA = {
  'SEMANAL': 'Semanal',
  'QUINCENAL': 'Quincenal',
  'MENSUAL': 'Mensual',
  'CATORCENAL': 'Catorcenal'
};

// ======================================================
// 1) CÁLCULOS AUTOMÁTICOS (Edad, RFC, CURP)
// ======================================================
export function actualizarCamposAutomaticos(ui, generador) {
  const nombre  = ui.nombre?.value?.trim() || '';
  const apellidos = ui.apellidos?.value?.trim() || '';
  const fechaNacimiento = ui.fecha_nacimiento?.value || '';
  const sexo    = ui.sexo?.value || '';
  const estado  = ui.estado_nacimiento?.value || ui.estado?.value || 'TL';

  // Edad
  if (fechaNacimiento && ui.edad) {
    const edadCalculada = generador.calcularEdad(fechaNacimiento);
    if (edadCalculada !== '') {
      ui.edad.value = edadCalculada;
    }
  }

  // RFC → solo si NO viene de BD
  if (!ui.rfc?.hasAttribute('data-from-db')) {
    if (nombre && apellidos && fechaNacimiento && ui.rfc) {
      const rfcGenerado = generador.generarRFC(nombre, apellidos, fechaNacimiento);
      if (rfcGenerado) {
        ui.rfc.value = rfcGenerado;
      }
    }
  }

  // CURP → solo si NO viene de BD
  if (!ui.curp?.hasAttribute('data-from-db')) {
    if (nombre && apellidos && fechaNacimiento && sexo && ui.curp) {
      const curpGenerado = generador.generarCURP(nombre, apellidos, fechaNacimiento, sexo, estado);
      if (curpGenerado) {
        ui.curp.value = curpGenerado;
      }
    }
  }
}

// ======================================================
// 2) LISTENERS AUTOMÁTICOS (cuando el usuario escribe)
// ======================================================
export function attachAutoCalcListeners(ui, generador, setDirty, actualizarEstadoCivilPorSexo, normalizaSexoFn) {
  ['nombre', 'apellidos', 'fecha_nacimiento', 'sexo', 'estado', 'estado_nacimiento'].forEach((campo) => {
    const el = ui[campo];
    if (!el) return;

    const handler = () => {
      // Normaliza el sexo a M / F
      if (ui.sexo && normalizaSexoFn) {
        ui.sexo.value = normalizaSexoFn(ui.sexo.value);
      }

      // Si cambió el sexo → actualizar combo de estado civil
      if (campo === 'sexo' && typeof actualizarEstadoCivilPorSexo === 'function') {
        actualizarEstadoCivilPorSexo(ui);
      }

      actualizarCamposAutomaticos(ui, generador);
      setDirty(true);
    };

    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  });

  // Si el usuario escribe manualmente RFC, ya no lo tratamos como "auto"
  if (ui.rfc) {
    ui.rfc.addEventListener('input', () => {
      ui.rfc.removeAttribute('data-auto-generated');
      setDirty(true);
    });
  }

  // Lo mismo con CURP
  if (ui.curp) {
    ui.curp.addEventListener('input', () => {
      ui.curp.removeAttribute('data-auto-generated');
      setDirty(true);
    });
  }
}

// ======================================================
// 3) LLENADO DEL FORMULARIO DESDE LA BD
// ======================================================
export function fillForm(data, ui, generador, setEmpleadoId, setDirty) {
  console.log('📄 [fillForm] Iniciando llenado con data:', data);

  if (!data || typeof data !== 'object') {
    console.error('❌ [fillForm] Data inválida:', data);
    return;
  }

  // ========== 1. LLENADO DIRECTO (mismos nombres de campo) ==========
  Object.keys(ui).forEach((campo) => {
    if (ui[campo] && data[campo] !== undefined && data[campo] !== null) {
      try {
        ui[campo].value = data[campo];
        console.log(`✅ [fillForm] ${campo} = "${data[campo]}"`);
      } catch (e) {
        console.warn(`⚠️ [fillForm] Error en ${campo}:`, e.message);
      }
    }
  });

  // ========== 2. NUM_TRABAJADOR EN LA PARTE SUPERIOR ==========
  if (ui.num_trabajador_top && (data.num_trabajador || data.numero_trabajador)) {
    ui.num_trabajador_top.value = data.num_trabajador || data.numero_trabajador;
    console.log('✅ [fillForm] num_trabajador_top =', ui.num_trabajador_top.value);
  }

  // ========== 3. NOMBRE / APELLIDOS / NOMBRE_COMPLETO ==========
  const nombreBD    = data.nombre?.trim ? data.nombre.trim() : data.nombre;
  const apellidosBD = data.apellidos?.trim ? data.apellidos.trim() : data.apellidos;
  const nombreCompletoBD = data.nombre_completo?.trim?.() || '';

  console.log('🔍 [fillForm] Revisando nombre/apellidos:', {
    nombre_bd: nombreBD,
    apellidos_bd: apellidosBD,
    nombre_completo_bd: nombreCompletoBD
  });

  // Regla: si ya vienen nombre y apellidos → respetar
  if (nombreBD && apellidosBD) {
    if (ui.nombre) ui.nombre.value = nombreBD;
    if (ui.apellidos) ui.apellidos.value = apellidosBD;
    console.log('✅ [fillForm] Nombre/Apellidos tomados DIRECTO de BD');
  } else if (nombreCompletoBD && (!nombreBD || !apellidosBD)) {
    // Dividir nombre_completo solo si no hay nombre y apellidos
    const partes = nombreCompletoBD.split(' ').filter(Boolean);
    const len = partes.length;

    let nombreUI = '';
    let apellidosUI = '';

    if (len === 1) {
      nombreUI = partes[0];
    } else if (len === 2) {
      nombreUI = partes[0];
      apellidosUI = partes[1];
    } else {
      // 3 o más palabras: todo menos las dos últimas como nombre
      nombreUI = partes.slice(0, -2).join(' ');
      apellidosUI = partes.slice(-2).join(' ');
    }

    if (ui.nombre) ui.nombre.value = nombreUI;
    if (ui.apellidos) ui.apellidos.value = apellidosUI;

    console.log('✅ [fillForm] Nombre/Apellidos generados desde nombre_completo:', {
      nombre_ui: nombreUI,
      apellidos_ui: apellidosUI
    });
  }

  // ========== 4. FECHAS ISO → yyyy-mm-dd ==========
  if (data.fecha_nacimiento && ui.fecha_nacimiento) {
    ui.fecha_nacimiento.value = toInputDate(data.fecha_nacimiento);
    console.log('✅ [fillForm] fecha_nacimiento =', ui.fecha_nacimiento.value);
  }

  if (data.fecha_ingreso && ui.fecha_ingreso) {
    ui.fecha_ingreso.value = toInputDate(data.fecha_ingreso);
    console.log('✅ [fillForm] fecha_ingreso =', ui.fecha_ingreso.value);
  }

  // ========== 5. EDAD ==========
  if (ui.edad) {
    const edadCalculada = data.edad ?? calcularEdad(data.fecha_nacimiento);
    ui.edad.value = edadCalculada ?? '';
    console.log('✅ [fillForm] edad =', ui.edad.value);
  }

  // ========== 6. SEXO ==========
  if (ui.sexo && data.sexo != null) {
    ui.sexo.value = normalizaSexo(data.sexo);
    console.log('✅ [fillForm] sexo =', ui.sexo.value);
  }

  // ========== 7. ESTADO CIVIL (normalización según sexo) ==========
  if (ui.estado_civil) {
    const ec = valFrom(data, [
      'estado_civil',
      'EstadoCivil',
      'estatus_civil',
      'estatusCivil',
      'estado_Civil',
    ]);

    console.log('🔍 [fillForm] Estado civil RAW:', ec);

    if (ec) {
      const sexoActual = ui.sexo?.value || data.sexo || '';
      const ecLimpio = strip(ec);
      let estadoCivilNormalizado = ec;

      console.log('🔍 [fillForm] Normalizando estado civil:', {
        original: ec,
        limpio: ecLimpio,
        sexo: sexoActual
      });

      // Normalizar según sexo
      if (sexoActual === 'M') {
        if (ecLimpio.includes('SOLTER')) estadoCivilNormalizado = 'Soltero';
        else if (ecLimpio.includes('CASAD')) estadoCivilNormalizado = 'Casado';
        else if (ecLimpio.includes('DIVORCIAD')) estadoCivilNormalizado = 'Divorciado';
        else if (ecLimpio.includes('VIUD')) estadoCivilNormalizado = 'Viudo';
        else if (ecLimpio.includes('UNION')) estadoCivilNormalizado = 'Unión libre';
      } else if (sexoActual === 'F') {
        if (ecLimpio.includes('SOLTER')) estadoCivilNormalizado = 'Soltera';
        else if (ecLimpio.includes('CASAD')) estadoCivilNormalizado = 'Casada';
        else if (ecLimpio.includes('DIVORCIAD')) estadoCivilNormalizado = 'Divorciada';
        else if (ecLimpio.includes('VIUD')) estadoCivilNormalizado = 'Viuda';
        else if (ecLimpio.includes('UNION')) estadoCivilNormalizado = 'Unión libre';
      }

      console.log('✅ [fillForm] Estado civil normalizado:', estadoCivilNormalizado);

      setControlValue(ui.estado_civil, estadoCivilNormalizado);
      console.log('✅ [fillForm] estado_civil =', ui.estado_civil.value);
    }
  }

  // ========== 8. ESCOLARIDAD ==========
  if (ui.escolaridad) {
    const es = valFrom(data, ['escolaridad','Escolaridad']);
    if (es) {
      const k = strip(es);
      const escolaridadFinal = MAP_ESCOLARIDAD[k] || es;
      setControlValue(ui.escolaridad, escolaridadFinal);
      console.log('✅ [fillForm] escolaridad =', escolaridadFinal);
    }
  }

  // ========== 8B. TIPO NÓMINA ==========
  if (ui.tipo_nomina) {
    const tn = valFrom(data, [
      'tipo_nomina',
      'tipoNomina',
      'tipo_de_nomina',
      'nomina',
      'periodicidad'
    ]);
    
    if (tn) {
      const k = strip(tn);
      const tipoNominaFinal = MAP_TIPO_NOMINA[k] || tn;
      setControlValue(ui.tipo_nomina, tipoNominaFinal);
      console.log('✅ [fillForm] tipo_nomina NORMALIZADO =', tipoNominaFinal);
    }
  }

  // ========== 9. CORREO ==========
  if (ui.correo) {
    const correo = valFrom(data, ['correo_electronico', 'correo', 'email']);
    if (correo) {
      ui.correo.value = correo;
      console.log('✅ [fillForm] correo =', correo);
    }
  }

  // ========== 10. CREDENCIAL ==========
  if (ui.credencial) {
    const credencial = valFrom(data, ['num_credencial', 'credencial', 'numero_credencial']);
    if (credencial) {
      ui.credencial.value = credencial;
      console.log('✅ [fillForm] credencial =', credencial);
    }
  }

  // ========== 11. JEFE ==========
  if (ui.jefe) {
    const jefe = valFrom(data, ['jefe', 'jefe_inmediato', 'supervisor']);
    if (jefe) {
      ui.jefe.value = jefe;
      console.log('✅ [fillForm] jefe =', jefe);
    }
  }

  // ========== 12. PARENTESCO BENEFICIARIO ==========
  const parentescoInput = document.getElementById('parentesco');
  if (parentescoInput) {
    const parentesco = valFrom(data, [
      'benef_parentesco',
      'parentesco',
      'parentesco_beneficiario',
      'beneficiario_parentesco'
    ]);
    if (parentesco) {
      parentescoInput.value = parentesco;
      console.log('✅ [fillForm] parentesco =', parentesco);
    }
  }

  // ========== 13. SALARIO (alineado con backend) ==========
  if (ui.salario) {
    const salarioBruto =
      data.salario ??
      data.salario_monto ??
      data.r_sal ??
      null;

    ui.salario.value = salarioBruto !== null ? salarioBruto : '';
    console.log('💰 [fillForm] salario =', ui.salario.value);
  }

  // ========== 14. MARCAR CURP / RFC COMO DATOS DE BD ==========
  if (ui.rfc && data.rfc) {
    ui.rfc.value = data.rfc;
    ui.rfc.setAttribute('data-from-db', '1');
    console.log('✅ [fillForm] rfc (DB) =', ui.rfc.value);
  }

  if (ui.curp && data.curp) {
    ui.curp.value = data.curp;
    ui.curp.setAttribute('data-from-db', '1');
    console.log('✅ [fillForm] curp (DB) =', ui.curp.value);
  }

  // ========== 15. ESTADO FINAL ==========
  if (typeof setEmpleadoId === 'function') {
    const idEmpleado = data.id_empleado ?? data.id;
    setEmpleadoId(idEmpleado);
    console.log('✅ [fillForm] ID empleado establecido:', idEmpleado);
  }

  if (typeof setDirty === 'function') {
    setDirty(false);
  }

  // ========== 16. ACTUALIZAR CAMPOS AUTOMÁTICOS ==========
  if (generador) {
    actualizarCamposAutomaticos(ui, generador);
  }

  console.log('✅ [fillForm] Llenado completado');
}

// ======================================================
// 4) RECOLECCIÓN DE DATOS PARA GUARDAR / DOCUMENTOS
// ======================================================
export function collectPayload(ui) {
  const nombre    = ui.nombre?.value?.trim() || '';
  const apellidos = ui.apellidos?.value?.trim() || '';
  const nombre_completo = (nombre && apellidos)
    ? `${nombre} ${apellidos}`
    : (nombre || apellidos || '');

  const edad = ui.edad?.value ? parseInt(ui.edad.value) : null;

  const jefeInput = document.getElementById('jefe');
  const jefePred  = document.getElementById('jefe_predeterminado');

  let jefe = null;
  if (jefeInput?.value?.trim()) {
    jefe = jefeInput.value.trim();
  } else if (jefePred?.value && jefePred.value !== 'otro') {
    jefe = jefePred.value;
  }

  const parentescoInput = document.getElementById('parentesco');
  const parentescoPred  = document.getElementById('parentesco_predeterminado');

  let parentesco = null;
  if (parentescoInput?.value?.trim()) {
    parentesco = parentescoInput.value.trim();
  } else if (parentescoPred?.value && parentescoPred.value !== 'otro') {
    const val = parentescoPred.value;
    parentesco = val.charAt(0).toUpperCase() + val.slice(1);
  }

  // Estado civil
  let estadoCivil = ui.estado_civil?.value?.trim() || null;
  const sexoActual = ui.sexo?.value?.trim()?.toUpperCase();
  
  console.log('📦 [collectPayload] Estado civil RAW:', estadoCivil, 'Sexo:', sexoActual);
  
  if (estadoCivil && sexoActual) {
    const ecLimpio = strip(estadoCivil);
    
    if (sexoActual === 'M') {
      if (ecLimpio.includes('SOLTER')) estadoCivil = 'Soltero';
      else if (ecLimpio.includes('CASAD')) estadoCivil = 'Casado';
      else if (ecLimpio.includes('DIVORCIAD')) estadoCivil = 'Divorciado';
      else if (ecLimpio.includes('VIUD')) estadoCivil = 'Viudo';
      else if (ecLimpio.includes('UNION')) estadoCivil = 'Unión libre';
    } else if (sexoActual === 'F') {
      if (ecLimpio.includes('SOLTER')) estadoCivil = 'Soltera';
      else if (ecLimpio.includes('CASAD')) estadoCivil = 'Casada';
      else if (ecLimpio.includes('DIVORCIAD')) estadoCivil = 'Divorciada';
      else if (ecLimpio.includes('VIUD')) estadoCivil = 'Viuda';
      else if (ecLimpio.includes('UNION')) estadoCivil = 'Unión libre';
    }
  }
  
  console.log('📦 [collectPayload] Estado civil NORMALIZADO:', estadoCivil);

  return {
    num_trabajador: ui.num_trabajador_top?.value?.trim() || null,
    nombre: nombre || null,
    apellidos: apellidos || null,
    nombre_completo: nombre_completo || null,

    correo: ui.correo?.value || null,
    sexo: ui.sexo?.value || null,
    fecha_nacimiento: ui.fecha_nacimiento?.value || null,
    edad: edad,

    calle_numero: ui.calle_numero?.value || null,
    colonia: ui.colonia?.value || null,
    municipio: ui.municipio?.value || null,
    estado: ui.estado?.value || null,
    estado_nacimiento: ui.estado_nacimiento?.value || null,
    codigo_postal: ui.codigo_postal?.value || null,
    telefono: ui.telefono?.value || null,

    estado_civil: estadoCivil,
    escolaridad: ui.escolaridad?.value || null,

    // ⚠️ Respetar valores de BD si existen
    curp: ui.curp?.hasAttribute('data-from-db')
      ? ui.curp.value
      : (ui.curp?.value || null),

    rfc: ui.rfc?.hasAttribute('data-from-db')
      ? ui.rfc.value
      : (ui.rfc?.value || null),

    nss: ui.nss?.value || null,
    credencial: ui.credencial?.value || ui.num_credencial?.value || null,
    num_credencial: ui.num_credencial?.value || null,

    fecha_ingreso: ui.fecha_ingreso?.value || null,
    area: ui.area?.value || null,
    puesto: ui.puesto?.value || null,
    jefe: jefe,

    salario: ui.salario?.value 
      ? parseFloat(String(ui.salario.value).replace(',', '.')) 
      : null,

    tipo_nomina: (() => {
      const raw = ui.tipo_nomina?.value || '';
      const k   = strip(raw);
      return MAP_TIPO_NOMINA[k] || raw || null;
    })(),

    benef_nombre: ui.benef_nombre?.value || null,
    benef_telefono: ui.benef_telefono?.value || null,
    benef_parentesco: parentesco
  };
}

// ======================================================
// 5) ACTUALIZAR ESTADO CIVIL SEGÚN SEXO (combo dinámico)
// ======================================================
export function actualizarEstadoCivilPorSexo(ui) {
  const select = ui.estado_civil;
  if (!select) return;

  const sexo = (ui.sexo?.value || '').toUpperCase().trim();
  const valorActual = select.value;

  console.log('🔄 [actualizarEstadoCivilPorSexo] Sexo:', sexo, 'Valor actual:', valorActual);

  // Limpia opciones actuales
  while (select.firstChild) {
    select.removeChild(select.firstChild);
  }

  /** Opciones según sexo */
  let opciones = [];

  if (sexo === 'M') {
    opciones = [
      { value: '', text: 'Seleccione...' },
      { value: 'Soltero',   text: 'Soltero' },
      { value: 'Casado',    text: 'Casado' },
      { value: 'Divorciado',text: 'Divorciado' },
      { value: 'Viudo',     text: 'Viudo' },
      { value: 'Unión libre', text: 'Unión libre' },
    ];
  } else if (sexo === 'F') {
    opciones = [
      { value: '', text: 'Seleccione...' },
      { value: 'Soltera',   text: 'Soltera' },
      { value: 'Casada',    text: 'Casada' },
      { value: 'Divorciada',text: 'Divorciada' },
      { value: 'Viuda',     text: 'Viuda' },
      { value: 'Unión libre', text: 'Unión libre' },
    ];
  } else {
    // Sin sexo: mostrar todas las opciones
    opciones = [
      { value: '', text: 'Seleccione...' },
      { value: 'Soltero',   text: 'Soltero' },
      { value: 'Soltera',   text: 'Soltera' },
      { value: 'Casado',    text: 'Casado' },
      { value: 'Casada',    text: 'Casada' },
      { value: 'Divorciado',text: 'Divorciado' },
      { value: 'Divorciada',text: 'Divorciada' },
      { value: 'Viudo',     text: 'Viudo' },
      { value: 'Viuda',     text: 'Viuda' },
      { value: 'Unión libre', text: 'Unión libre' },
    ];
  }

  // Crea las opciones en el <select>
  opciones.forEach(op => {
    const o = document.createElement('option');
    o.value = op.value;
    o.textContent = op.text;
    select.appendChild(o);
  });

  // Siempre permitir edición
  select.disabled = false;
  select.style.backgroundColor = '';
  select.style.cursor = '';

  // Intentar respetar el valor actual (si existía)
  if (valorActual) {
    const valorNormalizado = strip(valorActual);

    const conversionMap = {
      'SOLTERO':  sexo === 'F' ? 'Soltera' : 'Soltero',
      'SOLTERA':  sexo === 'M' ? 'Soltero' : 'Soltera',
      'SOLTEROA': sexo === 'F' ? 'Soltera' : 'Soltero',

      'CASADO':   sexo === 'F' ? 'Casada' : 'Casado',
      'CASADA':   sexo === 'M' ? 'Casado' : 'Casada',
      'CASADOA':  sexo === 'F' ? 'Casada' : 'Casado',

      'DIVORCIADO':  sexo === 'F' ? 'Divorciada' : 'Divorciado',
      'DIVORCIADA':  sexo === 'M' ? 'Divorciado' : 'Divorciada',
      'DIVORCIADOA': sexo === 'F' ? 'Divorciada' : 'Divorciado',

      'VIUDO':   sexo === 'F' ? 'Viuda' : 'Viudo',
      'VIUDA':   sexo === 'M' ? 'Viudo' : 'Viuda',
      'VIUDOA':  sexo === 'F' ? 'Viuda' : 'Viudo',

      'UNIONLIBRE': 'Unión libre',
      'UNION LIBRE': 'Unión libre',
    };

    let nuevoValor = conversionMap[valorNormalizado] || valorActual;

    // Si el valor sigue sin existir, buscar por texto
    let optionExists = Array.from(select.options).some(opt => opt.value === nuevoValor);
    
    if (!optionExists) {
      const optionByText = Array.from(select.options).find(
        opt => strip(opt.textContent) === strip(nuevoValor)
      );
      if (optionByText) {
        nuevoValor = optionByText.value;
        optionExists = true;
      }
    }

    if (optionExists) {
      select.value = nuevoValor;
      console.log('✅ [actualizarEstadoCivilPorSexo] Valor restaurado:', nuevoValor);
    } else {
      console.warn('⚠️ [actualizarEstadoCivilPorSexo] Valor no encontrado:', nuevoValor);
    }
  }

  console.log('✅ Estado civil actualizado para sexo:', sexo);
}
