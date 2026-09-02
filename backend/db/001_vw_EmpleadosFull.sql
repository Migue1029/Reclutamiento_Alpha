
USE ReclutamientoAlpha;
GO

CREATE OR ALTER VIEW dbo.vw_EmpleadosFull
AS
SELECT
  e.id_empleado,
  e.num_trabajador,
  e.nombre_completo,
  e.sexo,
  e.fecha_nacimiento,
  e.calle_numero, 
  e.colonia, 
  e.municipio, 
  e.estado, 
  e.codigo_postal,
  e.telefono, 
  
  -- ✅ ESTADO CIVIL con fallback robusto
  COALESCE(
    NULLIF(LTRIM(RTRIM(e.estado_civil)), ''),
    NULLIF(LTRIM(RTRIM(e.estatus_civil)), ''),
    NULLIF(LTRIM(RTRIM(r.estado_civil)), ''),
    NULLIF(LTRIM(RTRIM(r.estatus_civil)), '')
  ) AS estado_civil,
  
  e.escolaridad,
  e.curp, 
  e.rfc, 
  e.nss,
  e.correo_electronico AS correo,

  -- credencial robusta (empleado o staging)
  COALESCE(
    NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(64), e.num_credencial))), ''),
    NULLIF(LTRIM(RTRIM(r.numero_credencial)), ''),
    NULLIF(LTRIM(RTRIM(r.num_credencial)), '')
  ) AS credencial,

  COALESCE(e.fecha_ingreso, TRY_CONVERT(date, r.fecha_ingreso)) AS fecha_ingreso,

  -- Área, Puesto, Jefe directo desde staging (texto tal como llega)
  LTRIM(RTRIM(r.id_area))   AS area,
  LTRIM(RTRIM(r.id_puesto)) AS puesto,
  LTRIM(RTRIM(r.id_jefe))   AS jefe,

  -- Salario y tipo de nómina
  TRY_CONVERT(DECIMAL(12,2), REPLACE(REPLACE(r.salario, ',', ''), '$', '')) AS salario,
  LTRIM(RTRIM(r.tipo_nomina))           AS tipo_nomina,

  -- Beneficiario
  LTRIM(RTRIM(r.benef_nombre))          AS benef_nombre,
  LTRIM(RTRIM(r.benef_telefono))        AS benef_telefono,
  LTRIM(RTRIM(r.benef_parentesco))      AS benef_parentesco

FROM dbo.Empleado e
LEFT JOIN stg.Raw_Empleados r
  ON LTRIM(RTRIM(r.num_trabajador)) = LTRIM(RTRIM(e.num_trabajador));
GO