// backend/routes/contratos.js (ESM)
import express from "express";
import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { fileURLToPath } from "url";

const router = express.Router();

// __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directorio de plantillas
const TPL_DIR = path.resolve(__dirname, "../templates");

// ========== CONVERSIÓN NÚMERO A LETRAS ==========
function numeroALetras(numero) {
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
}

// ========== MAPA DE ESTADOS ==========
const MAP_ESTADOS = {
  'AS': 'AGUASCALIENTES',
  'BC': 'BAJA CALIFORNIA',
  'BS': 'BAJA CALIFORNIA SUR',
  'CC': 'CAMPECHE',
  'CL': 'COAHUILA',
  'CM': 'COLIMA',
  'CS': 'CHIAPAS',
  'CH': 'CHIHUAHUA',
  'DF': 'CIUDAD DE MÉXICO',
  'DG': 'DURANGO',
  'GT': 'GUANAJUATO',
  'GR': 'GUERRERO',
  'HG': 'HIDALGO',
  'JC': 'JALISCO',
  'MC': 'ESTADO DE MÉXICO',
  'MN': 'MICHOACÁN',
  'MS': 'MORELOS',
  'NT': 'NAYARIT',
  'NL': 'NUEVO LEÓN',
  'OC': 'OAXACA',
  'PL': 'PUEBLA',
  'QT': 'QUERÉTARO',
  'QR': 'QUINTANA ROO',
  'SP': 'SAN LUIS POTOSÍ',
  'SL': 'SINALOA',
  'SR': 'SONORA',
  'TC': 'TABASCO',
  'TS': 'TAMAULIPAS',
  'TL': 'TLAXCALA',
  'VZ': 'VERACRUZ',
  'YN': 'YUCATÁN',
  'ZS': 'ZACATECAS',
  'NE': 'NACIDO EN EL EXTRANJERO'
};

function obtenerNombreEstado(codigo) {
  if (!codigo) return 'TLAXCALA';
  const cod = String(codigo).toUpperCase().trim();
  if (cod.length > 2) return cod;
  return MAP_ESTADOS[cod] || cod;
}

// ========== HELPERS ==========
function formatearNumTrabajador(num) {
  if (!num) return '00000';
  const clean = String(num).replace(/\D/g, '');
  return clean.padStart(6, '0');
}

function generarCodigoContrato(tipo, numTrabajador) {
  const prefix = tipo === 'E' ? 'E' : 'S';
  const num = formatearNumTrabajador(numTrabajador);
  return `${prefix}-${num}`;
}

