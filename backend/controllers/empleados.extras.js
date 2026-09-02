// backend/controllers/empleados.extras.js
// backend/controllers/empleados.extras.js
import sql from 'mssql';

import {
  upsertCatalog,
  upsertPuesto,
  resolveOrDefaultTipoContrato,
  upsertSalario,
} from './empleados.catalogos.js';

/** ✅ Inserta/actualiza beneficiario ligado a un empleado - SIN OUTPUT */
export async function upsertBeneficiario(pool, id_empleado, { nombre, telefono, parentesco, correo }) {
  if (!id_empleado) {
    console.log('⚠️ [upsertBeneficiario] id_empleado no proporcionado');
    return;
  }

  console.log('💾 [upsertBeneficiario] Guardando:', {
    id_empleado,
    nombre,
    telefono,
    parentesco,
    correo
  });

  const has = await pool.request()
    .input('id', sql.Int, id_empleado)
    .query(`SELECT TOP 1 id_beneficiario FROM dbo.Beneficiario WHERE id_empleado=@id`);

  if (has.recordset?.length) {
    // ✅ UPDATE - Actualizar beneficiario existente
    await pool.request()
      .input('id', sql.Int, id_empleado)
      .input('nombre', sql.NVarChar(360), nombre ?? null)
      .input('telefono', sql.NVarChar(60), telefono ?? null)
      .input('parentesco', sql.NVarChar(120), parentesco ?? null)
      .input('correo', sql.NVarChar(300), correo ?? null)
      .query(`
        UPDATE dbo.Beneficiario
        SET nombre=@nombre, telefono=@telefono, parentesco=@parentesco, correo=@correo
        WHERE id_empleado=@id
      `);
    
    console.log('✅ [upsertBeneficiario] Beneficiario ACTUALIZADO con parentesco:', parentesco);
  } else {
    // ✅ INSERT - Crear nuevo beneficiario (SIN OUTPUT)
    await pool.request()
      .input('id', sql.Int, id_empleado)
      .input('nombre', sql.NVarChar(360), nombre ?? null)
      .input('telefono', sql.NVarChar(60), telefono ?? null)
      .input('parentesco', sql.NVarChar(120), parentesco ?? null)
      .input('correo', sql.NVarChar(300), correo ?? null)
      .query(`
        INSERT INTO dbo.Beneficiario(id_empleado, nombre, telefono, parentesco, correo)
        VALUES(@id, @nombre, @telefono, @parentesco, @correo)
      `);
    
    console.log('✅ [upsertBeneficiario] Beneficiario CREADO con parentesco:', parentesco);
  }
}

