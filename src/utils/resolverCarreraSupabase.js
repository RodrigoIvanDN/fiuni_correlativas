const clave = (valor) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

export function resolverCarreraSupabase(carreras, carreraIdFiuni, nombreCarrera) {
  const nombre = clave(nombreCarrera);
  return carreras.find((carrera) => Number(carrera.id) === Number(carreraIdFiuni))
    || carreras.find((carrera) => {
      const candidato = clave(carrera.nombre);
      return nombre && (candidato === nombre || candidato.includes(nombre) || nombre.includes(candidato));
    });
}
