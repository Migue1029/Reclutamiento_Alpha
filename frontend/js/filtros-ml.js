// frontend/js/filtros-ml.js
(() => {
  function $(sel, ctx = document) { return ctx.querySelector(sel); }
  function el(tag, cls) { const n = document.createElement(tag); if (cls) n.className = cls; return n; }

  document.addEventListener('DOMContentLoaded', () => {
    // ===== 1) Botón "Filtros" en la toolbar (usar el que ya tienes si existe) =====
    const toolbar   = document.querySelector('.toolbar');
    if (!toolbar) return;

    const actionsRight = toolbar.querySelector('.actions-right') || (() => {
      const d = el('div', 'actions-right');
      toolbar.appendChild(d);
      return d;
    })();

    let btnOpen = $('#btnFiltrosML') || $('#btnAbrirFiltros');
    if (!btnOpen) {
      btnOpen = el('button', 'btn btn-outline btn-small ml-filters-btn');
      btnOpen.type = 'button';
      btnOpen.id = 'btnFiltrosML';
      btnOpen.innerHTML = '🔎 Filtros';
      btnOpen.setAttribute('aria-haspopup', 'dialog');
      actionsRight.prepend(btnOpen);
    }

    // ===== 2) Modal: Backdrop + Sheet =====
    // Limpia el panel flotante antiguo si existiera
    const old = $('#panelFiltros'); old?.remove();

    const backdrop = el('div', 'filtros-backdrop');            // fondo oscuro
    const sheet    = el('aside', 'filtros-sheet');             // panel
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'titFiltros');

    // Header (sticky)
    const head = el('header', 'filtros-head');
    head.innerHTML = `
      <div class="filtros-title" id="titFiltros">Filtros de búsqueda</div>
      <button class="filtros-close" type="button" aria-label="Cerrar">✕</button>
    `;

    // Body (scroll interno)
    const body = el('div', 'filtros-body');
    body.innerHTML = `
      <div class="filtros-grid">

        <div class="filtros-field">
          <label class="filtros-label">Municipio</label>
          <input class="filtros-input" type="text" id="f_municipio" placeholder="Ej. Apizaco">
        </div>

        <div class="filtros-field">
          <label class="filtros-label">CURP</label>
          <input class="filtros-input" type="text" id="f_curp" placeholder="Ej. BEXX....">
        </div>

        <div class="filtros-field">
          <label class="filtros-label">RFC</label>
          <input class="filtros-input" type="text" id="f_rfc" placeholder="Ej. ABCD800101...">
        </div>

        <div class="filtros-field">
          <label class="filtros-label">NSS</label>
          <input class="filtros-input" type="text" id="f_nss" placeholder="Número de seguro social">
        </div>

        <div class="filtros-field">
          <label class="filtros-label">Área</label>
          <input class="filtros-input" type="text" id="f_area" placeholder="Ej. Sistemas">
        </div>

        <div class="filtros-field">
          <label class="filtros-label">Puesto</label>
          <input class="filtros-input" type="text" id="f_puesto" placeholder="Ej. Analista">
        </div>

        <div class="filtros-field" style="grid-column: 1 / -1;">
          <label class="filtros-label">Tipo de nómina</label>
          <div class="filtros-chips" id="f_tipo_nomina">
            <button type="button" data-val="SEMANAL"   class="filtros-chip">Semanal</button>
            <button type="button" data-val="QUINCENAL" class="filtros-chip">Quincenal</button>
            <button type="button" data-val="MENSUAL"   class="filtros-chip">Mensual</button>
          </div>
        </div>

        <div class="filtros-field" style="grid-column: 1 / -1;">
          <label class="filtros-label">Sexo</label>
          <div class="filtros-chips" id="f_sexo">
            <button type="button" data-val="F" class="filtros-chip">Femenino</button>
            <button type="button" data-val="M" class="filtros-chip">Masculino</button>
          </div>
        </div>

        <div class="filtros-field">
          <label class="filtros-label">Edad mín</label>
          <input class="filtros-input" type="number" id="f_edad_min" min="0" max="99" placeholder="Ej. 20">
        </div>
        <div class="filtros-field">
          <label class="filtros-label">Edad máx</label>
          <input class="filtros-input" type="number" id="f_edad_max" min="0" max="99" placeholder="Ej. 60">
        </div>

        <div class="filtros-field">
          <label class="filtros-label">Ingreso desde</label>
          <input class="filtros-input" type="date" id="f_fi_desde">
        </div>
        <div class="filtros-field">
          <label class="filtros-label">Ingreso hasta</label>
          <input class="filtros-input" type="date" id="f_fi_hasta">
        </div>

      </div>
    `;

    // Footer (sticky)
    const foot = el('footer', 'filtros-foot');
    foot.innerHTML = `
      <button type="button" class="btn-ghost"  id="btnFiltrosLimpiar">Limpiar</button>
      <button type="button" class="btn-ghost"  id="btnFiltrosCerrar">Cerrar</button>
      <button type="button" class="btn-primary" id="btnFiltrosAplicar">Aplicar</button>
    `;

    sheet.appendChild(head);
    sheet.appendChild(body);
    sheet.appendChild(foot);
    backdrop.appendChild(sheet);
    document.body.appendChild(backdrop);

    // ===== 3) Apertura / cierre con animación + bloqueo de scroll =====
    const btnClose   = $('.filtros-close', sheet);
    const btnApply   = $('#btnFiltrosAplicar', sheet);
    const btnClear   = $('#btnFiltrosLimpiar', sheet);
    const btnClose2  = $('#btnFiltrosCerrar', sheet);

    function openModal() {
      document.body.classList.add('no-scroll');
      backdrop.classList.add('is-open');
      sheet.classList.add('is-open');
      // foco accesible
      (sheet.querySelector('input,button,select,textarea') || sheet).focus();
    }
    function closeModal() {
      sheet.classList.remove('is-open');
      backdrop.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
    }

    btnOpen.addEventListener('click', openModal);
    btnClose?.addEventListener('click', closeModal);
    btnClose2?.addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && backdrop.classList.contains('is-open')) closeModal(); });

    // ===== 4) Chips toggle (acepta .is-active y .active por compatibilidad) =====
    sheet.addEventListener('click', (e) => {
      const chip = e.target.closest('.filtros-chip, .chip');
      if (!chip) return;
      chip.classList.toggle('is-active');
      chip.classList.toggle('active'); // si otras partes buscan .active
    });

    // ===== 5) Limpiar =====
    btnClear?.addEventListener('click', () => {
      sheet.querySelectorAll('input').forEach(i => i.value = '');
      sheet.querySelectorAll('.filtros-chip.is-active, .chip.active').forEach(c => {
        c.classList.remove('is-active'); c.classList.remove('active');
      });
    });

    // ===== 6) Aplicar → emitir 'filtros-aplicados' (contrato existente) =====
    const pick = (id) => $( '#' + id, sheet )?.value?.trim() || '';
    const pickChips = (id) => Array.from($('#' + id, sheet)?.querySelectorAll('.filtros-chip.is-active, .chip.active') || [])
                                  .map(n => n.dataset.val);

    btnApply?.addEventListener('click', () => {
      const detail = {
        municipio: pick('f_municipio'),
        curp:      pick('f_curp'),
        rfc:       pick('f_rfc'),
        nss:       pick('f_nss'),
        area:      pick('f_area'),
        puesto:    pick('f_puesto'),
        tipo_nomina: pickChips('f_tipo_nomina').join(','), // múltiple
        sexo:        pickChips('f_sexo').join(','),        // múltiple
        edad_min:  pick('f_edad_min'),
        edad_max:  pick('f_edad_max'),
        fecha_ingreso_desde: pick('f_fi_desde'),
        fecha_ingreso_hasta: pick('f_fi_hasta')
      };

      // Combina con la barra de búsqueda general si existe
      const qInput = document.querySelector('#txtBuscar') || document.querySelector('.search-box input');
      if (qInput && qInput.value.trim()) detail.q = qInput.value.trim();

      window.dispatchEvent(new CustomEvent('filtros-aplicados', { detail }));
      closeModal();
    });
  });
})();
