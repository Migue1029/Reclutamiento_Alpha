// backend/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// ===== Importar rutas =====
import empleadosRouter from './routes/empleados.routes.js';
import contratosRouter from './routes/contratos.js';
import documentosRouter from './routes/documentos.js';
import evaluacionesRouter from './routes/evaluaciones.routes.js';
import busquedaRoutes from './routes/busqueda.routes.js';

// ===== Configuración de __dirname =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== Inicializar Express =====
const app = express();
const PORT = process.env.PORT || process.env.APP_PORT || 3001;

// Log de entorno (sanitizado)
console.log('[ENV]', {
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_INSTANCE: process.env.DB_INSTANCE
});

// ===== Middlewares =====
app.use(cors());
app.use(express.json());

// ===== API Routes (montar ANTES de fallback/404) =====
app.use('/api/empleados', empleadosRouter);
app.use('/api/contratos', contratosRouter);
app.use('/api/documentos', documentosRouter);
app.use('/api/evaluaciones', evaluacionesRouter);
app.use('/api/busqueda', busquedaRoutes); // ✅ movido aquí (ya existe app)

// ===== Health Check =====
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ===== Servir frontend =====
const frontendDir = path.join(__dirname, '../frontend');
app.use(express.static(frontendDir));

// ===== Fallback SPA (solo para GET que no sean /api/*) =====
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// ===== 404 para rutas desconocidas =====
app.use((req, res) => {
  console.warn(`Ruta no encontrada: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ===== Error global =====
app.use((err, _req, res, _next) => {
  console.error('[ERROR GLOBAL]', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ===== Iniciar servidor =====
app.listen(PORT, () => {
  console.log(`✅ API escuchando en http://localhost:${PORT}`);
  console.log(`📂 Frontend servido desde: ${frontendDir}`);
  console.log(`📋 Templates en: ${path.join(__dirname, 'templates')}`);
  console.log(`📅 Sistema de evaluaciones: ACTIVO`);
});
