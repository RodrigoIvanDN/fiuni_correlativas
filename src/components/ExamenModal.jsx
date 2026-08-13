import { useEffect } from "react";

function colorPorcentaje(pct) {
  if (pct === null || pct === undefined || pct === "") return "var(--text-dim)";
  const n = Number(pct);
  if (Number.isNaN(n)) return "var(--text-dim)";
  if (n >= 50) return "var(--aprobada)";
  if (n >= 20) return "var(--disponible)";
  return "var(--bloqueada-t)";
}

// "2026-07-16T15:00:00" -> "Mie 16 jul 2026 - 15:00"
function formatearFechaHora(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const fecha = d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const hora = `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
  return `${fecha} · ${hora}`;
}

// "2026-07-16T15:00:00" -> "16/07/2026"
function formatearFecha(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Estado de la ventana de reclamos comparando con el momento actual:
//   "abierta"  -> hoy esta dentro del rango
//   "proxima"  -> el rango todavía no empezo
//   "cerrada"  -> el rango ya termino
//   null       -> no hay fechas de reclamo definidas
function estadoReclamo(inicio, fin) {
  if (!inicio || !fin) return null;
  const ahora = new Date();
  const i = new Date(inicio);
  const f = new Date(fin);
  if (isNaN(i.getTime()) || isNaN(f.getTime())) return null;
  if (ahora >= i && ahora <= f) return "abierta";
  if (ahora < i) return "proxima";
  return "cerrada";
}

const COLOR_RECLAMO = {
  abierta: "var(--aprobada)",
  proxima: "var(--disponible)",
  cerrada: "var(--text-dim)",
};

const TEXTO_RECLAMO = {
  abierta: "Ventana de reclamos abierta",
  proxima: "La ventana de reclamos aún no empieza",
  cerrada: "Ventana de reclamos cerrada",
};

function Fila({ etiqueta, valor }) {
  return (
    <div>
      <div
        style={{
          fontSize: ".6rem",
          textTransform: "uppercase",
          letterSpacing: "1.5px",
          color: "var(--text-dim)",
          fontFamily: "Inter, sans-serif",
          marginBottom: ".15rem",
        }}
      >
        {etiqueta}
      </div>
      <div style={{ fontSize: ".8rem", fontWeight: "500" }}>{valor || "—"}</div>
    </div>
  );
}

function Barra({ etiqueta, valor }) {
  const color = colorPorcentaje(valor);
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: ".7rem",
          marginBottom: ".3rem",
        }}
      >
        <span style={{ color: "var(--text-dim)" }}>{etiqueta}</span>
        <span style={{ color, fontWeight: "700", fontFamily: "Inter, sans-serif" }}>
          {valor === null || valor === undefined || valor === "" ? "—" : `${valor}%`}
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
            width: `${Math.min(Number(valor) || 0, 100)}%`,
            background: color,
            borderRadius: "2px",
          }}
        />
      </div>
    </div>
  );
}

export default function ExamenModal({ examen, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // datos ya normalizados
  const {
    materia,
    codigo,
    semestre,
    malla,
    carrera,
    anio,
    periodo,
    estado,
    tipo,
    motivo,
    asisOK,
    ppOK,
    calificacion,
    fecha,
    fechaInscripcion,
    usuarioInscripcion,
    fechaInicioReclamo,
    fechaFinReclamo,
    fechaAtencionReclamos,
    porcentajePP,
    porcentajePF,
    porcentajePC,
    esRecuperatorio,
    esInconsistente,
  } = examen;

  const reclamo = estadoReclamo(fechaInicioReclamo, fechaFinReclamo);
  const notaColor =
    calificacion === null || calificacion === undefined || calificacion === ""
      ? "var(--text-dim)"
      : Number(calificacion) >= 4
        ? "var(--aprobada)"
        : Number(calificacion) >= 2
          ? "var(--disponible)"
          : "var(--bloqueada-t)";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        zIndex: 400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "var(--bg3)",
          border: "1px solid var(--border2)",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "520px",
          maxHeight: "85vh",
          overflowY: "auto",
          padding: "1.75rem",
          position: "relative",
        }}
      >
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

        {/* header*/}
        {estado && <span className="badge-examen">{estado}</span>}
        {esRecuperatorio && (
          <span
            className="badge-examen"
            style={{ background: "rgba(214,158,46,0.15)", color: "var(--disponible)" }}
          >
            Recuperatorio
          </span>
        )}
        {esInconsistente && (
          <span
            className="badge-examen"
            style={{ background: "rgba(229,62,62,0.12)", color: "var(--bloqueada-t)" }}
          >
            Inconsistente
          </span>
        )}

        <div
          style={{
            fontSize: "1.2rem",
            fontWeight: "800",
            marginTop: ".6rem",
            marginBottom: ".25rem",
            paddingRight: "2rem",
          }}
        >
          {materia || "Materia sin nombre"}
        </div>
        <div
          style={{
            fontSize: ".7rem",
            color: "var(--text-dim)",
            fontFamily: "Inter, sans-serif",
            marginBottom: "1.25rem",
          }}
        >
          {[
            codigo,
            semestre ? `Semestre ${semestre}` : "",
            malla,
            carrera,
            anio ? `Año ${anio}` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>

        {/* fecha y hora del examen*/}
        <div
          style={{
            background: "var(--bg2)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "1rem",
            marginBottom: "1.25rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: ".6rem",
              textTransform: "uppercase",
              letterSpacing: "2px",
              color: "var(--text-dim)",
              fontFamily: "Inter, sans-serif",
              marginBottom: ".25rem",
            }}
          >
            Fecha y hora del examen
          </div>
          <div style={{ fontSize: "1.05rem", fontWeight: "700" }}>
            {formatearFechaHora(fecha) || "—"}
          </div>
        </div>

        {/* periodo e instancia*/}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: ".5rem",
            marginBottom: "1.25rem",
          }}
        >
          {periodo && <span className="badge-examen badge-examen-dim">{periodo}</span>}
          {tipo && <span className="badge-examen">{tipo}</span>}
          {motivo && <span className="badge-examen badge-examen-dim">Motivo: {motivo}</span>}
        </div>

        {/* calificacion*/}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: ".75rem",
            marginBottom: "1.25rem",
          }}
        >
          <span style={{ fontSize: "1.8rem", fontWeight: "800", color: notaColor }}>
            {calificacion === null || calificacion === undefined || calificacion === "" ||calificacion === 0
              ? "—"
              : calificacion}
          </span>
          <div style={{ fontSize: ".7rem", color: "var(--text-dim)" }}>
            Calificación
            {asisOK !== null &&
              (asisOK || ppOK) && (
                <div style={{ marginTop: ".2rem" }}>
                  {asisOK && <span style={{ color: "var(--aprobada)" }}>Asistencia ✓ </span>}
                  {ppOK && <span style={{ color: "var(--aprobada)" }}>PP ✓</span>}
                </div>
              )}
          </div>
        </div>

        {/* barras de porcentajes */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: ".7rem",
            marginBottom: "1.25rem",
            padding: "1rem",
            background: "var(--bg2)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
          }}
        >
          <Barra etiqueta="Promedio PP" valor={porcentajePP} />
          <Barra etiqueta="Promedio PF" valor={porcentajePF} />
          <Barra etiqueta="Promedio PC" valor={porcentajePC} />
        </div>

        {/* datos de inscripcion */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: ".75rem",
            marginBottom: "1.25rem",
          }}
        >
          <Fila etiqueta="Inscripción" valor={formatearFecha(fechaInscripcion)} />
    
        </div>

        {/* ventana de reclamos*/}
        <div
          style={{
            border: "1px dashed var(--border2)",
            borderRadius: "12px",
            padding: "1rem",
          }}
        >
          <div
            style={{
              fontSize: ".65rem",
              textTransform: "uppercase",
              letterSpacing: "2px",
              color: reclamo ? COLOR_RECLAMO[reclamo] : "var(--text-dim)",
              fontFamily: "Inter, sans-serif",
              fontWeight: "600",
              marginBottom: ".5rem",
            }}
          >
            {reclamo ? TEXTO_RECLAMO[reclamo] : "Reclamos"}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: ".5rem",
              fontSize: ".7rem",
              color: "var(--text-dim)",
            }}
          >
            <div>
              Desde: <strong style={{ color: "var(--text)" }}>{formatearFecha(fechaInicioReclamo)}</strong>
            </div>
            <div>
              Hasta: <strong style={{ color: "var(--text)" }}>{formatearFecha(fechaFinReclamo)}</strong>
            </div>
            <div>
              Atendimiento:{" "}
              <strong style={{ color: "var(--text)" }}>
                {formatearFecha(fechaAtencionReclamos)}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
