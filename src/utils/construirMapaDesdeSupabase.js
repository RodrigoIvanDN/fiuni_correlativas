const ESTADOS_FINALES = new Set([
  "aprobada",
  "bloqueada",
  "disponible",
  "habilitada",
  "retirada",
  "cancelada",
]);

const claveCodigo = (codigo) => String(codigo ?? "").trim().replace(/^0+(?=\d)/, "");

function estadoDelRegistro(registro) {
  const estado = String(registro?.estado ?? "").trim().toLowerCase();
  const nota = Number(registro?.calificacion ?? registro?.nota ?? NaN);

  if (estado === "aprobada" || nota >= 2) return "aprobada";
  if (registro?.inscripto !== false && !ESTADOS_FINALES.has(estado)) return "cursando";
  return null;
}

export function construirMapaDesdeSupabase({ materias, actuales = [], historial = [] }) {
  const porId = new Map(materias.map((materia) => [String(materia.id), materia.codigo]));
  const estados = new Map();

  for (const registro of [...historial, ...actuales]) {
    const codigo = claveCodigo(registro.codigoMateria ?? registro.materiaCodigo ?? registro.codigo);
    const estado = estadoDelRegistro(registro);
    if (!codigo || !estado || estados.get(codigo) === "aprobada") continue;
    estados.set(codigo, estado);
  }

  const mapa = materias.map((materia) => ({
    id: String(materia.codigo),
    nombre: materia.nombre,
    semestre: materia.semestre,
    creditos: materia.creditos,
    correlativas: (materia.correlativas || []).map((id) => String(porId.get(String(id)))).filter(Boolean),
    correlativas_regular: (materia.correlativas_regular || []).map((id) => String(porId.get(String(id)))).filter(Boolean),
  }));

  for (const materia of mapa) {
    const codigo = claveCodigo(materia.id);
    const estadoActual = estados.get(codigo);
    if (estadoActual) {
      materia.estado = estadoActual;
      continue;
    }

    const aprobadas = materia.correlativas.every((id) => estados.get(claveCodigo(id)) === "aprobada");
    const regularizadas = materia.correlativas_regular.every((id) => {
      const estado = estados.get(claveCodigo(id));
      return estado === "aprobada" || estado === "cursando";
    });
    materia.estado = aprobadas && regularizadas ? "disponible" : "bloqueada";
  }

  return mapa;
}
