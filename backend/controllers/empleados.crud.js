// backend/controllers/empleados.crud.js (ESM)
import mssql from 'mssql';
const sql = mssql;

import { getPool } from '../db/pool.js';
import { mapRow } from '../utils/mapRow.js';

// helpers seccionados
import { pickEmpleado, EMP_SPEC } from './empleados.helpers.js';

// catálogos (área/puesto/nomina/contrato/salario)
import {
  upsertCatalog,
  upsertPuesto,
  resolveOrDefaultTipoContrato,
  upsertSalario,
} from './empleados.catalogos.js';

// extras (beneficiario, contrato abierto, lectura de extras)
import {
  upsertBeneficiario,
  upsertContrato,
  fetchExtras,
} from './empleados.extras.js';

// ==================== Config ====================
const viewName  = process.env.DB_VIEW_EMPLEADOS_FULL;           // ej: vw_EmpleadosFull
const tableName = process.env.DB_TABLE_EMPLEADOS || 'Empleado'; // dbo.Empleado
const EMP_SOURCE = viewName || tableName;                       // vista preferida si existe

const searchTop = Number(process.env.DB_SEARCH_TOP || 500);
const listTop   = Number(process.env.DB_LIST_TOP   || 50);

// ================== LISTAR ==================
const ALLOWED_SORT = new Set(['num_trabajador','nombre_completo','area','puesto','fecha_ingreso']);
const pickSort = s => (ALLOWED_SORT.has(String(s || 'num_trabajador')) ? String(s) : 'num_trabajador');
const pickDir  = d => (String(d || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc');

export async function listar(req, res) {
  try {
    const rawQ     = (req.query?.q ?? req.query?.query ?? '').toString().trim();
    const page     = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || listTop)));
    const sort     = pickSort(req.query.sort);
    const dir      = pickDir(req.query.dir);
    const offset   = (page - 1) * pageSize;

    const pool = await getPool();
    const rq = pool.request()
      .input('q',        sql.NVarChar(200), rawQ)
      .input('sort',     sql.NVarChar(64),  sort)
      .input('dir',      sql.VarChar(4),    dir)
      .input('offset',   sql.Int,           offset)
      .input('pageSize', sql.Int,           pageSize);

    const sqlText = `
      SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

      WITH src AS (
        SELECT
          v.id_empleado,
          v.num_trabajador,
          v.nombre_completo,
          v.sexo,
          v.fecha_nacimiento,
          v.calle_numero,
          v.colonia,
          v.municipio,
          v.estado,
          v.codigo_postal,
          v.telefono,
          v.estado_civil,
          v.escolaridad,
          v.curp,
          v.rfc,
          v.nss,

          -- vista -> tabla base
          COALESCE(v.fecha_ingreso,       e.fecha_ingreso)       AS fecha_ingreso,
          COALESCE(v.correo_electronico,  e.correo_electronico)  AS correo_electronico,
          COALESCE(v.num_credencial,      e.num_credencial)      AS num_credencial,

          -- Fallbacks: Contrato -> Vista -> Staging (Raw)
          COALESCE(con.nombre_area,   v.area,   rw.r_area)         AS area,
          COALESCE(con.nombre_puesto, v.puesto, rw.r_puesto)       AS puesto,
          COALESCE(con.nombre_jefe,   v.jefe_inmediato, rw.r_jefe) AS jefe_inmediato,
          COALESCE(con.tipo_nomina,   v.tipo_nomina, rw.r_tipo)    AS tipo_nomina,
          COALESCE(con.salario_monto, v.salario_monto, rw.r_sal)   AS salario_monto,

          bene.nombre     AS benef_nombre,
          bene.parentesco AS benef_parentesco,
          bene.telefono   AS benef_telefono,
          bene.correo     AS benef_correo,

          COUNT(*) OVER() AS total_count
        FROM dbo.${EMP_SOURCE} AS v
        LEFT JOIN dbo.${tableName} AS e
               ON e.id_empleado = v.id_empleado

        -- Contrato (abierto si existe; si no, el más reciente)
        OUTER APPLY (
          SELECT TOP 1
            c.fecha_inicio,
            a.nombre_area      AS nombre_area,
            p.nombre_puesto    AS nombre_puesto,
            j.nombre_jefe      AS nombre_jefe,
            tn.descripcion     AS tipo_nomina,
            s.monto            AS salario_monto
          FROM dbo.Contrato c
          LEFT JOIN dbo.Area          a  ON a.id_area           = c.id_area
          LEFT JOIN dbo.Puesto        p  ON p.id_puesto         = c.id_puesto
          LEFT JOIN dbo.JefeInmediato j  ON j.id_jefe_inmediato = c.id_jefe_inmediato
          LEFT JOIN dbo.TipoNomina    tn ON tn.id_tipo_nomina   = c.id_tipo_nomina
          LEFT JOIN dbo.Salario       s  ON s.id_salario        = c.id_salario
          WHERE c.id_empleado = v.id_empleado
          ORDER BY 
            CASE WHEN c.fecha_fin IS NULL THEN 0 ELSE 1 END,
            c.id_contrato DESC
        ) con

        -- Staging plano por num_trabajador
        OUTER APPLY (
          SELECT TOP 1
            LTRIM(RTRIM(r.id_area))      AS r_area,
            LTRIM(RTRIM(r.id_puesto))    AS r_puesto,
            LTRIM(RTRIM(r.id_jefe))      AS r_jefe,
            LTRIM(RTRIM(r.tipo_nomina))  AS r_tipo,
            TRY_CONVERT(DECIMAL(18,2), REPLACE(REPLACE(r.salario, ',', ''), '$', '')) AS r_sal
          FROM stg.Raw_Empleados r
          WHERE LTRIM(RTRIM(r.num_trabajador)) = LTRIM(RTRIM(v.num_trabajador))
        ) rw

        -- Beneficiario más reciente
        OUTER APPLY (
          SELECT TOP 1
            b.nombre,
            b.telefono,
            b.parentesco,
            b.correo
          FROM dbo.Beneficiario b
          WHERE b.id_empleado = v.id_empleado
          ORDER BY b.id_beneficiario DESC
        ) bene

        WHERE (
          @q IS NULL OR @q = '' OR
          UPPER(v.nombre_completo)     LIKE UPPER('%'+@q+'%') OR
          UPPER(v.num_trabajador)      LIKE UPPER('%'+@q+'%') OR
          UPPER(v.puesto)              LIKE UPPER('%'+@q+'%') OR
          UPPER(v.area)                LIKE UPPER('%'+@q+'%') OR
          UPPER(v.curp)                LIKE UPPER('%'+@q+'%') OR
          UPPER(v.rfc)                 LIKE UPPER('%'+@q+'%') OR
          UPPER(v.nss)                 LIKE UPPER('%'+@q+'%') OR
          UPPER(v.correo_electronico)  LIKE UPPER('%'+@q+'%') OR
          UPPER(e.correo_electronico)  LIKE UPPER('%'+@q+'%')
        )
      )
      SELECT *
      FROM src
      ORDER BY
        CASE WHEN @sort='num_trabajador'  AND @dir='asc'  THEN NULL END ASC,
        CASE WHEN @sort='num_trabajador'  AND @dir='desc' THEN NULL END DESC,
        CASE WHEN @sort='nombre_completo' AND @dir='asc'  THEN NULL END ASC,
        CASE WHEN @sort='nombre_completo' AND @dir='desc' THEN NULL END DESC,
        CASE WHEN @sort='area'            AND @dir='asc'  THEN NULL END ASC,
        CASE WHEN @sort='area'            AND @dir='desc' THEN NULL END DESC,
        CASE WHEN @sort='puesto'          AND @dir='asc'  THEN NULL END ASC,
        CASE WHEN @sort='puesto'          AND @dir='desc' THEN NULL END DESC,
        CASE WHEN @sort='fecha_ingreso'   AND @dir='asc'  THEN NULL END ASC,
        CASE WHEN @sort='fecha_ingreso'   AND @dir='desc' THEN NULL END DESC,
        num_trabajador ASC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
    `;

    const r = await rq.query(sqlText);

    const rows  = r.recordset || [];
    const total = rows.length ? Number(rows[0].total_count) : 0;
    const items = rows.map(({ total_count, ...rest }) => rest);

    return res.json({ ok: true, page, pageSize, total, items });
  } catch (e) {
    console.error('[empleados.listar] error:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

// ================== BUSCAR ==================
export async function buscar(req, res) {
  try {
    const q = (req.query?.query || req.query?.q || '').trim();
    if (!q) return res.json([]);

    const pool = await getPool();
    const r = await pool.request().query(`
      SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
      SELECT TOP (${searchTop}) * FROM dbo.${EMP_SOURCE};
    `);

    const mapped = (r.recordset || []).map(mapRow);
    const qn = q.toLowerCase();
    const filtered = mapped.filter(e =>
      (e.nombre_completo || '').toLowerCase().includes(qn) ||
      (e.num_trabajador  || '').toLowerCase().includes(qn) ||
      (e.correo          || '').toLowerCase().includes(qn) ||
      (e.nombre          || '').toLowerCase().includes(qn) ||
      (e.apellidos       || '').toLowerCase().includes(qn)
    );

    return res.json(filtered.slice(0, listTop));
  } catch (e) {
    console.error('[empleados.buscar] error:', e);
    res.status(500).json({ error: e.message });
  }
}

// ================== OBTENER ==================
export async function obtenerPorId(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'id inválido' });

    const pool = await getPool();

    const [rTable, rView, extras] = await Promise.all([
      pool.request().input('id', sql.Int, id).query(`
        SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
        SELECT * FROM dbo.${tableName} WHERE id_empleado=@id;
      `),
      pool.request().input('id', sql.Int, id).query(`
        SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
        SELECT * FROM dbo.${EMP_SOURCE} WHERE id_empleado=@id;
      `),
      fetchExtras(pool, id),
    ]);

    const base = (rTable.recordset || [])[0] || {};
    const view = (rView.recordset || [])[0] || {};

    if (!base && !view) return res.status(404).json({ error: 'No encontrado' });

    const merged = { ...mapRow(view), ...base, ...extras };
    const idVal = merged.id ?? merged.id_empleado ?? id;
    merged.id = idVal;
    merged.id_empleado = idVal;

    return res.json(merged);
  } catch (e) {
    console.error('[empleados.obtenerPorId] error:', e);
    res.status(500).json({ error: e.message });
  }
}

