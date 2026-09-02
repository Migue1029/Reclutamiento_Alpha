// frontend/js/gestion.js
(() => {
  const API = '/api/empleados';
  const q = (sel, el=document) => el.querySelector(sel);
  const qq = (sel, el=document) => Array.from(el.querySelectorAll(sel));

  let state = {
    page: 1,
    pageSize: 50,
    total: 0,
    q: '',
    sort: 'num_trabajador',
    dir: 'asc',
    items: []
  };

  const txtBuscar    = q('#txtBuscar');
  const btnBuscar    = q('#btnBuscar');
  // const btnNuevo  = q('#btnNuevo'); // <- eliminado: ya no lo usamos
  const tbody        = q('#tablaEmpleados tbody');
  const infoCantidad = q('#infoCantidad');
  const btnPrev      = q('#btnPrev');
  const btnNext      = q('#btnNext');

  // Debounce
  let t;
  const debounce = (fn, ms=300) => (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };

  // Helpers
  const fmtDate = (s) => {
    if (!s) return '—';
    const d = new Date(s);
    if (isNaN(d.getTime())) return String(s);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const fmtNull = v => (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) ? '—' : v;
  const fmtMoney = v => (v==null || isNaN(Number(v))) ? '—' : Number(v).toFixed(2);

  // Toma el primer valor definido/no vacío entre varios alias
  const first = (obj, ...names) => {
    for (const n of names) {
      const v = obj?.[n];
      if (v !== undefined && v !== null && (typeof v !== 'string' || v.trim() !== '')) return v;
    }
    return null;
  };

  // Mapeo de campos para el resumen de la fila
  const pickResumen = (it) => {
    const correo = first(it, 'correo_electronico','correo','email','mail');
    const fechaIngreso = first(it, 'fecha_ingreso','ingreso','fecha_inicio','fecha_alta');
    return { correo, fechaIngreso };
  };

  // Mapeo de campos para el detalle expandible
  const pickDetalle = (it) => ({
    correo:       first(it, 'correo_electronico','correo','email','mail'),
    jefe:         first(it, 'jefe_inmediato','jefe','supervisor'),
    tipoNomina:   first(it, 'tipo_nomina','nomina','tipoNomina'),
    salarioMonto: first(it, 'salario','salario_monto','sueldo'),
    fechaIngreso: first(it, 'fecha_ingreso','ingreso','fecha_inicio','fecha_alta'),
    credencial:   first(it, 'num_credencial','credencial','credencial_num','numCredencial'),
    benefNombre:  first(it, 'beneficiario','benef_nombre','nombre_beneficiario','benef_nombre_completo'),
    benefParen:   first(it, 'parentesco','benef_parentesco','parentesco_beneficiario'),
    benefTel:     first(it, 'benef_telefono','telefono_beneficiario','benef_tel','telefono_benef')
  });

  // === SIEMPRE forzamos view=gestion ===
  async function fetchList() {
    const params = new URLSearchParams({
      page:     String(state.page),
      pageSize: String(state.pageSize),
      sort:     state.sort || 'num_trabajador',
      dir:      state.dir  || 'asc',
      view:     'gestion'
    });
    if ((state.q || '').trim()) params.set('q', state.q.trim());

    const url = `${API}?${params.toString()}`;

    let r;
    try {
      r = await fetch(url);
    } catch (e) {
      console.error('fetchList network error:', e);
      alert('No se pudo conectar con el servidor.');
      return;
    }

    let data = null;
    try { data = await r.json(); } catch {}

    if (!r.ok) {
      console.error('fetchList HTTP error:', r.status, data);
      alert(`Error cargando empleados (HTTP ${r.status})`);
      return;
    }

    // Acepta ambos formatos ({ok:true,...} o array)
    if (Array.isArray(data)) {
      state.total = data.length;
      state.items = data.slice(0, state.pageSize);
    } else if (data && data.ok === true && Array.isArray(data.items)) {
      state.total    = Number(data.total || 0);
      state.items    = data.items;
      state.page     = Number(data.page || state.page);
      state.pageSize = Number(data.pageSize || state.pageSize);
    } else {
      console.error('Respuesta API inesperada:', data);
      alert('Respuesta inesperada del servidor.');
      return;
    }

    render();
  }

  function render() {
    tbody.innerHTML = '';

    for (const it of state.items) {
      const { correo, fechaIngreso } = pickResumen(it);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fmtNull(it.num_trabajador)}</td>
        <td>${fmtNull(it.nombre_completo)}</td>
        <td>${fmtNull(it.puesto)}</td>
        <td>${fmtNull(it.area)}</td>
        <td>${fmtNull(correo)}</td>
        <td>${fmtNull(it.num_credencial || it.credencial)}</td>
        <td>${fmtDate(fechaIngreso)}</td>
        <td class="col-acciones">
          <div class="acciones-stack">
            <button class="btn btn-small btn-secondary js-editar" data-id="${it.id_empleado}">Editar</button>
            <button class="btn btn-small btn-danger js-eliminar"  data-id="${it.id_empleado}">Eliminar</button>
          </div>
        </td>
      `;

      const {
        correo: correoDet,
        jefe, tipoNomina, salarioMonto, fechaIngreso: fechaIngDet, credencial,
        benefNombre, benefParen, benefTel
      } = pickDetalle(it);

      const trDetail = document.createElement('tr');
      trDetail.className = 'row-detail';
      trDetail.innerHTML = `
        <td colspan="7">
          <div class="detail">
            <button class="btn btn-outline btn-small js-toggle-detail">Ver detalle</button>
            <div class="detail-panel hidden">
              <div class="detail-grid">
                <div>
                  <h4>Básicos</h4>
                  <div><strong>Sexo:</strong> ${fmtNull(first(it, 'sexo','genero'))}</div>
                  <div><strong>Fecha nacimiento:</strong> ${fmtDate(first(it, 'fecha_nacimiento','nacimiento'))}</div>
                </div>
                <div>
                  <h4>Domicilio</h4>
                  <div><strong>Calle y número:</strong> ${fmtNull(first(it, 'calle_numero','calle','domicilio'))}</div>
                  <div><strong>Colonia:</strong> ${fmtNull(first(it, 'colonia'))}</div>
                  <div><strong>Municipio:</strong> ${fmtNull(first(it, 'municipio'))}</div>
                  <div><strong>Estado:</strong> ${fmtNull(first(it, 'estado'))}</div>
                  <div><strong>C.P.:</strong> ${fmtNull(first(it, 'codigo_postal','cp','cpostal'))}</div>
                </div>
                <div>
                  <h4>Contacto</h4>
                  <div><strong>Teléfono:</strong> ${fmtNull(first(it, 'telefono','tel'))}</div>
                  <div><strong>Correo:</strong> ${fmtNull(correoDet)}</div>
                </div>
                <div>
                  <h4>Fiscales</h4>
                  <div><strong>Estado civil:</strong> ${fmtNull(first(it, 'estado_civil'))}</div>
                  <div><strong>Escolaridad:</strong> ${fmtNull(first(it, 'escolaridad'))}</div>
                  <div><strong>CURP:</strong> ${fmtNull(first(it, 'curp'))}</div>
                  <div><strong>RFC:</strong> ${fmtNull(first(it, 'rfc'))}</div>
                  <div><strong>NSS:</strong> ${fmtNull(first(it, 'nss'))}</div>
                </div>
                <div>
                  <h4>Laborales</h4>
                  <div><strong>Área:</strong> ${fmtNull(first(it, 'area'))}</div>
                  <div><strong>Puesto:</strong> ${fmtNull(first(it, 'puesto'))}</div>
                  <div><strong>Jefe inmediato:</strong> ${fmtNull(jefe)}</div>
                  <div><strong>Tipo de nómina:</strong> ${fmtNull(tipoNomina)}</div>
                  <div><strong>Salario (monto):</strong> ${fmtMoney(salarioMonto)}</div>
                  <div><strong>Fecha ingreso:</strong> ${fmtDate(fechaIngDet)}</div>
                  <div><strong>Credencial:</strong> ${fmtNull(credencial)}</div>
                </div>
                <div>
                  <h4>Beneficiario</h4>
                  <div><strong>Nombre:</strong> ${fmtNull(benefNombre)}</div>
                  <div><strong>Parentesco:</strong> ${fmtNull(benefParen)}</div>
                  <div><strong>Teléfono:</strong> ${fmtNull(benefTel)}</div>
                </div>
              </div>
            </div>
          </div>
        </td>
      `;

      tbody.appendChild(tr);
      tbody.appendChild(trDetail);
    }

    // Info y paginación
    const start = state.total === 0 ? 0 : ((state.page - 1) * state.pageSize) + 1;
    const end   = Math.min(state.page * state.pageSize, state.total);
    infoCantidad.textContent = `Mostrando ${start}–${end} de ${state.total}`;

    btnPrev.disabled = state.page <= 1;
    btnNext.disabled = state.page * state.pageSize >= state.total;

    // Eventos por fila
    qq('.js-editar', tbody).forEach(btn => btn.addEventListener('click', onEditar));
    qq('.js-eliminar', tbody).forEach(btn => btn.addEventListener('click', onEliminar));
    qq('.js-toggle-detail', tbody).forEach(btn => {
      btn.addEventListener('click', e => {
        const panel = e.currentTarget.closest('.detail').querySelector('.detail-panel');
        panel.classList.toggle('hidden');
        e.currentTarget.textContent = panel.classList.contains('hidden') ? 'Ver detalle' : 'Ocultar detalle';
      });
    });
  }

function onEditar(e) {
  const id = e.currentTarget.dataset.id;
  window.location.href = `index.html?id=${encodeURIComponent(id)}&id_empleado=${encodeURIComponent(id)}#edit`;
}


  async function onEliminar(e) {
    const id = e.currentTarget.dataset.id;
    const nombre = e.currentTarget.closest('tr').querySelector('td:nth-child(2)')?.textContent?.trim() || '';
    if (!confirm(`¿Seguro que deseas eliminar al empleado "${nombre}" (ID ${id})?`)) return;

    let r, data=null;
    try {
      r = await fetch(`${API}/${id}`, { method:'DELETE' });
      try { data = await r.json(); } catch {}
    } catch (err) {
      alert('No se pudo conectar con el servidor');
      return;
    }

    if (!r.ok || !data?.ok) {
      const msg = data?.message || data?.error || `HTTP ${r.status}`;
      alert(`Error al eliminar: ${msg}`);
      return;
    }

    // Notifica a otras pestañas (formulario) y refresca
    try {
      const ch = new BroadcastChannel('empleados');
      ch.postMessage({ type:'deleted', id:Number(id) });
      ch.close();
    } catch {}
    await fetchList();
  }

  // Buscar
  const doSearch = debounce(async () => {
    state.page = 1;
    state.q = (txtBuscar?.value || '').trim();
    await fetchList();
  }, 350);

  btnBuscar?.addEventListener('click', doSearch);
  txtBuscar?.addEventListener('input', doSearch);
  txtBuscar?.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') doSearch(); });

  btnPrev?.addEventListener('click', async () => {
    if (state.page > 1) { state.page--; await fetchList(); }
  });
  btnNext?.addEventListener('click', async () => {
    if (state.page * state.pageSize < state.total) { state.page++; await fetchList(); }
  });

  // btnNuevo?.addEventListener('click', () => { window.location.href = 'index.html#nuevo'; }); // ya no

  // Carga inicial
  fetchList().catch(err => {
    console.error(err);
    alert('Error cargando empleados');
  });
})();
