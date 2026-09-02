const strip = (s) =>
  (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.\-_/]/g, '')
    .trim()
    .toUpperCase();

// Construye un índice normalizado de las claves reales de la fila,
// para poder matchear columnas con espacios/acentos/puntos.
function buildKeyIndex(row) {
  const idx = {};
  for (const k of Object.keys(row)) {
    idx[strip(k)] = k;
  }
  return idx;
}

// get() mejorado: intenta variants (Upper/Camel/Snake) y, además,
// busca por clave NORMALIZADA en el índice de la fila.
const get = (row, keys) => {
  const kidx = row.__kidx || (row.__kidx = buildKeyIndex(row));

  for (const k of keys) {
    // 1) intentos directos habituales
    if (k in row && row[k] != null && `${row[k]}`.trim() !== '') return row[k];

    const kUp = k.toUpperCase();
    if (kUp in row && row[kUp] != null && `${row[kUp]}`.trim() !== '') return row[kUp];

    const kCamel = k.replace(/[_\s]+(.)/g, (_, c) => c.toUpperCase());
    if (kCamel in row && row[kCamel] != null && `${row[kCamel]}`.trim() !== '') return row[kCamel];

    const kSnake = k.replace(/[A-Z]/g, c => '_' + c).toLowerCase().replace(/^_/, '');
    if (kSnake in row && row[kSnake] != null && `${row[kSnake]}`.trim() !== '') return row[kSnake];

    // 2) match por clave normalizada (soporta "Tipo de nómina", "Teléfono beneficiario", etc.)
    const norm = strip(k);
    const realKey = kidx[norm];
    if (realKey && row[realKey] != null && `${row[realKey]}`.trim() !== '') return row[realKey];
  }
  return null;
};

const MAP_ESTADO_CIVIL = {
  'CASADO': 'Casado(a)', 'CASADA': 'Casado(a)',
  'SOLTERO': 'Soltero(a)', 'SOLTERA': 'Soltero(a)',
  'UNIONLIBRE': 'Unión libre', 'UNION LIBRE': 'Unión libre',
  'DIVORCIADO': 'Divorciado(a)', 'DIVORCIADA': 'Divorciado(a)',
  'VIUDO': 'Viudo(a)', 'VIUDA': 'Viudo(a)',
};

const MAP_ESCOLARIDAD = {
  'NINGUNA':      'Ninguna',
  'PRIMARIA':     'Primaria',
  'SECUNDARIA':   'Secundaria',
  // Unificamos todo a “Bachillerato”
  'PREPARATORIA': 'Bachillerato',
  'BACHILLERATO': 'Bachillerato',
  'TECNICO':      'Técnico',
  'TECNICOA':     'Técnico',   // por si viene raro
  'TECNICO.':     'Técnico',
  'LICENCIATURA': 'Licenciatura',
  'MAESTRIA':     'Maestría',
  'MAESTRIA.':    'Maestría',
  'MAESTRÍA':     'Maestría',
  'DOCTORADO':    'Doctorado'
};

const MAP_TIPO_NOMINA = {
  'SEMANAL':'Semanal','QUINCENAL':'Quincenal','MENSUAL':'Mensual','CATORCENAL':'Catorcenal'
};

const MAP_ESTADOS = {
  'DF':'Ciudad de México',
  'CDMX':'Ciudad de México',
  'TLAX.':'Tlaxcala', 'TLAX':'Tlaxcala', 'TLAXCALA':'Tlaxcala',
  'MEX.':'Estado de México', 'EDOMEX':'Estado de México',
  'QRO.':'Querétaro', 'QRO':'Querétaro'
};

const normalizaSexo = (v) => {
  const s = strip(v);
  if (s.startsWith('M')) return 'M';
  if (s.startsWith('F')) return 'F';
  return v ?? '';
};
const normalizaEstado = (v) => {
  const s = strip(v);
  if (!s) return v ?? null;
  for (const [k, nombre] of Object.entries(MAP_ESTADOS)) {
    if (strip(k) === s) return nombre;
  }
  return v;
};
const calcularEdad = (fecha) => {
  if (!fecha) return null;
  const n = new Date(fecha);
  if (isNaN(n)) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - n.getFullYear();
  const m = hoy.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) edad--;
  return edad;
};