function formatearFecha(fecha) {
  if (!fecha) return "";
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return "";
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

function resolverPlantillaDesdeTipo(tipo) {
  const norm = String(tipo || "").trim().toLowerCase().replace(/-/g, "_");

  const MAP = {
    empleado_determinado: "contrato_empleado_determinado.docx",
    contrato_empleado_determinado: "contrato_empleado_determinado.docx",
    empleado_indeterminado: "contrato_empleado_indeterminado.docx",
    contrato_empleado_indeterminado: "contrato_empleado_indeterminado.docx",
    sindicalizado_determinado: "sindicalizado_determinado.docx",
    contrato_sindicalizado_determinado: "sindicalizado_determinado.docx",
    sindicalizado_indeterminado: "sindicalizado_indeterminado.docx",
    contrato_sindicalizado_indeterminado: "sindicalizado_indeterminado.docx",
  };

  if (MAP[norm]) return MAP[norm];

  const candidate = `${norm}.docx`;
  const full = path.join(TPL_DIR, candidate);
  if (fs.existsSync(full)) return candidate;

  return null;
}

// ========== RUTAS ==========
router.get("/templates", (_req, res) => {
  try {
    const files = fs.readdirSync(TPL_DIR).filter((f) => f.toLowerCase().endsWith(".docx"));
    res.json({
      template_dir: TPL_DIR,
      files,
    });
  } catch (e) {
    res.status(500).json({ error: "Error listando templates", details: e.message });
  }
});

router.get("/:tipo", (req, res) => {
  return res.status(405).json({
    error: "Usa POST para generar contrato",
    ejemplo: "POST /api/contratos/empleado_indeterminado",
  });
});

// ========== GENERACIÓN DE CONTRATOS ==========
router.post("/:tipo", (req, res) => {
  try {
    const { tipo } = req.params;
    const payload = req.body || {};

    console.log(`[contratos] Generando tipo: ${tipo}`);
    console.log('[contratos] Payload recibido:', payload);

    const tplName = resolverPlantillaDesdeTipo(tipo);
    if (!tplName) {
      return res.status(404).json({
        error: `Tipo de contrato no soportado: '${tipo}'`,
        ejemplos_validos: ["empleado_determinado", "empleado_indeterminado", "sindicalizado_determinado", "sindicalizado_indeterminado"],
      });
    }

    const templatePath = path.join(TPL_DIR, tplName);
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({
        error: `Plantilla no encontrada: ${tplName}`,
        ruta: templatePath,
      });
    }

    const content = fs.readFileSync(templatePath, "binary");
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    const now = new Date();
    const numeroEmpleado = payload.num_trabajador?.replace(/\D/g, "") || payload.id || "00001";
    const codigoContrato = generarCodigoContrato(tipo, numeroEmpleado);

    // 🔥 HELPER: Normalizar estado civil con TODOS los aliases
    const normalizarEstadoCivil = (data) => {
      // Buscar en múltiples campos posibles
      const ec = 
        data.estado_civil || 
        data.EstadoCivil || 
        data.estatus_civil || 
        data.estatusCivil || 
        data.estado_Civil || 
        '';
      
      console.log('🔍 [contratos] Estado civil detectado:', ec);
      
      if (!ec) return '';
      
      const limpio = String(ec).toUpperCase().trim().replace(/\s+/g, '');
      
      // Mapeo robusto
      const mapeo = {
        'SOLTERO': 'SOLTERO',
        'SOLTERA': 'SOLTERA',
        'SOLTEROA': payload.sexo === 'F' ? 'SOLTERA' : 'SOLTERO',
        'CASADO': 'CASADO',
        'CASADA': 'CASADA',
        'CASADOA': payload.sexo === 'F' ? 'CASADA' : 'CASADO',
        'UNIONLIBRE': 'UNIÓN LIBRE',
        'UNION LIBRE': 'UNIÓN LIBRE',
        'UNIONL': 'UNIÓN LIBRE',
        'DIVORCIADO': 'DIVORCIADO',
        'DIVORCIADA': 'DIVORCIADA',
        'DIVORCIADOA': payload.sexo === 'F' ? 'DIVORCIADA' : 'DIVORCIADO',
        'VIUDO': 'VIUDO',
        'VIUDA': 'VIUDA',
        'VIUDOA': payload.sexo === 'F' ? 'VIUDA' : 'VIUDO',
      };
      
      const resultado = mapeo[limpio] || ec.toUpperCase();
      console.log('✅ [contratos] Estado civil normalizado:', resultado);
      
      return resultado;
    };

    const templateData = {
      // ========== DATOS PERSONALES ==========
      NOMBRE_COMPLETO: (payload.nombre_completo || '').toUpperCase(),
      NOMBRE: (payload.nombre || '').toUpperCase(),
      APELLIDOS: (payload.apellidos || '').toUpperCase(),
      APELLIDO_PATERNO: (payload.apellidos?.split(' ')[0] || '').toUpperCase(),
      APELLIDO_MATERNO: (payload.apellidos?.split(' ')[1] || '').toUpperCase(),

      // ========== EDAD Y SEXO ==========
      EDAD: payload.edad || calcularEdad(payload.fecha_nacimiento) || '',
      SEXO: payload.sexo === 'M' ? 'MASCULINO' : payload.sexo === 'F' ? 'FEMENINO' : (payload.sexo || '').toUpperCase(),

      // ========== ESTADO CIVIL - TODOS LOS ALIASES ==========
      ESTADO_CIVIL: normalizarEstadoCivil(payload),
      ESTATUS_CIVIL: normalizarEstadoCivil(payload), // ✅ ALIAS
      ESTADOCIVIL: normalizarEstadoCivil(payload),   // ✅ Sin guión bajo
      ESTADO_CIVIL_COMPLETO: normalizarEstadoCivil(payload), // ✅ Variante
      CIVIL: normalizarEstadoCivil(payload),         // ✅ Corto

      // ========== DOCUMENTOS ==========
      RFC: (payload.rfc || '').toUpperCase(),
      CURP: (payload.curp || '').toUpperCase(),
      NSS: payload.nss || '',
      NO_IMSS: payload.nss || '',
      CREDENCIAL: payload.credencial || payload.num_credencial || '',
      NUM_CREDENCIAL: payload.credencial || payload.num_credencial || '',
      NUMERO_CREDENCIAL: payload.credencial || payload.num_credencial || '',

  // ========== DOMICILIO CON ESTADO ABREVIADO (para contratos/credencial) ==========
  DOMICILIO: `${payload.calle_numero || 'SIN NUMERO'}, ${payload.colonia || ''}, ${payload.municipio || ''}, ${
        payload.estado || 'TL'
      }, C.P. ${payload.codigo_postal || ''}`
        .replace(/^, |, $|, , /g, '')
        .replace(/,\s*,/g, ',')
        .trim()
        .toUpperCase(),

      CALLE_NUMERO: (payload.calle_numero || '').toUpperCase(),
      COLONIA: (payload.colonia || '').toUpperCase(),
      MUNICIPIO: (payload.municipio || '').toUpperCase(),
      
      NOMBRE_CALLE: (payload.nombreCalle || '').toUpperCase(),
      CALLE: (payload.calle || '').toUpperCase(),
      NOMBRE_DE_CALLE:(payload.nombre_de_calle || '').toUpperCase(),
      
      NUMERO_CALLE: (payload.numero_calle || '').toUpperCase(),
      NUM_CALLE: (payload.num_calle || '').toUpperCase(),
      NO_CALLE: (payload.no_calle || '').toUpperCase(),
      NUMERO: (payload.numero || '').toUpperCase(),
      
      ESTADO: (payload.estado || 'TL').toUpperCase(),
      ESTADO_ABREVIADO: (payload.estado || 'TL').toUpperCase(),
      ESTADO_COMPLETO: obtenerNombreEstado(payload.estado),
      ESTADO_NOMBRE: obtenerNombreEstado(payload.estado),
      
      CP: payload.codigo_postal || '',
      CODIGO_POSTAL: payload.codigo_postal || '',
      C_P: payload.codigo_postal || '',

      // ========== CONTACTO ==========
      TELEFONO: payload.telefono || '',
      CORREO: payload.correo || '',
      CORREO_ELECTRONICO: payload.correo || '',

      // ========== EMPLEO ==========
      NUM_TRABAJADOR: formatearNumTrabajador(numeroEmpleado),
      NUMERO_TRABAJADOR: formatearNumTrabajador(numeroEmpleado),
      NO_TRABAJADOR: formatearNumTrabajador(numeroEmpleado),
      PUESTO: (payload.puesto || '').toUpperCase(),
      AREA: (payload.area || '').toUpperCase(),
      DEPARTAMENTO: (payload.area || '').toUpperCase(),

      // ========== SALARIO ==========
      SALARIO: payload.salario || '0',
      SALARIO_DIARIO: payload.salario || '0',
      SALARIO_LETRAS: numeroALetras(payload.salario),
      SALARIO_LETRA: numeroALetras(payload.salario),
      MONTO_SALARIO: payload.salario || '0',

      // ========== TIPO NÓMINA ==========
      TIPO_NOMINA: (
        payload.tipo_nomina === 'Quincenal'
          ? 'QUINCE Y ULTIMO DE CADA MES'
          : payload.tipo_nomina === 'Semanal'
          ? 'SÁBADO DE CADA SEMANA'
          : payload.tipo_nomina || ''
      ).toUpperCase(),

      // ========== FECHAS ==========
      FECHA_INGRESO: formatearFecha(payload.fecha_ingreso),
      FECHA_NACIMIENTO: formatearFecha(payload.fecha_nacimiento),
      FECHA_ACTUAL: formatearFecha(now),
      FECHA_COMPLETA_TEXTO: `${numeroALetras(now.getDate()).toUpperCase()} DE ${
        ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'][now.getMonth()]
      } DEL AÑO ${numeroALetras(now.getFullYear()).toUpperCase()}`,

      DIA_ACTUAL: now.getDate(),
      DIA_ACTUAL_TEXTO: numeroALetras(now.getDate()).toUpperCase(),
      MES_ACTUAL: ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'][now.getMonth()],
      MES_ACTUAL_NUMERO: now.getMonth() + 1,
      AÑO_ACTUAL: now.getFullYear(),
      AÑO_ACTUAL_TEXTO: numeroALetras(now.getFullYear()).toUpperCase(),

      // ========== BENEFICIARIO ==========
      NOM_BENEF: (payload.benef_nombre || '').toUpperCase(),
      BENEF_NOMBRE: (payload.benef_nombre || '').toUpperCase(),
      BENEFICIARIO_NOMBRE: (payload.benef_nombre || '').toUpperCase(),
      NOMBRE_BENEFICIARIO: (payload.benef_nombre || '').toUpperCase(),
      EMERGENCIA_NOMBRE: (payload.benef_nombre || '').toUpperCase(),
      
      BENEF_TELEFONO: payload.benef_telefono || '',
      TELEFONO_BENEFICIARIO: payload.benef_telefono || '',
      TEL_BENEFICIARIO: payload.benef_telefono || '',
      EMERGENCIA_TELEFONO: payload.benef_telefono || '',
      
      BENEF_PARENTESCO: (payload.benef_parentesco || payload.parentesco || '').toUpperCase(),
      PARENTESCO: (payload.benef_parentesco || payload.parentesco || '').toUpperCase(),
      PARENTESCO_BENEFICIARIO: (payload.benef_parentesco || payload.parentesco || '').toUpperCase(),
      EMERGENCIA_PARENTESCO: (payload.benef_parentesco || payload.parentesco || '').toUpperCase(),

      // ========== JEFE ==========
      JEFE: (payload.jefe || '').toUpperCase(),
      JEFE_INMEDIATO: (payload.jefe || '').toUpperCase(),
      SUPERVISOR: (payload.jefe || '').toUpperCase(),

      // ========== EMPRESA ==========
      EMPRESA: 'ALPHA CERAMICA, S.A.P.I DE C.V.',
      EMPRESA_NOMBRE: 'ALPHA CERAMICA, S.A.P.I DE C.V.',
      EMPRESA_DIRECCION: 'Km. 14.8 Carretera Vía Corta, Puebla-Santa Ana Chiautempan',
      EMPRESA_REPRESENTANTE: 'C.P. MARTÍNEZ BENITO CRISTOBAL GERARDO',
      EMPRESA_PUESTO: 'Representante Legal',

      // ========== EXTRAS ==========
      CODIGO_CONTRATO: codigoContrato,
      TIPO_CONTRATO: String(tipo || '').toUpperCase(),
      PLANTILLA_USADA: tplName,
    };

    console.log('📋 [contratos] Template data generado con estado civil:', templateData.ESTADO_CIVIL);

    doc.setData(templateData);
    doc.render();

    const buf = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });

    const nombreArchivo = `Contrato_${(payload.nombre || "Empleado").replace(/\s+/g, "_")}_${String(tipo).replace(/\s+/g, "_")}.docx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename=${nombreArchivo}`);
    
    console.log(`✅ Contrato ${tipo} generado: ${nombreArchivo}`);
    return res.send(buf);

  } catch (err) {
    console.error("[contratos] ERROR:", err);
    return res.status(500).json({
      error: "Error generando contrato",
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

export default router;