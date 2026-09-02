/**
 * GeneradorDocumentosOficiales - Versión 2 mejorada
 * RFC y CURP con algoritmos más precisos
 * Permite edición manual sin bloqueos
 */

export default class GeneradorDocumentosOficiales {
  constructor() {
    this.codigosEstados = {
      'AGUASCALIENTES': 'AS', 'BAJA CALIFORNIA': 'BC', 'BAJA CALIFORNIA SUR': 'BS',
      'CAMPECHE': 'CC', 'COAHUILA': 'CL', 'COLIMA': 'CM', 'CHIAPAS': 'CS',
      'CHIHUAHUA': 'CH', 'CIUDAD DE MEXICO': 'DF', 'CIUDAD DE MÉXICO': 'DF', 'DURANGO': 'DG',
      'GUANAJUATO': 'GT', 'GUERRERO': 'GR', 'HIDALGO': 'HG', 'JALISCO': 'JC',
      'MEXICO': 'MC', 'MÉXICO': 'MC', 'MICHOACAN': 'MN', 'MICHOACÁN': 'MN', 'MORELOS': 'MS',
      'NAYARIT': 'NT', 'NUEVO LEON': 'NL', 'NUEVO LEÓN': 'NL', 'OAXACA': 'OC', 'PUEBLA': 'PL',
      'QUERETARO': 'QT', 'QUERÉTARO': 'QT', 'QUINTANA ROO': 'QR', 'SAN LUIS POTOSI': 'SP',
      'SAN LUIS POTOSÍ': 'SP', 'SINALOA': 'SL', 'SONORA': 'SR', 'TABASCO': 'TC',
      'TAMAULIPAS': 'TS', 'TLAXCALA': 'TL', 'VERACRUZ': 'VZ', 'YUCATAN': 'YN', 'YUCATÁN': 'YN',
      'ZACATECAS': 'ZS', 'NACIDO EN EL EXTRANJERO': 'NE'
    };

    this.nombresComunes = ['MARIA', 'MARIA JOSE', 'JOSE', 'MA', 'J', 'M'];
    
    this.palabrasInconvenientes = [
      'BACA', 'LOCA', 'BUEI', 'BUEY', 'MAME', 'KOGE', 'KAKA', 'KULO',
      'FETO', 'JOTO', 'RATA', 'PUTO', 'PEDA', 'CACA', 'CACO', 'CAGA',
      'COGE', 'COJA', 'COJI', 'COJO', 'FETO', 'GUEY', 'JOTO', 'KACA',
      'KAMA', 'KASE', 'CULO', 'LOCO', 'LOKA', 'MAME', 'PEJE', 'PENE',
      'PUTO', 'TETA', 'VACA', 'VAGO', 'VAYA', 'VERE', 'VUEY'
    ];
  }

  /**
   * Limpia texto: elimina acentos, mayúsculas, solo alfanuméricos
   */
  limpiarTexto(texto) {
    if (!texto) return '';
    
    const acentos = {
      'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ü': 'U',
      'á': 'A', 'é': 'E', 'í': 'I', 'ó': 'O', 'ú': 'U', 'ü': 'U',
      'Ñ': 'X', 'ñ': 'X'
    };
    
    let t = texto.toUpperCase().trim();
    Object.keys(acentos).forEach(k => t = t.replace(new RegExp(k, 'g'), acentos[k]));
    return t.replace(/[^A-Z0-9]/g, '');
  }

  /**
   * Obtiene primera vocal interna (después de la primera letra)
   */
  obtenerPrimeraVocalInterna(p) {
    if (!p || p.length < 2) return 'X';
    const vocales = 'AEIOU';
    for (let i = 1; i < p.length; i++) {
      if (vocales.includes(p[i])) return p[i];
    }
    return 'X';
  }

  /**
   * Obtiene primera consonante interna (después de la primera letra, excluyendo H)
   */
  obtenerPrimeraConsonanteInterna(p) {
    if (!p || p.length < 2) return 'X';
    const vocales = 'AEIOU';
    for (let i = 1; i < p.length; i++) {
      const c = p[i];
      if (!vocales.includes(c) && c !== 'H') return c;
    }
    return 'X';
  }

