import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { logger } from "../utils/logger";
import SkeletonLoader from "./SkeletonLoader";
import MateriaModal from "./MateriaModal";
import Libreta from "./Libreta";
import { limpiarNombre } from "../utils/limpiarNombre";

function colorAsistencia(porcentaje) {
  if (porcentaje >= 75) return "var(--aprobada)";
  if (porcentaje >= 60) return "var(--disponible)";
  return "var(--bloqueada-t)";
}

function colorPP(porcentaje) {
  if (porcentaje >= 50) return "var(--aprobada)";
  if (porcentaje >= 20) return "var(--disponible)";
  return "var(--bloqueada-t)";
}

export default function Dashboard({ session }) {
  const { session: authSession } = useAuth();
  const currentSession = session || authSession;

  const mapaQuery = currentSession?.carreraId
    ? `/mapa?carrera_id=${currentSession.carreraId}`
    : null;

  const { data: materiasRaw, loading: materiasLoading, error: materiasError } =
    useFetch("/materias", currentSession?.token);
  const { data: historialMaterias } = useFetch(
    "/mis-materias",
    currentSession?.token,
  );
  const { data: mapaRaw } = useFetch(mapaQuery, currentSession?.token);

  const materias = (materiasRaw || []).filter(
    (m) => m.anho === new Date().getFullYear(),
  );
  const mapaMaterias = mapaRaw?.materias || [];

  const [modalMateria, setModalMateria] = useState(null);
  const [mostrarLibreta, setMostrarLibreta] = useState(false);

  // Debug: loguear materias recibidas
  useEffect(() => {
    if (materiasRaw && materiasRaw.length > 0) {
      logger.debug("Materias recibidas del servidor", materiasRaw);
      logger.log("Materias de este año:", materias);
    }
  }, [materiasRaw, materias]);

  if (materiasLoading)
    return (
      <div className="main">
        <SkeletonLoader />
      </div>
    );
  if (materiasError)
    return (
      <div className="error-msg" style={{ padding: "2rem" }}>
        ⚠ {materiasError}
      </div>
    );

  return (
    <div className="main">
      <div style={{ marginBottom: "2rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div>
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
              {currentSession.carrera || "Informática"} · {new Date().getFullYear()}
            </div>
            <h1 style={{ fontSize: "1.0rem", fontWeight: "500", margin: 0 }}>
              {mostrarLibreta ? "Libreta de notas" : "Mis materias"}
            </h1>
          </div>

          {/* boton para cambiar entre secciones*/}
          <button
            onClick={() => setMostrarLibreta(!mostrarLibreta)}
            style={{
              background: mostrarLibreta ? "var(--accent)" : "var(--bg2)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "8px 16px",
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
              fontSize: ".75rem",
              fontWeight: "600",
              color: mostrarLibreta ? "white" : "var(--text-dim)",
              transition: "all 0.2s",
            }}
          >
            {mostrarLibreta ? "Mis materias" : "Libreta"}
          </button>
        </div>

        {!mostrarLibreta && (
          <span
            style={{
              fontSize: ".7rem",
              color: "var(--text-dim)",
              fontFamily: "Inter, sans-serif",
              display: "block",
              marginTop: ".5rem",
            }}
          >
            Click en cualquier materia para ver su detalle
          </span>
        )}
      </div>

      {!mostrarLibreta ? (
        // vista de materias
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "1rem",
          }}
        >
          {materias.map((m) => {
            const registro = m;
            const pp = registro?.porcentajePP ?? 0;
            const pAsistencia = registro?.porcentajeAsistencia ?? 0;

            return (
              <div
                key={m.id}
                className="card-materia"
                onClick={() => {
                  setModalMateria({
                    id: m.codigoMateria,
                    nombre: m.materia,
                    semestre: m.semestre,
                    estado: "cursando",
                  });
                }}
                style={{ cursor: "pointer" }}
              >
                <div>
                  <div style={{ fontWeight: "700", fontSize: ".95rem" }}>
                    {limpiarNombre(m.materia)}
                  </div>
                  <div
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: ".7rem",
                      color: "var(--text-dim)",
                    }}
                  >
                    Cód. {m.codigoMateria} · {m.semestre} Semestre
                  </div>
                </div>

                {/*Asistencia */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: ".75rem",
                      marginBottom: ".3rem",
                    }}
                  >
                    <span style={{ color: "var(--text-dim)" }}>Asistencia</span>
                    <span
                      style={{
                        color: colorAsistencia(pAsistencia),
                        fontWeight: "700",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      {pAsistencia}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: "3px",
                      background: "var(--border)",
                      borderRadius: "2px",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pAsistencia}%`,
                        background: colorAsistencia(pAsistencia),
                        borderRadius: "2px",
                      }}
                    />
                  </div>
                </div>

                {/*Promedio PP */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: ".75rem",
                      marginBottom: ".3rem",
                    }}
                  >
                    <span style={{ color: "var(--text-dim)" }}>
                      Promedio PP
                    </span>
                    <span
                      style={{
                        color: colorPP(pp),
                        fontWeight: "700",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      {pp}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: "3px",
                      background: "var(--border)",
                      borderRadius: "2px",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pp}%`,
                        background: colorPP(pp),
                        borderRadius: "2px",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    fontSize: ".65rem",
                    color: "var(--text-dim)",
                    fontFamily: "Inter, sans-serif",
                    borderTop: "1px solid var(--border)",
                    paddingTop: ".5rem",
                  }}
                ></div>
              </div>
            );
          })}
        </div>
      ) : (
        // Vista de libreta
        <Libreta session={session} />
      )}

      {/*Modal de detalle*/}
      {modalMateria && (
        <MateriaModal
          materia={modalMateria}
          historialMaterias={historialMaterias}
          session={session}
          mapaMaterias={mapaMaterias}
          onClose={() => setModalMateria(null)}
          onNavigate={(m) => setModalMateria(m)} // nuevo prop, abre la materia clickeada en un nuevo modal
        />
      )}
    </div>
  );
}
