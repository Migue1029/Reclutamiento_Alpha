// backend/controllers/empleados.controller.js
import sql from 'mssql';
import { getPool } from '../db/pool.js';
import { mapRow } from '../utils/mapRow.js';

// ==================== Config ====================
const viewName  = process.env.DB_VIEW_EMPLEADOS_FULL;
const tableName = process.env.DB_TABLE_EMPLEADOS || 'Empleado';
const EMP_SOURCE = viewName || tableName;

const searchTop = Number(process.env.DB_SEARCH_TOP || 500);
const listTop   = Number(process.env.DB_LIST_TOP   || 50);

// ==================== Helpers ====================
const toNull = v =>
  (v === undefined || v === null || String(v).trim?.() === '' ? null : v);

function parseDateLoose(v) {
  if (!v) return null;
  try {
    const s = typeof v === 'string' ? v.slice(0, 10).replace(/\//g, '-') : v;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}

function normMoney(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? null : n;
}

// ==================== LISTAR ====================
const ALLOWED_SORT = new Set([
  'num_trabajador','nombre_completo','area','puesto','fecha_ingreso'
]);

const pickSort = s =>
  (ALLOWED_SORT.has(String(s || 'num_trabajador')) ? String(s) : 'num_trabajador');

const pickDir  = d =>
  (String(d || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc');

export async function listar(req, res) {
  try {
    const rawQ    = (req.query?.q ?? req.query?.query ?? '').toString().trim();
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

          COALESCE(v.fecha_ingreso, e.fecha_ingreso) AS fecha_ingreso,
          COALESCE(v.correo_electronico, e.correo_electronico) AS correo_electronico,
          COALESCE(v.num_credencial, e.num_credencial) AS num_credencial,

          COALESCE(con.nombre_area,   v.area,   rw.r_area)         AS area,
          COALESCE(con.nombre_puesto, v.puesto, rw.r_puesto)       AS puesto,
          COALESCE(con.nombre_jefe,   v.jefe_inmediato, rw.r_jefe) AS jefe_inmediato,
          COALESCE(con.tipo_nomina,   v.tipo_nomina, rw.r_tipo)    AS tipo_nomina,
          COALESCE(con.salario_monto, rw.r_sal)                    AS salario,


          -- 🔥 SALARIO priorizado correctamente
          COALESCE(
            con.salario_monto,
            rw.r_sal
          ) AS salario,

          bene.nombre     AS benef_nombre,
          bene.parentesco AS benef_parentesco,
          bene.telefono   AS benef_telefono,
          bene.correo     AS benef_correo,

          COUNT(*) OVER() AS total_count
        FROM dbo.${EMP_SOURCE} AS v
        LEFT JOIN dbo.${tableName} AS e
               ON e.id_empleado = v.id_empleado

        OUTER APPLY (
          SELECT TOP 1
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
          ORDER BY c.id_contrato DESC
        ) con

        OUTER APPLY (
          SELECT TOP 1
            LTRIM(RTRIM(r.id_area)) AS r_area,
            LTRIM(RTRIM(r.id_puesto)) AS r_puesto,
            LTRIM(RTRIM(r.id_jefe)) AS r_jefe,
            LTRIM(RTRIM(r.tipo_nomina)) AS r_tipo,
            TRY_CONVERT(DECIMAL(10,2),
              REPLACE(REPLACE(r.salario, ',', ''), '$', '')
            ) AS r_sal
          FROM stg.Raw_Empleados r
          WHERE LTRIM(RTRIM(r.num_trabajador)) = LTRIM(RTRIM(v.num_trabajador))
        ) rw

        OUTER APPLY (
          SELECT TOP 1 b.*
          FROM dbo.Beneficiario b
          WHERE b.id_empleado = v.id_empleado
          ORDER BY b.id_beneficiario DESC
        ) bene

        WHERE (
          @q IS NULL OR @q = '' OR
          UPPER(v.nombre_completo) LIKE UPPER('%'+@q+'%') OR
          UPPER(v.num_trabajador) LIKE UPPER('%'+@q+'%') OR
          UPPER(v.curp) LIKE UPPER('%'+@q+'%') OR
          UPPER(v.rfc) LIKE UPPER('%'+@q+'%') OR
          UPPER(v.nss) LIKE UPPER('%'+@q+'%') OR
          UPPER(v.correo_electronico) LIKE UPPER('%'+@q+'%')
        )
      )
      SELECT *
      FROM src
      ORDER BY num_trabajador ASC
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

// ================== BUSCAR ====================
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
      (e.correo          || '').toLowerCase().includes(qn)
    );

    return res.json(filtered.slice(0, listTop));

  } catch (e) {
    console.error('[empleados.buscar] error:', e);
    res.status(500).json({ error: e.message });
  }
}

// ================== DETALLE FULL ====================
export async function obtenerEmpleadoDetalleFull(req, res) {
  try {
    const { id } = req.params;
    const pool = await getPool();

    const q = `
      SELECT TOP 1
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
        e.correo_electronico,
        e.fecha_ingreso,

        LTRIM(RTRIM(r.id_area)) AS area,
        LTRIM(RTRIM(r.id_puesto)) AS puesto,
        LTRIM(RTRIM(r.id_jefe)) AS jefe,
        TRY_CONVERT(DECIMAL(10,2),
          REPLACE(REPLACE(r.salario, ',', ''), '$', '')
        ) AS salario,
        LTRIM(RTRIM(r.tipo_nomina)) AS tipo_nomina,

        e.num_credencial,

        r.benef_nombre,
        r.benef_parentesco,
        r.benef_telefono
      FROM dbo.Empleado e
      LEFT JOIN stg.Raw_Empleados r
        ON LTRIM(RTRIM(r.num_trabajador)) = LTRIM(RTRIM(e.num_trabajador))
      WHERE e.id_empleado = @id;
    `;

    const { recordset } = await pool.request()
      .input('id', sql.Int, Number(id))
      .query(q);

    res.json(recordset[0] || null);

  } catch (err) {
    console.error('[obtenerEmpleadoDetalleFull] error', err);
    res.status(500).json({ error: 'No se pudo obtener detalle del empleado' });
  }
}

// ================== CRUD ====================
export { obtenerPorId, crear, actualizar, eliminar } from './empleados.crud.js';
