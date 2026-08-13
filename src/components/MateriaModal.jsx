import { useState, useEffect } from "react";
import { apiFetch } from "../api";
import { ESTADO_LABELS } from "../constants";
import { limpiarNombre } from "../utils/limpiarNombre";

//constantes de notas
const NOTAS = [
  { nota: 5, pcMin: 90 },
  { nota: 4, pcMin: 80 },
  { nota: 3, pcMin: 70 },
  { nota: 2, pcMin: 60 },
];

/**
 * calcula un porcentaje minimo en el examen final para alcanzar una nota
 *
 * Formula
 * Si PF >= PP -> PC = PF
 * Si PP > PF -> PC = PPx0.4 + PFx0.6
 * Es requerido minino un 60 en el final
 */
function pfNecesario(pp, pcObjetivo) {
  const pfObjetivo = (pcObjetivo - pp * 0.4) / 0.6;

  //si el pfObjetivo es menor a 60 (nota 2), retorna 60
  if (pfObjetivo <= 60) return pcObjetivo;

  if (pfObjetivo >= pp) return pcObjetivo; // si pfObjetivo ya es mayor o igual al pp el minimo es pcObjetivo (no tiene sentido que si pfObjetivo es <= 99  el minimo requerido sea ese)
  return Math.round(pfObjetivo);
}

function colorPP(pp) {
  if (pp >= 50) return "var(--aprobada)";
  if (pp >= 20) return "var(--disponible)";
  return "var(--bloqueada-t)";
}

function colorAsistencia(pct) {
  if (pct >= 75) return "var(--aprobada)";
  if (pct >= 60) return "var(--disponible)";
  return "var(--bloqueada-t)";
}

/**
 * formatea la fecha a "Vie 14 de mar 2025"
 */
