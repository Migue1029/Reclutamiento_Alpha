// Componente de búsqueda/autocomplete para empleados

export function initSearch({ buscarInput, resultados, onSelect, buscarEmpleados }) {
  let t;
  let current = [];
  let activeIndex = -1;

  function renderResultados(data){
    current = data;
    activeIndex = -1;
    if (!Array.isArray(data) || data.length === 0){
      if (resultados) resultados.innerHTML = '<li class="item-res"><em>Sin resultados</em></li>';
      return;
    }
    if (resultados) {
      resultados.innerHTML = data.map((d,i)=>`
        <li class="item-res" data-index="${i}" data-id="${d.id_empleado}" role="option" tabindex="0">
          <span class="num">${d.num_trabajador || '(s/n)'}</span>
          <span class="name">${d.nombre_completo || ''}</span>
        </li>
      `).join('');
    }
  }

  function setActive(index){
    if (!resultados) return;
    const items = [...resultados.querySelectorAll('.item-res')];
    items.forEach(el => el.classList.remove('is-active'));
    if (index >= 0 && index < items.length){
      items[index].classList.add('is-active');
      items[index].scrollIntoView({ block:'nearest' });
      activeIndex = index;
    } else activeIndex = -1;
  }

  async function selectByIndex(index){
    if (index < 0 || index >= current.length) return;
    const { id_empleado } = current[index];
    await onSelect(id_empleado);
    limpiarLista();
  }

  function limpiarLista(){
    if (resultados) resultados.innerHTML = '';
    activeIndex = -1;
    current = [];
  }

  if (buscarInput) {
    buscarInput.addEventListener('input', () => {
      const q = buscarInput.value.trim();
      clearTimeout(t);
      if (!q) { limpiarLista(); return; }
      t = setTimeout(async () => {
        try {
          const data = await buscarEmpleados(q);
          renderResultados(data);
        } catch (e) {
          console.error('[buscarEmpleados]', e);
          if (resultados) resultados.innerHTML = '<li class="item-res"><em>Error consultando el servidor</em></li>';
        }
      }, 280);
    });

    buscarInput.addEventListener('keydown', async (e) => {
      if (!resultados) return;
      const items = resultados.querySelectorAll('.item-res');
      const len = items.length;
      if (e.key === 'ArrowDown' && len){ e.preventDefault(); setActive(Math.min(activeIndex + 1, len - 1)); }
      else if (e.key === 'ArrowUp' && len){ e.preventDefault(); setActive(Math.max(activeIndex - 1, 0)); }
      else if (e.key === 'Enter' && len){ e.preventDefault(); if (activeIndex === -1) setActive(0); await selectByIndex(activeIndex); }
      else if (e.key === 'Escape'){ limpiarLista(); }
    });
  }

  if (resultados) {
    resultados.addEventListener('mousemove', (e) => {
      const li = e.target.closest('.item-res');
      if (!li) return;
      const idx = Number(li.dataset.index);
      if (!Number.isNaN(idx)) setActive(idx);
    });
    resultados.addEventListener('click', async (e) => {
      const li = e.target.closest('.item-res');
      if (!li) return;
      await selectByIndex(Number(li.dataset.index));
    });
  }

  // Exponer util por si lo necesitas desde fuera
  return { limpiarLista };
}