// ================== CREAR (con validación NSS mejorada) ==================
export async function crear(req, res) {
  try {
    const raw = req.body || {};
    const b = pickEmpleado(raw);

    // Validación: nombre y apellidos
    if (!b.nombre_completo && !(b.nombre && b.apellidos)) {
      return res.status(400).json({ error: 'nombre y apellidos (o nombre_completo) son obligatorios' });
    }

    // ✅ CALCULAR EDAD AL MOMENTO DEL REGISTRO
    let edadRegistro = null;
    if (b.fecha_nacimiento) {
      edadRegistro = calcularEdad(b.fecha_nacimiento);
    }

    // ✅ VALIDACIÓN DE NUM_TRABAJADOR
    if (!b.num_trabajador || String(b.num_trabajador).trim() === '') {
      return res.status(400).json({ 
        error: 'El número de trabajador es obligatorio' 
      });
    }

    const pool = await getPool();

    // ✅ VALIDACIÓN DE NSS DUPLICADO
    if (b.nss && String(b.nss).trim() !== '') {
      const nssLimpio = String(b.nss).replace(/\D/g, '');
      
      if (nssLimpio.length !== 11) {
        return res.status(400).json({ 
          error: `El NSS debe tener exactamente 11 dígitos. Recibido: ${nssLimpio.length} dígitos`,
          nss_recibido: b.nss
        });
      }

      const nssCheck = await pool.request()
        .input('nss', sql.VarChar(20), nssLimpio)
        .query(`SELECT id_empleado, nombre_completo FROM dbo.${tableName} WHERE nss = @nss`);
      
      if (nssCheck.recordset.length > 0) {
        const empleadoExistente = nssCheck.recordset[0];
        return res.status(400).json({ 
          error: `El NSS ${nssLimpio} ya está registrado`,
          id_existente: empleadoExistente.id_empleado,
          nombre_existente: empleadoExistente.nombre_completo
        });
      }

      b.nss = nssLimpio;
    }

    // ✅ VALIDACIÓN DE NUM_TRABAJADOR DUPLICADO
    const numCheck = await pool.request()
      .input('num', sql.NVarChar(60), b.num_trabajador)
      .query(`SELECT id_empleado, nombre_completo FROM dbo.${tableName} WHERE num_trabajador = @num`);
    
    if (numCheck.recordset.length > 0) {
      const empleadoExistente = numCheck.recordset[0];
      return res.status(400).json({ 
        error: `El número de trabajador ${b.num_trabajador} ya está registrado`,
        id_existente: empleadoExistente.id_empleado,
        nombre_existente: empleadoExistente.nombre_completo
      });
    }

    // columnas existentes en dbo.Empleado
    const colsQ = await pool.request()
      .input('tbl', sql.NVarChar(128), tableName)
      .query(`
        SELECT c.COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS c
        WHERE c.TABLE_SCHEMA='dbo' AND c.TABLE_NAME=@tbl
      `);
    const existing = new Set((colsQ.recordset || []).map(r => r.COLUMN_NAME));

    const aliasMap = { correo: 'correo_electronico', credencial: 'num_credencial' };

    const cols = [];
    const params = [];
    const rq = pool.request();

    for (const [key, val] of Object.entries(b)) {
      // ✅ EXCLUIR 'edad' del loop para procesarlo después
      if (['area','puesto','jefe','salario','tipo_nomina','tipo_contrato','benef_nombre','benef_telefono','benef_parentesco','benef_correo','edad'].includes(key)) {
        continue;
      }
      
      const col = aliasMap[key] || key;
      if (!existing.has(col)) continue;

      // ⚠️ Si NSS viene vacío, no insertarlo
      if (col === 'nss' && (!val || String(val).trim() === '')) {
        continue;
      }

      cols.push(col);
      params.push('@' + col);

      const spec = EMP_SPEC[col] || EMP_SPEC[key];
      if (!spec) rq.input(col, sql.NVarChar, val);
      else if (spec.type === sql.NVarChar) rq.input(col, sql.NVarChar(spec.len), val);
      else if (spec.type === sql.VarChar)  rq.input(col, sql.VarChar(spec.len), val);
      else if (spec.type === sql.Date)     rq.input(col, sql.Date, val);
      else rq.input(col, spec.type, val);
    }

    // ✅ AGREGAR EDAD AL MOMENTO DEL REGISTRO (UNA SOLA VEZ)
    if (edadRegistro !== null && existing.has('edad')) {
      cols.push('edad');
      params.push('@edad');
      rq.input('edad', sql.Int, edadRegistro);
    }

    if (!cols.length) return res.status(400).json({ error: 'No hay columnas válidas para insertar' });

    // ✅ SOLUCIÓN: INSERT sin OUTPUT (compatible con triggers)
    await rq.query(`
      INSERT INTO dbo.${tableName} (${cols.join(', ')})
      VALUES (${params.join(', ')})
    `);

    // ✅ Obtener el ID insertado con consulta separada
    const getIdQuery = await pool.request()
      .input('num', sql.NVarChar(60), b.num_trabajador)
      .query(`
        SELECT TOP 1 id_empleado AS id 
        FROM dbo.${tableName} 
        WHERE num_trabajador = @num
        ORDER BY id_empleado DESC
      `);

    const newId = getIdQuery.recordset?.[0]?.id;
    
    if (!newId) {
      console.warn('[empleados.crear] No se pudo recuperar el ID del empleado insertado');
      return res.status(201).json({ 
        ok: true,
        success: true,
        message: 'Empleado creado pero no se pudo recuperar el ID'
      });
    }

    await upsertContrato(pool, newId, b);
    await upsertBeneficiario(pool, newId, {
      nombre: b.benef_nombre, 
      telefono: b.benef_telefono, 
      parentesco: b.benef_parentesco, 
      correo: b.benef_correo
    });

    const [r2, extras] = await Promise.all([
      pool.request().input('id', sql.Int, newId).query(`
        SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
        SELECT * FROM dbo.${EMP_SOURCE} WHERE id_empleado=@id;
      `),
      fetchExtras(pool, newId),
    ]);
    
    const row = (r2.recordset || [])[0];
    const mapped = row ? mapRow(row) : {};
    const idValue = mapped.id ?? mapped.id_empleado ?? newId;

    return res.status(201).json({ 
      ok: true, 
      success: true,
      id: idValue, 
      id_empleado: idValue, 
      empleado: { id_empleado: idValue, ...mapped, ...extras }
    });
    
  } catch (e) {
    console.error('[empleados.crear] error:', e);
    
    let errorMsg = e.message || 'Error desconocido';
    
    if (errorMsg.includes('UQ_Empleado_nss') || errorMsg.includes('duplicate key')) {
      const match = errorMsg.match(/\(([0-9]+)\)/);
      const nss = match ? match[1] : 'proporcionado';
      
      return res.status(400).json({ 
        ok: false,
        error: `El NSS ${nss} ya está registrado en el sistema`,
        codigo: 'NSS_DUPLICADO'
      });
    }
    
    if (errorMsg.includes('num_trabajador') && errorMsg.includes('duplicate')) {
      return res.status(400).json({ 
        ok: false,
        error: 'El número de trabajador ya está registrado',
        codigo: 'NUM_TRABAJADOR_DUPLICADO'
      });
    }
    
    return res.status(500).json({ 
      ok: false, 
      error: errorMsg,
      codigo: 'ERROR_CREAR_EMPLEADO'
    });
  }
}
// ========== HELPER: CALCULAR EDAD ==========
function calcularEdad(fechaNacimiento) {
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

// ================== ACTUALIZAR (con validación NSS mejorada) ==================
export async function actualizar(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'id inválido' });

    const b = pickEmpleado(req.body || {});
    const pool = await getPool();

    // ✅ VALIDACIÓN DE NSS DUPLICADO (excluyendo el registro actual)
    if (b.nss && String(b.nss).trim() !== '') {
      const nssLimpio = String(b.nss).replace(/\D/g, '');
      
      if (nssLimpio.length !== 11) {
        return res.status(400).json({ 
          error: `El NSS debe tener exactamente 11 dígitos. Recibido: ${nssLimpio.length} dígitos`,
          nss_recibido: b.nss
        });
      }

      const nssCheck = await pool.request()
        .input('nss', sql.VarChar(20), nssLimpio)
        .input('id', sql.Int, id)
        .query(`
          SELECT id_empleado, nombre_completo 
          FROM dbo.${tableName} 
          WHERE nss = @nss AND id_empleado != @id
        `);
      
      if (nssCheck.recordset.length > 0) {
        const empleadoExistente = nssCheck.recordset[0];
        return res.status(400).json({ 
          error: `El NSS ${nssLimpio} ya está registrado en otro empleado`,
          id_existente: empleadoExistente.id_empleado,
          nombre_existente: empleadoExistente.nombre_completo
        });
      }

      b.nss = nssLimpio;
    }

    const colsQ = await pool.request()
      .input('tbl', sql.NVarChar(128), tableName)
      .query(`
        SELECT c.COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS c
        WHERE c.TABLE_SCHEMA='dbo' AND c.TABLE_NAME=@tbl
      `);
    const existing = new Set((colsQ.recordset || []).map(r => r.COLUMN_NAME));

    const aliasMap = { correo: 'correo_electronico', credencial: 'num_credencial' };

    const sets = [];
    const rq = pool.request().input('id', sql.Int, id);

    for (const [key, val] of Object.entries(b)) {
      if (['area','puesto','jefe','salario','tipo_nomina','tipo_contrato','benef_nombre','benef_telefono','benef_parentesco','benef_correo'].includes(key)) {
        continue;
      }
      const col = aliasMap[key] || key;
      if (!existing.has(col)) continue;

      // ⚠️ Si NSS viene vacío, establecer NULL
      if (col === 'nss' && (!val || String(val).trim() === '')) {
        sets.push(`${col}=NULL`);
        continue;
      }

      sets.push(`${col}=@${col}`);
      const spec = EMP_SPEC[col] || EMP_SPEC[key];
      if (!spec) rq.input(col, sql.NVarChar, val);
      else if (spec.type === sql.NVarChar) rq.input(col, sql.NVarChar(spec.len), val);
      else if (spec.type === sql.VarChar)  rq.input(col, sql.VarChar(spec.len), val);
      else if (spec.type === sql.Date)     rq.input(col, sql.Date, val);
      else rq.input(col, spec.type, val);
    }

    if (sets.length) {
      await rq.query(`
        UPDATE dbo.${tableName}
        SET ${sets.join(', ')}
        WHERE id_empleado=@id
      `);
    }

    await upsertContrato(pool, id, b);
    await upsertBeneficiario(pool, id, {
      nombre: b.benef_nombre, telefono: b.benef_telefono, parentesco: b.benef_parentesco, correo: b.benef_correo
    });

    const [r2, extras] = await Promise.all([
      pool.request().input('id', sql.Int, id).query(`
        SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
        SELECT * FROM dbo.${EMP_SOURCE} WHERE id_empleado = @id;
      `),
      fetchExtras(pool, id),
    ]);

    const row = (r2.recordset || [])[0];
    if (!row) return res.json({ ok: true, id });

    const mapped = mapRow(row);
    const idValue = mapped.id ?? mapped.id_empleado ?? id;
    return res.json({ 
      ok: true, 
      success: true,
      id: idValue, 
      id_empleado: idValue, 
      empleado: { id_empleado: idValue, ...mapped, ...extras }
    });
  } catch (e) {
    console.error('[empleados.actualizar] error:', e);
    
    // ✅ MANEJO ESPECÍFICO DE ERRORES SQL
    let errorMsg = e.message || 'Error desconocido';
    
    if (errorMsg.includes('UQ_Empleado_nss') || errorMsg.includes('duplicate key')) {
      const match = errorMsg.match(/\(([0-9]+)\)/);
      const nss = match ? match[1] : 'proporcionado';
      
      return res.status(400).json({ 
        ok: false,
        error: `El NSS ${nss} ya está registrado en otro empleado`,
        codigo: 'NSS_DUPLICADO'
      });
    }
    
    return res.status(500).json({ 
      ok: false,
      error: errorMsg,
      codigo: 'ERROR_ACTUALIZAR_EMPLEADO'
    });
  }
}