function formatFecha(isoStr) {
  const d = new Date(isoStr);
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const meses = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  return `${dias[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Seccion colapsable, se usa dentro del modal
 */
function Seccion({ titulo, children, defaultAbierta = false }) {
  const [abierta, setAbierta] = useState(defaultAbierta);
  return (
    <div
      style={{
        borderTop: "1px solid var(--border)",
        paddingTop: "1rem",
        marginTop: "1rem",
      }}
    >
      <button
        onClick={() => setAbierta(!abierta)}
        style={{
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 0,
        }}
      >
        <span
          style={{
            fontSize: ".65rem",
            textTransform: "uppercase",
            letterSpacing: "2px",
            color: "var(--accent)",
            fontFamily: "Inter, sans-serif",
            fontWeight: "700",
          }}
        >
          {titulo}
        </span>
        <span style={{ fontSize: ".7rem", color: "var(--text-dim)" }}>
          {abierta ? "▲" : "▼"}
        </span>
      </button>
      {abierta && <div style={{ marginTop: ".75rem" }}>{children}</div>}
    </div>
  );
}

//Componente principal
export default function MateriaModal({
  materia,
  historialMaterias,
  session,
  mapaMaterias, // para obtener correlativas
  onClose,
  onNavigate, // agrego nuevo prop para navegar entre modales al clickear una materia  en la parte de "necesita aprobadas" y "habilita"
}) {
  const [asistencia, setAsistencia] = useState(null);
  const [cargandoAsist, setCargandoAsist] = useState(false);
  const [faltasCargadas, setFaltasCargadas] = useState(false);

  if (!materia) return null;  

  const { nombre: nombreRaw, id, semestre: semestreRaw, creditos, estado } = materia;
  const nombre = limpiarNombre(nombreRaw);
  const semestre = limpiarNombre(semestreRaw?.toString().replace('º', '')) ?? semestreRaw;

  // busca el registro de la materia clickeada, el pp y asistencia
  const registro = (historialMaterias || []).find((h) => {
    const hn = h.nombreMateria?.toLowerCase().replace(/\*/g, "").trim();
    //console.log("hn", hn);
    const mn = nombre?.toLowerCase().replace(/\*/g, "").trim();
    return h.codigoMateria?.trim() === id || hn === mn;
  });
  //console.log("registro", registro);

  const pp = registro?.porcentajePP ?? 0;
  const asistPct = registro?.porcentajeAsistencia ?? 0;
  const periodo = registro?.periodo?.label ?? "";
  const materiaPeriodoId = registro?.materiaPeriodoId; // para cargar las faltas

  const tienePP = pp > 0 || asistPct > 0;

  const estadoPp = pp >= 50 ? "final" : pp >= 20 ? "recuperatorio" : "recursa";

  //busca la materia en el mapa por ID o por nombre
  const materiaEnMapa = mapaMaterias?.find(
    (m) =>
      m.id === id ||
      m.nombre?.toLowerCase().replace(/\*/g, "").trim() ===
        nombre?.toLowerCase().replace(/\*/g, "").trim(),
  );

  const correlativas = materiaEnMapa?.correlativas || [];
  const correlativasRegular = materiaEnMapa?.correlativas_regular || [];

  // materias que se habilita esta materia
  const desbloquea =
    mapaMaterias?.filter(
      (m) =>
        m.correlativas?.includes(materiaEnMapa?.id) ||
        m.correlativas_regular?.includes(materiaEnMapa?.id),
    ) || [];

  //para buscar los nombres
  const mapaIds = Object.fromEntries(
    (mapaMaterias || []).map((m) => [m.id, m]),
  );

  function cargarFaltas() {
    if (faltasCargadas || !materiaPeriodoId || !session?.token) return;
    setFaltasCargadas(true);
    setCargandoAsist(true);
    apiFetch(`/asistencia/${materiaPeriodoId}`, {
      token: session.token,
      method: "POST",
    })
      .then(setAsistencia)
      .catch(() => setAsistencia({ error: true }))
      .finally(() => setCargandoAsist(false));
  }

  // procesar las faltas
  const faltas =
    asistencia && !asistencia.error
      ? (() => {
          const mapa = Object.fromEntries(
            (asistencia.studentAssists || []).map((sa) => [
              sa.assistanceId,
              sa.present,
            ]),
          );
          return (asistencia.assists || [])
            .filter((c) => mapa[c.id] === false)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        })()
      : [];

  const presentes =
    asistencia && !asistencia.error
      ? (() => {
          const mapa = Object.fromEntries(
            (asistencia.studentAssists || []).map((sa) => [
              sa.assistanceId,
              sa.present,
            ]),
          );
          return (asistencia.assists || []).filter((c) => mapa[c.id] === true)
            .length;
        })()
      : 0;

  const totalClases = asistencia?.assists?.length ?? 0;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-content">
        {/* boton cerrar */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1.25rem",
            right: "1.25rem",
            background: "none",
            border: "none",
            color: "var(--text-dim)",
            cursor: "pointer",
            fontSize: "1rem",
          }}
        >
          ✕
        </button>

        {/* header con estado */}
        <span
          className={`panel-estado-badge badge-${estado}`}
          style={{ marginBottom: ".75rem" }}
        >
          {ESTADO_LABELS[estado]}
        </span>
        <div
          style={{
            fontSize: "1.2rem",
            fontWeight: "800",
            marginBottom: ".25rem",
            paddingRight: "2rem",
          }}
        >
          {nombre}
        </div>
        <div
          style={{
            fontSize: ".7rem",
            color: "var(--text-dim)",
            fontFamily: "Inter, sans-serif",
            marginBottom: "1.25rem",
          }}
        >
          {id} · Semestre {semestre}
          {creditos ? ` · ${creditos} créditos` : ""}
          {periodo ? ` · ${periodo}` : ""}
        </div>

        {/* pp y asistencias*/}
        {tienePP ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
              marginBottom: "1rem",
            }}
          >
            {/* PP */}
            <div
              style={{
                background: "var(--bg2)",
                borderRadius: "10px",
                padding: "12px 14px",
                borderLeft: `3px solid ${colorPP(pp)}`,
              }}
            >
              <div
                style={{
                  fontSize: ".65rem",
                  color: "var(--text-dim)",
                  fontFamily: "Inter, sans-serif",
                  marginBottom: "4px",
                }}
              >
                PROMEDIO PP
              </div>
              <div
                style={{
                  fontSize: "1.6rem",
                  fontWeight: "800",
                  color: colorPP(pp),
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {pp}%
              </div>
              <div
                style={{
                  fontSize: ".65rem",
                  color: colorPP(pp),
                  fontFamily: "Inter, sans-serif",
                  marginTop: "2px",
                }}
              >
                {
                  {
                    final: "puede rendir final",
                    recuperatorio: "solo recuperatorio",
                    recursa: "recursa",
                  }[estadoPp]
                }
              </div>
            </div>

            {/* Asistencia */}
            <div
              style={{
                background: "var(--bg2)",
                borderRadius: "10px",
                padding: "12px 14px",
                borderLeft: `3px solid ${colorAsistencia(asistPct)}`,
              }}
            >
              <div
                style={{
                  fontSize: ".65rem",
                  color: "var(--text-dim)",
                  fontFamily: "Inter, sans-serif",
                  marginBottom: "4px",
                }}
              >
                ASISTENCIA
              </div>
              <div
                style={{
                  fontSize: "1.6rem",
                  fontWeight: "800",
                  color: colorAsistencia(asistPct),
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {asistPct}%
              </div>
              <div
                style={{
                  fontSize: ".65rem",
                  color: colorAsistencia(asistPct),
                  fontFamily: "Inter, sans-serif",
                  marginTop: "2px",
                }}
              >
                {asistPct >= 75
                  ? "regularidad ok"
                  : asistPct >= 60
                    ? "en riesgo"
                    : "sin regularidad"}
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              fontSize: ".8rem",
              color: "var(--text-dim)",
              fontFamily: "Inter, sans-serif",
              padding: "1rem",
              background: "var(--bg2)",
              borderRadius: "8px",
              textAlign: "center",
              marginBottom: "1rem",
            }}
          >
            Sin historial de cursado
          </div>
        )}

        {/* seccion para calcular nota, solo se habilita si el pp es mayor a 50 */}
        {tienePP && estadoPp === "final" && (
          <Seccion titulo="Calculador de notas" defaultAbierta={true}>
            <div
              style={{
                fontSize: ".65rem",
                color: "var(--text-dim)",
                fontFamily: "Inter, sans-serif",
                marginBottom: "10px",
              }}
            >
              Con PP {pp}% — mínimo necesario en el final:
            </div>
            {NOTAS.map(({ nota, pcMin }) => {
              const pf = pfNecesario(pp, pcMin);
              const imposible = pf > 100;
              return (
                <div
                  key={nota}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "7px 0",
                    borderBottom: "1px solid var(--border)",
                    fontSize: ".8rem",
                  }}
                >
                  <span style={{ fontWeight: "700" }}>Nota {nota}</span>
                  <span
                    style={{
                      fontFamily: "Inter, sans-serif",
                      color: imposible
                        ? "var(--bloqueada-t)"
                        : "var(--text-dim)",
                    }}
                  >
                    {imposible ? "imposible con este PP" : `${pf}% mínimo`}
                  </span>
                </div>
              );
            })}
          </Seccion>
        )}

        {/*seccion de las correlativas de la materia*/}
        {(correlativas.length > 0 ||
          correlativasRegular.length > 0 ||
          desbloquea.length > 0) && (
          <Seccion titulo="Correlativas" defaultAbierta={true}>
            {correlativas.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <div
                  style={{
                    fontSize: ".65rem",
                    color: "var(--accent)",
                    fontFamily: "Inter, sans-serif",
                    marginBottom: "6px",
                  }}
                >
                  Necesita aprobadas:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {correlativas.map((cid) => {
                    const m = mapaIds[cid];
                    const ok = m?.estado === "aprobada";
                    const clickable = m && onNavigate;
                    return (
                      <span
                        key={cid}
                        onClick={() => {
                          if (!clickable) return;
                          onClose();
                          onNavigate(m); // te lleva al modal de la materia cickeada
                        }}
                        style={{
                          padding: "2px 10px",
                          borderRadius: "20px",
                          fontSize: ".7rem",
                          fontFamily: "Inter, sans-serif",
                          background: ok  
                            ? "rgba(29,185,84,0.15)"
                            : "rgba(255,77,77,0.1)",
                          border: `1px solid ${ok ? "var(--aprobada)" : "var(--bloqueada-t)"}`,
                          color: ok ? "var(--aprobada)" : "var(--bloqueada-t)",
                          cursor: clickable ? "pointer" : "default",
                        }}
                      >
                        {ok ? "✓" : "✕"} {m ? m.nombre : cid}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Necesita regularidad */}
            {correlativasRegular.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <div
                  style={{
                    fontSize: ".65rem",
                    color: "var(--accent)",
                    fontFamily: "Inter, sans-serif",
                    marginBottom: "6px",
                  }}
                >
                  Necesita regularidad (aprobada o cursando):
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {correlativasRegular.map((cid) => {
                    const m = mapaIds[cid];
                    const ok =
                      m?.estado === "aprobada" || m?.estado === "cursando";
                    const clickable = m && onNavigate;
                    return (
                      <span
                        key={cid}
                        onClick={() => {
                          if (!clickable) return;
                          onClose();
                          onNavigate(m);
                        }}
                        style={{
                          padding: "2px 10px",
                          borderRadius: "20px",
                          fontSize: ".7rem",
                          fontFamily: "Inter, sans-serif",
                          background: ok
                            ? "rgba(29,185,84,0.15)"
                            : "rgba(255,77,77,0.1)",
                          border: `1px solid ${ok ? "var(--aprobada)" : "var(--bloqueada-t)"}`,
                          color: ok ? "var(--aprobada)" : "var(--bloqueada-t)",
                          cursor: clickable ? "pointer" : "default",
                        }}
                      >
                        {ok ? "✓" : "✕"} {m ? m.nombre : cid}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/*habilita*/}
            {desbloquea.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <div
                  style={{
                    fontSize: ".65rem",
                    color: "var(--accent)",
                    fontFamily: "Inter, sans-serif",
                    marginBottom: "6px",
                  }}
                >
                  Habilita (materias que podés cursar después):
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {desbloquea.map((m) => (
                    <span
                      key={m.id}
                      onClick={() => {
                        if (!onNavigate) return;
                        onClose();
                        onNavigate(m);
                      }}
                      style={{
                        padding: "2px 10px",
                        borderRadius: "20px",
                        fontSize: ".7rem",
                        fontFamily: "Inter, sans-serif",
                        background: "rgba(29,185,84,0.1)",
                        border: "1px solid var(--aprobada)",
                        cursor: onNavigate ? "pointer" : "default",
                      }}
                    >
                      {m.nombre}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Seccion>
        )}

        {/* seccion para las faltas*/}
        {tienePP && materiaPeriodoId && (
          <Seccion titulo="Mis faltas" defaultAbierta={false}>
            {!faltasCargadas ? (
              <button
                onClick={cargarFaltas}
                style={{
                  background: "none",
                  border: "1px solid var(--border2)",
                  borderRadius: "6px",
                  padding: "6px 14px",
                  cursor: "pointer",
                  fontSize: ".7rem",
                  color: "var(--accent)",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Cargar faltas
              </button>
            ) : cargandoAsist ? (
              <div
                style={{
                  fontSize: ".75rem",
                  color: "var(--text-dim)",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Cargando...
              </div>
            ) : asistencia?.error ? (
              <div
                style={{
                  fontSize: ".75rem",
                  color: "var(--bloqueada-t)",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                No se pudo cargar la asistencia
              </div>
            ) : (
              <>
                <div
                  style={{
                    fontSize: ".7rem",
                    color: "var(--text-dim)",
                    fontFamily: "Inter, sans-serif",
                    marginBottom: "10px",
                  }}
                >
                  {presentes} presentes · {faltas.length} ausentes ·{" "}
                  {totalClases} clases totales
                </div>
                {faltas.length === 0 ? (
                  <div
                    style={{
                      fontSize: ".75rem",
                      color: "var(--aprobada)",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    Sin faltas registradas
                  </div>
                ) : (
                  faltas.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "6px 0",
                        borderBottom: "1px solid var(--border)",
                        fontSize: ".75rem",
                      }}
                    >
                      <span
                        style={{
                          color: "var(--bloqueada-t)",
                          fontFamily: "Inter, sans-serif",
                          fontSize: ".65rem",
                        }}
                      >
                        ✕
                      </span>
                      <span
                        style={{
                          color: "var(--text-dim)",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        {formatFecha(c.date)}
                      </span>
                      {c.reference && (
                        <span
                          style={{
                            color: "var(--text-dim)",
                            fontSize: ".65rem",
                            marginLeft: "auto",
                          }}
                        >
                          {c.reference}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </>
            )}
          </Seccion>
        )}
      </div>
    </div>
  );
}
