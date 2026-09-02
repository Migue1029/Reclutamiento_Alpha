export function splitNombreCompleto(nombreCompleto = '') {
  const raw = (nombreCompleto || '').trim().replace(/\s+/g, ' ');
  if (!raw) return { nombres: '', apellidos: '' };

  const tokens = raw.split(' ');

  // 1 sola palabra
  if (tokens.length === 1) {
    return { nombres: tokens[0], apellidos: '' };
  }

  // 2 palabras: Nombre Apellido
  if (tokens.length === 2) {
    return { nombres: tokens[0], apellidos: tokens[1] };
  }

  // 3 o más palabras:
  // Últimos 2 = Apellidos, el resto = Nombres
  const apellidos = tokens.slice(-2).join(' ');
  const nombres = tokens.slice(0, -2).join(' ');

  return { nombres, apellidos };
}