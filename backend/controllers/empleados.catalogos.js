// backend/controllers/empleados.catalogos.js
import sql from 'mssql';

export async function resolveIdByName(pool, { table, idCol, nameCol, value }) {
  if (!value) return null;
  const r = await pool.request()
    .input('v', sql.NVarChar(300), String(value).trim())
    .query(`SELECT TOP 1 ${idCol} AS id FROM dbo.${table} WHERE UPPER(${nameCol}) = UPPER(@v)`);
  return r.recordset?.[0]?.id ?? null;
}

export async function upsertCatalog(pool, { table, idCol, nameCol, value, maxLen = 300 }) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (Number.isInteger(n)) return n;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const found = await resolveIdByName(pool, { table, idCol, nameCol, value: trimmed });
  if (found) return found;

  // ✅ INSERT sin OUTPUT
  await pool.request()
    .input('name', sql.NVarChar(maxLen), trimmed)
    .query(`INSERT INTO dbo.${table} (${nameCol}) VALUES (@name)`);
  
  // ✅ Obtener ID con consulta separada
  const getId = await pool.request()
    .input('name', sql.NVarChar(maxLen), trimmed)
    .query(`SELECT TOP 1 ${idCol} AS id FROM dbo.${table} WHERE ${nameCol} = @name ORDER BY ${idCol} DESC`);
  
  return getId.recordset?.[0]?.id ?? null;
}

export async function resolveOrDefaultTipoContrato(pool, value) {
  const found = await upsertCatalog(pool, {
    table: 'TipoContrato', idCol: 'id_tipo_contrato', nameCol: 'descripcion', value, maxLen: 120
  });
  if (found) return found;
  const r = await pool.request().query(`SELECT TOP 1 id_tipo_contrato AS id FROM dbo.TipoContrato ORDER BY id_tipo_contrato`);
  return r.recordset?.[0]?.id ?? null;
}

export async function upsertSalario(pool, monto, descripcion = null) {
  if (monto == null) return null;
  const reqSel = pool.request().input('m', sql.Decimal(18, 2), Number(monto));
  if (descripcion) reqSel.input('d', sql.NVarChar(100), descripcion);
  const whereDesc = descripcion ? ' AND UPPER(descripcion)=UPPER(@d)' : '';
  const s = await reqSel.query(`SELECT TOP 1 id_salario AS id FROM dbo.Salario WHERE monto = @m${whereDesc}`);
  if (s.recordset?.[0]?.id) return s.recordset[0].id;

  // ✅ INSERT sin OUTPUT
  await pool.request()
    .input('m', sql.Decimal(18, 2), Number(monto))
    .input('d', sql.NVarChar(100), descripcion || 'SALARIO')
    .query(`INSERT INTO dbo.Salario(descripcion, monto) VALUES(@d, @m)`);
  
  // ✅ Obtener ID con consulta separada
  const getId = await pool.request()
    .input('m', sql.Decimal(18, 2), Number(monto))
    .query(`SELECT TOP 1 id_salario AS id FROM dbo.Salario WHERE monto = @m ORDER BY id_salario DESC`);
  
  return getId.recordset?.[0]?.id ?? null;
}

async function findPuestoIdByNameAndArea(pool, nombre, id_area) {
  if (!nombre || !id_area) return null;
  const r = await pool.request()
    .input('n', sql.NVarChar(120), String(nombre).trim())
    .input('a', sql.Int, id_area)
    .query(`
      SELECT TOP 1 id_puesto AS id
      FROM dbo.Puesto
      WHERE id_area = @a AND UPPER(nombre_puesto) = UPPER(@n)
    `);
  return r.recordset?.[0]?.id ?? null;
}

export async function upsertPuesto(pool, value, id_area) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (Number.isInteger(n)) return n;
  if (!id_area) return null;

  const nombre = String(value).trim();
  if (!nombre) return null;

  const found = await findPuestoIdByNameAndArea(pool, nombre, id_area);
  if (found) return found;

  // ✅ INSERT sin OUTPUT
  await pool.request()
    .input('a', sql.Int, id_area)
    .input('n', sql.NVarChar(120), nombre)
    .query(`INSERT INTO dbo.Puesto (id_area, nombre_puesto) VALUES (@a, @n)`);
  
  // ✅ Obtener ID con consulta separada
  const getId = await pool.request()
    .input('a', sql.Int, id_area)
    .input('n', sql.NVarChar(120), nombre)
    .query(`SELECT TOP 1 id_puesto AS id FROM dbo.Puesto WHERE id_area = @a AND nombre_puesto = @n ORDER BY id_puesto DESC`);
  
  return getId.recordset?.[0]?.id ?? null;
}