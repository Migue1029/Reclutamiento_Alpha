import express from 'express';
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

const router = express.Router();

// Al inicio de documentos.js (después de los imports)
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

function obtenerNombreEstado(codigo) {
  if (!codigo) return 'TLAXCALA';
  const cod = String(codigo).toUpperCase().trim();
  if (cod.length > 2) return cod;
  return MAP_ESTADOS[cod] || cod;
}

// 🔥 HELPER PARA NORMALIZAR ESTADO CIVIL
function normalizarEstadoCivilGlobal(payload) {
  const ec = 
    payload.estado_civil || 
    payload.EstadoCivil || 
    payload.estatus_civil || 
    payload.estatusCivil || 
    '';
  
  console.log('🔍 [Estado Civil] Valor recibido:', ec);
  
  if (!ec) return '';
  
  const limpio = String(ec).toUpperCase().trim().replace(/\s+/g, '');
  
  const mapeo = {
    'SOLTERO': 'SOLTERO',
    'SOLTERA': 'SOLTERA',
    'SOLTEROA': payload.sexo === 'F' ? 'SOLTERA' : 'SOLTERO',
    'CASADO': 'CASADO',
    'CASADA': 'CASADA',
    'CASADOA': payload.sexo === 'F' ? 'CASADA' : 'CASADO',
    'UNIONLIBRE': 'UNIÓN LIBRE',
    'UNIONL': 'UNIÓN LIBRE',
    'DIVORCIADO': 'DIVORCIADO',
    'DIVORCIADA': 'DIVORCIADA',
    'VIUDO': 'VIUDO',
    'VIUDA': 'VIUDA',
  };
  
  const resultado = mapeo[limpio] || ec.toUpperCase();
  console.log('✅ [Estado Civil] Normalizado:', resultado);
  return resultado;
}

// __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directorio de plantillas
const TPL_DIR = path.resolve(__dirname, '../templates');

// Helper: formatear número de trabajador con ceros
function formatearNumTrabajador(num) {
  if (!num) return '00000';
  const clean = String(num).replace(/\D/g, '');
  return clean.padStart(6, '0');
}

// Helper: generar código de etiqueta
function generarCodigoEtiqueta(tipo, numTrabajador) {
  const prefix = tipo === 'E' ? 'E' : 'S';
  const num = formatearNumTrabajador(numTrabajador);
  return `${prefix}-${num}`;
}

// Helper para calcular fecha de vencimiento (1 año después)
function calcularFechaVencimiento() {
  const hoy = new Date();
  const vencimiento = new Date(hoy.getFullYear() + 1, hoy.getMonth(), hoy.getDate());
  return vencimiento.toISOString().split('T')[0];
}