/** ✅ Inserta/actualiza el contrato ABIERTO del empleado - SIN OUTPUT */
export async function upsertContrato(pool, id_empleado, payload) {
  if (!id_empleado) return;

  const id_area = await upsertCatalog(pool, {
    table: 'Area', idCol: 'id_area', nameCol: 'nombre_area', value: payload.area, maxLen: 120
  });
  const id_puesto = await upsertPuesto(pool, payload.puesto, id_area);
  const [id_jefe_inmediato, id_tipo_nomina] = await Promise.all([
    upsertCatalog(pool, { table: 'JefeInmediato', idCol: 'id_jefe_inmediato', nameCol: 'nombre_jefe', value: payload.jefe, maxLen: 200 }),
    upsertCatalog(pool, { table: 'TipoNomina',    idCol: 'id_tipo_nomina',    nameCol: 'descripcion',  value: payload.tipo_nomina, maxLen: 120 }),
  ]);

  const id_tipo_contrato = await resolveOrDefaultTipoContrato(pool, payload.tipo_contrato);
  const id_salario       = await upsertSalario(pool, payload.salario, 'SALARIO');

  if (!id_area || !id_puesto || !id_jefe_inmediato || !id_tipo_nomina || !id_salario || !id_tipo_contrato) return;

  const c = await pool.request()
    .input('id', sql.Int, id_empleado)
    .query(`
      SELECT TOP 1 * FROM dbo.Contrato
      WHERE id_empleado=@id AND fecha_fin IS NULL
      ORDER BY id_contrato DESC
    `);

  const fecha_inicio = payload.fecha_ingreso ? new Date(payload.fecha_ingreso) : new Date();

  if (c.recordset?.length) {
    // ✅ UPDATE existente
    await pool.request()
      .input('idc', sql.Int, c.recordset[0].id_contrato)
      .input('id_tipo_contrato', sql.Int, id_tipo_contrato)
      .input('fecha_inicio', sql.Date, fecha_inicio)
      .input('id_area', sql.Int, id_area)
      .input('id_puesto', sql.Int, id_puesto)
      .input('id_jefe', sql.Int, id_jefe_inmediato)
      .input('id_salario', sql.Int, id_salario)
      .input('id_nomina', sql.Int, id_tipo_nomina)
      .query(`
        UPDATE dbo.Contrato
        SET id_tipo_contrato=@id_tipo_contrato,
            fecha_inicio=@fecha_inicio,
            id_area=@id_area,
            id_puesto=@id_puesto,
            id_jefe_inmediato=@id_jefe,
            id_salario=@id_salario,
            id_tipo_nomina=@id_nomina
        WHERE id_contrato=@idc
      `);
  } else {
    // ✅ INSERT nuevo (SIN OUTPUT)
    await pool.request()
      .input('id_empleado', sql.Int, id_empleado)
      .input('id_tipo_contrato', sql.Int, id_tipo_contrato)
      .input('fecha_inicio', sql.Date, fecha_inicio)
      .input('id_area', sql.Int, id_area)
      .input('id_puesto', sql.Int, id_puesto)
      .input('id_jefe', sql.Int, id_jefe_inmediato)
      .input('id_salario', sql.Int, id_salario)
      .input('id_nomina', sql.Int, id_tipo_nomina)
      .query(`
        INSERT INTO dbo.Contrato
          (id_empleado, id_tipo_contrato, fecha_inicio, fecha_fin, id_area, id_puesto, id_jefe_inmediato, id_salario, id_tipo_nomina)
        VALUES
          (@id_empleado, @id_tipo_contrato, @fecha_inicio, NULL, @id_area, @id_puesto, @id_jefe, @id_salario, @id_nomina)
      `);
  }
}

/** Lee contrato abierto + beneficiario (sin cambios) */
export async function fetchExtras(pool, id_empleado) {
  if (!id_empleado) return {};

  const req = pool.request();
  req.input('id', sql.Int, id_empleado);
  req.multiple = true;

  const q = await req.query(`
    SELECT TOP 1
      a.nombre_area       AS area,
      p.nombre_puesto     AS puesto,
      j.nombre_jefe       AS jefe,
      tn.descripcion      AS tipo_nomina,
      s.monto             AS salario
    FROM dbo.Contrato c
    LEFT JOIN dbo.Area          a  ON a.id_area          = c.id_area
    LEFT JOIN dbo.Puesto        p  ON p.id_puesto        = c.id_puesto
    LEFT JOIN dbo.JefeInmediato j  ON j.id_jefe_inmediato= c.id_jefe_inmediato
    LEFT JOIN dbo.TipoNomina    tn ON tn.id_tipo_nomina  = c.id_tipo_nomina
    LEFT JOIN dbo.Salario       s  ON s.id_salario       = c.id_salario
    WHERE c.id_empleado=@id AND c.fecha_fin IS NULL
    ORDER BY c.id_contrato DESC;

    SELECT TOP 1
      b.nombre      AS benef_nombre,
      b.telefono    AS benef_telefono,
      b.parentesco  AS benef_parentesco,
      b.correo      AS benef_correo
    FROM dbo.Beneficiario b
    WHERE b.id_empleado=@id
    ORDER BY b.id_beneficiario DESC;
  `);

  const contrato = q.recordsets?.[0]?.[0] || {};
  const bene     = q.recordsets?.[1]?.[0] || {};
  
  console.log('📖 [fetchExtras] Beneficiario leído:', bene);
  
  return { ...contrato, ...bene };
}