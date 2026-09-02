// backend/controllers/index.js
import * as crud from './empleados.crud.js';
import * as gestion from './empleados.gestion.controller.js';

export const listar       = crud.listar;
export const buscar       = crud.buscar;
export const obtenerPorId = crud.obtenerPorId;
export const crear        = crud.crear;
export const actualizar   = crud.actualizar;
export const eliminar     = crud.eliminar;

// extras de la vista "gestión" (si los necesitas en rutas)
export const listarGestion   = gestion.listar;
export const obtenerGestion  = gestion.obtener;
export const eliminarGestion = gestion.eliminar;