// Helper para separar calle y número
function separarCalleNumero(calleNumero) {
  if (!calleNumero) {
    return { nombreCalle: '', numeroCalle: 'S/N' };
  }

  const texto = String(calleNumero).trim().toUpperCase();
  
  console.log('🔍 [separarCalleNumero] Input:', texto);

  // ========== 1. DETECTAR "SIN NÚMERO" (prioridad máxima) ==========
  const sinNumeroPatterns = [
    /^(.+?)\s+SIN\s+N[UÚ]MERO\s*$/i,
    /^(.+?)\s+SIN\s+NUM\s*$/i,
    /^(.+?)\s+SIN\s+N[OÚ]\.?\s*$/i,
    /^(.+?)\s+S\/N\s*$/i,
    /^(.+?)\s+SN\s*$/i,
  ];

  for (const patron of sinNumeroPatterns) {
    const match = texto.match(patron);
    if (match) {
      const resultado = {
        nombreCalle: match[1].trim(),
        numeroCalle: 'S/N'
      };
      console.log('✅ [separarCalleNumero] SIN NÚMERO:', resultado);
      return resultado;
    }
  }

  // ========== 2. DETECTAR PALABRA "NÚMERO" EXPLÍCITA ==========
  // Patrones que incluyen la palabra "número" o sus variantes
  const patronesConPalabraNumero = [
    // "Ignacio Zaragoza numero 22"
    /^(.+?)\s+N[UÚ]MERO\s+(.+)$/i,
    
    // "Ignacio Zaragoza Número 22"
    /^(.+?)\s+N[ÚU]MERO\s+(.+)$/i,
    
    // "Ignacio Zaragoza NUM 22"
    /^(.+?)\s+NUM\.?\s+(.+)$/i,
    
    // "Ignacio Zaragoza No. 22"
    /^(.+?)\s+NO\.?\s+(.+)$/i,
    
    // "Ignacio Zaragoza Nº 22"
    /^(.+?)\s+N[ºÂº]\.?\s+(.+)$/i,
    
    // "Ignacio Zaragoza # 22"
    /^(.+?)\s+#\s*(.+)$/,
  ];

  for (const patron of patronesConPalabraNumero) {
    const match = texto.match(patron);
    if (match) {
      const resultado = {
        nombreCalle: match[1].trim(),
        numeroCalle: match[2].trim()
      };
      console.log('✅ [separarCalleNumero] CON PALABRA "NÚMERO":', resultado);
      return resultado;
    }
  }

  // ========== 3. DETECTAR NÚMERO AL FINAL (sin palabra "número") ==========
  // Patrones para números directos al final
  const patronesNumeroDirecto = [
    // "Ignacio Zaragoza 22" (número simple al final)
    /^(.+?)\s+(\d+[A-Z]?)$/,
    
    // "Ignacio Zaragoza 123-A" (número con guión y letra)
    /^(.+?)\s+(\d+-[A-Z0-9]+)$/,
    
    // "Ignacio Zaragoza, 22" (con coma)
    /^(.+?),\s*(\d+.*)$/,
  ];

  for (const patron of patronesNumeroDirecto) {
    const match = texto.match(patron);
    if (match) {
      // 🔥 VALIDACIÓN EXTRA: Evitar confundir números de fechas con números de domicilio
      const posibleCalle = match[1].trim();
      const posibleNumero = match[2].trim();
      
      // Si el "número" tiene más de 6 dígitos, probablemente no sea un número de casa
      if (!/^\d{7,}$/.test(posibleNumero)) {
        // Verificar que no sea parte de un nombre de calle como "5 de Mayo"
        const palabrasReservadas = ['DE', 'DEL', 'LA', 'LAS', 'LOS', 'EL'];
        const ultimaPalabra = posibleCalle.split(/\s+/).pop();
        
        if (!palabrasReservadas.includes(ultimaPalabra)) {
          const resultado = {
            nombreCalle: posibleCalle,
            numeroCalle: posibleNumero
          };
          console.log('✅ [separarCalleNumero] NÚMERO DIRECTO:', resultado);
          return resultado;
        }
      }
    }
  }

  // ========== 4. ÚLTIMO RECURSO: Analizar último token ==========
  const tokens = texto.split(/\s+/);
  const ultimoToken = tokens[tokens.length - 1];
  
  // Si el último token parece un número (solo dígitos o dígitos+letra)
  if (/^(\d+[A-Z]?|S\/N)$/i.test(ultimoToken)) {
    const resultado = {
      nombreCalle: tokens.slice(0, -1).join(' ').trim(),
      numeroCalle: ultimoToken
    };
    console.log('✅ [separarCalleNumero] ÚLTIMO TOKEN:', resultado);
    return resultado;
  }

  // ========== 5. FALLBACK: Todo es calle, número S/N ==========
  const resultado = {
    nombreCalle: texto,
    numeroCalle: 'S/N'
  };
  console.log('⚠️ [separarCalleNumero] FALLBACK (todo es calle):', resultado);
  return resultado;
}

