const clave = (valor) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

export function resolverCarreraSupabase(carreras, carreraIdFiuni, nombreCarrera, materias, materiasFiuni) {
  const nombre = clave(nombreCarrera);
  const porNombre = carreras.find((carrera) => {
      const candidato = clave(carrera.nombre);
      return nombre && (candidato === nombre || candidato.includes(nombre) || nombre.includes(candidato));
    });
  if (porNombre) return porNombre;

  const nombresFiuni = new Set(
    (materiasFiuni || []).map((materia) => clave(materia.nombre ?? materia.materia)).filter(Boolean),
  );
  const coincidencias = new Map();
  for (const materia of materias || []) {
    if (nombresFiuni.has(clave(materia.nombre))) {
      coincidencias.set(materia.carrera_id, (coincidencias.get(materia.carrera_id) || 0) + 1);
    }
  }
  const carreraDetectada = carreras
    .map((carrera) => ({ carrera, coincidencias: coincidencias.get(carrera.id) || 0 }))
    .sort((a, b) => b.coincidencias - a.coincidencias)[0];
  if (carreraDetectada?.coincidencias) return carreraDetectada.carrera;

  return carreras.find((carrera) => Number(carrera.id) === Number(carreraIdFiuni));
}
