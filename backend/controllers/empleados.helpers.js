// backend/controllers/empleados.helpers.js - CORREGIDO

import sql from 'mssql';

const toNull = v => (v === undefined || v === null || String(v).trim?.() === '' ? null : v);

function parseDateLoose(v) {
  if (!v) return null;
  try {
    const s = typeof v === 'string' ? v.slice(0, 10).replace(/\//g, '-') : v;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}

function normMoney(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? null : n;
}

export function pickEmpleado(b = {}) {
  const correo       = b.correo ?? b.correo_electronico;
  const credencial   = b.credencial ?? b.num_credencial;
  const fechaIngreso = b.fecha_ingreso ?? b.fecha_inicio;
  const jefeNombre   = b.jefe ?? b.jefe_inmediato ?? b.jefeNombre;
  const areaValor    = b.area ?? b.nombre_area ?? b.id_area;
  const puestoValor  = b.puesto ?? b.nombre_puesto ?? b.id_puesto;
  const tipoNomina   = b.tipo_nomina ?? b.tipoNomina ?? b.nomina;
  const salarioValor = b.salario ?? b.salario_monto ?? b.monto_salario;

  const benefNombre = b.benef_nombre ?? b.beneficiario_nombre ?? b.nombre_beneficiario ?? b.beneficiario?.nombre;
  const benefTel    = b.benef_telefono ?? b.beneficiario_telefono ?? b.telefono_beneficiario ?? b.tel_beneficiario ?? b.beneficiario?.telefono;
  const benefParen  = b.benef_parentesco ?? b.parentesco ?? b.beneficiario_parentesco ?? b.parentesco_beneficiario ?? b.beneficiario?.parentesco;
  const benefCorreo = b.benef_correo ?? b.beneficiario_correo ?? b.correo_beneficiario ?? b.beneficiario?.correo;

  // ✅ ESTADO CIVIL con múltiples aliases (CRÍTICO)
  const estadoCivil = 
    b.estado_civil ?? 
    b.estatus_civil ?? 
    b.estadoCivil ?? 
    b.estatusCivil ?? 
    b.estado_Civil ?? 
    b.EstadoCivil ?? 
    null;

  console.log('🔍 [pickEmpleado] Estado civil detectado:', estadoCivil);

  console.log('🔍 [pickEmpleado] Parentesco detectado:', {
    original: b.benef_parentesco,
    alternativo: b.parentesco,
    seleccionado: benefParen
  });

  return {
    num_trabajador:   toNull(b.num_trabajador),
    nombre:           toNull(b.nombre),
    apellidos:        toNull(b.apellidos),
    nombre_completo:  toNull(b.nombre_completo || `${b.nombre || ''} ${b.apellidos || ''}`.trim()),
    correo:           toNull(correo),
    sexo:             toNull(b.sexo),

    fecha_nacimiento: parseDateLoose(b.fecha_nacimiento),
    edad:             b.edad ? parseInt(b.edad) : null,
    fecha_ingreso:    parseDateLoose(fechaIngreso),

    calle_numero:     toNull(b.calle_numero),
    colonia:          toNull(b.colonia),
    municipio:        toNull(b.municipio),
    estado:           toNull(b.estado),
    codigo_postal:    toNull(b.codigo_postal),
    telefono:         toNull(b.telefono),
    
    estado_civil:     toNull(estadoCivil), // ✅ AGREGADO
    escolaridad:      toNull(b.escolaridad),
    curp:             toNull(b.curp),
    rfc:              toNull(b.rfc),
    nss:              toNull(b.nss),

    area:             toNull(areaValor),
    puesto:           toNull(puestoValor),
    jefe:             toNull(jefeNombre),
    salario:          normMoney(salarioValor),
    tipo_nomina:      toNull(tipoNomina),

    credencial:       toNull(credencial),

    benef_nombre:     toNull(benefNombre),
    benef_telefono:   toNull(benefTel),
    benef_parentesco: toNull(benefParen),
    benef_correo:     toNull(benefCorreo),
  };
}

export const EMP_SPEC = {
  num_trabajador:     { type: sql.NVarChar, len: 60  },
  nombre:             { type: sql.NVarChar, len: 360 },
  apellidos:          { type: sql.NVarChar, len: 360 },
  nombre_completo:    { type: sql.NVarChar, len: 360 },
  correo_electronico: { type: sql.NVarChar, len: 240 },
  sexo:               { type: sql.NVarChar, len: 20  },
  fecha_nacimiento:   { type: sql.Date },
  edad:               { type: sql.Int },
  calle_numero:       { type: sql.NVarChar, len: 320 },
  colonia:            { type: sql.NVarChar, len: 240 },
  municipio:          { type: sql.NVarChar, len: 240 },
  estado:             { type: sql.NVarChar, len: 80  },
  codigo_postal:      { type: sql.NVarChar, len: 10  },
  telefono:           { type: sql.NVarChar, len: 20  },
  estado_civil:       { type: sql.NVarChar, len: 60  }, // ✅ AGREGADO
  escolaridad:        { type: sql.NVarChar, len: 120 },
  curp:               { type: sql.NVarChar, len: 26  },
  rfc:                { type: sql.NVarChar, len: 20  },
  nss:                { type: sql.NVarChar, len: 20  },
  fecha_ingreso:      { type: sql.Date },
  num_credencial:     { type: sql.NVarChar, len: 128 },
};