function calcularEdadFallback(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  
  if (isNaN(nacimiento.getTime())) return null;
  
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mes = hoy.getMonth() - nacimiento.getMonth();
  
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  
  return edad >= 0 ? edad : null;
}

// ========== ETIQUETA ==========
router.post('/etiqueta', (req, res) => {
  try {
    const payload = req.body || {};
    const { tipo_empleado, num_trabajador, nombre_completo } = payload;

    console.log('[Etiqueta] Request:', { tipo_empleado, num_trabajador, nombre_completo });

    if (!tipo_empleado || !['E', 'S'].includes(tipo_empleado)) {
      return res.status(400).json({ 
        error: 'tipo_empleado es requerido y debe ser "E" (Empleado) o "S" (Sindicalizado)' 
      });
    }

    if (!num_trabajador || !nombre_completo) {
      return res.status(400).json({ 
        error: 'num_trabajador y nombre_completo son requeridos' 
      });
    }

    const templateName = tipo_empleado === 'E' 
      ? 'etiqueta_empleado.docx' 
      : 'etiqueta_sindicalizado.docx';
    
    const templatePath = path.join(TPL_DIR, templateName);

    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ 
        error: `Plantilla no encontrada: ${templateName}`,
        ruta: templatePath,
        sugerencia: 'Coloca las plantillas en backend/templates/'
      });
    }

    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { 
      paragraphLoop: true, 
      linebreaks: true 
    });

    const codigo = generarCodigoEtiqueta(tipo_empleado, num_trabajador);

    const templateData = {
      CODIGO: codigo,
      TIPO: tipo_empleado === 'E' ? 'EMPLEADO' : 'SINDICALIZADO',
      TIPO_ABREV: tipo_empleado,
      NUM_TRABAJADOR: formatearNumTrabajador(num_trabajador),
      NOMBRE_COMPLETO: (nombre_completo || '').toUpperCase(),
      NOMBRE: (payload.nombre || '').toUpperCase(),
      APELLIDOS: (payload.apellidos || '').toUpperCase(),
      AREA: (payload.area || '').toUpperCase(),
      PUESTO: (payload.puesto || '').toUpperCase(),
      JEFE: (payload.jefe || '').toUpperCase(),
      TELEFONO: payload.telefono || '',
      CORREO: payload.correo || '',
      CURP: payload.curp || '',
      RFC: payload.rfc || '',
      NSS: payload.nss || '',
      CREDENCIAL: payload.credencial || payload.num_credencial || '',
      FECHA_INGRESO: payload.fecha_ingreso || '',
      EMPRESA: 'ALPHA CERAMICA, S.A.P.I DE C.V.',
      EMPRESA_DIRECCION: 'Km. 14.8 Carretera Vía Corta, Puebla-Santa Ana Chiautempan',
      CP: payload.codigo_postal || '',
      NOM_BENEF: (payload.benef_nombre || '').toUpperCase(),
      BENEF_TELEFONO: payload.benef_telefono || '',
      ESTADO: obtenerNombreEstado(payload.estado),
      ESTADO_COMPLETO: obtenerNombreEstado(payload.estado),
    };

    try {
      doc.setData(templateData);
      doc.render();
    } catch (renderError) {
      console.error('[Etiqueta] Error al renderizar:', renderError);
      return res.status(500).json({ 
        error: 'Error al llenar la plantilla',
        details: renderError.message,
        plantilla: templateName
      });
    }

    const buf = doc.getZip().generate({ 
      type: 'nodebuffer', 
      compression: 'DEFLATE' 
    });

    const nombreArchivo = `Etiqueta_${codigo}_${(nombre_completo || 'Empleado').replace(/\s+/g, '_')}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    
    console.log('[Etiqueta] ✅ Generada exitosamente:', nombreArchivo);
    return res.send(buf);

  } catch (err) {
    console.error('[Etiqueta] Error general:', err);
    return res.status(500).json({ 
      error: 'Error generando etiqueta', 
      details: err.message 
    });
  }
});

// ========== CREDENCIAL ==========
router.post('/credencial', (req, res) => {
  try {
    const payload = req.body || {};
    const { num_trabajador, nombre_completo } = payload;

    console.log('[Credencial] Payload recibido:', payload);

    if (!num_trabajador || !nombre_completo) {
      return res.status(400).json({ 
        error: 'num_trabajador y nombre_completo son requeridos' 
      });
    }

    const templatePath = path.join(TPL_DIR, 'credencial.docx');

    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ 
        error: 'Plantilla de credencial no encontrada',
        ruta: templatePath,
      });
    }

    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { 
      paragraphLoop: true, 
      linebreaks: true 
    });

    const numFormateado = formatearNumTrabajador(num_trabajador);

    const domicilioCompleto = `${payload.calle_numero || 'SIN NUMERO'}, ${payload.colonia || ''}, ${payload.municipio || ''}, ${
      payload.estado || 'TL'
    }, C.P. ${payload.codigo_postal || ''}`
      .replace(/^, |, $|, , /g, '')
      .replace(/,\s*,/g, ',')
      .trim()
      .toUpperCase();

    const templateData = {
      NUM_TRABAJADOR: numFormateado,
      NO_CONTROL: numFormateado,
      NUM_TRABAJADOR_COMPLETO: `No. ${numFormateado}`,
      
      NOMBRE_COMPLETO: (nombre_completo || '').toUpperCase(),
      NOMBRE: (payload.nombre || '').toUpperCase(),
      APELLIDOS: (payload.apellidos || '').toUpperCase(),
      EDAD: payload.edad || calcularEdadFallback(payload.fecha_nacimiento) || '',
      
      // ✅ ESTADO CIVIL CON TODOS LOS ALIASES
      ESTADO_CIVIL: normalizarEstadoCivilGlobal(payload),
      ESTATUS_CIVIL: normalizarEstadoCivilGlobal(payload),
      ESTADOCIVIL: normalizarEstadoCivilGlobal(payload),
      CIVIL: normalizarEstadoCivilGlobal(payload),
      
      DOMICILIO: domicilioCompleto,
      
      CALLE_NUMERO: (payload.calle_numero || '').toUpperCase(),
      COLONIA: (payload.colonia || '').toUpperCase(),
      MUNICIPIO: (payload.municipio || '').toUpperCase(),
      ESTADO: (payload.estado || 'TL').toUpperCase(),
      ESTADO_COMPLETO: obtenerNombreEstado(payload.estado),
      CODIGO_POSTAL: payload.codigo_postal || '',
      CP: payload.codigo_postal || '',
      
      FECHA_INGRESO: payload.fecha_ingreso 
  ? (() => {
      const f = new Date(payload.fecha_ingreso);
      const dia = f.getDate();
      const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                     'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      const mes = meses[f.getMonth()];
      const anio = f.getFullYear();
      return `${dia}/${mes}/${anio}`;
    })()
  : '',
      FECHA_EMISION: new Date().toLocaleDateString('es-MX'),
      FECHA_VENCIMIENTO: calcularFechaVencimiento(),
      
      NSS: payload.nss || '',
      NO_IMSS: payload.nss || '',
      CURP: payload.curp || '',
      RFC: payload.rfc || '',
      CREDENCIAL_INE: payload.credencial || payload.num_credencial || '',
      TELEFONO: payload.telefono || '',
      CORREO: payload.correo || '',
      
      AREA: (payload.area || '').toUpperCase(),
      DEPARTAMENTO: (payload.area || '').toUpperCase(),
      PUESTO: (payload.puesto || '').toUpperCase(),
      JEFE: (payload.jefe || '').toUpperCase(),
      
      EMERGENCIA_NOMBRE: (payload.benef_nombre || '').toUpperCase(),
      NOM_BENEF: (payload.benef_nombre || '').toUpperCase(),
      BENEF_NOMBRE: (payload.benef_nombre || '').toUpperCase(),
      
      EMERGENCIA_TELEFONO: payload.benef_telefono || '',
      BENEF_TELEFONO: payload.benef_telefono || '',
      
      EMERGENCIA_PARENTESCO: (payload.benef_parentesco || payload.parentesco || '').toUpperCase(),
      PARENTESCO: (payload.benef_parentesco || payload.parentesco || '').toUpperCase(),
      
      EMPRESA: 'ALPHA CERAMICA, S.A.P.I DE C.V.',
      EMPRESA_DIRECCION: 'KM. 14.8 Vía Corta Pue.-Sta. Ana S/N',
      EMPRESA_CIUDAD: 'San Cosme Mazatecochco, Tlaxcala',
      EMPRESA_CP: 'C.P. 90870',
      EMPRESA_TELEFONO: 'Tel:(01-222) 263 02 30 y 31',
    };

    console.log('✅ [Credencial] Estado civil:', templateData.ESTADO_CIVIL);

    try {
      doc.setData(templateData);
      doc.render();
    } catch (renderError) {
      console.error('[Credencial] Error al renderizar:', renderError);
      return res.status(500).json({ 
        error: 'Error al llenar la plantilla',
        details: renderError.message
      });
    }

    const buf = doc.getZip().generate({ 
      type: 'nodebuffer', 
      compression: 'DEFLATE' 
    });

    const nombreArchivo = `Credencial_${numFormateado}_${(nombre_completo || 'Empleado').replace(/\s+/g, '_')}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    
    console.log('[Credencial] ✅ Generada exitosamente:', nombreArchivo);
    return res.send(buf);

  } catch (err) {
    console.error('[Credencial] Error general:', err);
    return res.status(500).json({ 
      error: 'Error generando credencial', 
      details: err.message 
    });
  }
});

