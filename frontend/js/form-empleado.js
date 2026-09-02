// ========== IMPORTS ==========
import { buscarEmpleados, obtenerEmpleado, actualizarEmpleado } from './api.js';
import GeneradorDocumentosOficiales from './lib/generador-oficial.js';
import { buildUI } from './lib/ui-map.js';
import { 
  attachAutoCalcListeners, 
  actualizarCamposAutomaticos, 
  fillForm, 
  collectPayload,
  actualizarEstadoCivilPorSexo 
} from './lib/fill-form.js';
import { initSearch } from './lib/search-box.js';
import { normalizaSexo } from './lib/normalizers.js';

// ========== DOM READY ==========
document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ form-empleado.js iniciando...');

  // ===== Referencias DOM =====
  const buscarInput = document.getElementById('buscarEmpleado');
  const resultados  = document.getElementById('resultadosBusqueda');
  const form        = document.getElementById('frmEmpleado');
  const btnNuevoTop = document.getElementById('btnNuevoTop');
  const btnNuevoBot = document.getElementById('btnNuevoBottom');

  if (!form) { 
    console.error('❌ Formulario no encontrado'); 
    return; 
  }

  // ===== Instancias =====
  const generador = new GeneradorDocumentosOficiales();
  const ui = buildUI();

  // ===== Estado =====
  let empleadoActualId = null;
  let dirty = false;
  const setDirty = (v) => { dirty = !!v; };
  const setEmpleadoId = (id) => { empleadoActualId = id; };

  // ========== FUNCIÓN: LIMPIAR LISTA ==========
  let limpiarLista = () => {};

  // ========== FUNCIÓN: LIMPIAR FORMULARIO ==========
  function limpiarFormulario() {
    console.log('🧹 Limpiando formulario...');
    
    form.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.type === 'checkbox' || el.type === 'radio') {
        el.checked = false;
      } else if (el.id === 'estado' || el.id === 'estado_nacimiento') {
        el.value = 'TL';
      } else {
        el.value = '';
      }
    });
    
    setEmpleadoId(null);
    setDirty(false);
    limpiarLista();
    
    if (buscarInput) buscarInput.value = '';
    
    actualizarCamposAutomaticos(ui, generador);
    
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    console.log('✅ Formulario limpio');
  }

  // ========== CARGA POR URL ==========
  (async () => {
    try {
      const qs = new URLSearchParams(window.location.search);
      const idFromUrl =
        Number(qs.get('id')) ||
        Number(qs.get('id_empleado')) ||
        Number(qs.get('empleadoId'));

      if (!idFromUrl || isNaN(idFromUrl)) {
        console.log('✅ Formulario en modo NUEVO (sin ID en URL)');
        limpiarFormulario();
        return;
      }

      console.log('📖 Cargando empleado desde URL:', idFromUrl);

      const emp = await obtenerEmpleado(idFromUrl);
      if (!emp || typeof emp !== 'object') {
        console.warn('⚠️ No se encontró empleado con ID:', idFromUrl);
        limpiarFormulario();
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }

      fillForm(emp, ui, generador, setEmpleadoId, setDirty);

      const idVal = emp.id_empleado ?? emp.id ?? idFromUrl;
      setEmpleadoId(idVal);
      setDirty(false);

      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      form.classList.remove('form-flash'); 
      void form.offsetWidth; 
      form.classList.add('form-flash');

    } catch (err) {
      console.error('[Carga URL] Error:', err);
      limpiarFormulario();
      window.history.replaceState({}, '', window.location.pathname);
    }
  })();

  // ========== AUTO-CÁLCULOS ==========
  attachAutoCalcListeners(ui, generador, setDirty, actualizarEstadoCivilPorSexo, normalizaSexo);
  actualizarEstadoCivilPorSexo(ui);

  // ========== SALARIOS PREDETERMINADOS ==========
  const salarioPred = document.getElementById('salario_predeterminado');
  const salarioInput = ui.salario;

  if (salarioPred && salarioInput) {
    salarioPred.addEventListener('change', (e) => {
      if (e.target.value && e.target.value !== 'otro') {
        salarioInput.value = e.target.value;
        setDirty(true);
      } else if (e.target.value === 'otro') {
        salarioInput.value = '';
        salarioInput.focus();
      }
    });

    salarioInput.addEventListener('input', () => {
      if (salarioInput.value) {
        salarioPred.value = '';
      }
      setDirty(true);
    });
  }

  // ========== BÚSQUEDA / AUTOCOMPLETE ==========
  const searchInit = initSearch({
    buscarInput,
    resultados,
    buscarEmpleados,
    onSelect: async (id) => {
      try {
        const emp = await obtenerEmpleado(Number(id));
        fillForm(emp, ui, generador, setEmpleadoId, setDirty);
        form.scrollIntoView({ behavior:'smooth', block:'start' });
        form.classList.remove('form-flash'); 
        void form.offsetWidth; 
        form.classList.add('form-flash');
      } catch (e) {
        console.error('[obtenerEmpleado]', e);
        alert('Error al obtener empleado: ' + e.message);
      }
    }
  });

  limpiarLista = searchInit.limpiarLista;

  // ========== SUBMIT (crear/actualizar) ==========
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    
    console.log('🔐 [SUBMIT] Iniciando guardado...');
    
    const numTrabajador = ui.num_trabajador_top?.value?.trim();
    if (!numTrabajador) {
      alert('⚠️ El número de trabajador es obligatorio.\n\nPor favor, llena este campo antes de guardar.');
      ui.num_trabajador_top?.focus();
      return;
    }

    const payload = collectPayload(ui);
    console.log('📦 [SUBMIT] Payload completo:', payload);
    
    try {
      if (empleadoActualId) {
        console.log('🔄 [SUBMIT] Modo: ACTUALIZAR empleado ID:', empleadoActualId);
        
        const res = await fetch(`http://localhost:3001/api/empleados/${empleadoActualId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        console.log('📡 [SUBMIT] Response status:', res.status);

        if (!res.ok) {
          const text = await res.text();
          console.error('❌ [SUBMIT] Response error:', text);
          
          let data;
          try { 
            data = JSON.parse(text); 
          } catch { 
            data = { error: text }; 
          }
          
          throw new Error(data.error || 'Error actualizando empleado');
        }

        const result = await res.json();
        console.log('✅ [SUBMIT] Response data:', result);

        if (result.ok || result.success) {
          alert('✅ Empleado actualizado correctamente');
          
          if (result.empleado) {
            console.log('🔄 [SUBMIT] Recargando datos frescos...');
            fillForm(result.empleado, ui, generador, setEmpleadoId, setDirty);
          } else {
            console.log('🔄 [SUBMIT] Consultando datos frescos...');
            const freshData = await obtenerEmpleado(empleadoActualId);
            fillForm(freshData, ui, generador, setEmpleadoId, setDirty);
          }
          
          setDirty(false);
        } else {
          throw new Error('Respuesta inesperada del servidor');
        }

      } else {
        console.log('🆕 [SUBMIT] Modo: CREAR nuevo empleado');
        
        const res = await fetch('http://localhost:3001/api/empleados', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        console.log('📡 [SUBMIT] Response status:', res.status);
        
        if (!res.ok) {
          const text = await res.text(); 
          console.error('❌ [SUBMIT] Response error:', text);
          
          let data;
          try { 
            data = JSON.parse(text); 
          } catch { 
            data = { error: text }; 
          }
          
          if (data.codigo === 'NSS_DUPLICADO') {
            alert(
              '❌ NSS Duplicado\n\n' +
              data.error + '\n\n' +
              '¿Qué hacer?\n' +
              '• Si el empleado no tiene NSS, déjalo vacío\n' +
              '• Si tiene NSS, verifica que sea correcto (11 dígitos)'
            );
            ui.nss?.focus();
            return;
          }
          
          if (data.codigo === 'NUM_TRABAJADOR_DUPLICADO') {
            alert(
              '❌ Número de Trabajador Duplicado\n\n' +
              data.error + '\n\n' +
              'Este número ya está asignado a otro empleado.'
            );
            ui.num_trabajador_top?.focus();
            return;
          }
          
          throw new Error(data.error || 'Error creando empleado');
        }
        
        const result = await res.json();
        console.log('✅ [SUBMIT] Response data:', result);
        
        if (result.success && result.empleado) {
          const newId = result.empleado.id_empleado || result.id_empleado || result.id;
          
          alert(
            '✅ Empleado creado correctamente\n\n' +
            'ID: ' + newId + '\n' +
            'Número de trabajador: ' + result.empleado.num_trabajador
          );
          
          setEmpleadoId(newId);
          
          console.log('🔄 [SUBMIT] Consultando datos completos del empleado recién creado...');
          
          await new Promise(resolve => setTimeout(resolve, 500));
          
          try {
            const freshData = await obtenerEmpleado(newId);
            console.log('🔥 [SUBMIT] Datos frescos obtenidos:', freshData);
            
            fillForm(freshData, ui, generador, setEmpleadoId, setDirty);
            
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('id', newId);
            window.history.replaceState({}, '', newUrl);
            
            console.log('✅ [SUBMIT] Formulario actualizado con datos frescos');
          } catch (fetchError) {
            console.error('⚠️ [SUBMIT] Error al recargar datos:', fetchError);
            fillForm(result.empleado, ui, generador, setEmpleadoId, setDirty);
          }
          
        } else {
          alert('⚠️ Empleado creado pero hubo un problema con la respuesta');
        }
        
        setDirty(false);
      }
      
    } catch (e) {
      console.error('❌ [SUBMIT] Error capturado:', e);
      
      let errorMsg = e.message;
      
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        alert(
          '❌ Error de Conexión\n\n' +
          'No se pudo conectar con el servidor.\n\n' +
          'Verifica que el servidor esté ejecutándose'
        );
        return;
      }
      
      alert('❌ Error al guardar empleado:\n\n' + errorMsg);
    }
  });

  // ========== BOTONES "NUEVO" ==========
  const onNuevoClick = () => {
    if (dirty) {
      if (confirm('Tienes cambios sin guardar. ¿Deseas descartarlos?')) {
        limpiarFormulario();
      }
    } else {
      limpiarFormulario();
    }
  };
  
  if (btnNuevoTop) btnNuevoTop.addEventListener('click', onNuevoClick);
  if (btnNuevoBot) btnNuevoBot.addEventListener('click', onNuevoClick);

  // ========== GENERACIÓN DE CONTRATOS ==========
  console.log('🔧 Registrando listeners de CONTRATOS...');
  
  document.querySelectorAll('[data-contrato]').forEach(btn => {
    console.log('✅ Listener registrado para contrato:', btn.dataset.contrato);
    
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const tipo = btn.dataset.contrato;
      console.log('📄 [Contrato] Generando tipo:', tipo);
      
      const payload = collectPayload(ui);
      console.log('📦 [Contrato] Payload:', payload);

      if (!payload.nombre || !payload.apellidos) {
        alert('⚠️ Necesitas llenar al menos el nombre y apellidos para generar un contrato.');
        return;
      }

      try {
        const res = await fetch('http://localhost:3001/api/contratos/' + tipo, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const text = await res.text();
          let data;
          try { data = JSON.parse(text); } catch { data = { error: text }; }
          throw new Error(data.error || "Error generando contrato");
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Contrato_${(payload.nombre || "Empleado").replace(/\s+/g, "_")}_${String(tipo).replace(/\s+/g, "_")}.docx`;
        a.click();
        URL.revokeObjectURL(url);
        
        console.log('✅ [Contrato] Generado exitosamente:', tipo);
      } catch (err) {
        console.error('❌ [Contrato] Error:', err);
        alert('No se pudo generar el contrato:\n\n' + err.message);
      }
    });
  });

  // ========== GENERACIÓN DE DOCUMENTOS ==========
  console.log('🔧 Registrando listeners de DOCUMENTOS...');
  
  document.querySelectorAll('[data-documento]').forEach(btn => {
    console.log('✅ Listener registrado para documento:', btn.dataset.documento);
    
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const tipoDoc = btn.dataset.documento;
      console.log('📄 [Documento] Tipo:', tipoDoc);

      let payloadFinal = collectPayload(ui);
      console.log('📦 [Documento] Payload UI:', payloadFinal);

      if (empleadoActualId) {
        try {
          console.log('🔄 [Documento] Complementando con datos de BD...');
          const empFromApi = await obtenerEmpleado(empleadoActualId);
          console.log('📥 [Documento] Datos BD:', empFromApi);

          payloadFinal = {
            ...empFromApi,
            ...payloadFinal,
          };

          console.log('✅ [Documento] Payload FINAL:', payloadFinal);
        } catch (err) {
          console.warn('⚠️ [Documento] No se pudo leer BD:', err);
        }
      }

      if (!payloadFinal.nombre || !payloadFinal.apellidos) {
        alert('⚠️ Necesitas llenar al menos el nombre y apellidos para generar el documento.');
        return;
      }

      if (tipoDoc === 'etiqueta') {
        abrirModalTipoEmpleado(payloadFinal);
        return;
      }

      if (tipoDoc === 'credencial') {
        await generarCredencial(payloadFinal);
        return;
      }

      if (tipoDoc === 'checklist') {
        await generarCheckList(payloadFinal);
        return;
      }

      if (tipoDoc === 'evaluaciones') {
        abrirModalTipoEvaluacion(payloadFinal);
        return;
      }

      alert(`Documento "${tipoDoc}" en desarrollo`);
    });
  });

  // ========== FUNCIONES AUXILIARES PARA DOCUMENTOS ==========

  async function generarCredencial(payload) {
    try {
      console.log('🪪 [Credencial] Generando...');

      const res = await fetch('http://localhost:3001/api/documentos/credencial', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { error: text }; }
        throw new Error(data.error || "Error generando credencial");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Credencial_${payload.num_trabajador || 'empleado'}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      
      console.log('✅ [Credencial] Generada exitosamente');
    } catch (err) {
      console.error('❌ [Credencial] Error:', err);
      alert('No se pudo generar la credencial:\n\n' + err.message);
    }
  }

  async function generarCheckList(payload) {
    try {
      console.log('📋 [CheckList] Generando...');

      const res = await fetch('http://localhost:3001/api/documentos/checklist', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { error: text }; }
        throw new Error(data.error || "Error generando checklist");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const nombre =
        payload.nombre_completo ||
        `${payload.nombre || ''} ${payload.apellidos || ''}`.trim() ||
        'empleado';

      const num = payload.num_trabajador || 'empleado';

      a.download = `CheckList_${num}_${nombre.replace(/\s+/g, '_')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      console.log('✅ [CheckList] Generado exitosamente');
    } catch (err) {
      console.error('❌ [CheckList] Error:', err);
      alert('No se pudo generar el checklist:\n\n' + err.message);
    }
  }

  function abrirModalTipoEmpleado(payload) {
    const modal = document.getElementById('modalTipoEmpleado');
    const btnE = document.getElementById('btnEmpleado');
    const btnS = document.getElementById('btnSindicalizado');
    const btnCancel = document.getElementById('btnCancelarTipo');

    if (!modal) return;

    modal.classList.remove('hidden');

    async function generarEtiqueta(tipo) {
      try {
        console.log(`🏷️ [Etiqueta ${tipo}] Generando...`);
        
        const res = await fetch('http://localhost:3001/api/documentos/etiqueta', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            tipo_empleado: tipo
          })
        });

        if (!res.ok) {
          const text = await res.text();
          let data;
          try { data = JSON.parse(text); } catch { data = { error: text }; }
          throw new Error(data.error || "Error generando etiqueta");
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Etiqueta_${tipo}-${payload.num_trabajador || 'empleado'}.docx`;
        a.click();
        URL.revokeObjectURL(url);
        
        cerrarModal();
        console.log(`✅ [Etiqueta ${tipo}] Generada exitosamente`);
      } catch (err) {
        console.error(`❌ [Etiqueta ${tipo}] Error:`, err);
        alert('No se pudo generar la etiqueta: ' + err.message);
      }
    }

    function cerrarModal() {
      modal.classList.add('hidden');
      btnE.removeEventListener('click', onClickE);
      btnS.removeEventListener('click', onClickS);
      btnCancel.removeEventListener('click', onClickCancel);
    }

    function onClickE(e) {
      e.preventDefault();
      e.stopPropagation();
      generarEtiqueta('E');
    }
    
    function onClickS(e) {
      e.preventDefault();
      e.stopPropagation();
      generarEtiqueta('S');
    }
    
    function onClickCancel(e) {
      e.preventDefault();
      e.stopPropagation();
      cerrarModal();
    }

    btnE.addEventListener('click', onClickE);
    btnS.addEventListener('click', onClickS);
    btnCancel.addEventListener('click', onClickCancel);
  }

 function abrirModalTipoEvaluacion(payload) {
  const modal = document.getElementById('modalTipoEvaluacion');
  const btnEval1 = document.getElementById('btnEval1');
  const btnEval2 = document.getElementById('btnEval2');
  const btnEval3 = document.getElementById('btnEval3');
  const btnCancel = document.getElementById('btnCancelarEvaluacion');

  if (!modal) {
    console.error('❌ Modal de evaluación no encontrado');
    return;
  }

  modal.classList.remove('hidden');

  async function generarEvaluacionConNumero(numero) {
    try {
      console.log(`📋 [Evaluación ${numero}] Generando...`);

      const res = await fetch('http://localhost:3001/api/documentos/evaluacion', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          num_contrato: numero
        })
      });

      if (!res.ok) {
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { error: text }; }
        throw new Error(data.error || "Error generando evaluación");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Evaluacion_${numero}_${payload.num_trabajador || 'empleado'}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      
      cerrarModal();
      console.log(`✅ [Evaluación ${numero}] Generada exitosamente`);
    } catch (err) {
      console.error(`❌ [Evaluación ${numero}] Error:`, err);
      alert(`No se pudo generar la evaluación ${numero}:\n\n` + err.message);
    }
  }

  function cerrarModal() {
    modal.classList.add('hidden');
    btnEval1.removeEventListener('click', onClickEval1);
    btnEval2.removeEventListener('click', onClickEval2);
    btnEval3.removeEventListener('click', onClickEval3);
    btnCancel.removeEventListener('click', cerrarModal);
  }

  // ✅ AGREGAR e.preventDefault() y e.stopPropagation() AQUÍ
  function onClickEval1(e) { 
    e.preventDefault(); 
    e.stopPropagation(); 
    generarEvaluacionConNumero(1); 
  }
  
  function onClickEval2(e) { 
    e.preventDefault(); 
    e.stopPropagation(); 
    generarEvaluacionConNumero(2); 
  }
  
  function onClickEval3(e) { 
    e.preventDefault(); 
    e.stopPropagation(); 
    generarEvaluacionConNumero(3); 
  }
  
  function onClickCancel(e) { 
    e.preventDefault(); 
    e.stopPropagation(); 
    cerrarModal(); 
  }

  btnEval1.addEventListener('click', onClickEval1);
  btnEval2.addEventListener('click', onClickEval2);
  btnEval3.addEventListener('click', onClickEval3);
  btnCancel.addEventListener('click', onClickCancel); // ✅ Usar onClickCancel en lugar de cerrarModal
}

  console.log('✅ form-empleado.js cargado completamente');
});