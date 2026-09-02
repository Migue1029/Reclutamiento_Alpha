// backend/routes/evaluaciones.routes.js
import { Router } from 'express';
import { getPool } from '../db/pool.js';
import sql from 'mssql';

const router = Router();

/**
 * Obtener empleados con evaluaciones pendientes
 * GET /api/evaluaciones/pendientes
 */
router.get('/pendientes', async (req, res) => {
  try {
    const diasAnticipacion = Number(req.query.dias || 7); // 7 días por defecto
    const pool = await getPool();

    const query = `
      SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

      WITH EvaluacionesProgramadas AS (
        SELECT 
          e.id_empleado,
          e.num_trabajador,
          e.nombre_completo,
          e.fecha_ingreso,
          c.id_area,
          a.nombre_area AS area,
          c.id_puesto,
          p.nombre_puesto AS puesto,
          
          -- Calcular fechas de evaluación (30, 60, 90 días)
          DATEADD(DAY, 30, e.fecha_ingreso) AS evaluacion_1,
          DATEADD(DAY, 60, e.fecha_ingreso) AS evaluacion_2,
          DATEADD(DAY, 90, e.fecha_ingreso) AS evaluacion_3,
          
          -- Días transcurridos desde ingreso
          DATEDIFF(DAY, e.fecha_ingreso, GETDATE()) AS dias_desde_ingreso,
          
          -- Determinar qué evaluación toca
          CASE 
            WHEN DATEDIFF(DAY, e.fecha_ingreso, GETDATE()) < 30 THEN 1
            WHEN DATEDIFF(DAY, e.fecha_ingreso, GETDATE()) < 60 THEN 2
            WHEN DATEDIFF(DAY, e.fecha_ingreso, GETDATE()) < 90 THEN 3
            ELSE NULL
          END AS evaluacion_numero,
          
          -- Fecha de la próxima evaluación
          CASE 
            WHEN DATEDIFF(DAY, e.fecha_ingreso, GETDATE()) < 30 
              THEN DATEADD(DAY, 30, e.fecha_ingreso)
            WHEN DATEDIFF(DAY, e.fecha_ingreso, GETDATE()) < 60 
              THEN DATEADD(DAY, 60, e.fecha_ingreso)
            WHEN DATEDIFF(DAY, e.fecha_ingreso, GETDATE()) < 90 
              THEN DATEADD(DAY, 90, e.fecha_ingreso)
            ELSE NULL
          END AS fecha_proxima_evaluacion,
          
          -- Días faltantes para la próxima evaluación
          CASE 
            WHEN DATEDIFF(DAY, e.fecha_ingreso, GETDATE()) < 30 
              THEN DATEDIFF(DAY, GETDATE(), DATEADD(DAY, 30, e.fecha_ingreso))
            WHEN DATEDIFF(DAY, e.fecha_ingreso, GETDATE()) < 60 
              THEN DATEDIFF(DAY, GETDATE(), DATEADD(DAY, 60, e.fecha_ingreso))
            WHEN DATEDIFF(DAY, e.fecha_ingreso, GETDATE()) < 90 
              THEN DATEDIFF(DAY, GETDATE(), DATEADD(DAY, 90, e.fecha_ingreso))
            ELSE NULL
          END AS dias_faltantes

        FROM dbo.Empleado e
        LEFT JOIN dbo.Contrato c ON c.id_empleado = e.id_empleado AND c.fecha_fin IS NULL
        LEFT JOIN dbo.Area a ON a.id_area = c.id_area
        LEFT JOIN dbo.Puesto p ON p.id_puesto = c.id_puesto
        
        WHERE e.fecha_ingreso IS NOT NULL
          AND DATEDIFF(DAY, e.fecha_ingreso, GETDATE()) < 90  -- Solo primeros 90 días
      )
      SELECT *
      FROM EvaluacionesProgramadas
      WHERE dias_faltantes IS NOT NULL
        AND dias_faltantes <= @diasAnticipacion
        AND dias_faltantes >= 0
      ORDER BY dias_faltantes ASC, fecha_proxima_evaluacion ASC;
    `;

    const result = await pool.request()
      .input('diasAnticipacion', sql.Int, diasAnticipacion)
      .query(query);

    const pendientes = result.recordset.map(emp => ({
      id_empleado: emp.id_empleado,
      num_trabajador: emp.num_trabajador,
      nombre_completo: emp.nombre_completo,
      area: emp.area,
      puesto: emp.puesto,
      fecha_ingreso: emp.fecha_ingreso,
      evaluacion_numero: emp.evaluacion_numero,
      fecha_evaluacion: emp.fecha_proxima_evaluacion,
      dias_faltantes: emp.dias_faltantes,
      urgencia: emp.dias_faltantes <= 3 ? 'alta' : emp.dias_faltantes <= 7 ? 'media' : 'baja'
    }));

    res.json({
      ok: true,
      total: pendientes.length,
      dias_anticipacion: diasAnticipacion,
      evaluaciones: pendientes
    });

  } catch (err) {
    console.error('[Evaluaciones Pendientes] Error:', err);
    res.status(500).json({ 
      ok: false, 
      error: 'Error obteniendo evaluaciones pendientes',
      details: err.message 
    });
  }
});