export function mapRow(row) {
  const nombre   = get(row, ['nombre','Nombre']) ?? '';
  const apellidos = get(row, ['apellidos','Apellidos']) ?? '';
  const nombreCompleto = get(row, ['nombre_completo','NombreCompleto']) 
                      ?? `${nombre} ${apellidos}`.trim();

  const ecRaw = get(row, ['estado_civil','EstadoCivil']);
  const escRaw = get(row, ['escolaridad','Escolaridad']);
  const tnRaw  = get(row, [
    'tipo_nomina','tipoNomina','tipo_de_nomina',
    'periodicidad','periodicidad_pago','periodicidad_de_pago',
    'tipo_pago','tipoPago'
  ]);

  const mapped = {
    id_empleado: get(row, ['id_empleado','IdEmpleado','ID_EMPLEADO']),
    num_trabajador: get(row, ['num_trabajador','numero_trabajador','no_empleado','empleado','empleado_num','NumeroTrabajador']),

    nombre,
    apellidos,
    nombre_completo: nombreCompleto || null,

    correo: get(row, ['correo','correo_electronico','email','Correo','Email','E_mail']),
    sexo: normalizaSexo(get(row, ['sexo','Sexo','genero'])),
    fecha_nacimiento: get(row, ['fecha_nacimiento','FechaNacimiento','Fecha_Nacimiento']),
    edad: get(row, ['edad']) ?? calcularEdad(get(row, ['fecha_nacimiento','FechaNacimiento','Fecha_Nacimiento'])),

    calle_numero: get(row, ['calle_numero','calle','domicilio','direccion']),
    colonia: get(row, ['colonia','barrio','fraccionamiento']),
    municipio: get(row, ['municipio','ciudad','localidad']),
    estado: normalizaEstado(get(row, ['estado','estado_origen','estadoNacimiento'])),
    codigo_postal: get(row, ['codigo_postal','cp','CodPostal','CodigoPostal']),
    telefono: get(row, ['telefono','tel','celular','telefono1']),

    estado_civil: MAP_ESTADO_CIVIL[strip(ecRaw)] || ecRaw || null,
    escolaridad:  MAP_ESCOLARIDAD[strip(escRaw)] || escRaw || null,
    curp: get(row, ['curp','CURP']),
    rfc: get(row, ['rfc','RFC']),
    nss: get(row, ['nss','NSS']),

    credencial: get(row, [
    'credencial',          // alias de la vista
    'num_credencial',      // nombre en tabla Empleado
    'numero_credencial',
    'no_credencial',
    'credencial_ine',      // por si en alguna fuente la llamaron así
    'ine',
    'ine_numero'
  ]),

    fecha_ingreso: get(row, ['fecha_ingreso','FechaIngreso','Fecha_Ingreso']),
    area: get(row, ['area','Area','departamento','Departamento']),
    puesto: get(row, ['puesto','Puesto','cargo']),
    jefe: get(row, ['jefe','jefe_inmediato','Jefe inmediato','supervisor','coordinador','gerente','encargado']),

    salario: get(row, [
      'salario','sueldo','sueldo_mensual','sueldo_diario','salario_diario','sdi',
      'salario_mensual','salario_base','sueldo_base'
    ]),
    tipo_nomina: MAP_TIPO_NOMINA[strip(tnRaw)] || tnRaw || null,

    // Beneficiario (agregadas variantes con orden invertido)
    benef_nombre: get(row, [
      'benef_nombre','beneficiario_nombre','beneficiarioNombre','nombre_beneficiario','Nombre beneficiario'
    ]) ?? row?.beneficiario?.nombre ?? null,
    benef_telefono: get(row, [
      'benef_telefono','beneficiario_telefono','beneficiarioTelefono',
      'telefono_beneficiario','Teléfono beneficiario','tel_beneficiario'
    ]) ?? row?.beneficiario?.telefono ?? null,
    benef_parentesco: get(row, [
      'benef_parentesco','beneficiario_parentesco','beneficiarioParentesco',
      'parentesco_beneficiario','Parentesco beneficiario'
    ]) ?? row?.beneficiario?.parentesco ?? null,
  };

  Object.keys(mapped).forEach(k => {
    if (mapped[k] === '' || mapped[k] === undefined) mapped[k] = null;
  });

  return mapped;
}