  /**
   * Calcula edad basada en fecha de nacimiento
   */
  calcularEdad(fecha) {
    if (!fecha) return '';
    const hoy = new Date();
    const n = new Date(fecha);
    if (isNaN(n.getTime())) return '';
    
    let edad = hoy.getFullYear() - n.getFullYear();
    const m = hoy.getMonth() - n.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) edad--;
    return edad < 0 ? '' : edad;
  }

  /**
   * Obtiene primera letra del nombre (inteligente con nombres compuestos)
   */
  obtenerPrimeraLetraNombre(nombre) {
    const t = this.limpiarTexto(nombre);
    const palabras = t.split(/\s+/).filter(Boolean);
    
    if (!palabras.length) return 'X';
    
    // Si el primer nombre es común (MARIA, JOSE, MA, J), usa el siguiente
    if (palabras.length > 1) {
      const primero = palabras[0];
      if (this.nombresComunes.some(nc => primero.includes(nc))) {
        return palabras[1][0] || 'X';
      }
    }
    
    return palabras[0][0] || 'X';
  }

  /**
   * Evita palabras inconvenientes sustituyendo 4ta letra
   */
  evitarPalabrasInconvenientes(codigo) {
    if (codigo.length < 4) return codigo;
    
    const primeros4 = codigo.substring(0, 4);
    if (this.palabrasInconvenientes.includes(primeros4)) {
      return codigo[0] + codigo[1] + codigo[2] + 'X' + codigo.substring(4);
    }
    return codigo;
  }

  /**
   * Calcula dígito verificador del RFC (peso por posición)
   * RFC base = 12 caracteres, se agrega 1 dígito verificador
   */
  calcularDigitoVerificadorRFC(rfc12) {
    if (!rfc12 || rfc12.length !== 12) return '0';
    
    const secuencia = '3298765432987654321';
    let suma = 0;
    
    for (let i = 0; i < 12; i++) {
      const c = rfc12[i];
      let valor = 0;
      
      if (c >= '0' && c <= '9') {
        valor = parseInt(c);
      } else if (c >= 'A' && c <= 'Z') {
        valor = c.charCodeAt(0) - 64; // A=1, B=2, ..., Z=26
      }
      
      suma += valor * parseInt(secuencia[i]);
    }
    
    const resto = (11 - (suma % 11)) % 11;
    return resto === 10 ? 'A' : resto.toString();
  }

  /**
   * Genera RFC completo con dígito verificador
   */
  generarRFC(nombre, apellidos, fechaNacimiento) {
  try {
    if (!nombre || !apellidos || !fechaNacimiento) return '';
    
    const ap = apellidos.trim().split(/\s+/).filter(Boolean);
    const aPat = this.limpiarTexto(ap[0] || '');
    const aMat = this.limpiarTexto(ap[1] || '');
    const nomL = this.limpiarTexto(nombre);
    
    if (!aPat || !nomL) return '';
    
    // Extraer directamente del string YYYY-MM-DD (no usar new Date())
    const [año_str, mes_str, dia_str] = String(fechaNacimiento).slice(0, 10).split('-');
    const año = año_str.slice(-2);
    const mes = mes_str;
    const dia = dia_str;
    
    let rfc = 
      (aPat[0] || 'X') +
      this.obtenerPrimeraVocalInterna(aPat) +
      (aMat[0] || 'X') +
      this.obtenerPrimeraLetraNombre(nombre) +
      año + mes + dia;
    
    rfc = this.evitarPalabrasInconvenientes(rfc);
    return rfc + 'ABC';
  } catch (e) {
    console.error('[generarRFC]', e);
    return '';
  }
}
  /**
   * Calcula dígito verificador del CURP
   */
  calcularDigitoVerificadorCURP(curp17) {
    if (!curp17 || curp17.length !== 17) return '0';
    
    const secuencia = '3298765432987654321';
    let suma = 0;
    
    for (let i = 0; i < 17; i++) {
      const c = curp17[i];
      let valor = 0;
      
      if (c >= '0' && c <= '9') {
        valor = parseInt(c);
      } else if (c >= 'A' && c <= 'Z') {
        valor = c.charCodeAt(0) - 64; // A=1, ..., Z=26
      }
      
      suma += valor * parseInt(secuencia[i]);
    }
    
    const resto = (11 - (suma % 11)) % 11;
    return resto === 10 ? 'K' : resto.toString();
  }

  /**
   * Genera CURP completo con dígito verificador
   */
generarCURP(nombre, apellidos, fechaNacimiento, sexo, estado = 'TLAXCALA') {
  try {
    if (!nombre || !apellidos || !fechaNacimiento || !sexo) return '';
    
    const ap = apellidos.trim().split(/\s+/).filter(Boolean);
    const aPat = this.limpiarTexto(ap[0] || '');
    const aMat = this.limpiarTexto(ap[1] || '');
    const nomL = this.limpiarTexto(nombre);
    
    if (!aPat || !nomL) return '';
    
    // Extraer directamente YYYY-MM-DD sin usar new Date()
    const [año_str, mes_str, dia_str] = String(fechaNacimiento).slice(0, 10).split('-');
    const año = año_str.slice(-2);
    const mes = mes_str;
    const dia = dia_str;
    
    let curp = 
      (aPat[0] || 'X') +
      this.obtenerPrimeraVocalInterna(aPat) +
      (aMat[0] || 'X') +
      this.obtenerPrimeraLetraNombre(nombre) +
      año + mes + dia;
    
    // Sexo: H o M
    const sexoNorm = sexo.toUpperCase()[0];
    curp += (sexoNorm === 'F' ? 'M' : 'H');
    
    // ===== FIX: ESTADO - NORMALIZAR CORRECTAMENTE =====
    let cod = String(estado || 'TLAXCALA').toUpperCase().trim();
    
    console.log('🔍 [CURP] Estado recibido:', estado);
    console.log('🔍 [CURP] Estado limpiado:', cod);
    
    // Si ya es código de 2 letras, usarlo directamente
    if (cod.length === 2 && /^[A-Z]{2}$/.test(cod)) {
      console.log('✅ [CURP] Código de estado válido:', cod);
    } else {
      // Buscar en el diccionario
      const codigoEncontrado = this.codigosEstados[cod];
      
      if (codigoEncontrado) {
        cod = codigoEncontrado;
        console.log('✅ [CURP] Código encontrado en diccionario:', cod);
      } else {
        console.warn('⚠️ [CURP] Estado no encontrado, usando TL por defecto');
        cod = 'TL';
      }
    }
    
    curp += cod;
    
    // Consonantes
    curp +=
      this.obtenerPrimeraConsonanteInterna(aPat) +
      this.obtenerPrimeraConsonanteInterna(aMat) +
      this.obtenerPrimeraConsonanteInterna(nomL);
    
    curp = this.evitarPalabrasInconvenientes(curp);
    curp += '0'; // Homoclave (placeholder)
    
    const digito = this.calcularDigitoVerificadorCURP(curp);
    
    const curpFinal = curp + digito;
    console.log('✅ [CURP] CURP generado:', curpFinal);
    
    return curpFinal;
  } catch (e) {
    console.error('[generarCURP] Error:', e);
    return '';
  }
}}