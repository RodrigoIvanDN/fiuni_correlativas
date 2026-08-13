import { useState, useEffect } from "react";
import { apiFetch } from "../api";
import { limpiarNombre } from "../utils/limpiarNombre";
import ExamenModal from "./ExamenModal";

/**
 * convierte cualquier valor a texto seguro para mostrar en la ui
 */
function aTexto(valor) {
  if (valor === null || valor === undefined) return "";
  // Objetos del estilo { value: 1, label: "Aprobado" }
  if (typeof valor === "object") {
    // preferimos el label (texto legible), si no el value
    if (valor.label !== undefined && valor.label !== null) return String(valor.label);
    if (valor.nombre !== undefined && valor.nombre !== null) return String(valor.nombre);
    if (valor.value !== undefined && valor.value !== null) return String(valor.value);
    // de ultima un json plano 
    try {
      return JSON.stringify(valor);
    } catch {
      return "";
    }
  }
  return String(valor);
}

/**
 * Extrae el nombre de la materia desde el item de examen
 * La FIUNI a veces lo manda como string ("Algebra*") y a veces como objeto
 * ({ nombre: "Algebra" })
 */
function nombreMateria(item) {
  // Si el campo materia es un objeto, buscamos el nombre dentro
  if (item.materia && typeof item.materia === "object") {
    return limpiarNombre(aTexto(item.materia));
  }
  // si es string, se usa directo
  if (item.materia) return limpiarNombre(String(item.materia));
  // algunas variantes de la API usan materiaNombre o nombre
  return limpiarNombre(aTexto(item.materiaNombre ?? item.nombre));
}

/**
 * Normaliza UN item de examen a una forma unica */
function normalizarExamen(e) {
  if (!e || typeof e !== "object") {
    return null;
  }
  // instancia puede ser objeto { value, label, item: { asis, pp, motivo } }
  const inst = e.instancia && typeof e.instancia === "object" ? e.instancia : null;
  // estadoExamen es objeto { value, label } en my-exams
  const estadoObj =
    e.estadoExamen && typeof e.estadoExamen === "object" ? e.estadoExamen : null;
  return {
    // id para el key de React 
    id: e.id ?? e.examenId ?? e.inscripcionId ?? null,
    // Materia: puede ser string u objeto 
    materia: nombreMateria(e),
    // Codigo de la materia (codMateria en my-exams)
    codigo: aTexto(e.codMateria ?? e.codigoMateria ?? e.materiaCodigo),
    // Semestre de la materia (si viene)
    semestre: aTexto(e.semestre),
    // Malla de la carrera (objeto con label) 
    malla: aTexto(e.malla ?? e.mallaCodigo),
    carrera: aTexto(e.carrera),
    // Anho de inscripcion (my-exams)
    anio: aTexto(e.anioInscripcion ?? e.anioCursada),
    // Calificacion: numero (0-5) o string, puede no existir (examen sin nota)
    calificacion: e.calificacion ?? e.nota ?? null,
    // Estado del examen: OBJETO {value,label} o string -> aTexto lo arregla
    estado: aTexto(e.estado ?? e.estadoExamen),
    // valor numerico del estado (Activo=0, Sellado=1, Confirmar Notas=4)
    estadoValue: estadoObj?.value ?? null,
    // Instancia/tipo: final, complementario, recuperatorio
    tipo: aTexto(e.tipo ?? e.tipoExamen ?? e.instancia),
    // Motivo de habilitacion de la instancia ("PP > 49")
    motivo: aTexto(inst?.item?.motivo ?? e.motivo),
    // Habilitaciones de la instancia (asistencia / PP)
    asisOK: inst?.item?.asis ?? null,
    ppOK: inst?.item?.pp ?? null,
    // Fecha del examen (fechaExamen en my-exams, fecha en /exams/all)
    fecha: aTexto(e.fechaExamen ?? e.fecha ?? e.fechaHora),
    // Turno / hora (varia tambien segun el endpoint)
    turno: aTexto(e.turno ?? e.hora),
    // Periodo del examen: Ordinario / Complementario / Regularizacion
    periodo: aTexto(e.periodo),
    // Datos de la inscripcion (my-exams)
    fechaInscripcion: aTexto(e.fechaInscripcion),
    usuarioInscripcion: aTexto(e.usuarioInscripcion),
    // Ventana de reclamos (my-exams)
    fechaInicioReclamo: aTexto(e.fechaInicioReclamo),
    fechaFinReclamo: aTexto(e.fechaFinReclamo),
    fechaAtencionReclamos: aTexto(e.fechaAtencionReclamos),
    // Porcentajes (PP/PF/PC) que a veces manda my-exams
    porcentajePP: e.porcentajePP ?? null,
    porcentajePF: e.porcentajePF ?? null,
    porcentajePC: e.porcentajePC ?? null,
    // Flags
    esRecuperatorio: Boolean(e.esRecuperatorio ?? inst?.item?.esRecuperatorio),
    esInconsistente: Boolean(e.esInconsistente),
    //crudo: para que el modal de detalle pueda leer cualquier campo extra
    crudo: e,
  };
}

