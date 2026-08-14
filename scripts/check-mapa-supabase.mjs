import assert from "node:assert/strict";
import { construirMapaDesdeSupabase } from "../src/utils/construirMapaDesdeSupabase.js";

const mapa = construirMapaDesdeSupabase({
  materias: [
    { id: 1, codigo: "001", nombre: "Álgebra", semestre: 1, correlativas: [], correlativas_regular: [] },
    { id: 2, codigo: "002", nombre: "Análisis", semestre: 1, correlativas: [], correlativas_regular: [] },
    { id: 3, codigo: "009", nombre: "Álgebra Lineal", semestre: 2, correlativas: ["1"], correlativas_regular: ["2"] },
  ],
  actuales: [{ codigoMateria: "002", estado: "cursando", inscripto: true }],
  historial: [{ codigoMateria: "001", estado: "aprobada" }],
});

assert.deepEqual(mapa.map((materia) => materia.estado), ["aprobada", "cursando", "disponible"]);
assert.deepEqual(mapa[2].correlativas, ["001"]);
assert.deepEqual(mapa[2].correlativas_regular, ["002"]);
console.log("CHECK_MAPA_SUPABASE_OK");
