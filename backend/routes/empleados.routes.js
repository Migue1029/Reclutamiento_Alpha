// backend/routes/empleados.routes.js (ESM)
import { Router } from 'express';

// Controlador base (CRUD + buscar + listar simple)
import * as baseCtrl from '../controllers/empleados.crud.js';

// Controlador de gestión (lista enriquecida, ya probada en /gestion.html)
import * as gestionCtrl from '../controllers/empleados.gestion.controller.js';

// === Agregar import ===
import { obtenerEmpleadoDetalleFull } from '../controllers/empleados.controller.js';


const router = Router();

// ---- Helper: validar id numérico
const withValidId = (handler) => (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ ok: false, error: 'id inválido' });
  }
  return handler(req, res, next);
};

// ===================== RUTAS =====================

// GET /api/empleados
router.get('/', (req, res) => {
  const q = (req.query?.query ?? req.query?.q ?? '').toString().trim();

  // Autocompletado del formulario (search-box)
  if (q) {
    return baseCtrl.buscar(req, res);
  }

  // Vista "gestión" (lista robusta que ya tienes funcionando)
  const view = String(req.query.view || '').toLowerCase();
  if (view === 'gestion') {
    return gestionCtrl.listar(req, res);
  }

  // Por defecto usa la lista robusta (mejor cobertura de datos)
  return gestionCtrl.listar(req, res);
});

// === Agregar ruta ANTES de rutas que capturan /:id genéricas ===
router.get('/:id/detalle', obtenerEmpleadoDetalleFull);

// GET /api/empleados/:id
router.get('/:id', withValidId(baseCtrl.obtenerPorId));

// POST /api/empleados
router.post('/', baseCtrl.crear);

// PUT /api/empleados/:id
router.put('/:id', withValidId(baseCtrl.actualizar));

// DELETE /api/empleados/:id
router.delete('/:id', withValidId(baseCtrl.eliminar));

export default router;
