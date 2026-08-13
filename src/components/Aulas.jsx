import { useState, useEffect } from "react";
import { apiFetch } from "../api";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const MIN_LIBRE_MIN = 30;
const REFRESH_MS = 60 * 60 * 1000; //actualizar "ocupadas ahora" cada 60 minutos

function enMinutos(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + (m || 0);
}

function formatearMin(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// hora y dia "ahora" desde el navegador
// El dia se convierte del formato de JS (0=Domingo, 6=Sabado) al de la tabla
// (1=Lunes, 7=Domingo), la hora va con cero a la izquierda ("09:05") para que
// el backend la compare correctamente como texto
function ahoraDia() {
  return ((new Date().getDay() + 6) % 7) + 1; //aca le sumamos un dia para que coincida
}

function ahoraHora() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function Aulas() {
  const [aulas, setAulas] = useState([]);
  const [aulaSeleccionada, setAulaSeleccionada] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [horarios, setHorarios] = useState({});
  const [cargando, setCargando] = useState(true);
  // Estado de la vista "ocupadas ahora" (cuando no hay aula seleccionada)
  const [ocupadas, setOcupadas] = useState([]); 
  const [infoOcupadas, setInfoOcupadas] = useState(null); // dia, hora de la ultima consulta
  const [cargandoOcupadas, setCargandoOcupadas] = useState(true);
  const [errorOcupadas, setErrorOcupadas] = useState(false);

  // lista de aulas para las tarjetitas y para calcular las libres
  useEffect(() => {
    apiFetch("/aulas")
      .then((data) =>
        setAulas(
          data?.aulas?.length ? data.aulas : AULAS_PLACEHOLDER,
        ),
      )
      .catch(() => setAulas(AULAS_PLACEHOLDER))
      .finally(() => setCargando(false));
  }, []);

  // Consulta al backend las aulas ocupadas en el di/hora actual del alumno
  useEffect(() => {
    if (aulaSeleccionada) return;

    let activo = true; // evita setState despues de desmontar

    const pedirOcupadas = () => {
      const dia = ahoraDia();
      const hora = ahoraHora();
      apiFetch(`/aulas/ocupadas?dia=${dia}&hora=${encodeURIComponent(hora)}`)
        .then((data) => {
          if (!activo) return;
          setOcupadas(data?.ocupadas || []);
          setInfoOcupadas({
            dia: data?.dia ?? dia,
            hora: data?.hora ?? hora,
          });
          setErrorOcupadas(false);
        })
        .catch(() => {
          if (!activo) return;
          setOcupadas([]);
          setInfoOcupadas(null);
          setErrorOcupadas(true);
        })
        .finally(() => {
          if (activo) setCargandoOcupadas(false);
        });
    };

    setCargandoOcupadas(true);
    pedirOcupadas();
    const intervalo = setInterval(pedirOcupadas, REFRESH_MS);

    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [aulaSeleccionada]);

  // horario de cada aula 
  useEffect(() => {
    if (!aulaSeleccionada) return;
    if (horarios[aulaSeleccionada]) return;
    apiFetch(`/aulas/${encodeURIComponent(aulaSeleccionada)}`)
      .then((data) =>
        setHorarios((prev) => ({
          ...prev,
          [aulaSeleccionada]: data?.horario || [],
        })),
      )
      .catch(() =>
        setHorarios((prev) => ({
          ...prev,
          [aulaSeleccionada]: HORARIO_PLACEHOLDER[aulaSeleccionada] || [],
        })),
      );
  }, [aulaSeleccionada, horarios]);

  const horario = horarios[aulaSeleccionada] || [];

  // Aulas libres ahora = todas las aulas menos las ocupadas
  // "todas" sale de la misma lista que se usa para las tarjetitas, asi no hacemos otra llamada al backend
  const libres = aulas.filter((a) => !ocupadas.some((o) => o.aula === a));

  // Aulas filtradas por el buscador 
  const consulta = busqueda.trim().toLowerCase();
  const aulasFiltradas = consulta
    ? aulas.filter((a) => a.toLowerCase().includes(consulta))
    : aulas;

  // por dia,b loques ordenados con "Libre" en los huecos entre clases
  const bloquesPorDia = DIAS.map((_, idx) => {
    const diaNum = idx + 1;
    const slots = horario
      .filter((h) => h.dia === diaNum)
      .sort((a, b) => enMinutos(a.hora_inicio) - enMinutos(b.hora_inicio));
    const bloques = [];
    let finAnterior = 7 * 60; //primer bloque comienza a las 7
    slots.forEach((s, i) => {
      const inicio = enMinutos(s.hora_inicio);
      const fin = enMinutos(s.hora_fin);
      if (i === 0 && inicio - 7 * 60 >= MIN_LIBRE_MIN)
        bloques.push({ libre: true, desde: 7 * 60, hasta: inicio });
      if (i > 0 && inicio - finAnterior >= MIN_LIBRE_MIN)
        bloques.push({ libre: true, desde: finAnterior, hasta: inicio });
      bloques.push(s);
      finAnterior = fin;
    });
    if (slots.length > 0 && 22 * 60 - finAnterior >= MIN_LIBRE_MIN)
      bloques.push({ libre: true, desde: finAnterior, hasta: 22 * 60 });
    if (slots.length === 0) bloques.push({ libre: true, desde: 7 * 60, hasta: 22 * 60 });
    return { diaNum, bloques };
  });

  if (cargando || cargandoOcupadas) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <div className="spinner" />
        <span style={{ color: "var(--text-dim)" }}>Cargando aulas...</span>
      </div>
    );
  }

  return (
    <div className="main">
      <div style={{ marginBottom: "1.5rem" }}>
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
          Aulas
        </div>
        <h1 style={{ fontSize: "1rem", fontWeight: "500", margin: 0 }}>
          Disponibilidad de aulas
        </h1>
      </div>

      {/* buscador y selector de aulas*/}
      <div className="aulas-picker">
        <input
          type="search"
          className="aulas-search"
          placeholder="Buscar aula: '15', 'lab', 'auditorio'..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar aula"
        />
        <div className="aulas-chips">
          {aulasFiltradas.map((a) => (
            <button
              key={a}
              className={`aulas-chip ${aulaSeleccionada === a ? "activo" : ""}`}
              onClick={() =>
                setAulaSeleccionada(aulaSeleccionada === a ? "" : a)
              }
            >
              {a}
            </button>
          ))}
          {aulasFiltradas.length === 0 && (
            <span
              style={{
                fontSize: ".7rem",
                color: "var(--text-dim)",
                fontFamily: "Inter, sans-serif",
                whiteSpace: "nowrap",
              }}
            >
              Sin resultados para "{busqueda}"
            </span>
          )}
        </div>
      </div>

      {!aulaSeleccionada && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/*Aulas ocupadas ahora*/}
          <div>
            <div style={{ marginBottom: ".75rem" }}>
              <span
                style={{
                  fontSize: ".7rem",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                  color: "var(--accent)",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Aulas ocupadas ahora
              </span>
              {infoOcupadas && (
                <span
                  style={{
                    fontSize: ".65rem",
                    color: "var(--text-dim)",
                    fontFamily: "Inter, sans-serif",
                    marginLeft: ".5rem",
                  }}
                > 
                </span>
              )}
            </div>

            {errorOcupadas && (
              <div
                style={{
                  padding: "1rem",
                  textAlign: "center",
                  color: "var(--text-dim)",
                  fontSize: ".8rem",
                  fontFamily: "Inter, sans-serif",
                  background: "var(--bg3)",
                  borderRadius: "12px",
                  border: "1px dashed var(--border2)",
                }}
              >
                No se pudo obtener la disponibilidad actual
              </div>
            )}

            {!errorOcupadas && ocupadas.length === 0 && (
              <div
                style={{
                  padding: "1rem",
                  textAlign: "center",
                  color: "var(--text-dim)",
                  fontSize: ".8rem",
                  fontFamily: "Inter, sans-serif",
                  background: "var(--bg3)",
                  borderRadius: "12px",
                  border: "1px dashed var(--border2)",
                }}
              >
                No hay aulas ocupadas ahora
              </div>
            )}

            {ocupadas.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: ".6rem",
                }}
              >
                {ocupadas.map((o, idx) => (
                  <div
                    key={idx}
                    className="card-materia"
                    style={{ flexDirection: "row", flexWrap: "wrap" }}
                  >
                    <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                      <div style={{ fontWeight: "700", fontSize: ".9rem" }}>
                        {o.aula}
                      </div>
                      <div
                        style={{
                          fontSize: ".65rem",
                          color: "var(--text-dim)",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        {o.hora_inicio}–{o.hora_fin}
                      </div>
                    </div>
                    <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: "600",
                          fontSize: ".8rem",
                          color: "var(--cursando)",
                        }}
                      >
                        {o.materia}
                      </div>
                      <div
                        style={{
                          fontSize: ".7rem",
                          color: "var(--text-dim)",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        {o.curso}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/*Aulas libres ahora */}
          <div>
            <div style={{ marginBottom: ".75rem" }}>
              <span
                style={{
                  fontSize: ".7rem",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                  color: "var(--aprobada)",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Aulas libres ahora
              </span>
              <span
                style={{
                  fontSize: ".65rem",
                  color: "var(--text-dim)",
                  fontFamily: "Inter, sans-serif",
                  marginLeft: ".5rem",
                }}
              >
             
              </span>
            </div>

            {libres.length === 0 && (
              <div
                style={{
                  padding: "1rem",
                  textAlign: "center",
                  color: "var(--text-dim)",
                  fontSize: ".8rem",
                  fontFamily: "Inter, sans-serif",
                  background: "var(--bg3)",
                  borderRadius: "12px",
                  border: "1px dashed var(--border2)",
                }}
              >
                No hay aulas libres ahora
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: ".4rem" }}>
              {libres.map((a) => (
                <span key={a} className="aulas-libre-chip">
                  {a}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {aulaSeleccionada && (
        <div className="aulas-grid-wrap">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(140px, 1fr))",
              background: "var(--bg3)",
              borderRadius: "12px",
              border: "1px solid var(--border)",
              overflow: "hidden",
            }}
          >
            {/* header dias */}
            {DIAS.map((d) => (
              <div
                key={d}
                style={{
                  padding: ".6rem .25rem",
                  textAlign: "center",
                  fontSize: ".7rem",
                  fontWeight: "600",
                  color: "var(--text-dim)",
                  fontFamily: "Inter, sans-serif",
                  background: "var(--bg2)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {d}
              </div>
            ))}
            {/* bloques por dia */}
            {bloquesPorDia.map(({ diaNum, bloques }) => (
              <div
                key={diaNum}
                style={{
                  border: "1px solid var(--border)",
                  padding: ".4rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: ".3rem",
                  minHeight: "120px",
                }}
              >
                {bloques.length === 0 && (
                  <div className="aulas-libre">Libre</div>
                )}
                {bloques.map((b, i) =>
                  b.libre ? (
                    <div key={i} className="aulas-libre">
                      {formatearMin(b.desde)} · Libre
                    </div>
                  ) : (
                    <div key={i} className="aulas-clase">
                      <div className="aulas-hora">
                        {b.hora_inicio}–{b.hora_fin}
                      </div>
                      <div className="aulas-materia">{b.materia}</div>
                      <div className="aulas-curso">{b.curso}</div>
                    </div>
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
