// Conexión MSSQL con pool único (ESM)
import mssql from 'mssql';

export const dbConfig = {
  server: process.env.DB_HOST || process.env.DB_SERVER || 'BATICOMPUTADORA',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME || 'ReclutamientoAlpha',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '300339',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 15000,
    requestTimeout: 15000,
    enableArithAbort: true
  }
};

let pool;
export async function getPool() {
  if (pool) return pool;
  pool = await mssql.connect(dbConfig);
  return pool;
}

export const sql = mssql;
