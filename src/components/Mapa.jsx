/**
 * Mapa.jsx
 *
 * Vista que muestra todas las materias de la carrera organizadas por semestre.
 * Al hacer click en una materia, abre un modal con su detalle completo.
 *
 * Props:
 * @param {Object} session - { token, nombre, carreraId }
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { apiFetch } from "../api";
import { ESTADO_LABELS } from "../constants";
import Spinner from "./Spinner";
import NodoMateria from "./NodoMateria";
import MateriaModal from "./MateriaModal";

export default function Mapa({ session }) {
  const [mapa, setMapa] = useState(null); // Datos del mapa de correlativas
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalMateria, setModalMateria] = useState(null); //materia para el modal
  const [historialMaterias, setHistorialMaterias] = useState(null);

  // carga mapa de correlativas
  useEffect(() => {
    const query = session.carreraId ? `?carrera_id=${session.carreraId}` : "";
    apiFetch(`/mapa${query}`, { token: session.token })
      .then(setMapa)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [session.token, session.carreraId]);

  // carga el historial del alumno, materias, pp, asistencia
  useEffect(() => {
    if (!session?.token) return;
    apiFetch("/mis-materias", { token: session.token })
      .then(setHistorialMaterias)
      .catch(() => setHistorialMaterias([]));
  }, [session.token]);

  // Memoizar la organización por semestre
  const porSemestre = useMemo(
    () =>
      mapa
        ? mapa.materias.reduce((auxiliar, materia) => {
            if (!auxiliar[materia.semestre]) auxiliar[materia.semestre] = [];
            auxiliar[materia.semestre].push(materia);
            return auxiliar;
          }, {})
        : {},
    [mapa],
  );

  // Memoizar estadísticas
  const stats = useMemo(
    () =>
      mapa
        ? {
            total: mapa.materias.length,
            aprobadas: mapa.materias.filter((m) => m.estado === "aprobada")
              .length,
            cursando: mapa.materias.filter((m) => m.estado === "cursando")
              .length,
            disponibles: mapa.materias.filter((m) => m.estado === "disponible")
              .length,
          }
        : null,
    [mapa],
  );

  // Memoizar callback para evitar crear nueva función en cada render
  const handleClickNodo = useCallback((materia) => {
    setModalMateria(materia);
  }, []);

  if (loading) return <Spinner texto="Calculando tu mapa..." />;
  if (error)
    return (
      <div className="error-msg" style={{ padding: "2rem" }}>
        ⚠ {error}
      </div>
    );
  if (!mapa) return null;

  return (
    <div className="main">
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div
          style={{
            fontSize: ".75rem",
            textTransform: "uppercase",
            letterSpacing: "3px",
            color: "var(--text-dim)",
            fontFamily: "Inter, sans-serif",
            marginBottom: ".5rem",
          }}
        >
          {mapa.nombre}
        </div>
        <h1 style={{ fontSize: "1.0rem", fontWeight: "500" }}>
          Mapa de correlativas
        </h1>
        <span
          style={{
            fontSize: ".7rem",
            color: "var(--text-dim)",
            fontFamily: "Inter, sans-serif",
          }}
        >
          Click en cualquier materia para ver su detalle
        </span>
      </div>

      {/* colores para estados */}
      <div className="hero">
        <div className="hero-item">
          <div className="dot" style={{ background: "var(--aprobada)" }} />{" "}
          Aprobada ({stats.aprobadas})
        </div>
        <div className="hero-item">
          <div className="dot" style={{ background: "var(--cursando)" }} />{" "}
          Cursando ({stats.cursando})
        </div>
        <div className="hero-item">
          <div className="dot" style={{ background: "var(--disponible)" }} />{" "}
          Habilitada ({stats.disponibles})
        </div>
        <div className="hero-item">
          <div className="dot" style={{ background: "var(--bloqueada-t)" }} />{" "}
          No habilitada
        </div>
        <div className="hero-item" style={{ marginLeft: "auto" }}>
          <strong>
            {stats.aprobadas}/{stats.total}
          </strong>{" "}
          aprobadas
        </div>
      </div>

      {/* Materias por semestre */}
      {Object.keys(porSemestre)
        .sort((a, b) => a - b)
        .map((sem) => (
          <div key={sem} className="semestre-block">
            <div className="semestre-titulo">Semestre {sem}</div>
            <div className="materias-row">
              {porSemestre[sem].map((m) => (
                <NodoMateria key={m.id} materia={m} onClick={handleClickNodo} />
              ))}
            </div>
          </div>
        ))}

      {/* Modal */}
      {modalMateria && (
        <MateriaModal
          materia={modalMateria}
          historialMaterias={historialMaterias}
          session={session}
          mapaMaterias={mapa.materias}
          onClose={() => setModalMateria(null)}
          onNavigate={(m) => setModalMateria(m)} // nuevo prop, abre la materia clickeada en un nuevo modal
        />
      )}
    </div>
  );
}
