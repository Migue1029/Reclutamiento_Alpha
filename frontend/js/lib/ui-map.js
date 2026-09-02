// Mapa de referencias a los controles del formulario
const $ = (id) => document.getElementById(id);

export function buildUI() {
  return {
    num_trabajador_top: $('num_trabajador_top'),
    nombre: $('nombre'),
    apellidos: $('apellidos'),
    correo: $('correo'),
    sexo: $('sexo'),
    fecha_nacimiento: $('fecha_nacimiento'),
    edad: $('edad'),
    calle_numero: $('calle_numero'),
    colonia: $('colonia'),
    municipio: $('municipio'),
    estado: $('estado'),
    estado_nacimiento: $('estado_nacimiento'),
    codigo_postal: $('codigo_postal'),
    telefono: $('telefono'),
    credencial:      document.getElementById('credencial'),
    num_credencial:  document.getElementById('num_credencial'),
    estado_civil: $('estado_civil'),
    escolaridad: $('escolaridad'),
    curp: $('curp'),
    rfc: $('rfc'),
    nss: $('nss'),
    fecha_ingreso: document.getElementById('fecha_ingreso'),
    area:          document.getElementById('area'),
    puesto:        document.getElementById('puesto'),
    jefe:          document.getElementById('jefe'),
    salario:       document.getElementById('salario'),
    tipo_nomina:   document.getElementById('tipo_nomina'),
    benef_nombre:  document.getElementById('benef_nombre'),
    benef_telefono:document.getElementById('benef_telefono'),
    benef_parentesco: document.getElementById('benef_parentesco'),
  }
}