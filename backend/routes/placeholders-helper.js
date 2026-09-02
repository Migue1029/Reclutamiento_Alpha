// backend/routes/placeholders-helper.js
// Función centralizada para generar TODOS los placeholders

export function generarPlaceholdersCompletos(payload) {
  // Helper: Formatear número de trabajador
  const formatearNumTrabajador = (num) => {
    if (!num) return '00000';
    const clean = String(num).replace(/\D/g, '');
    return clean.padStart(6, '0');
  };

  // Helper: Formatear fecha legible
  const formatearFecha = (fecha) => {
    if (!fecha) return "";
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return "";
    const meses = [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ];
    return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
  };

  // Helper: Número a letras
  const numeroALetras = (numero) => {
    if (numero === 0 || numero === "0" || numero === null || numero === undefined) 
      return "CERO PESOS 00/100 M.N.";

    const num = typeof numero === 'string' ? parseFloat(numero.replace(/,/g, '')) : numero;
    if (isNaN(num)) return "CERO PESOS 00/100 M.N.";

    const partes = num.toFixed(2).split('.');
    const entero = parseInt(partes[0]);
    const centavos = partes[1];

    const unidades = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
    const decenas = ["", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
    const especiales = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
    const centenas = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

    function convertirGrupo(n) {
      if (n === 0) return "";
      if (n === 100) return "CIEN";
      if (n < 10) return unidades[n];
      if (n >= 10 && n < 20) return especiales[n - 10];
      if (n < 100) {
        const dec = Math.floor(n / 10);
        const uni = n % 10;
        if (n >= 21 && n <= 29) return "VEINTI" + unidades[uni];
        return decenas[dec] + (uni > 0 ? " Y " + unidades[uni] : "");
      }
      if (n < 1000) {
        const cen = Math.floor(n / 100);
        const resto = n % 100;
        return centenas[cen] + (resto > 0 ? " " + convertirGrupo(resto) : "");
      }
      return String(n);
    }

    function convertirNumero(n) {
      if (n === 0) return "CERO";
      if (n === 1) return "UN";
      if (n < 1000) return convertirGrupo(n);

      if (n < 1000000) {
        const miles = Math.floor(n / 1000);
        const resto = n % 1000;
        let resultado = miles === 1 ? "MIL" : convertirGrupo(miles) + " MIL";
        if (resto > 0) resultado += " " + convertirGrupo(resto);
        return resultado;
      }

      if (n < 1000000000) {
        const millones = Math.floor(n / 1000000);
        const resto = n % 1000000;
        let resultado = millones === 1 ? "UN MILLÓN" : convertirGrupo(millones) + " MILLONES";
        if (resto > 0) resultado += " " + convertirNumero(resto);
        return resultado;
      }

      return String(n);
    }

    const textoEntero = convertirNumero(entero);
    return `${textoEntero} PESOS ${centavos}/100 M.N.`;
  };

  // Helper: Mapa de estados
  const MAP_ESTADOS = {
    'AS': 'AGUASCALIENTES', 'BC': 'BAJA CALIFORNIA', 'BS': 'BAJA CALIFORNIA SUR',
    'CC': 'CAMPECHE', 'CL': 'COAHUILA', 'CM': 'COLIMA', 'CS': 'CHIAPAS',
    'CH': 'CHIHUAHUA', 'DF': 'CIUDAD DE MÉXICO', 'DG': 'DURANGO',
    'GT': 'GUANAJUATO', 'GR': 'GUERRERO', 'HG': 'HIDALGO', 'JC': 'JALISCO',
    'MC': 'ESTADO DE MÉXICO', 'MN': 'MICHOACÁN', 'MS': 'MORELOS',
    'NT': 'NAYARIT', 'NL': 'NUEVO LEÓN', 'OC': 'OAXACA', 'PL': 'PUEBLA',
    'QT': 'QUERÉTARO', 'QR': 'QUINTANA ROO', 'SP': 'SAN LUIS POTOSÍ',
    'SL': 'SINALOA', 'SR': 'SONORA', 'TC': 'TABASCO', 'TS': 'TAMAULIPAS',
    'TL': 'TLAXCALA', 'VZ': 'VERACRUZ', 'YN': 'YUCATÁN', 'ZS': 'ZACATECAS',
    'NE': 'NACIDO EN EL EXTRANJERO'
  };

  const obtenerNombreEstado = (codigo) => {
    if (!codigo) return 'TLAXCALA';
    const cod = String(codigo).toUpperCase().trim();
    if (cod.length > 2) return cod;
    return MAP_ESTADOS[cod] || cod;
  };

  // ==================== PREPARAR DATOS ====================
  const now = new Date();
  const numeroEmpleado = payload.num_trabajador?.replace(/\D/g, "") || payload.id || "00001";
  const numFormateado = formatearNumTrabajador(numeroEmpleado);

  // Domicilio completo con estado ABREVIADO (para contratos/credencial)
  const domicilioAbreviado = `${payload.calle_numero || 'SIN NUMERO'}, ${payload.colonia || ''}, ${payload.municipio || ''}, ${
    payload.estado || 'TL'
  }, C.P. ${payload.codigo_postal || ''}`
    .replace(/^, |, $|, , /g, '')
    .replace(/,\s*,/g, ',')
    .trim()
    .toUpperCase();

  // Domicilio completo con estado COMPLETO (para CheckList)
  const domicilioCompleto = `${payload.calle_numero || 'SIN NUMERO'}, ${payload.colonia || ''}, ${payload.municipio || ''}, ${
    obtenerNombreEstado(payload.estado)
  }, C.P. ${payload.codigo_postal || ''}`
    .replace(/^, |, $|, , /g, '')
    .replace(/,\s*,/g, ',')
    .trim()
    .toUpperCase();

  // ==================== RETORNAR TODOS LOS PLACEHOLDERS ====================
  return {
    // ========== IDENTIFICACIÓN ==========
    NUM_TRABAJADOR: numFormateado,
    NUMERO_TRABAJADOR: numFormateado,
    NO_TRABAJADOR: numFormateado,
    NUMERO_EMPLEADO: numFormateado,
    ID_EMPLEADO: payload.id_empleado || '',

    // ========== NOMBRE ==========
    NOMBRE_COMPLETO: (payload.nombre_completo || '').toUpperCase(),
    NOMBRE: (payload.nombre || '').toUpperCase(),
    APELLIDOS: (payload.apellidos || '').toUpperCase(),
    APELLIDO_PATERNO: (payload.apellidos?.split(' ')[0] || '').toUpperCase(),
    APELLIDO_MATERNO: (payload.apellidos?.split(' ')[1] || '').toUpperCase(),

    // ========== EDAD Y SEXO ==========
    EDAD: payload.edad || '',
    SEXO: payload.sexo === 'M' ? 'MASCULINO' : payload.sexo === 'F' ? 'FEMENINO' : (payload.sexo || '').toUpperCase(),
    GENERO: payload.sexo === 'M' ? 'MASCULINO' : payload.sexo === 'F' ? 'FEMENINO' : (payload.sexo || '').toUpperCase(),

    // ========== ESTADO CIVIL ==========
    ESTADO_CIVIL: (payload.estado_civil || '').toUpperCase(),
    ESTATUS_CIVIL: (payload.estado_civil || '').toUpperCase(),

    // ========== DOCUMENTOS ==========
    RFC: (payload.rfc || '').toUpperCase(),
    CURP: (payload.curp || '').toUpperCase(),
    NSS: payload.nss || '',
    NO_IMSS: payload.nss || '',
    IMSS: payload.nss || '',
    
    CREDENCIAL: payload.credencial || payload.num_credencial || '',
    NUM_CREDENCIAL: payload.credencial || payload.num_credencial || '',
    NUMERO_CREDENCIAL: payload.credencial || payload.num_credencial || '',
    NO_CREDENCIAL: payload.credencial || payload.num_credencial || '',
    CREDENCIAL_INE: payload.credencial || payload.num_credencial || '',
    INE: payload.credencial || payload.num_credencial || '',

    // ========== DOMICILIO COMPLETO ==========
    DOMICILIO: domicilioAbreviado,
    DOMICILIO_COMPLETO: domicilioCompleto,
    DIRECCION: domicilioAbreviado,
    DIRECCION_COMPLETA: domicilioCompleto,

    // ========== DOMICILIO DESGLOSADO ==========
    CALLE_NUMERO: (payload.calle_numero || '').toUpperCase(),
    CALLE: (payload.calle_numero || '').toUpperCase(),
    NUMERO: (payload.calle_numero || '').toUpperCase(),
    
    COLONIA: (payload.colonia || '').toUpperCase(),
    MUNICIPIO: (payload.municipio || '').toUpperCase(),
    CIUDAD: (payload.municipio || '').toUpperCase(),
    LOCALIDAD: (payload.municipio || '').toUpperCase(),
    
    // Estado ABREVIADO
    ESTADO: (payload.estado || 'TL').toUpperCase(),
    ESTADO_ABREVIADO: (payload.estado || 'TL').toUpperCase(),
    
    // Estado COMPLETO
    ESTADO_COMPLETO: obtenerNombreEstado(payload.estado),
    ESTADO_NOMBRE: obtenerNombreEstado(payload.estado),
    ESTADO_RESIDENCIA: obtenerNombreEstado(payload.estado),
    
    // Código postal
    CP: payload.codigo_postal || '',
    CODIGO_POSTAL: payload.codigo_postal || '',
    C_P: payload.codigo_postal || '',
    COD_POSTAL: payload.codigo_postal || '',

    // ========== CONTACTO ==========
    TELEFONO: payload.telefono || '',
    TEL: payload.telefono || '',
    CELULAR: payload.telefono || '',
    
    CORREO: payload.correo || '',
    CORREO_ELECTRONICO: payload.correo || '',
    EMAIL: payload.correo || '',
    E_MAIL: payload.correo || '',
    MAIL: payload.correo || '',

    // ========== EMPLEO ==========
    PUESTO: (payload.puesto || '').toUpperCase(),
    CARGO: (payload.puesto || '').toUpperCase(),
    
    AREA: (payload.area || '').toUpperCase(),
    DEPARTAMENTO: (payload.area || '').toUpperCase(),
    SECCION: (payload.area || '').toUpperCase(),

    // ========== SALARIO ==========
    SALARIO: payload.salario || '0',
    SALARIO_DIARIO: payload.salario || '0',
    SUELDO: payload.salario || '0',
    SUELDO_DIARIO: payload.salario || '0',
    MONTO_SALARIO: payload.salario || '0',
    
    SALARIO_LETRAS: numeroALetras(payload.salario),
    SALARIO_LETRA: numeroALetras(payload.salario),
    SUELDO_LETRAS: numeroALetras(payload.salario),

    // ========== TIPO NÓMINA ==========
    TIPO_NOMINA: (
      payload.tipo_nomina === 'Quincenal'
        ? 'QUINCE Y ULTIMO DE CADA MES'
        : payload.tipo_nomina === 'Semanal'
        ? 'SÁBADO DE CADA SEMANA'
        : payload.tipo_nomina || ''
    ).toUpperCase(),
    NOMINA: payload.tipo_nomina || '',
    PERIODICIDAD: payload.tipo_nomina || '',
    TIPO_PAGO: payload.tipo_nomina || '',

    // ========== FECHAS ==========
    FECHA_INGRESO: formatearFecha(payload.fecha_ingreso),
    FECHA_INICIO: formatearFecha(payload.fecha_ingreso),
    FECHA_ALTA: formatearFecha(payload.fecha_ingreso),
    
    FECHA_NACIMIENTO: formatearFecha(payload.fecha_nacimiento),
    FECHA_NAC: formatearFecha(payload.fecha_nacimiento),
    
    FECHA_ACTUAL: formatearFecha(now),
    FECHA_HOY: formatearFecha(now),
    
    FECHA_COMPLETA_TEXTO: `${numeroALetras(now.getDate()).toUpperCase()} DE ${
      ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'][now.getMonth()]
    } DEL AÑO ${numeroALetras(now.getFullYear()).toUpperCase()}`,

    DIA_ACTUAL: now.getDate(),
    DIA_ACTUAL_TEXTO: numeroALetras(now.getDate()).toUpperCase(),
    DIA: now.getDate(),
    
    MES_ACTUAL: ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'][now.getMonth()],
    MES_ACTUAL_NUMERO: now.getMonth() + 1,
    MES: ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'][now.getMonth()],
    
    AÑO_ACTUAL: now.getFullYear(),
    AÑO_ACTUAL_TEXTO: numeroALetras(now.getFullYear()).toUpperCase(),
    AÑO: now.getFullYear(),
    ANIO: now.getFullYear(),

    // ========== BENEFICIARIO (TODOS LOS ALIAS) ==========
    NOM_BENEF: (payload.benef_nombre || '').toUpperCase(),
    BENEF_NOMBRE: (payload.benef_nombre || '').toUpperCase(),
    BENEFICIARIO_NOMBRE: (payload.benef_nombre || '').toUpperCase(),
    NOMBRE_BENEFICIARIO: (payload.benef_nombre || '').toUpperCase(),
    BENEFICIARIO: (payload.benef_nombre || '').toUpperCase(),
    EMERGENCIA_NOMBRE: (payload.benef_nombre || '').toUpperCase(),
    
    BENEF_TELEFONO: payload.benef_telefono || '',
    TELEFONO_BENEFICIARIO: payload.benef_telefono || '',
    TEL_BENEFICIARIO: payload.benef_telefono || '',
    EMERGENCIA_TELEFONO: payload.benef_telefono || '',
    TEL_EMERGENCIA: payload.benef_telefono || '',
    
    BENEF_PARENTESCO: (payload.benef_parentesco || payload.parentesco || '').toUpperCase(),
    PARENTESCO: (payload.benef_parentesco || payload.parentesco || '').toUpperCase(),
    PARENTESCO_BENEFICIARIO: (payload.benef_parentesco || payload.parentesco || '').toUpperCase(),
    EMERGENCIA_PARENTESCO: (payload.benef_parentesco || payload.parentesco || '').toUpperCase(),
    
    BENEF_CORREO: (payload.benef_correo || '').toUpperCase(),
    CORREO_BENEFICIARIO: (payload.benef_correo || '').toUpperCase(),
    EMERGENCIA_CORREO: (payload.benef_correo || '').toUpperCase(),

    // ========== JEFE ==========
    JEFE: (payload.jefe || '').toUpperCase(),
    JEFE_INMEDIATO: (payload.jefe || '').toUpperCase(),
    SUPERVISOR: (payload.jefe || '').toUpperCase(),
    JEFE_NOMBRE: (payload.jefe || '').toUpperCase(),
    JEFE_NOMBRE_COMPLETO: (payload.jefe || '').toUpperCase(),
    COORDINADOR: (payload.jefe || '').toUpperCase(),
    ENCARGADO: (payload.jefe || '').toUpperCase(),

    // ========== EMPRESA ==========
    EMPRESA: 'ALPHA CERAMICA, S.A.P.I DE C.V.',
    EMPRESA_NOMBRE: 'ALPHA CERAMICA, S.A.P.I DE C.V.',
    RAZON_SOCIAL: 'ALPHA CERAMICA, S.A.P.I DE C.V.',
    
    EMPRESA_DIRECCION: 'Km. 14.8 Carretera Vía Corta, Puebla-Santa Ana Chiautempan',
    EMPRESA_DOMICILIO: 'Km. 14.8 Carretera Vía Corta, Puebla-Santa Ana Chiautempan',
    
    EMPRESA_REPRESENTANTE: 'C.P. MARTÍNEZ BENITO CRISTOBAL GERARDO',
    REPRESENTANTE_LEGAL: 'C.P. MARTÍNEZ BENITO CRISTOBAL GERARDO',
    REPRESENTANTE: 'C.P. MARTÍNEZ BENITO CRISTOBAL GERARDO',
    
    EMPRESA_PUESTO: 'Representante Legal',
    PUESTO_REPRESENTANTE: 'Representante Legal',

    // ========== OTROS ==========
    CODIGO_CONTRATO: `${payload.tipo_empleado || 'S'}-${numFormateado}`,
    TIPO_CONTRATO: String(payload.tipo_contrato || '').toUpperCase(),
    TIPO_EMPLEADO: payload.tipo_empleado || 'S',
    
    ESCOLARIDAD: (payload.escolaridad || '').toUpperCase(),
    NIVEL_ESTUDIOS: (payload.escolaridad || '').toUpperCase(),
  };
}