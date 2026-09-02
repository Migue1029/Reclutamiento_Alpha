// controllers/empleados.gestion.controller.js (ESM) — versión robusta y completa
import { sql, getPool } from '../db/pool.js';

const DB_VIEW_EMPLEADOS_FULL = 'Empleado';  // Usar tabla directamente para obtenerconst DB_VIEW_EMPLEADOS_FULL = 'Empleado';  // Usar tabla directamente
const DB_TABLE_EMPLEADOS     = process.env.DB_TABLE_EMPLEADOS     || 'Empleado';

// 👇 Para GESTIÓN usaremos SIEMPRE la tabla Empleado
const EMP_SOURCE = DB_TABLE_EMPLEADOS;
const TABLE_NAME = DB_TABLE_EMPLEADOS;

console.log("⚡ USANDO FUENTE DE DATOS:", EMP_SOURCE);

const LIST_TOP = Number(process.env.DB_LIST_TOP || 50);

// Orden/paginación
const ALLOWED_SORT = new Set(['num_trabajador','nombre_completo','area','puesto','fecha_ingreso']);
const pickSort = s => (ALLOWED_SORT.has(String(s || 'num_trabajador')) ? String(s) : 'num_trabajador');
const pickDir  = d => (String(d || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc');

/* ===== Helpers para detección de columnas y armado seguro ===== */
async function getColumns(pool, objectName) {
  // Devuelve Set con los nombres de columna (en minúsculas) del objeto dbo.<objectName>
  const r = await pool.request()
    .input('name', sql.NVarChar(256), objectName)
    .query(`
      SELECT c.name AS col
      FROM sys.columns c
      JOIN sys.objects o ON o.object_id = c.object_id
      WHERE o.name = @name AND o.schema_id = SCHEMA_ID('dbo');
    `);
  return new Set((r.recordset || []).map(x => String(x.col).toLowerCase()));
}

const firstExisting = (colsSet, candidates) =>
  candidates.find(c => colsSet.has(c.toLowerCase())) || null;

const exprOrNull = (alias, col) => (col ? `${alias}.[${col}]` : 'NULL');

// Cache en memoria para /api/empleados?view=gestion
// key = JSON.stringify({q,page,pageSize,sort,dir})
const _gestionCache = new Map();
const GESTION_CACHE_TTL_MS = 15_000; // 15s

function getFromCache(key) {
  const e = _gestionCache.get(key);
  if (!e) return null;
  if (Date.now() > e.expireAt) { _gestionCache.delete(key); return null; }
  return e.payload;
}
function putInCache(key, payload) {
  _gestionCache.set(key, { payload, expireAt: Date.now() + GESTION_CACHE_TTL_MS });
}

/* ================== LISTAR (vista Gestión) - VERSIÓN ESTABLE ================== */
export async function listar(req, res) {
  try {
    const pool = await getPool();
    const rawQ = (req.query?.q ?? req.query?.query ?? '').toString().trim();
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Number(req.query.pageSize || 50));
    const offset = (page - 1) * pageSize;
    const sort = req.query.sort || 'num_trabajador';
    const dir = req.query.dir === 'desc' ? 'DESC' : 'ASC';

    let query = `
      SELECT 
        id_empleado,
        num_trabajador,
        nombre_completo,
        fecha_ingreso,
        correo_electronico AS correo,
        num_credencial,
        sexo,
        fecha_nacimiento,
        calle_numero,
        colonia,
        municipio,
        estado,
        codigo_postal,
        telefono,
        estado_civil,
        escolaridad,
        curp,
        rfc,
        nss,
        COUNT(*) OVER() AS total_count
      FROM Empleado
    `;

    if (rawQ) {
      query += ` WHERE num_trabajador LIKE '%' + @q + '%' 
                 OR nombre_completo LIKE '%' + @q + '%' 
                 OR correo_electronico LIKE '%' + @q + '%'`;
    }

    query += ` ORDER BY ${sort} ${dir} OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`;

    const request = pool.request();
    if (rawQ) request.input('q', sql.NVarChar(200), rawQ);
    request.input('offset', sql.Int, offset);
    request.input('pageSize', sql.Int, pageSize);

    const result = await request.query(query);
    
    const rows = result.recordset || [];
    const total = rows.length ? Number(rows[0].total_count) : 0;
    const items = rows.map(({ total_count, ...rest }) => rest);

    res.json({ ok: true, page, pageSize, total, items });
  } catch (err) {
    console.error('[empleados.gestion.listar] ERROR:', err);
    res.status(500).json({ ok: false, error: 'LIST_ERROR', message: String(err.message || err) });
  }
}

/* ================== OBTENER (detalle completo) ================== */
export async function obtener(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'BAD_ID' });
  
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
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
          e.estado_civil,
          e.escolaridad,
          e.curp,
          e.rfc,
          e.nss,
          e.fecha_ingreso,
          e.correo_electronico,
          e.num_credencial,
          /* Datos del contrato más reciente */
          a.nombre_area,
          p.nombre_puesto,
          j.nombre_jefe,
          tn.descripcion AS tipo_nomina,
          s.monto AS salario,
          /* Beneficiario más reciente */
          b.nombre AS benef_nombre,
          b.parentesco AS benef_parentesco,
          b.telefono AS benef_telefono,
          b.correo AS benef_correo
        FROM Empleado e
        /* Contrato más reciente */
        OUTER APPLY (
          SELECT TOP 1
            c.id_area,
            c.id_puesto,
            c.id_jefe_inmediato,
            c.id_salario,
            c.id_tipo_nomina
          FROM Contrato c
          WHERE c.id_empleado = e.id_empleado
          ORDER BY c.id_contrato DESC
        ) c
        LEFT JOIN Area a ON a.id_area = c.id_area
        LEFT JOIN Puesto p ON p.id_puesto = c.id_puesto
        LEFT JOIN JefeInmediato j ON j.id_jefe_inmediato = c.id_jefe_inmediato
        LEFT JOIN TipoNomina tn ON tn.id_tipo_nomina = c.id_tipo_nomina
        LEFT JOIN Salario s ON s.id_salario = c.id_salario
        /* Beneficiario más reciente */
        OUTER APPLY (
          SELECT TOP 1
            b2.nombre,
            b2.parentesco,
            b2.telefono,
            b2.correo
          FROM Beneficiario b2
          WHERE b2.id_empleado = e.id_empleado
          ORDER BY b2.id_beneficiario DESC
        ) b
        WHERE e.id_empleado = @id
      `);
    
    if (!result.recordset.length) {
      return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    }
    
    res.json({ ok: true, item: result.recordset[0] });
  } catch (err) {
    console.error('[GET /api/empleados/:id] Error:', err);
    res.status(500).json({ ok: false, error: 'GET_ERROR', message: String(err.message || err) });
  }
}
/* ================== DETALLE COMPLETO ================== */
export async function detalle(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'BAD_ID' });

  try {
    const pool = await getPool();
    const q = await pool.request()
      .input('id', sql.Int, id)
      .query(`
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
          e.estado_civil,
          e.escolaridad,
          e.curp,
          e.rfc,
          e.nss,
          e.fecha_ingreso,
          e.correo_electronico,
          e.num_credencial,
          /* Datos del contrato más reciente */
          a.nombre_area,
          p.nombre_puesto,
          j.nombre_jefe,
          tn.descripcion AS tipo_nomina,
          s.monto AS salario,
          /* Beneficiario más reciente */
          bn.nombre AS benef_nombre,
          bn.parentesco AS benef_parentesco,
          bn.telefono AS benef_telefono,
          bn.correo AS benef_correo
        FROM Empleado e
        /* Contrato más reciente */
        OUTER APPLY (
          SELECT TOP 1
            c.id_area,
            c.id_puesto,
            c.id_jefe_inmediato,
            c.id_salario,
            c.id_tipo_nomina
          FROM Contrato c
          WHERE c.id_empleado = e.id_empleado
          ORDER BY c.id_contrato DESC
        ) c
        LEFT JOIN Area a ON a.id_area = c.id_area
        LEFT JOIN Puesto p ON p.id_puesto = c.id_puesto
        LEFT JOIN JefeInmediato j ON j.id_jefe_inmediato = c.id_jefe_inmediato
        LEFT JOIN TipoNomina tn ON tn.id_tipo_nomina = c.id_tipo_nomina
        LEFT JOIN Salario s ON s.id_salario = c.id_salario
        /* Beneficiario más reciente */
        OUTER APPLY (
          SELECT TOP 1
            b.nombre,
            b.parentesco,
            b.telefono,
            b.correo
          FROM Beneficiario b
          WHERE b.id_empleado = e.id_empleado
          ORDER BY b.id_beneficiario DESC
        ) bn
        WHERE e.id_empleado = @id
      `);

    const item = q.recordset?.[0];
    if (!item) {
      return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    }

    res.json(item);
  } catch (err) {
    console.error('[GET /api/empleados/:id/detalle] Error:', err);
    res.status(500).json({ ok: false, error: 'DETAIL_ERROR', message: String(err.message || err) });
  }
}

/* ================== ELIMINAR (lógico) ================== */
export async function eliminar(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ ok:false, error:'BAD_ID' });
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, id)
      .query(`
        UPDATE dbo.[${TABLE_NAME}]
        SET is_deleted = 1
        WHERE id_empleado = @id;
      `);
    res.json({ ok:true, id });
  } catch (err) {
    console.error('[DELETE /api/empleados/:id] Error:', err);
    res.status(500).json({ ok:false, error:'DELETE_ERROR', message: String(err.message || err) });
  }
}

/* ================== ACTUALIZAR ================== */
export async function actualizar(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ ok:false, error:'BAD_ID' });
  const b = req.body || {};
  const toNull = v => (v === undefined || v === null || String(v).trim?.() === '' ? null : v);

  try {
    const pool = await getPool();
    const q = await pool.request()
      .input('id',                 sql.Int,           id)
      .input('num_trabajador',     sql.VarChar(20),   toNull(b.num_trabajador))
      .input('nombre_completo',    sql.NVarChar(150), toNull(b.nombre_completo))
      .input('sexo',               sql.NVarChar(20),  toNull(b.sexo))
      .input('fecha_nacimiento',   sql.Date,          toNull(b.fecha_nacimiento))
      .input('calle_numero',       sql.NVarChar(120), toNull(b.calle_numero))
      .input('colonia',            sql.NVarChar(120), toNull(b.colonia))
      .input('municipio',          sql.NVarChar(120), toNull(b.municipio))
      .input('estado',             sql.NVarChar(120), toNull(b.estado))
      .input('codigo_postal',      sql.VarChar(10),   toNull(b.codigo_postal))
      .input('telefono',           sql.VarChar(30),   toNull(b.telefono))
      .input('estado_civil',       sql.NVarChar(50),  toNull(b.estado_civil))
      .input('escolaridad',        sql.NVarChar(80),  toNull(b.escolaridad))
      .input('curp',               sql.VarChar(20),   toNull(b.curp))
      .input('rfc',                sql.VarChar(20),   toNull(b.rfc))
      .input('nss',                sql.VarChar(20),   toNull(b.nss))
      .input('fecha_ingreso',      sql.Date,          toNull(b.fecha_ingreso))
      .input('correo_electronico', sql.NVarChar(150), toNull(b.correo_electronico))
      .input('num_credencial',     sql.VarChar(50),   toNull(b.num_credencial))
      .query(`
        UPDATE dbo.[${TABLE_NAME}] SET
          num_trabajador     = @num_trabajador,
          nombre_completo    = @nombre_completo,
          sexo               = @sexo,
          fecha_nacimiento   = @fecha_nacimiento,
          calle_numero       = @calle_numero,
          colonia            = @colonia,
          municipio          = @municipio,
          estado             = @estado,
          codigo_postal      = @codigo_postal,
          telefono           = @telefono,
          estado_civil       = @estado_civil,
          escolaridad        = @escolaridad,
          curp               = @curp,
          rfc                = @rfc,
          nss                = @nss,
          fecha_ingreso      = @fecha_ingreso,
          correo_electronico = @correo_electronico,
          num_credencial     = @num_credencial
        WHERE id_empleado = @id;

        SELECT * FROM dbo.[${DB_VIEW_EMPLEADOS_FULL}] WHERE id_empleado = @id;
      `);

    const updated = q.recordset?.[0];
    res.json({ ok:true, item: updated });
  } catch (err) {
    console.error('[PUT /api/empleados/:id] Error:', err);
    res.status(500).json({ ok:false, error:'UPDATE_ERROR', message: String(err.message || err) });
  }
}
