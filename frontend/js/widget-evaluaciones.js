// frontend/js/widget-evaluaciones.js - SOLO NOTIFICACIONES

class WidgetEvaluaciones {
  constructor() {
    this.pendientes = [];
    this.intervalo = null;
  }

  async iniciar() {
    this.crearWidget();
    await this.actualizar();
    
    // Actualizar cada 5 minutos
    this.intervalo = setInterval(() => this.actualizar(), 5 * 60 * 1000);
    
    console.log('✅ Widget de evaluaciones iniciado');
  }

  crearWidget() {
    const widget = document.createElement('div');
    widget.id = 'widgetEvaluaciones';
    widget.className = 'widget-evaluaciones';
    widget.innerHTML = `
      <div class="widget-header" id="headerEvaluaciones">
        <span class="widget-titulo">📋 Evaluaciones Pendientes</span>
        <span class="widget-badge" id="badgeEvaluaciones">0</span>
        <button class="widget-toggle" id="toggleEvaluaciones">▼</button>
      </div>
      <div class="widget-contenido" id="contenidoEvaluaciones" style="display: none;">
        <div class="widget-loading">Cargando...</div>
      </div>
    `;
    
    document.body.appendChild(widget);

    // Toggle
    document.getElementById('toggleEvaluaciones').addEventListener('click', () => {
      const contenido = document.getElementById('contenidoEvaluaciones');
      const toggle = document.getElementById('toggleEvaluaciones');
      
      if (contenido.style.display === 'none') {
        contenido.style.display = 'block';
        toggle.textContent = '▲';
      } else {
        contenido.style.display = 'none';
        toggle.textContent = '▼';
      }
    });

    this.inyectarEstilos();
  }

  async actualizar() {
    try {
      const res = await fetch('http://localhost:3001/api/evaluaciones/pendientes?dias=7');
      if (!res.ok) throw new Error('Error al obtener evaluaciones');
      
      const data = await res.json();
      this.pendientes = data.evaluaciones || [];
      
      this.renderizar();
      this.notificarSiUrgente();

    } catch (err) {
      console.error('[Widget] Error:', err);
    }
  }

  renderizar() {
    const badge = document.getElementById('badgeEvaluaciones');
    const contenido = document.getElementById('contenidoEvaluaciones');

    badge.textContent = this.pendientes.length;
    badge.className = 'widget-badge ' + (this.pendientes.length > 0 ? 'badge-activo' : '');

    if (this.pendientes.length === 0) {
      contenido.innerHTML = `
        <div class="widget-vacio">
          <p>✅ No hay evaluaciones pendientes</p>
        </div>
      `;
      return;
    }

    let html = '<div class="widget-lista">';
    
    this.pendientes.forEach(emp => {
      const urgenciaClass = 
        emp.urgencia === 'alta' ? 'urgencia-alta' :
        emp.urgencia === 'media' ? 'urgencia-media' : 'urgencia-baja';

      const urgenciaTexto =
        emp.urgencia === 'alta' ? '🔴 URGENTE' :
        emp.urgencia === 'media' ? '🟡 Próximamente' : '🟢 Programada';

      html += `
        <div class="eval-item ${urgenciaClass}">
          <div class="eval-header">
            <span class="eval-nombre">${emp.nombre_completo}</span>
            <span class="eval-urgencia">${urgenciaTexto}</span>
          </div>
          <div class="eval-info">
            <div><strong>No. Trabajador:</strong> ${emp.num_trabajador}</div>
            <div><strong>Área:</strong> ${emp.area || 'N/A'}</div>
            <div><strong>Puesto:</strong> ${emp.puesto || 'N/A'}</div>
          </div>
          <div class="eval-footer">
            <span class="eval-numero">Evaluación #${emp.evaluacion_numero}</span>
            <span class="eval-dias">${emp.dias_faltantes} día(s)</span>
          </div>
        </div>
      `;
    });

    html += '</div>';
    contenido.innerHTML = html;
  }

  notificarSiUrgente() {
    const urgentes = this.pendientes.filter(e => e.urgencia === 'alta');
    
    if (urgentes.length > 0 && Notification.permission === 'granted') {
      new Notification('⚠️ Evaluaciones Urgentes', {
        body: `${urgentes.length} empleado(s) requieren evaluación en los próximos 3 días`,
        icon: '/imagenes/image001.png'
      });
    }
  }

  inyectarEstilos() {
    const estilos = document.createElement('style');
    estilos.textContent = `
      .widget-evaluaciones {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 380px;
        max-height: 600px;
        background: white;
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.15);
        z-index: 1000;
      }

      .widget-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        background: linear-gradient(135deg, #065f46, #059669);
        color: white;
        cursor: pointer;
        border-radius: 16px 16px 0 0;
      }

      .widget-titulo {
        font-weight: 600;
        font-size: 1rem;
      }

      .widget-badge {
        background: rgba(255,255,255,0.2);
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 0.85rem;
        min-width: 24px;
        text-align: center;
      }

      .widget-badge.badge-activo {
        background: #dc2626;
        animation: pulse 2s infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }

      .widget-toggle {
        background: none;
        border: none;
        color: white;
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0;
        width: 24px;
      }

      .widget-contenido {
        max-height: 500px;
        overflow-y: auto;
      }

      .widget-loading, .widget-vacio {
        padding: 30px;
        text-align: center;
        color: #6b7280;
      }

      .widget-lista {
        padding: 12px;
      }

      .eval-item {
        background: white;
        border: 1px solid #e5e7eb;
        border-left: 4px solid #10b981;
        border-radius: 12px;
        padding: 14px;
        margin-bottom: 12px;
      }

      .eval-item.urgencia-alta {
        border-left-color: #ef4444;
        background: #fef2f2;
      }

      .eval-item.urgencia-media {
        border-left-color: #f59e0b;
        background: #fffbeb;
      }

      .eval-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }

      .eval-nombre {
        font-weight: 600;
        color: #111827;
        font-size: 0.95rem;
      }

      .eval-urgencia {
        font-size: 0.75rem;
        padding: 4px 8px;
        border-radius: 6px;
        background: rgba(0,0,0,0.05);
      }

      .eval-info {
        font-size: 0.85rem;
        color: #6b7280;
        margin-bottom: 10px;
        line-height: 1.6;
      }

      .eval-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.85rem;
        color: #374151;
        padding-top: 8px;
        border-top: 1px solid #e5e7eb;
      }

      .eval-numero {
        font-weight: 600;
      }

      .eval-dias {
        background: #dbeafe;
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 0.8rem;
      }

      @media (max-width: 480px) {
        .widget-evaluaciones {
          width: calc(100% - 40px);
          right: 20px;
          left: 20px;
        }
      }
    `;
    document.head.appendChild(estilos);
  }

  detener() {
    if (this.intervalo) {
      clearInterval(this.intervalo);
    }
  }
}

// ========== AUTO-INICIAR ==========
document.addEventListener('DOMContentLoaded', () => {
  // Pedir permiso para notificaciones
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Iniciar widget
  window.widgetEvaluaciones = new WidgetEvaluaciones();
  window.widgetEvaluaciones.iniciar();
});