// ========== CHECK LIST EXCEL ==========
router.post('/checklist', async (req, res) => {
  try {
    const payload = req.body || {};
        console.log('🐛 [CheckList] Payload recibido:', payload);

    const { num_trabajador, nombre_completo } = payload;

    // 👀 LOG IMPORTANTE
    console.log('📥 [CheckList] Payload recibido:', payload);
    console.log('📥 [CheckList] payload.estado_civil:', payload.estado_civil);
    console.log('📥 [CheckList] Estado civil normalizado:',
      normalizarEstadoCivilGlobal(payload)
    );


    const templatePath = path.join(TPL_DIR, 'checklist.xlsx');

    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ 
        error: 'Plantilla de checklist no encontrada',
        ruta: templatePath,
      });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(500).json({
        error: 'No se pudo acceder a la primera hoja del Excel'
      });
    }

    const numFormateado = formatearNumTrabajador(num_trabajador);
    const { nombreCalle, numeroCalle } = separarCalleNumero(payload.calle_numero);

    const formatearFecha = (fecha) => {
      if (!fecha) return '';
      const f = new Date(fecha + 'T00:00:00');
      const day = String(f.getDate()).padStart(2, '0');
      const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
      const month = months[f.getMonth()];
      const year = String(f.getFullYear()).slice(-2);
      return `${day}-${month}-${year}`;
    };

    const formatearNSS = (nss) => {
      if (!nss) return '';
      const clean = nss.replace(/\D/g, '');
      if (clean.length === 11) {
        return `${clean.slice(0,2)} ${clean.slice(2,4)} ${clean.slice(4,8)} ${clean.slice(8,10)} ${clean.slice(10)}`;
      }
      return nss;
    };

    const replacements = {
      '{NUM_TRABAJADOR}': numFormateado,
      '{NOMBRE_COMPLETO}': (nombre_completo || '').toUpperCase(),
      '{NOMBRE}': (payload.nombre || '').toUpperCase(),
      '{APELLIDOS}': (payload.apellidos || '').toUpperCase(),
      '{AREA}': (payload.area || '').toUpperCase(),
      '{DEPARTAMENTO}': (payload.area || '').toUpperCase(),
      '{PUESTO}': (payload.puesto || '').toUpperCase(),
      '{FECHA_NACIMIENTO}': formatearFecha(payload.fecha_nacimiento),
      '{FECHA_INGRESO}': formatearFecha(payload.fecha_ingreso),
      '{EDAD}': payload.edad || calcularEdadFallback(payload.fecha_nacimiento) || '',
      '{ESCOLARIDAD}': (payload.escolaridad || '').toUpperCase(),
      '{CORREO}': payload.correo || '',
      
      '{CALLE_NUMERO}': (payload.calle_numero || '').toUpperCase(),
      '{NOMBRE_CALLE}': nombreCalle,
      '{CALLE}': nombreCalle,
      '{NOMBRE_DE_CALLE}': nombreCalle,
      '{NUMERO_CALLE}': numeroCalle,
      '{NUM_CALLE}': numeroCalle,
      '{NO_CALLE}': numeroCalle,
      '{NUMERO}': numeroCalle,
      
      '{COLONIA}': (payload.colonia || '').toUpperCase(),
      '{MUNICIPIO}': (payload.municipio || '').toUpperCase(),
      '{CIUDAD}': (payload.municipio || '').toUpperCase(),
      
      '{ESTADO}': obtenerNombreEstado(payload.estado),
      '{ESTADO_COMPLETO}': obtenerNombreEstado(payload.estado),
      '{ESTADO_NOMBRE}': obtenerNombreEstado(payload.estado),
      
      '{CODIGO_POSTAL}': payload.codigo_postal || '',
      '{CP}': payload.codigo_postal || '',
      '{C_P}': payload.codigo_postal || '',
      
      // ✅ ESTADO CIVIL CON TODOS LOS ALIASES
      '{ESTADO_CIVIL}': normalizarEstadoCivilGlobal(payload),
      '{ESTATUS_CIVIL}': normalizarEstadoCivilGlobal(payload),
      '{ESTADOCIVIL}': normalizarEstadoCivilGlobal(payload),
      '{CIVIL}': normalizarEstadoCivilGlobal(payload),
      
      '{EMERGENCIA_NOMBRE}': (payload.benef_nombre || '').toUpperCase(),
      '{NOM_BENEF}': (payload.benef_nombre || '').toUpperCase(),
      '{BENEF_NOMBRE}': (payload.benef_nombre || '').toUpperCase(),
      '{NOMBRE_BENEFICIARIO}': (payload.benef_nombre || '').toUpperCase(),
      
      '{PARENTESCO}': (payload.benef_parentesco || payload.parentesco || '').toUpperCase(),
      '{BENEF_PARENTESCO}': (payload.benef_parentesco || payload.parentesco || '').toUpperCase(),
      
      '{EMERGENCIA_TELEFONO}': payload.benef_telefono || '',
      '{BENEF_TELEFONO}': payload.benef_telefono || '',
      
      '{TELEFONO}': payload.telefono || '',
      '{RFC}': payload.rfc || '',
      '{CURP}': payload.curp || '',
      '{NSS}': formatearNSS(payload.nss),
      '{EDAD}': payload.edad || '',
    };

    console.log('📄 [CheckList] Reemplazando placeholders...');
    console.log('✅ [CheckList] Estado civil:', replacements['{ESTADO_CIVIL}']);

    let replacedCount = 0;

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        if (cell.value && typeof cell.value === 'string') {
          let newValue = cell.value;
          let changed = false;
          
          for (const [placeholder, value] of Object.entries(replacements)) {
            if (newValue.includes(placeholder)) {
              const escapedPlaceholder = placeholder.replace(/[{}]/g, '\\$&');
              newValue = newValue.replace(new RegExp(escapedPlaceholder, 'g'), value);
              changed = true;
            }
          }
          
          if (changed) {
            cell.value = newValue;
            replacedCount++;
          }
        }
      });
    });

    console.log(`✅ [CheckList] Celdas modificadas: ${replacedCount}`);

    const buffer = await workbook.xlsx.writeBuffer();
    const nombreArchivo = `CheckList_${numFormateado}_${nombre_completo.replace(/\s+/g, '_')}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    
    console.log('✅ [CheckList] Generado exitosamente');
    return res.send(buffer);

  } catch (err) {
    console.error('❌ [CheckList] ERROR:', err.message);
    return res.status(500).json({ 
      error: 'Error generando checklist', 
      details: err.message
    });
  }
});

// ========== EVALUACIÓN DE EMPLEADO ==========
router.post('/evaluacion', (req, res) => {
  try {
    const payload = req.body || {};
    const { num_trabajador, nombre_completo, num_contrato } = payload;

    console.log('[Evaluación] Request:', { num_trabajador, nombre_completo, num_contrato });

    if (!num_trabajador || !nombre_completo) {
      return res.status(400).json({ 
        error: 'num_trabajador y nombre_completo son requeridos' 
      });
    }

    const numeroEvaluacion = parseInt(num_contrato) || 1;
    if (numeroEvaluacion < 1 || numeroEvaluacion > 3) {
      return res.status(400).json({ 
        error: 'El número de evaluación debe ser 1, 2 o 3' 
      });
    }

    const templatePath = path.join(TPL_DIR, 'evaluacion_empleado.docx');

    console.log('[Evaluación] Buscando plantilla en:', templatePath);

    if (!fs.existsSync(templatePath)) {
      console.error('[Evaluación] ❌ Plantilla NO encontrada en:', templatePath);
      
      try {
        const files = fs.readdirSync(TPL_DIR);
        console.log('[Evaluación] Archivos disponibles en templates:', files);
      } catch (e) {
        console.error('[Evaluación] Error listando templates:', e);
      }
      
      return res.status(404).json({ 
        error: 'Plantilla de evaluación no encontrada',
        ruta_buscada: templatePath,
        sugerencia: 'Verifica que el archivo evaluacion_empleado.docx exista en backend/templates/'
      });
    }

    console.log('[Evaluación] ✅ Plantilla encontrada');

    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { 
      paragraphLoop: true, 
      linebreaks: true 
    });

    const numFormateado = formatearNumTrabajador(num_trabajador);
    const tipoEmpleado = payload.tipo_empleado || 'S';
    const codigoEmpleado = `${tipoEmpleado}-${numFormateado}`;

    const formatearFechaEspanol = (fecha) => {
      if (!fecha) return '';
      const f = new Date(fecha + 'T00:00:00');
      const dia = f.getDate();
      const meses = [
        'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
      ];
      const mes = meses[f.getMonth()];
      const año = f.getFullYear();
      return `${dia}-${mes}-${año}`;
    };

    const hoy = new Date();
    const fechaActual = formatearFechaEspanol(hoy.toISOString().split('T')[0]);

    let fechaVencimiento = '';
    if (payload.fecha_ingreso) {
      const fechaIng = new Date(payload.fecha_ingreso + 'T00:00:00');
      const diasAgregar = numeroEvaluacion * 30;
      fechaIng.setDate(fechaIng.getDate() + diasAgregar);
      fechaVencimiento = formatearFechaEspanol(fechaIng.toISOString().split('T')[0]);
    }

    const templateData = {
      FECHA_ACTUAL: fechaActual,
      FECHA_VENCIMIENTO: fechaVencimiento,
      FECHA_INGRESO: formatearFechaEspanol(payload.fecha_ingreso),

      JEFE_NOMBRE: (payload.jefe || 'ING. [NOMBRE DEL JEFE]').toUpperCase(),
      JEFE_NOMBRE_COMPLETO: (payload.jefe || 'ING. [NOMBRE DEL JEFE]').toUpperCase(),
      JEFE_INMEDIATO: (payload.jefe || 'ING. [NOMBRE DEL JEFE]').toUpperCase(),

      CODIGO_EMPLEADO: codigoEmpleado,
      NUM_TRABAJADOR: numFormateado,
      NUMERO_TRABAJADOR: numFormateado,
      NUMERO_EMPLEADO: codigoEmpleado,
      NOMBRE_COMPLETO: (nombre_completo || '').toUpperCase(),
      NOMBRE: (payload.nombre || '').toUpperCase(),
      APELLIDOS: (payload.apellidos || '').toUpperCase(),

      PUESTO: (payload.puesto || '').toUpperCase(),
      AREA: (payload.area || '').toUpperCase(),
      DEPARTAMENTO: (payload.area || '').toUpperCase(),

      NUM_CONTRATO: numeroEvaluacion,
      NUMERO_CONTRATO: numeroEvaluacion,
      NUM_EVALUACION: numeroEvaluacion,
      NUMERO_EVALUACION: numeroEvaluacion,
      EVALUACION: numeroEvaluacion,
      EVALUACION_NUMERO: numeroEvaluacion,

      EMPRESA: 'ALPHA CERAMICA, S.A.P.I DE C.V.',
      EMPRESA_NOMBRE: 'ALPHA CERAMICA, S.A.P.I DE C.V.',
      REPRESENTANTE_LEGAL: 'C.P. MARTÍNEZ BENITO CRISTOBAL GERARDO',
    };

    console.log('[Evaluación] 📋 Datos preparados:', {
      plantilla: 'evaluacion_empleado.docx',
      CODIGO_EMPLEADO: templateData.CODIGO_EMPLEADO,
      NOMBRE_COMPLETO: templateData.NOMBRE_COMPLETO,
      NUM_EVALUACION: templateData.NUM_EVALUACION,
      FECHA_VENCIMIENTO: templateData.FECHA_VENCIMIENTO,
      DIAS_AGREGADOS: numeroEvaluacion * 30
    });

    try {
      doc.setData(templateData);
      doc.render();
    } catch (renderError) {
      console.error('[Evaluación] ❌ Error al renderizar:', renderError);
      return res.status(500).json({ 
        error: 'Error al llenar la plantilla',
        details: renderError.message,
        placeholder_faltante: renderError.properties?.id || 'Desconocido'
      });
    }

    const buf = doc.getZip().generate({ 
      type: 'nodebuffer', 
      compression: 'DEFLATE' 
    });

    const nombreArchivo = `Evaluacion_${numeroEvaluacion}_${codigoEmpleado}_${(nombre_completo || 'Empleado').replace(/\s+/g, '_')}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    
    console.log('[Evaluación] ✅ Generada exitosamente:', nombreArchivo);
    return res.send(buf);

  } catch (err) {
    console.error('[Evaluación] ❌ Error general:', err);
    return res.status(500).json({ 
      error: 'Error generando evaluación', 
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// ========== LISTAR TEMPLATES ==========
router.get('/templates', (req, res) => {
  try {
    const files = fs.readdirSync(TPL_DIR).filter(f => f.endsWith('.docx') || f.endsWith('.xlsx'));
    res.json({
      template_dir: TPL_DIR,
      templates: files,
      documentos: {
        credencial: files.includes('credencial.docx') ? '✅' : '❌',
        checklist: files.includes('checklist.xlsx') ? '✅' : '❌',
        etiqueta_empleado: files.includes('etiqueta_empleado.docx') ? '✅' : '❌',
        etiqueta_sindicalizado: files.includes('etiqueta_sindicalizado.docx') ? '✅' : '❌'
      }
    });
  } catch (e) {
    res.status(500).json({ 
      error: 'Error listando templates', 
      details: e.message 
    });
  }
});

export default router;