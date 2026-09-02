// frontend/js/gestion-filtros.js
(() => {
  console.log('[gestion-filtros] cargado');

  // ====== Elementos de la UI que ya tienes en gestion.html ======
  const inputQ   = document.querySelector('#txtBuscar');          // barra general
  const btnPrev  = document.querySelector('#btnPrev');
  const btnNext  = document.querySelector('#btnNext');
  const infoCnt  = document.querySelector('#infoCantidad');
  const tbody    = document.querySelector('#tablaEmpleados tbody');

  // Tamaño de página: usa el que muestras "Mostrando 1–50"
  const PAGE_SIZE_DEFAULT = 50;

  // ====== Estado local para la búsqueda con filtros ======
  const state = {
    page: 1,
    pageSize: PAGE_SIZE_DEFAULT,
    lastParams: null,   // se llena cuando aplicas filtros
    total: 0
  };

  // ====== Util: construye querystring ignorando vacíos ======
  function buildQS(params) {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k,v]) => {
      if (v === undefined || v === null) return;
      const s = String(v).trim();
      if (s !== '') usp.set(k, s);
    });
    return usp.toString();
  }

  // ====== Render de filas en la tabla ======
  function renderRows(items = []) {
    if (!tbody) return;
    if (!Array.isArray(items)) items = [];

    tbody.innerHTML = items.map(r => `
      <tr data-id="${r.id_empleado ?? ''}">
        <td>${r.num_trabajador ?? ''}</td>
        <td>${r.nombre_completo ?? ''}</td>
        <td>${r.puesto ?? ''}</td>
        <td>${r.area ?? ''}</td>
        <td>${r.correo ?? ''}</td>
        <td>${r.num_credencial ?? ''}</td>
        <td>${r.fecha_ingreso ?? ''}</td>
        <td class="actions col-acciones">
          <div class="acciones-stack">
            <button class="btn btn-outline btn-small btn-ver-detalle"
                    data-action="toggle-detail" data-id="${r.id_empleado ?? ''}">
              Ver detalle
            </button>
            <button class="btn btn-secondary btn-small btn-editar"
                    data-action="edit" data-id="${r.id_empleado ?? ''}">
              Editar
            </button>
            <button class="btn btn-danger btn-small btn-eliminar"
                    data-action="delete" data-id="${r.id_empleado ?? ''}">
              Eliminar
            </button>
          </div>
        </td>
      </tr>
      <tr class="row-detail hidden" data-detail-for="${r.id_empleado ?? ''}">
        <td colspan="8">
          <div class="detail">
            <div class="detail-panel hidden">
              <!-- contenido se rellena al hacer click en "Ver detalle" -->
            </div>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // ====== Actualiza el texto "Mostrando X–Y de Z" ======
  function renderInfo(total, page, pageSize) {
    if (!infoCnt) return;
    const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const end   = Math.min(total, page * pageSize);
    infoCnt.textContent = `Mostrando ${start}–${end} de ${total}`;
  }

  // ====== Habilita/Deshabilita botones de paginación ======
  function updatePager(total, page, pageSize) {
    const maxPage = Math.max(1, Math.ceil((total || 0) / pageSize));
    if (btnPrev) btnPrev.disabled = (page <= 1);
    if (btnNext) btnNext.disabled = (page >= maxPage);
  }

  // ====== Llamada al backend con filtros + q ======
  async function buscarConFiltros(params) {
    const qs = buildQS(params);
    const url = `/api/busqueda?${qs}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Error ${res.status} en /api/busqueda`);
    return res.json(); // { total, page, pageSize, items }
  }

  // ====== Ejecuta la búsqueda y pinta ======
  async function doSearch() {
    try {
      // Si no hay filtros aplicados, no hacemos nada (dejas gestion.js manejar lo normal)
      if (!state.lastParams) return;

      const params = {
        ...state.lastParams,
        page: state.page,
        pageSize: state.pageSize,
        orderBy: 'num_trabajador',
        orderDir: 'ASC'
      };

      const data = await buscarConFiltros(params);
      state.total = data.total || 0;

      renderRows(data.items || []);
      renderInfo(state.total, state.page, state.pageSize);
      updatePager(state.total, state.page, state.pageSize);
    } catch (err) {
      console.error('[gestion-filtros] doSearch error', err);
      // opcional: mostrar toast/alert
    }
  }

  // ====== Escucha el evento que emite filtros-ml.js ======
  window.addEventListener('filtros-aplicados', (ev) => {
    const detail = ev.detail || {};

    // Mezcla con la barra general (inputQ) si trae texto
    const q = inputQ?.value?.trim();
    const merged = { ...detail };
    if (q) merged.q = q;

    // Guardar como "últimos filtros aplicados" y buscar desde página 1
    state.page = 1;
    state.pageSize = PAGE_SIZE_DEFAULT;
    state.lastParams = merged;

    doSearch();
  });

  // ====== Paginación (usa los botones existentes) ======
  btnPrev?.addEventListener('click', () => {
    if (!state.lastParams) return; // si no hay filtros activos, que operen tus handlers actuales
    if (state.page > 1) {
      state.page -= 1;
      doSearch();
    }
  });

  btnNext?.addEventListener('click', () => {
    if (!state.lastParams) return;
    const maxPage = Math.max(1, Math.ceil((state.total || 0) / state.pageSize));
    if (state.page < maxPage) {
      state.page += 1;
      doSearch();
    }
  });

  // ====== Enter en la barra general con filtros activos ======
  inputQ?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && state.lastParams) {
      const q = inputQ.value.trim();
      state.lastParams = { ...state.lastParams, ...(q ? { q } : {}) };
      state.page = 1;
      doSearch();
    }
  });

  // ====== Delegación de eventos para Detalle / Editar / Eliminar (cuando hay filtros) ======
  tbody?.addEventListener('click', async (ev) => {
    if (!state.lastParams) return; // sólo gestionamos nosotros cuando hay filtros activos

    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if (!id) return;

if (action === 'toggle-detail') {
  const rowDetail = tbody.querySelector(`tr.row-detail[data-detail-for="${id}"]`);
  const panel = rowDetail?.querySelector('.detail-panel');
  if (!rowDetail || !panel) return;

  if (!panel.classList.contains('hidden')) {
    panel.classList.add('hidden');
    rowDetail.classList.add('hidden');
    btn.textContent = 'Ver detalle';
    return;
  }

  // 1) Traer detalle FULL del backend
  let det = null;
  try {
    const resp = await fetch(`/api/empleados/${id}/detalle`);
    if (resp.ok) det = await resp.json();
  } catch (_) { /* ignore */ }

  // 2) Fallback mínimo si algo viniera null
  det = det || {};
  const safe = (v) => (v ?? '—');

  // 3) Renderizar igual que la vista normal (secciones)
  panel.innerHTML = `
    <button class="btn btn-outline btn-small" data-action="toggle-detail" data-id="${id}">Ocultar detalle</button>

    <div class="detail-grid" style="margin-top:12px">
      <div>
        <h4>Básicos</h4>
        <div><strong>Sexo:</strong> ${safe(det.sexo)}</div>
        <div><strong>Fecha nacimiento:</strong> ${safe(det.fecha_nacimiento)}</div>
      </div>

      <div>
        <h4>Domicilio</h4>
        <div><strong>Calle y número:</strong> ${safe(det.calle_numero)}</div>
        <div><strong>Colonia:</strong> ${safe(det.colonia)}</div>
        <div><strong>Municipio:</strong> ${safe(det.municipio)}</div>
        <div><strong>Estado:</strong> ${safe(det.estado)}</div>
        <div><strong>C.P.:</strong> ${safe(det.codigo_postal)}</div>
      </div>

      <div>
        <h4>Contacto</h4>
        <div><strong>Teléfono:</strong> ${safe(det.telefono)}</div>
        <div><strong>Correo:</strong> ${safe(det.correo_electronico)}</div>
      </div>

      <div>
        <h4>Fiscales</h4>
        <div><strong>Estado civil:</strong> ${safe(det.estado_civil)}</div>
        <div><strong>Escolaridad:</strong> ${safe(det.escolaridad)}</div>
        <div><strong>CURP:</strong> ${safe(det.curp)}</div>
        <div><strong>RFC:</strong> ${safe(det.rfc)}</div>
        <div><strong>NSS:</strong> ${safe(det.nss)}</div>
      </div>

      <div>
        <h4>Laborales</h4>
        <div><strong>Área:</strong> ${safe(det.area)}</div>
        <div><strong>Puesto:</strong> ${safe(det.puesto)}</div>
        <div><strong>Jefe inmediato:</strong> ${safe(det.jefe)}</div>
        <div><strong>Tipo de nómina:</strong> ${safe(det.tipo_nomina)}</div>
        <div><strong>Salario (monto):</strong> ${safe(det.salario)}</div>
        <div><strong>Fecha ingreso:</strong> ${safe(det.fecha_ingreso)}</div>
        <div><strong>Credencial:</strong> ${safe(det.num_credencial)}</div>
      </div>

      <div>
        <h4>Beneficiario</h4>
        <div><strong>Nombre:</strong> ${safe(det.benef_nombre)}</div>
        <div><strong>Parentesco:</strong> ${safe(det.benef_parentesco)}</div>
        <div><strong>Teléfono:</strong> ${safe(det.benef_telefono)}</div>
      </div>
    </div>
  `;

  panel.classList.remove('hidden');
  rowDetail.classList.remove('hidden');
  btn.textContent = 'Ocultar detalle';
  return;
    }

    // Editar
    if (action === 'edit') {
      // Si tu app expone una función global, úsala
      if (typeof window.handleEditarEmpleado === 'function') {
        window.handleEditarEmpleado(id);
      } else {
        // Fallback: redirige al form con el id
        window.location.href = `index.html?id=${encodeURIComponent(id)}#edit`;
      }
      return;
    }

    // Eliminar
    if (action === 'delete') {
      if (!confirm('¿Eliminar este empleado? Esta acción no se puede deshacer.')) return;
      try {
        if (typeof window.handleEliminarEmpleado === 'function') {
          await window.handleEliminarEmpleado(id);
        } else {
          const res = await fetch(`/api/empleados/${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Error al eliminar');
        }
        // refrescar tabla con los mismos filtros
        doSearch();
      } catch (e) {
        console.error('Eliminar error', e);
        alert('No se pudo eliminar el empleado.');
      }
      return;
    }
  });
})();
