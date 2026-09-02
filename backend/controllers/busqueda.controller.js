import { sql, getPool } from '../db/pool.js';

// Campos que soporta el texto libre `q`
const Q_FIELDS = [
  'e.num_trabajador',
  'e.nombre_completo',
  'e.curp',
  'e.rfc',
  'e.nss',
  'e.correo_electronico',
  'r.municipio',
  'r.estado',
  'r.colonia',
  'r.id_area',
  'r.id_puesto',
  'r.id_jefe',
  'r.tipo_nomina'
];

// Orden permitidos para evitar SQL injection
const ORDER_WHITE_LIST = new Set([
  'num_trabajador','nombre_completo','fecha_ingreso','area','puesto','jefe','tipo_nomina','salario'
]);

export async function buscarEmpleadosAvanzado(req, res) {
  try {
    const pool = await getPool();

    // Parámetros
    const {
      q = '',
      municipio,
      curp,
      rfc,
      nss,
      sexo,
      area,
      puesto,
      jefe,
      tipo_nomina,
      edad_min,
      edad_max,
      fecha_ingreso_desde,
      fecha_ingreso_hasta,
      page = 1,
      pageSize = 20,
      orderBy = 'num_trabajador',
      orderDir = 'ASC'
    } = req.query;

    // Sanitizar orden
    const safeOrderBy = ORDER_WHITE_LIST.has(String(orderBy).toLowerCase())
      ? String(orderBy)
      : 'num_trabajador';
    const safeOrderDir = String(orderDir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const p = [];
    const where = [];

    // Base: usamos la vista y el staging para ampliar filtros
    // NOTA: la vista ya hace LEFT JOIN con stg.Raw_Empleados como r (según tu script).
    // Aquí reconstruimos el FROM para tener 'e' y 'r' disponibles de forma explícita:
    const FROM_SQL = `
      FROM dbo.Empleado e
      LEFT JOIN stg.Raw_Empleados r
        ON LTRIM(RTRIM(r.num_trabajador)) = LTRIM(RTRIM(e.num_trabajador))
    `;

    // Texto libre `q` sobre muchas columnas (acentos-insensible)
    if (q && String(q).trim() !== '') {
      const qParam = `%${String(q).trim()}%`;
      const parts = Q_FIELDS.map((f, i) => {
        // Collation insensible a acentos y mayúsculas (ajústalo si tu BD usa otro)
        return `${f} COLLATE Latin1_General_CI_AI LIKE @q`;
      }).join(' OR ');
      where.push(`(${parts})`);
      p.push({ name: 'q', type: sql.NVarChar(200), value: qParam });
    }

    // Filtros específicos (solo agregan condición si vienen)
    const addLike = (col, val, name) => {
      if (val && String(val).trim() !== '') {
        where.push(`${col} COLLATE Latin1_General_CI_AI LIKE @${name}`);
        p.push({ name, type: sql.NVarChar(200), value: `%${String(val).trim()}%` });
      }
    };
    addLike('r.municipio', municipio, 'municipio');
    addLike('e.curp', curp, 'curp');
    addLike('e.rfc', rfc, 'rfc');
    addLike('e.nss', nss, 'nss');
    addLike('e.correo_electronico', req.query.correo, 'correo');
    addLike('r.id_area', area, 'area');
    addLike('r.id_puesto', puesto, 'puesto');
    addLike('r.id_jefe', jefe, 'jefe');
    addLike('r.tipo_nomina', tipo_nomina, 'tipo_nomina');

// --- Reemplazar bloque de 'sexo' ---
if (sexo && String(sexo).trim() !== '') {
  // Puede venir "F", "M", "Femenino", "Masculino", o múltiples: "F,M"
  const items = String(sexo)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  // Normalizamos a primera letra (M/F), upper-case
  const primeras = [...new Set(items.map(s => (s[0] || '').toUpperCase()))]
    .filter(ch => ch === 'M' || ch === 'F');

  if (primeras.length === 1) {
    where.push(`LEFT(UPPER(e.sexo),1) = @sx0`);
    p.push({ name: 'sx0', type: sql.NVarChar(1), value: primeras[0] });
  } else if (primeras.length > 1) {
    const ph = primeras.map((_, i) => `@sx${i}`).join(',');
    where.push(`LEFT(UPPER(e.sexo),1) IN (${ph})`);
    primeras.forEach((v, i) => p.push({ name: `sx${i}`, type: sql.NVarChar(1), value: v }));
  }
}


    // Edad (calculada a partir de fecha_nacimiento)
    if (edad_min) {
      where.push(`DATEDIFF(year, e.fecha_nacimiento, GETDATE()) >= @edad_min`);
      p.push({ name: 'edad_min', type: sql.Int, value: Number(edad_min) });
    }
    if (edad_max) {
      where.push(`DATEDIFF(year, e.fecha_nacimiento, GETDATE()) <= @edad_max`);
      p.push({ name: 'edad_max', type: sql.Int, value: Number(edad_max) });
    }

    // Rango de fecha de ingreso
    if (fecha_ingreso_desde) {
      where.push(`COALESCE(e.fecha_ingreso, TRY_CONVERT(date, r.fecha_ingreso)) >= @fi_desde`);
      p.push({ name: 'fi_desde', type: sql.Date, value: fecha_ingreso_desde });
    }
    if (fecha_ingreso_hasta) {
      where.push(`COALESCE(e.fecha_ingreso, TRY_CONVERT(date, r.fecha_ingreso)) <= @fi_hasta`);
      p.push({ name: 'fi_hasta', type: sql.Date, value: fecha_ingreso_hasta });
    }

    // WHERE final
    const WHERE_SQL = where.length ? `WHERE ${where.join('\n  AND ')}` : '';

    // Paginación
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSz  = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 20));
    const offset  = (pageNum - 1) * pageSz;

    // Consulta total
    const COUNT_SQL = `
      SELECT COUNT(*) AS total
      ${FROM_SQL}
      ${WHERE_SQL};
    `;

    // Consulta de items
    const ITEMS_SQL = `
      SELECT
        e.id_empleado,
        e.num_trabajador,
        e.nombre_completo,
        e.sexo,
        e.fecha_nacimiento,
        e.curp, e.rfc, e.nss,
        e.correo_electronico AS correo,
        COALESCE(e.fecha_ingreso, TRY_CONVERT(date, r.fecha_ingreso)) AS fecha_ingreso,
        LTRIM(RTRIM(r.id_area))   AS area,
        LTRIM(RTRIM(r.id_puesto)) AS puesto,
        LTRIM(RTRIM(r.id_jefe))   AS jefe,
        TRY_CONVERT(DECIMAL(12,2), REPLACE(REPLACE(r.salario, ',', ''), '$', '')) AS salario,
        LTRIM(RTRIM(r.tipo_nomina)) AS tipo_nomina,
        -- Edad calculada
        DATEDIFF(year, e.fecha_nacimiento, GETDATE()) AS edad
      ${FROM_SQL}
      ${WHERE_SQL}
      ORDER BY ${safeOrderBy} ${safeOrderDir}
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
    `;

    const reqCount = pool.request();
    p.forEach(x => reqCount.input(x.name, x.type, x.value));
    const { recordset: countRows } = await reqCount.query(COUNT_SQL);
    const total = countRows?.[0]?.total || 0;

    const reqItems = pool.request();
    p.forEach(x => reqItems.input(x.name, x.type, x.value));
    reqItems.input('offset', sql.Int, offset);
    reqItems.input('pageSize', sql.Int, pageSz);
    const { recordset: items } = await reqItems.query(ITEMS_SQL);

    res.json({ total, page: pageNum, pageSize: pageSz, items });
  } catch (err) {
    console.error('[buscarEmpleadosAvanzado] error', err);
    res.status(500).json({ error: 'Error en búsqueda avanzada', detail: String(err) });
  }
}
