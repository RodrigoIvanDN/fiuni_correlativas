import assert from "node:assert/strict";
import { esMateriaCursando } from "../src/utils/esMateriaCursando.js";

const anho = new Date().getFullYear();
assert.equal(esMateriaCursando({ anho, inscripto: true, estado: "cursando" }), true);
assert.equal(esMateriaCursando({ anho, inscripto: false, estado: "disponible" }), false);
assert.equal(esMateriaCursando({ anho, estado: "habilitada" }), false);
assert.equal(esMateriaCursando({ anho: anho - 1, inscripto: true }), false);
assert.equal(
  [{ anho, inscripto: true, estado: "cursando" }].filter((materia) =>
    esMateriaCursando(materia),
  ).length,
  1,
);
console.log("CHECK_TERCER_SEMESTRE_OK");