// ================ ELIMINAR =================
export async function eliminar(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ ok: false, error: 'id inválido' });
  }

  try {
    const pool = await getPool();
    const r = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SET XACT_ABORT ON;
        BEGIN TRY
          BEGIN TRAN;

            DELETE FROM dbo.Beneficiario WHERE id_empleado = @id;
            DELETE FROM dbo.Contrato      WHERE id_empleado = @id;
            DELETE FROM dbo.${tableName}  WHERE id_empleado = @id;

            DECLARE @deleted INT = @@ROWCOUNT;

          COMMIT TRAN;
          SELECT 1 AS ok, @deleted AS deleted;
        END TRY
        BEGIN CATCH
          IF (XACT_STATE()) <> 0 ROLLBACK TRAN;
          DECLARE @msg NVARCHAR(4000) = ERROR_MESSAGE();
          RAISERROR(@msg, 16, 1);
        END CATCH
      `);

    const row = r.recordset?.[0] || {};
    if (!row.ok) return res.status(500).json({ ok: false, error: 'Error desconocido' });
    if ((row.deleted ?? 0) === 0) return res.status(404).json({ ok: false, error: 'No encontrado' });

    return res.json({ ok: true, deleted: row.deleted });
  } catch (e) {
    console.error('[empleados.eliminar] error:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
