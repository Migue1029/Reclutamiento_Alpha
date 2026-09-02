import { Router } from 'express';
import { buscarEmpleadosAvanzado } from '../controllers/busqueda.controller.js';

const router = Router();

// GET /api/busqueda
router.get('/', buscarEmpleadosAvanzado);

export default router;
