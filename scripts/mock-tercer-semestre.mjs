import { createServer } from "node:http";
import assert from "node:assert/strict";

const puerto = 8787;
const anho = new Date().getFullYear();
const materias = [
  { id: 11, codigoMateria: "300", materia: "Análisis Matemático III", semestre: "Tercer", anho, estado: "cursando", inscripto: true, porcentajeAsistencia: 90, porcentajePP: 0 },
  { id: 12, codigoMateria: "301", materia: "Física III", semestre: "Tercer", anho, estado: "cursando", inscripto: true, porcentajeAsistencia: 85, porcentajePP: 0 },
  { id: 13, codigoMateria: "302", materia: "Inglés II", semestre: "Tercer", anho, estado: "cursando", inscripto: true, porcentajeAsistencia: 100, porcentajePP: 0 },
  // Caso a reproducir: la API devuelve una materia de 5.º, pero no está inscripto.
  { id: 23, codigoMateria: "430", materia: "Inglés IV", semestre: "Quinto", anho, estado: "disponible", inscripto: false, porcentajeAsistencia: 0, porcentajePP: 0 },
];

const mapa = {
  nombre: "Ingeniería Informática — perfil demo",
  materias: materias.map(({ codigoMateria, materia, semestre, estado }) => ({
    id: codigoMateria,
    nombre: materia,
    semestre: semestre === "Tercer" ? 3 : 5,
    estado,
  })),
};

assert.equal(materias.filter((m) => m.inscripto).length, 3);
assert.equal(mapa.materias.find((m) => m.id === "430").estado, "disponible");

const responder = (res, estado, datos) => {
  res.writeHead(estado, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  });
  res.end(JSON.stringify(datos));
};

createServer((req, res) => {
  if (req.method === "OPTIONS") return responder(res, 204, {});
  const ruta = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (req.method === "POST" && ruta === "/auth/login") {
    return responder(res, 200, {
      token: "demo-tercer-semestre",
      id: "demo-tercero",
      nombre: "Alumno Demo — 3.º semestre",
      carrera: "Informática",
      carreraId: "demo-informatica",
    });
  }
  if (req.method === "GET" && ruta === "/materias") return responder(res, 200, materias);
  if (req.method === "GET" && ruta === "/mapa") return responder(res, 200, mapa);
  if (req.method === "GET" && ruta === "/mis-materias") return responder(res, 200, []);
  return responder(res, 404, { detail: "Ruta demo no encontrada" });
}).listen(puerto, () => {
  console.log(`Mock de 3.º semestre en http://127.0.0.1:${puerto}`);
});
