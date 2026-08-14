const ESTADOS_NO_INSCRIPTOS = new Set([
  "aprobada",
  "bloqueada",
  "disponible",
  "habilitada",
  "retirada",
  "cancelada",
]);

export function esMateriaCursando(materia, anhoActual = new Date().getFullYear()) {
  if (materia?.anho !== anhoActual || materia.inscripto === false) return false;
  const estado = String(materia.estado || "").trim().toLowerCase();
  return !ESTADOS_NO_INSCRIPTOS.has(estado);
}
