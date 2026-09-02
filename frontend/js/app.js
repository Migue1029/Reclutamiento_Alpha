// frontend/js/app.js

// Simplificar a solo máscaras y validaciones
const REGEX = {
  CURP: /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/,
  RFC: /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/,
  NSS: /^\d{11}$/,
  CP: /^\d{5}$/,
  TEL10: /^\d{10}$/
};

document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ app.js cargado - Máscaras configuradas');

  // Mayúsculas en CURP/RFC
  ['curp', 'rfc'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', (e) => {
      const pos = e.target.selectionStart;
      e.target.value = e.target.value.toUpperCase();
      e.target.setSelectionRange(pos, pos);
    });
  });

  // Código postal (solo números, máx 5)
  const cpEl = document.getElementById('codigo_postal');
  if (cpEl) {
    cpEl.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5);
    });
  }

  // Campos numéricos (excepto NSS que tiene validación especial)
  ['telefono', 'benef_telefono', 'num_trabajador_top', 'credencial'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '');
    });
  });

  // ========== NSS CON VALIDACIÓN VISUAL ==========
  const nssInput = document.getElementById('nss');
  if (nssInput) {
    nssInput.addEventListener('input', (e) => {
      // Quitar todo excepto números
      e.target.value = e.target.value.replace(/\D/g, '');
      
      // Limitar a 11 dígitos
      if (e.target.value.length > 11) {
        e.target.value = e.target.value.slice(0, 11);
      }
      
      // Validación visual en tiempo real
      const valor = e.target.value;
      
      // Remover clases previas
      e.target.classList.remove('input-valido', 'input-invalido', 'input-incompleto');
      
      if (valor.length === 0) {
        // Vacío: sin estilo
        return;
      } else if (valor.length === 11) {
        // Completo y válido
        e.target.classList.add('input-valido');
        e.target.setCustomValidity(''); // Válido
      } else {
        // Incompleto
        e.target.classList.add('input-incompleto');
        e.target.setCustomValidity(`NSS debe tener 11 dígitos. Llevas ${valor.length}`);
      }
    });
    
    // Al salir del campo (blur)
    nssInput.addEventListener('blur', (e) => {
      const valor = e.target.value;
      
      if (valor.length > 0 && valor.length !== 11) {
        // Mostrar error visual
        e.target.classList.remove('input-valido', 'input-incompleto');
        e.target.classList.add('input-invalido');
        
        // Mensaje de error
        e.target.setCustomValidity(`El NSS debe tener exactamente 11 dígitos. Tienes ${valor.length}.`);
        e.target.reportValidity();
      } else if (valor.length === 11) {
        e.target.classList.remove('input-invalido', 'input-incompleto');
        e.target.classList.add('input-valido');
        e.target.setCustomValidity('');
      }
    });
  }

  // Limitar número de trabajador a 6 dígitos
  const numTrabajadorInput = document.getElementById('num_trabajador_top');
  if (numTrabajadorInput) {
    numTrabajadorInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '');
      if (e.target.value.length > 6) {
        e.target.value = e.target.value.slice(0, 6);
      }
    });
  }

  // ========== Parentesco: Select predeterminado + Input manual ==========
  const parentescoPred = document.getElementById('parentesco_predeterminado');
  const parentescoInput = document.getElementById('parentesco');

  if (parentescoPred && parentescoInput) {
    // Cuando se selecciona del dropdown
    parentescoPred.addEventListener('change', (e) => {
      const valor = e.target.value;
      
      if (valor && valor !== 'otro') {
        const valorCapitalizado = valor.charAt(0).toUpperCase() + valor.slice(1);
        parentescoInput.value = valorCapitalizado;
      } else if (valor === 'otro') {
        parentescoInput.value = '';
        parentescoInput.focus();
      } else {
        parentescoInput.value = '';
      }
    });

    // Cuando se escribe manualmente
    parentescoInput.addEventListener('input', () => {
      if (parentescoInput.value) {
        parentescoPred.value = '';
      }
    });
  }

  // ========== Jefe Inmediato: Select predeterminado + Input manual ==========
  const jefePred = document.getElementById('jefe_predeterminado');
  const jefeInput = document.getElementById('jefe');

  if (jefePred && jefeInput) {
    // Cuando se selecciona del dropdown
    jefePred.addEventListener('change', (e) => {
      const valor = e.target.value;
      
      if (valor && valor !== 'otro') {
        jefeInput.value = valor;
      } else if (valor === 'otro') {
        jefeInput.value = '';
        jefeInput.focus();
      } else {
        jefeInput.value = '';
      }
    });

    // Cuando se escribe manualmente
    jefeInput.addEventListener('input', () => {
      if (jefeInput.value) {
        jefePred.value = '';
      }
    });
  }

  console.log('✅ Parentesco y Jefe Inmediato configurados correctamente');
});