/**
 * Obtener historial de evaluaciones de un empleado
 * GET /api/evaluaciones/empleado/:id
 */
router.get('/empleado/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();

    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          e.num_trabajador,
          e.nombre_completo,
          e.fecha_ingreso,
          DATEDIFF(DAY, e.fecha_ingreso, GETDATE()) AS dias_desde_ingreso,
          
          -- Evaluación 1 (30 días)
          DATEADD(DAY, 30, e.fecha_ingreso) AS eval1_fecha,
          CASE WHEN DATEDIFF(DAY, e.fecha_ingreso, GETDATE()) >= 30 THEN 'Vencida' ELSE 'Pendiente' END AS eval1_estado,
          
          -- Evaluación 2 (60 días)
          DATEADD(DAY, 60, e.fecha_ingreso) AS eval2_fecha,
          CASE WHEN DATEDIFF(DAY, e.fecha_ingreso, GETDATE()) >= 60 THEN 'Vencida' ELSE 'Pendiente' END AS eval2_estado,
          
          -- Evaluación 3 (90 días)
          DATEADD(DAY, 90, e.fecha_ingreso) AS eval3_fecha,
          CASE WHEN DATEDIFF(DAY, e.fecha_ingreso, GETDATE()) >= 90 THEN 'Vencida' ELSE 'Pendiente' END AS eval3_estado
          
        FROM dbo.Empleado e
        WHERE e.id_empleado = @id;
      `);

    if (!result.recordset.length) {
      return res.status(404).json({ ok: false, error: 'Empleado no encontrado' });
    }

    res.json({ ok: true, empleado: result.recordset[0] });

  } catch (err) {
    console.error('[Evaluaciones Empleado] Error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * Obtener estadísticas de evaluaciones
 * GET /api/evaluaciones/estadisticas
 */
router.get('/estadisticas', async (req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

      SELECT 
        COUNT(*) AS total_empleados_nuevos,
        SUM(CASE WHEN DATEDIFF(DAY, fecha_ingreso, GETDATE()) < 30 THEN 1 ELSE 0 END) AS pendientes_eval1,
        SUM(CASE WHEN DATEDIFF(DAY, fecha_ingreso, GETDATE()) BETWEEN 30 AND 59 THEN 1 ELSE 0 END) AS pendientes_eval2,
        SUM(CASE WHEN DATEDIFF(DAY, fecha_ingreso, GETDATE()) BETWEEN 60 AND 89 THEN 1 ELSE 0 END) AS pendientes_eval3,
        SUM(CASE WHEN DATEDIFF(DAY, fecha_ingreso, GETDATE()) >= 90 THEN 1 ELSE 0 END) AS completados
      FROM dbo.Empleado
      WHERE fecha_ingreso IS NOT NULL
        AND DATEDIFF(DAY, fecha_ingreso, GETDATE()) <= 120; -- Últimos 120 días
    `);

    res.json({ ok: true, estadisticas: result.recordset[0] });

  } catch (err) {
    console.error('[Evaluaciones Estadísticas] Error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;