/**
 * Recibe la respuesta cruda de un endpoint y devuelve la lista de items
 * normalizados, elimina los items invalidos
 */
function normalizarRespuesta(data) {
  const lista = Array.isArray(data) ? data : data?.items ?? [];
  return lista
    .map(normalizarExamen) 
    .filter(Boolean); 
}

function colorNota(cal) {
  if (cal === null || cal === undefined || cal === "") return "var(--text-dim)";
  const n = Number(cal);
  if (Number.isNaN(n)) return "var(--text-dim)";
  if (n >= 2) return "var(--aprobada)";


  return "var(--bloqueada-t)";
}

/**
 * Formatea una fecha a formato corto legible "14 mar 2026", si la fecha no es valida, devuelve el texto original
 */
function formatearFecha(fechaStr) {
  if (!fechaStr) return "";
  const d = new Date(fechaStr);
  if (isNaN(d.getTime())) return fechaStr;
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function estiloSelect() {
  return {
    background: "var(--bg2)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    color: "var(--text)",
    fontSize: ".75rem",
    padding: ".45rem .7rem",
    fontFamily: "Inter, sans-serif",
  };
}


export default function Examenes({ session }) {
  const [examenes, setExamenes] = useState([]);
  const [fuente, setFuente] = useState(""); //solo para saber de que endpoint 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [examenSeleccionado, setExamenSeleccionado] = useState(null);

  // carga de datos, con fallback a otro endpoint
  // Si el primero falla o viene vacio se prueba el segundo
  // Solo si ambos fallan se muestra el error
  useEffect(() => {
    if (!session?.token) return;
    // funcion que pide un endpoint y normaliza la respuesta
    const pedir = (path) =>
      apiFetch(path, { method: "POST", token: session.token })
        .then((data) => normalizarRespuesta(data));

    (async () => {
      try {
        //  /exams 
        const exams = await pedir("/exams");
        if (exams.length > 0) {
          setExamenes(exams);
          setFuente("exams");
          return;
        }
        // /examenes (historial) - si /exams vino vacio
        const historial = await pedir("/examenes");
        setExamenes(historial);
        setFuente("examenes");
      } catch (err) {
        //  si /exams fall, probar el historial
        try {
          const historial = await pedir("/examenes");
          setExamenes(historial);
          setFuente("examenes");
        } catch (err2) {
          // los dos fallaron -> mostrar el error del segundo intento
          setError(err2.message || err.message);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [session.token]);

  // opciones de filtros
  const periodos = [...new Set(examenes.map((e) => e.periodo).filter(Boolean))];
  const estados = [...new Set(examenes.map((e) => e.estado).filter(Boolean))];
  const tipos = [...new Set(examenes.map((e) => e.tipo).filter(Boolean))];

  //lista filtrada
  const visibles = examenes.filter((e) => {
    if (filtroPeriodo !== "todos" && e.periodo !== filtroPeriodo) return false;
    if (filtroEstado !== "todos" && e.estado !== filtroEstado) return false;
    if (filtroTipo !== "todos" && e.tipo !== filtroTipo) return false;
    if (
      busqueda.trim() &&
      !e.materia.toLowerCase().includes(busqueda.trim().toLowerCase())
    )
      return false;
    return true;
  });

  const total = visibles.length;
  const aprobados = visibles.filter((e) => Number(e.calificacion) >= 2).length;
  const reprobados = visibles.filter(
    (e) =>
      e.calificacion !== null &&
      e.calificacion !== undefined &&
      e.calificacion !== "" &&
      Number(e.calificacion) < 2,
  ).length;
  // pendientes, sin calificacion todavia
  const pendientes = visibles.filter((e) => e.estadoValue === 0).length;

  // estados de carga
  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <div className="spinner" />
        <span style={{ color: "var(--text-dim)" }}>Cargando exámenes...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          color: "var(--bloqueada-t)",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        ⚠ Error: {error}
      </div>
    );
  }

  if (examenes.length === 0) {
    return (
      <div
        style={{
          padding: "2rem",
          textAlign: "center",
          color: "var(--text-dim)",
        }}
      >
        No hay exámenes registrados
      </div>
    );
  }

  return (
    <div className="main">
        {/* filtros*/}
      {(periodos.length > 0 ||
        estados.length > 0 ||
        tipos.length > 0) && (
        <div
          style={{
            display: "flex",
            gap: ".5rem",
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <input
            type="text"
            placeholder="Buscar materia..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              ...estiloSelect(),
              flex: "1 1 160px",
              minWidth: "140px",
            }}
          />
          {periodos.length > 0 && (
            <select
              value={filtroPeriodo}
              onChange={(e) => setFiltroPeriodo(e.target.value)}
              style={estiloSelect()}
            >
              <option value="todos">Periodo: todos</option>
              {periodos.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
          {estados.length > 0 && (
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              style={estiloSelect()}
            >
              <option value="todos">Estado: todos</option>
              {estados.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          {tipos.length > 0 && (
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              style={estiloSelect()}
            >
              <option value="todos">Instancia: todas</option>
              {tipos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
          {(filtroPeriodo !== "todos" ||
            filtroEstado !== "todos" ||
            filtroTipo !== "todos" ||
            busqueda.trim() !== "") && (
            <button
              onClick={() => {
                setFiltroPeriodo("todos");
                setFiltroEstado("todos");
                setFiltroTipo("todos");
                setBusqueda("");
              }}
              style={{
                ...estiloSelect(),
                cursor: "pointer",
                color: "var(--bloqueada-t)",
                borderColor: "var(--bloqueada)",
              }}
            >
              ✕ Limpiar
            </button>
          )}
        </div>
      )}

      {/* lista de examenes */}
      {visibles.length === 0 ? (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "var(--text-dim)",
          }}
        >
          Sin resultados para los filtros elegidos
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
          {visibles.map((e, idx) => (
            <div
              key={e.id ?? `examen-${idx}`}
              className="card-materia"
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                cursor: "pointer",
                transition: "border-color .15s ease",
              }}
              onClick={() => setExamenSeleccionado(e)}
            >
              {/* nombre de la materia */}
              <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <div style={{ fontWeight: "600", fontSize: ".85rem" }}>
                  {e.materia || "Materia sin nombre"}
                </div>
                <div
                  style={{
                    fontSize: ".65rem",
                    color: "var(--text-dim)",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  
                  {[
                    e.codigo,
                    e.semestre ? `${e.semestre}° semestre` : "",
                    e.turno,
                    e.periodo,
                  ]
                    .filter(Boolean)
                    .join(" - ")}
                </div>
              </div>

              {/*Badges y calificacion todo ya pasado por aTexto*/}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: ".5rem",
                  flexWrap: "wrap",
                }}
              >
                {e.tipo && <span className="badge-examen">{e.tipo}</span>}
                {e.estado && (
                  <span className="badge-examen badge-examen-dim">{e.estado}</span>
                )}
                {e.fecha && (
                  <span
                    style={{
                      fontSize: ".7rem",
                      color: "var(--text-dim)",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {formatearFecha(e.fecha)}
                  </span>
                )}
                {/* calificacion numero con color o "—" si no hay nota */}
                <span
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: "700",
                    color: colorNota(e.calificacion),
                    fontFamily: "Inter, sans-serif",
                    minWidth: "2rem",
                    textAlign: "right",
                  }}
                >
                  {e.calificacion === null ||
                  e.calificacion === undefined ||
                  e.calificacion === "" ||
                  e.calificacion === 0
                    ? "—"
                    : e.calificacion}
                </span>
                {/* Indicador de que la tarjeta es clickeable */}
                <span style={{ color: "var(--text-dim)", fontSize: ".8rem" }}>▸</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/*modal */}
      {examenSeleccionado && (
        <ExamenModal
          examen={examenSeleccionado}
          onClose={() => setExamenSeleccionado(null)}
        />
      )}
    </div>
  );
}