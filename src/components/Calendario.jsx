import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { limpiarNombre } from "../utils/limpiarNombre";
import { esMateriaCursando } from "../utils/esMateriaCursando";
import { apiFetch, parseJwt } from "../api";
import "../styles/calendario.css";

// El backend de la FIUNI agrega un "*" a las materias que son correlativas.
// Esta función los elimina para que la interfaz se vea más limpia.

// ─── CONSTANTES ────────────────────────────────────────────────────────────
// Días de la semana (versión larga para las vistas)
const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// Nombres de los meses en español (para el encabezado del calendario)
const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

// Alias para el mini calendario dentro del modal
const MESES_CAL = [...MESES];

// Días de la semana en versión corta (para el mini calendario)
const DIAS_SEMANA_CAL = ["L", "M", "M", "J", "V", "S", "D"];

function fechaLocalISO(fecha = new Date()) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function obtenerIdentidadUsuario(token) {
  const payload = parseJwt(token);
  return payload?.unique_name || payload?.email || payload?.sub || null;
}

// ─── Iconos y colores para cada tipo de evento ────────────────────────────
// Cada tipo de evento (parcial, final, feriado, etc.) tiene un emoji y un color
// que lo identifican visualmente en el calendario.
const ICONOS_TIPO = {
  parcial: "📝",
  final: "📚",
  tarea: "📋",
  otro: "📌",
  feriado: "🏖️",
  inicio_clases: "🎓",
  fin_clases: "🏁",
  receso: "⏸️",
  inscripcion: "📝",
  regularizacion: "🔄",
  complementario: "🔁",
  cierre_periodo: "🔒",
  administrativo: "📋",
  proyecto: "📁",
  tfg: "🎯",
};

const COLORES_TIPO = {
  parcial: "var(--cursando)", // Azul (definido en main.css)
  final: "var(--bloqueada-t)", // Rojo
  tarea: "var(--disponible)", // Amarillo
  otro: "var(--accent)", // Color de acento (rojo o dorado según tema)
  feriado: "#9b59b6", // Púrpura fijo
  inicio_clases: "#2ecc71", // Verde
  fin_clases: "#e74c3c", // Rojo oscuro
  inscripcion: "#3498db", // Azul
  regularizacion: "#f39c12", // Naranja
  complementario: "#e67e22", // Naranja oscuro
  cierre_periodo: "#95a5a6", // Gris
  administrativo: "#7f8c8d", // Gris oscuro
  proyecto: "#8e44ad", // Violeta
  tfg: "#c0392b", // Rojo intenso
};

// ─── FUNCIONES PARA EXPORTAR ICS (archivo de calendario) ──────────────────

/**
 * Escapa caracteres especiales para que el texto sea seguro en un archivo ICS.
 * Los caracteres \, ; , y saltos de línea deben escaparse según el estándar iCalendar.
 */
function escaparICS(texto) {
  return String(texto)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Genera el contenido de un VEVENT para un solo evento.
 * Incluye un UID único (basado en el ID de Supabase) para evitar duplicados
 * si el usuario importa el archivo varias veces en Google Calendar, Apple Calendar, etc.
 */
function generarEventoICS(evento) {
  const fechaStr = evento.fecha.split("T")[0]; // Solo la parte de la fecha (YYYY-MM-DD)
  const fechaInicio = new Date(fechaStr + "T00:00:00");
  const fechaFin = new Date(fechaInicio);
  fechaFin.setDate(fechaFin.getDate() + 1); // El evento dura todo el día → DTEND es el día siguiente
  const fechaFinStr = fechaFin.toISOString().split("T")[0].replace(/-/g, "");
  return [
    "BEGIN:VEVENT",
    `DTSTART;VALUE=DATE:${fechaStr.replace(/-/g, "")}`,
    `DTEND;VALUE=DATE:${fechaFinStr}`,
    `SUMMARY:${escaparICS(evento.titulo)}`,
    `DESCRIPTION:${escaparICS(evento.descripcion || "")} - Materia: ${escaparICS(evento.materia_nombre || "")}`,
    `UID:${evento.id}@fiuni.edu.py`, // Identificador único para evitar duplicados
    "LOCATION:FIUNI",
    "END:VEVENT",
  ].join("\n");
}

/**
 * Envuelve una lista de VEVENT en un calendario ICS completo (VCALENDAR).
 */
function generarCalendarioICS(eventos) {
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FIUNI//Calendario Academico//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ].join("\n");
  const footer = "END:VCALENDAR";
  const eventosICS = eventos.map(generarEventoICS).join("\n");
  return `${header}\n${eventosICS}\n${footer}`;
}

/**
 * Descarga un contenido como archivo.
 * En dispositivos Apple (iOS) se usa una URI de datos porque Safari
 * no maneja bien los Blobs para forzar la descarga de archivos .ics.
 */
function descargarArchivo(contenido, nombre, tipo = "text/calendar") {
  const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  // Crear el blob una sola vez
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);

  if (esIOS) {
    // En iOS, usamos un enlace temporal con la URL del blob.
    // Safari detecta el tipo MIME y muestra el banner "Abrir en Calendario".
    const link = document.createElement("a");
    link.href = url;
    link.download = nombre;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Liberar la memoria después de un rato
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return;
  }

  // Para Android y escritorio, el mismo método funciona perfectamente.
  const link = document.createElement("a");
  link.href = url;
  link.download = nombre;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────
export default function Calendario({ session }) {
  // ─── ESTADOS ──────────────────────────────────────────────────────────
  const [eventos, setEventos] = useState([]); // Eventos de estudiantes (de la tabla "eventos")
  const [eventosOficiales, setEventosOficiales] = useState([]); // Eventos del calendario académico oficial
  const [materias, setMaterias] = useState([]); // Materias que cursa el estudiante
  const [materiasIds, setMateriasIds] = useState([]); // Solo los IDs (para filtrar eventos)
  const [loading, setLoading] = useState(true); // Controla el spinner de carga inicial
  const [error, setError] = useState(""); // Mensaje de error global

  const [fechaActual, setFechaActual] = useState(new Date()); // Fecha de referencia para la vista
  const [vista, setVista] = useState("mensual"); // "mensual" o "semanal"

  const [mostrarModal, setMostrarModal] = useState(false); // Controla el modal de crear/editar
  const [eventoEditando, setEventoEditando] = useState(null); // Evento que se está editando (null = nuevo)

  const [filtroMateria, setFiltroMateria] = useState("todas"); // Filtro por materia
  const [filtroTipo, setFiltroTipo] = useState("todos"); // Filtro por tipo de evento

  const [diaSeleccionado, setDiaSeleccionado] = useState(null); // Día seleccionado para el popover

  // ─── CARGA INICIAL DE MATERIAS Y EVENTOS (UN SOLO EFECTO) ──────────────
  // Carga primero las materias del backend de la FIUNI, obtiene sus IDs,
  // y luego consulta los eventos de esas materias en Supabase.
  // Todo se hace en un solo efecto para evitar parpadeos de carga.
  useEffect(() => {
    if (!session?.carreraId) {
      setMaterias([]);
      setMateriasIds([]);
      setEventos([]);
      setError("No pudimos identificar tu carrera; solo se muestran los eventos académicos generales.");
      setLoading(false);
      return;
    }
    let cancelado = false;
    setLoading(true);
    setError("");

    const cargarDatos = async () => {
      try {
        // 1) Obtener materias desde la API de la FIUNI
        const data = await apiFetch("/materias", { token: session.token });
        if (cancelado) return;
        const cursando = data
          .filter((materia) => esMateriaCursando(materia))
          .map((m) => ({ ...m, materia: limpiarNombre(m.materia) })); // Limpiar asteriscos
        setMaterias(cursando);
        const ids = cursando.map((m) => m.codigoMateria);
        setMateriasIds(ids); // Guardar solo los IDs para filtrar eventos

        // 2) Si hay materias, cargar sus eventos desde Supabase
        if (ids.length > 0) {
          const { data: eventosData, error: eventosError } = await supabase
            .from("eventos")
            .select("*")
            .eq("carrera_id", session.carreraId) // Solo de su carrera
            .in("materia_id", ids) // Solo de las materias que cursa
            .is("eliminado_por", null) // Ocultar los eliminados (soft delete)
            .order("fecha", { ascending: true });

          if (eventosError) throw eventosError;
          if (!cancelado) setEventos(eventosData || []);
        } else {
          if (!cancelado) setEventos([]); // Sin materias, sin eventos
        }
      } catch (err) {
        if (!cancelado) setError(err.message || "No se pudo cargar el calendario");
      } finally {
        if (!cancelado) setLoading(false); // Ocultar spinner
      }
    };

    cargarDatos();
    return () => {
      cancelado = true;
    };
  }, [session?.carreraId, session?.token]); // Se ejecuta al cambiar de carrera o sesiÃ³n

  // ─── SUSCRIPCIÓN EN TIEMPO REAL ────────────────────────────────────────
  // Escucha cambios en la tabla "eventos" (inserciones, actualizaciones, eliminaciones)
  // y actualiza el estado local en tiempo real, filtrando solo los de las materias del usuario.
  useEffect(() => {
    if (!session?.carreraId || materiasIds.length === 0) return;

    const subscription = supabase
      .channel("eventos-cambios") // Nombre único del canal
      .on(
        "postgres_changes",
        {
          event: "*", // Escuchar INSERT, UPDATE y DELETE
          schema: "public",
          table: "eventos",
          filter: `carrera_id=eq.${session.carreraId}`, // Solo eventos de su carrera
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setEventos((prev) => prev.filter((e) => e.id !== payload.old.id));
            return;
          }

          const evento = payload.new;
          const perteneceAMateria = materiasIds.includes(evento.materia_id);
          setEventos((prev) => {
            if (!perteneceAMateria || evento.eliminado_por) {
              return prev.filter((e) => e.id !== evento.id);
            }
            const existe = prev.some((e) => e.id === evento.id);
            return existe
              ? prev.map((e) => (e.id === evento.id ? evento : e))
              : [...prev, evento];
          });
        },
      )
      .subscribe();

    // Limpiar suscripción al desmontar
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [session.carreraId, materiasIds]);

  // ─── CARGA DE CALENDARIO ACADÉMICO OFICIAL ─────────────────────────────
  // Los eventos oficiales (feriados, inicio/fin de clases, etc.) están en la tabla
  // "calendario_academico" y se muestran a todos los estudiantes de la carrera.
  useEffect(() => {
    let cancelado = false;
    const cargarOficiales = async () => {
      let consulta = supabase
        .from("calendario_academico")
        .select("*");
      consulta = session?.carreraId
        ? consulta.or(`carrera_id.is.null,carrera_id.eq.${session.carreraId}`)
        : consulta.is("carrera_id", null);
      const { data, error: eventosOficialesError } = await consulta;
      if (eventosOficialesError) {
        if (!cancelado) setError(eventosOficialesError.message);
        return;
      }
      if (!cancelado) setEventosOficiales(data || []);
    };
    cargarOficiales();
    return () => {
      cancelado = true;
    };
  }, [session?.carreraId]);

  // ─── NAVEGACIÓN DEL CALENDARIO ──────────────────────────────────────────
  // Funciones para cambiar el mes/semana visible y volver a "hoy".
  const irMesAnterior = () =>
    setFechaActual(
      new Date(fechaActual.getFullYear(), fechaActual.getMonth() - 1, 1),
    );
  const irMesSiguiente = () =>
    setFechaActual(
      new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 1),
    );
  const irHoy = () => setFechaActual(new Date());
  const irSemanaAnterior = () => {
    const n = new Date(fechaActual);
    n.setDate(n.getDate() - 7);
    setFechaActual(n);
  };
  const irSemanaSiguiente = () => {
    const n = new Date(fechaActual);
    n.setDate(n.getDate() + 7);
    setFechaActual(n);
  };

  // ─── CÁLCULO DE DÍAS ────────────────────────────────────────────────────
  // Devuelve un array con los 7 días de la semana (lunes a domingo) que contienen a "fecha".
  const obtenerDiasSemana = (fecha) => {
    const dias = [];
    const lunes = new Date(fecha);
    const diaActual = lunes.getDay() || 7; // Convertir domingo (0) a 7
    lunes.setDate(lunes.getDate() - (diaActual - 1)); // Retroceder hasta el lunes
    for (let i = 0; i < 7; i++) {
      const dia = new Date(lunes);
      dia.setDate(dia.getDate() + i);
      dias.push(dia);
    }
    return dias;
  };

  // Devuelve un array con todos los días que se muestran en la vista mensual,
  // incluyendo algunos días del mes anterior y siguiente para rellenar la cuadrícula.
  const obtenerDiasMes = (fecha) => {
    const año = fecha.getFullYear();
    const mes = fecha.getMonth();
    const primerDia = new Date(año, mes, 1);
    const ultimoDia = new Date(año, mes + 1, 0);
    const dias = [];
    const diaInicio = primerDia.getDay() || 7; // 1 = Lunes, 7 = Domingo
    // Días del mes anterior que se ven en la primera semana
    for (let i = 1; i < diaInicio; i++)
      dias.push({
        fecha: new Date(año, mes, 1 - (diaInicio - i)),
        esOtroMes: true, // Se atenúan visualmente
      });
    // Días del mes actual
    for (let i = 1; i <= ultimoDia.getDate(); i++)
      dias.push({ fecha: new Date(año, mes, i), esOtroMes: false });
    return dias;
  };

  // ─── COMBINAR EVENTOS ──────────────────────────────────────────────────
  // Une los eventos de estudiantes y los oficiales en un solo array,
  // añadiendo una propiedad "es_oficial" para distinguirlos visualmente.
  const todosLosEventos = [
    ...eventos.map((e) => ({ ...e, es_oficial: false })),
    ...eventosOficiales.map((e) => ({
      ...e,
      es_oficial: true,
      materia_id: null,
      materia_nombre: "Institucional",
      tipo: e.tipo || "feriado",
      fecha: new Date(e.fecha + "T00:00:00").toISOString(),
    })),
  ];

  // ─── FILTROS ────────────────────────────────────────────────────────────
  // Aplica los filtros de materia y tipo seleccionados por el usuario.
  const eventosFiltrados = todosLosEventos.filter((ev) => {
    if (filtroMateria !== "todas" && ev.materia_id !== filtroMateria)
      return false;
    if (filtroTipo !== "todos" && ev.tipo !== filtroTipo) return false;
    return true;
  });

  // Devuelve los eventos que ocurren en una fecha específica (para pintar cada celda).
  const eventosDelDia = (fecha) =>
    eventosFiltrados.filter((ev) => {
      const f = new Date(ev.fecha);
      return (
        f.getDate() === fecha.getDate() &&
        f.getMonth() === fecha.getMonth() &&
        f.getFullYear() === fecha.getFullYear()
      );
    });

  // ─── CRUD DE EVENTOS (protegido contra suplantación) ──────────────────
  const handleGuardarEvento = async (datosEvento) => {
    try {
      // Extraemos el correo real del token (campo unique_name)
      const creador = obtenerIdentidadUsuario(session.token);
      if (!creador) throw new Error("No se pudo identificar al usuario autenticado");

      if (eventoEditando) {
        const { error } = await supabase
          .from("eventos")
          .update({
            titulo: datosEvento.titulo,
            descripcion: datosEvento.descripcion,
            materia_id: datosEvento.materiaId,
            materia_nombre: limpiarNombre(datosEvento.materiaNombre),
            tipo: datosEvento.tipo,
            fecha: datosEvento.fecha,
          })
          .eq("id", eventoEditando.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("eventos").insert([
          {
            titulo: datosEvento.titulo,
            descripcion: datosEvento.descripcion,
            materia_id: datosEvento.materiaId,
            materia_nombre: limpiarNombre(datosEvento.materiaNombre),
            tipo: datosEvento.tipo,
            fecha: datosEvento.fecha,
            carrera_id: session.carreraId,
            creado_por: creador, // ← correo real extraído del token
          },
        ]);
        if (error) throw error;
      }
      setMostrarModal(false);
      setEventoEditando(null);
    } catch (err) {
      throw err;
    }
  };

  const handleEliminarEvento = async (eventoId) => {
    if (!confirm("¿Estás seguro de eliminar este evento?")) return;
    try {
      const eliminador = obtenerIdentidadUsuario(session.token);
      if (!eliminador) throw new Error("No se pudo identificar al usuario autenticado");

      const { error: eliminarError } = await supabase
        .from("eventos")
        .update({ eliminado_por: eliminador }) // ← correo real extraído del token
        .eq("id", eventoId);
      if (eliminarError) throw eliminarError;

      setMostrarModal(false);
      setEventoEditando(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const obtenerNombre = (userId) => {
    if (!userId) return "";
    // Si es un correo (contiene @), es el identificador real, lo mostramos tal cual
    if (userId.includes("@")) return userId;
    // Si es el token antiguo, mostramos el correo del token actual o un resumen
    const payload = parseJwt(userId);
    return payload?.unique_name || "Otro usuario";
  };

  // ─── EXPORTAR A ICS ─────────────────────────────────────────────────────
  // Descarga un archivo .ics con todos los eventos del estudiante (no oficiales).
  const descargarTodosEventos = () => {
    const eventosEstudiante = todosLosEventos.filter((e) => !e.es_oficial);
    if (eventosEstudiante.length === 0) {
      alert("No hay eventos de tus materias para exportar.");
      return;
    }
    const ics = generarCalendarioICS(eventosEstudiante);
    descargarArchivo(ics, "calendario_fiuni.ics");
  };

  // ─── FORMATEO ───────────────────────────────────────────────────────────
  // Convierte una fecha ISO a un texto legible: "lun, 10 de mayo".
  const formatearFecha = (fecha) =>
    new Date(fecha).toLocaleDateString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "long",
    });

  // ─── RENDER ─────────────────────────────────────────────────────────────
  // Mientras se cargan los datos iniciales, se muestra un spinner.
  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <div className="spinner" />
        <span style={{ color: "var(--text-dim)" }}>Cargando calendario...</span>
      </div>
    );
  }

  const hoy = new Date();
  const dias = vista === "mensual" ? obtenerDiasMes(fechaActual) : [];
  const diasSemana = vista === "semanal" ? obtenerDiasSemana(fechaActual) : [];

  return (
    <div className="main">
      {/* ─── ENCABEZADO ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div
          style={{
            fontSize: ".75rem",
            textTransform: "uppercase",
            letterSpacing: "3px",
            color: "var(--text-dim)",
            fontFamily: "Space Mono, monospace",
            marginBottom: ".5rem",
          }}
        >
          Calendario Académico
        </div>
        <h1 style={{ fontSize: "1.0rem", fontWeight: "500", margin: 0 }}>
          Calendario
        </h1>
      </div>
      {error && <div className="error-msg" style={{ marginBottom: "1rem" }}>{error}</div>}

      {/* ─── BARRA DE CONTROLES ────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        {/* Navegación: flechas + mes/año + botón Hoy */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={vista === "mensual" ? irMesAnterior : irSemanaAnterior}
            className="btn-logout"
            aria-label={vista === "mensual" ? "Mes anterior" : "Semana anterior"}
          >
            ←
          </button>
          <span
            style={{
              fontSize: "clamp(0.8rem, 2.5vw, 1rem)",
              fontWeight: "600",
              minWidth: "150px",
              textAlign: "center",
            }}
          >
            {vista === "mensual"
              ? `${MESES[fechaActual.getMonth()]} ${fechaActual.getFullYear()}`
              : `Sem. del ${diasSemana[0]?.getDate() || ""} al ${diasSemana[6]?.getDate() || ""}`}
          </span>
          <button
            onClick={vista === "mensual" ? irMesSiguiente : irSemanaSiguiente}
            className="btn-logout"
            aria-label={vista === "mensual" ? "Mes siguiente" : "Semana siguiente"}
          >
            →
          </button>
          <button
            onClick={irHoy}
            style={{
              marginLeft: "0.5rem",
              padding: "0.4rem 0.8rem",
              border: "1px solid var(--border2)",
              borderRadius: "6px",
              background: "transparent",
              color: "var(--text-dim)",
              cursor: "pointer",
              fontFamily: "Space Mono, monospace",
              fontSize: "0.7rem",
            }}
          >
            Hoy
          </button>
        </div>

        {/* Acciones: toggle vista, exportar, nuevo evento */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* Toggle vista mensual / semanal */}
          <div
            style={{
              display: "flex",
              borderRadius: "8px",
              overflow: "hidden",
              border: "1px solid var(--border2)",
            }}
          >
            <button
              onClick={() => setVista("mensual")}
              style={{
                padding: "0.4rem 0.8rem",
                border: "none",
                background:
                  vista === "mensual" ? "var(--accent)" : "transparent",
                color: vista === "mensual" ? "#000" : "var(--text-dim)",
                cursor: "pointer",
                fontFamily: "Space Mono, monospace",
                fontSize: "0.7rem",
              }}
            >
              Mes
            </button>
            <button
              onClick={() => setVista("semanal")}
              style={{
                padding: "0.4rem 0.8rem",
                border: "none",
                background:
                  vista === "semanal" ? "var(--accent)" : "transparent",
                color: vista === "semanal" ? "#000" : "var(--text-dim)",
                cursor: "pointer",
                fontFamily: "Space Mono, monospace",
                fontSize: "0.7rem",
              }}
            >
              Semana
            </button>
          </div>

          {/* Botón de exportación ICS (solo eventos del estudiante) */}
          <button
            onClick={descargarTodosEventos}
            title="Exportar mis eventos a calendario"
            style={{
              padding: "0.5rem",
              borderRadius: "8px",
              border: "1px solid var(--border2)",
              background: "transparent",
              color: "var(--text-dim)",
              cursor: "pointer",
              fontSize: "1.2rem",
            }}
          >
            📤
          </button>

          {/* Botón para crear un nuevo evento */}
          <button
            onClick={() => {
              setEventoEditando(null); // null = modo creación
              setMostrarModal(true);
            }}
            disabled={!session?.carreraId || materias.length === 0}
            title={!session?.carreraId || materias.length === 0 ? "No hay materias disponibles para crear un evento" : undefined}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "8px",
              border: "none",
              background: "var(--accent)",
              color: "#000",
              fontWeight: "600",
              cursor: !session?.carreraId || materias.length === 0 ? "not-allowed" : "pointer",
              opacity: !session?.carreraId || materias.length === 0 ? 0.5 : 1,
              fontFamily: "Space Mono, monospace",
              fontSize: "0.75rem",
            }}
          >
            + Nuevo
          </button>
        </div>
      </div>

      {/* ─── FILTROS ───────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        {/* Selector de materia */}
        <select
          value={filtroMateria}
          onChange={(e) => setFiltroMateria(e.target.value)}
          style={{
            padding: "0.4rem 0.8rem",
            borderRadius: "6px",
            border: "1px solid var(--border2)",
            background: "var(--bg3)",
            color: "var(--text)",
            fontFamily: "Space Mono, monospace",
            fontSize: "clamp(0.65rem, 2vw, 0.7rem)",
            flex: "1 1 auto",
          }}
        >
          <option value="todas">Todas las materias</option>
          {materias.map((m) => (
            <option key={m.codigoMateria} value={m.codigoMateria}>
              {m.materia}
            </option>
          ))}
        </select>

        {/* Selector de tipo de evento */}
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          style={{
            padding: "0.4rem 0.8rem",
            borderRadius: "6px",
            border: "1px solid var(--border2)",
            background: "var(--bg3)",
            color: "var(--text)",
            fontFamily: "Space Mono, monospace",
            fontSize: "clamp(0.65rem, 2vw, 0.7rem)",
            flex: "1 1 auto",
          }}
        >
          <option value="todos">Todos los tipos</option>
          <option value="parcial">📝 Parcial</option>
          <option value="final">📚 Examen Final</option>
          <option value="tarea">📋 Tarea</option>
          <option value="otro">📌 Otro</option>
          <option value="feriado">🏖️ Feriado</option>
          <option value="inicio_clases">🎓 Inicio de clases</option>
          <option value="fin_clases">🏁 Fin de clases</option>
          <option value="inscripcion">📝 Inscripción</option>
          <option value="regularizacion">🔄 Regularización</option>
          <option value="complementario">🔁 Complementario</option>
          <option value="cierre_periodo">🔒 Cierre de periodo</option>
          <option value="proyecto">📁 Proyecto</option>
          <option value="tfg">🎯 TFG</option>
        </select>
      </div>

      {/* ─── VISTA MENSUAL ──────────────────────────────────────────────── */}
      {vista === "mensual" && (
        <div
          style={{
            background: "var(--bg3)",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            overflow: "hidden",
          }}
        >
          {/* Días de la semana (cabecera) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              borderBottom: "1px solid var(--border)",
              background: "var(--bg2)",
            }}
          >
            {DIAS_SEMANA.map((dia) => (
              <div
                key={dia}
                style={{
                  padding: "0.75rem 0.25rem",
                  textAlign: "center",
                  fontSize: "clamp(0.55rem, 2vw, 0.7rem)",
                  fontWeight: "600",
                  color: "var(--text-dim)",
                  fontFamily: "Space Mono, monospace",
                }}
              >
                {dia.slice(0, 3)}
              </div>
            ))}
          </div>

          {/* Cuadrícula de días */}
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}
          >
            {dias.map(({ fecha, esOtroMes }, index) => {
              const esHoy =
                fecha.getDate() === hoy.getDate() &&
                fecha.getMonth() === hoy.getMonth() &&
                fecha.getFullYear() === hoy.getFullYear();
              const eventosHoy = eventosDelDia(fecha);

              return (
                <div
                  key={index}
                  style={{
                    minHeight: "clamp(60px, 15vw, 100px)",
                    padding: "0.25rem",
                    border: "1px solid var(--border)",
                    background: esHoy
                      ? "rgba(29,185,84,0.05)"
                      : esOtroMes
                        ? "var(--bg2)"
                        : "transparent",
                    opacity: esOtroMes ? 0.5 : 1,
                    overflow: "hidden",
                  }}
                >
                  {/* Número del día (clic abre el popover con todos los eventos) */}
                  <button
                    onClick={() => setDiaSeleccionado(fecha)}
                    style={{
                      fontSize: "clamp(0.6rem, 2vw, 0.75rem)",
                      fontWeight: esHoy ? "700" : "400",
                      marginBottom: "2px",
                      fontFamily: "Space Mono, monospace",
                      textAlign: "center",
                      width: esHoy ? "clamp(20px, 5vw, 24px)" : "auto",
                      height: esHoy ? "clamp(20px, 5vw, 24px)" : "auto",
                      lineHeight: esHoy ? "clamp(20px, 5vw, 24px)" : "normal",
                      borderRadius: esHoy ? "50%" : "4px",
                      background: esHoy ? "var(--accent)" : "transparent",
                      color: esHoy ? "#000" : "var(--text-dim)",
                      border: "none",
                      cursor: "pointer",
                      padding: "2px 4px",
                      margin: esHoy ? "0 auto 2px" : "0 0 2px 0",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {fecha.getDate()}
                  </button>

                  {/* Eventos del día (máximo 3 visibles, el resto con "+X más") */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1px",
                    }}
                  >
                    {eventosHoy.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        title={`${ev.titulo} - ${limpiarNombre(ev.materia_nombre || "")}${ev.creado_por ? " (creado por " + obtenerNombre(ev.creado_por) + ")" : ""}`}
                        onClick={() => {
                          if (ev.es_oficial) return; // Los oficiales no son clickeables
                          setEventoEditando(ev);
                          setMostrarModal(true);
                        }}
                        style={{
                          fontSize: "clamp(0.4rem, 1.8vw, 0.6rem)",
                          padding:
                            "clamp(2px, 0.5vw, 3px) clamp(2px, 0.5vw, 6px)",
                          borderRadius: "3px",
                          background: ev.es_oficial
                            ? "var(--bg3)"
                            : COLORES_TIPO[ev.tipo] || "var(--accent)",
                          border: ev.es_oficial
                            ? "1px dashed var(--accent)"
                            : "none",
                          color: ev.es_oficial ? "var(--accent)" : "#000",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          cursor: ev.es_oficial ? "default" : "pointer",
                          fontFamily: "Space Mono, monospace",
                          maxWidth: "100%",
                          display: "inline-block",
                          boxSizing: "border-box",
                          touchAction: "manipulation",
                        }}
                      >
                        {ICONOS_TIPO[ev.tipo] || "📅"} {ev.titulo}
                      </div>
                    ))}
                    {eventosHoy.length > 3 && (
                      <div
                        style={{
                          fontSize: "clamp(0.4rem, 1.5vw, 0.55rem)",
                          color: "var(--text-dim)",
                          fontFamily: "Space Mono, monospace",
                        }}
                      >
                        +{eventosHoy.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── VISTA SEMANAL ──────────────────────────────────────────────── */}
      {/* Similar a la mensual, pero con columnas más anchas y scroll horizontal en móviles */}
      {vista === "semanal" && (
        <div
          style={{
            background: "var(--bg3)",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            overflowX: "auto",
          }}
        >
          {/* Cabecera de días */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(80px, 1fr))",
              borderBottom: "1px solid var(--border)",
              background: "var(--bg2)",
            }}
          >
            {diasSemana.map((fecha, index) => {
              const esHoy =
                fecha.getDate() === hoy.getDate() &&
                fecha.getMonth() === hoy.getMonth() &&
                fecha.getFullYear() === hoy.getFullYear();
              return (
                <div
                  key={index}
                  style={{
                    padding: "0.5rem 0.25rem",
                    textAlign: "center",
                    background: esHoy ? "rgba(29,185,84,0.1)" : "transparent",
                  }}
                >
                  <button
                    onClick={() => setDiaSeleccionado(fecha)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text-dim)",
                      cursor: "pointer",
                      fontSize: "clamp(0.55rem, 2vw, 0.65rem)",
                      fontFamily: "Space Mono, monospace",
                      padding: 0,
                    }}
                  >
                    {DIAS_SEMANA[index].slice(0, 3)}
                  </button>
                  <div
                    style={{
                      fontSize: "clamp(0.75rem, 2.5vw, 0.9rem)",
                      fontWeight: esHoy ? "700" : "400",
                      color: esHoy ? "var(--accent)" : "var(--text)",
                    }}
                  >
                    {fecha.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Columnas con eventos */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(80px, 1fr))",
              minHeight: "300px",
            }}
          >
            {diasSemana.map((fecha, index) => {
              const eventosHoy = eventosDelDia(fecha);
              return (
                <div
                  key={index}
                  style={{
                    padding: "0.25rem",
                    border: "1px solid var(--border)",
                    minHeight: "100%",
                    overflow: "hidden",
                  }}
                >
                  {eventosHoy.map((ev) => (
                    <div
                      key={ev.id}
                      onClick={() => {
                        if (ev.es_oficial) return;
                        setEventoEditando(ev);
                        setMostrarModal(true);
                      }}
                      style={{
                        fontSize: "clamp(0.45rem, 1.8vw, 0.6rem)",
                        padding:
                          "clamp(2px, 0.4vw, 4px) clamp(3px, 0.6vw, 6px)",
                        borderRadius: "4px",
                        background: ev.es_oficial
                          ? "var(--bg3)"
                          : COLORES_TIPO[ev.tipo] || "var(--accent)",
                        border: ev.es_oficial
                          ? "1px dashed var(--accent)"
                          : "none",
                        color: ev.es_oficial ? "var(--accent)" : "#000",
                        marginBottom: "2px",
                        cursor: ev.es_oficial ? "default" : "pointer",
                        fontFamily: "Space Mono, monospace",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "100%",
                        boxSizing: "border-box",
                        touchAction: "manipulation",
                      }}
                    >
                      <div style={{ fontWeight: "600" }}>
                        {ICONOS_TIPO[ev.tipo] || "📅"} {ev.titulo}
                      </div>
                      <div
                        style={{
                          fontSize: "clamp(0.4rem, 1.5vw, 0.55rem)",
                          opacity: 0.8,
                        }}
                      >
                        {limpiarNombre(ev.materia_nombre || "")}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── MODAL DE CREAR/EDITAR EVENTO ────────────────────────────────── */}
      {mostrarModal && (
        <ModalEvento
          evento={eventoEditando}
          materias={materias}
          onSave={handleGuardarEvento}
          onDelete={eventoEditando ? handleEliminarEvento : undefined}
          onClose={() => {
            setMostrarModal(false);
            setEventoEditando(null);
          }}
        />
      )}

      {/* ─── MODAL DE DÍA (POPOVER CON TODOS LOS EVENTOS) ────────────────── */}
      {diaSeleccionado && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 450,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setDiaSeleccionado(null)}
        >
          <div
            style={{
              background: "var(--bg3)",
              border: "1px solid var(--border2)",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "400px",
              maxHeight: "80vh",
              overflowY: "auto",
              padding: "1.25rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <h3 style={{ fontSize: "1rem", fontWeight: "600", margin: 0 }}>
                {diaSeleccionado.toLocaleDateString("es-ES", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </h3>
              <button
                onClick={() => setDiaSeleccionado(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-dim)",
                  cursor: "pointer",
                  fontSize: "1.2rem",
                }}
              >
                ✕
              </button>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {eventosDelDia(diaSeleccionado).length === 0 ? (
                <div
                  style={{
                    color: "var(--text-dim)",
                    fontSize: "0.8rem",
                    textAlign: "center",
                    padding: "1rem",
                  }}
                >
                  No hay eventos para este día
                </div>
              ) : (
                eventosDelDia(diaSeleccionado).map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => {
                      if (ev.es_oficial) return;
                      setDiaSeleccionado(null);
                      setEventoEditando(ev);
                      setMostrarModal(true);
                    }}
                    style={{
                      padding: "0.75rem",
                      borderRadius: "8px",
                      background: ev.es_oficial
                        ? "var(--bg3)"
                        : COLORES_TIPO[ev.tipo] || "var(--accent)",
                      border: ev.es_oficial
                        ? "1px dashed var(--accent)"
                        : "none",
                      cursor: ev.es_oficial ? "default" : "pointer",
                      color: ev.es_oficial ? "var(--accent)" : "#000",
                      fontFamily: "Space Mono, monospace",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: "600",
                        fontSize: "0.85rem",
                        marginBottom: "4px",
                        wordBreak: "break-word",
                      }}
                    >
                      {ICONOS_TIPO[ev.tipo] || "📅"} {ev.titulo}
                    </div>
                    <div style={{ fontSize: "0.7rem", opacity: 0.9 }}>
                      {limpiarNombre(ev.materia_nombre || "")}
                      {ev.creado_por && (
                        <span>
                          {" "}
                          · Creado por: {obtenerNombre(ev.creado_por)}
                        </span>
                      )}
                      {ev.descripcion && ` · ${ev.descripcion}`}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── COMPONENTE MODAL DE EVENTO ──────────────────────────────────────────
// Subcomponente que maneja el formulario de creación/edición de un evento.
// Incluye un mini calendario para seleccionar la fecha sin escribir manualmente.
function ModalEvento({ evento, materias, onSave, onDelete, onClose }) {
  // Estado del formulario, inicializado con los datos del evento si se está editando
  const [form, setForm] = useState({
    titulo: evento?.titulo || "",
    descripcion: evento?.descripcion || "",
    materiaId: evento?.materia_id || "",
    materiaNombre: limpiarNombre(evento?.materia_nombre || ""),
    tipo: evento?.tipo || "parcial",
    fecha: evento?.fecha
      ? new Date(evento.fecha).toISOString().slice(0, 10) // YYYY-MM-DD
      : fechaLocalISO(),
  });
  const [error, setError] = useState(""); // Error de validación
  const [saving, setSaving] = useState(false); // Para deshabilitar el botón mientras guarda
  const [mostrarCalendario, setMostrarCalendario] = useState(false); // Toggle del mini calendario

  const fechaSeleccionada = new Date(form.fecha + "T00:00:00");
  const [calendarioMes, setCalendarioMes] = useState(
    fechaSeleccionada.getMonth(),
  );
  const [calendarioAnio, setCalendarioAnio] = useState(
    fechaSeleccionada.getFullYear(),
  );

  // ─── Funciones del mini calendario ──────────────────────────────────────
  // Genera la cuadrícula de días para un mes y año dados
  const obtenerDiasCalendario = (mes, anio) => {
    const primerDia = new Date(anio, mes, 1);
    const ultimoDia = new Date(anio, mes + 1, 0);
    const dias = [];
    const diaInicio = primerDia.getDay() || 7; // Lunes = 1, Domingo = 7
    for (let i = 1; i < diaInicio; i++) dias.push(null); // Huecos antes del día 1
    for (let i = 1; i <= ultimoDia.getDate(); i++) dias.push(i);
    return dias;
  };

  // Navega al mes anterior o siguiente en el mini calendario
  const cambiarMes = (delta) => {
    let nuevoMes = calendarioMes + delta;
    let nuevoAnio = calendarioAnio;
    if (nuevoMes < 0) {
      nuevoMes = 11;
      nuevoAnio--;
    } else if (nuevoMes > 11) {
      nuevoMes = 0;
      nuevoAnio++;
    }
    setCalendarioMes(nuevoMes);
    setCalendarioAnio(nuevoAnio);
  };

  // Establece la fecha seleccionada y cierra el mini calendario
  const seleccionarFecha = (dia) => {
    const fechaStr = `${calendarioAnio}-${String(calendarioMes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    setForm({ ...form, fecha: fechaStr });
    setMostrarCalendario(false);
  };

  // Formatea una fecha YYYY-MM-DD a texto "15 de Junio de 2026"
  const formatearFechaVisual = (fechaStr) => {
    if (!fechaStr) return "Seleccionar fecha";
    const [anio, mes, dia] = fechaStr.split("-");
    return `${parseInt(dia)} de ${MESES_CAL[parseInt(mes) - 1]} de ${anio}`;
  };

  // Valida y envía el formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.titulo.trim()) {
      setError("El título es obligatorio");
      return;
    }
    if (!form.materiaId) {
      setError("Debe seleccionar una materia");
      return;
    }
    if (!form.fecha) {
      setError("Debe seleccionar una fecha");
      return;
    }

    // No permitir fechas pasadas
    const fechaSel = new Date(form.fecha + "T00:00:00");
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (fechaSel < hoy) {
      setError("No se pueden agendar eventos en fechas pasadas");
      return;
    }

    setSaving(true);
    const materia = materias.find((m) => m.codigoMateria === form.materiaId);
    try {
      await onSave({
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim(),
        materiaId: form.materiaId,
        materiaNombre: limpiarNombre(materia?.materia || form.materiaId),
        tipo: form.tipo,
        fecha: new Date(form.fecha + "T00:00:00").toISOString(),
      });
    } catch (err) {
      setError(err.message || "Error al guardar el evento");
    } finally {
      setSaving(false);
    }
  };

  const hoy = new Date();

  // Verifica si un día del mini calendario es "hoy"
  const esHoy = (dia) =>
    dia === hoy.getDate() &&
    calendarioMes === hoy.getMonth() &&
    calendarioAnio === hoy.getFullYear();

  // Verifica si un día ya pasó (para deshabilitarlo)
  const esPasado = (dia) => {
    const fechaComparar = new Date(calendarioAnio, calendarioMes, dia);
    const h = new Date();
    h.setHours(0, 0, 0, 0);
    return fechaComparar < h;
  };

  // Verifica si un día es el que está seleccionado actualmente
  const esSeleccionado = (dia) => {
    const fc = `${calendarioAnio}-${String(calendarioMes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    return fc === form.fecha;
  };

  const dias = obtenerDiasCalendario(calendarioMes, calendarioAnio);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-contenido">
        {/* Encabezado del modal */}
        <div className="modal-header">
          <h3>{evento ? "Editar Evento" : "Nuevo Evento"}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Campo: Título */}
          <div className="field">
            <label>Título</label>
            <input
              type="text"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ej: Parcial de Física II"
              required
            />
          </div>

          {/* Campo: Descripción (opcional) */}
          <div className="field">
            <label>Descripción</label>
            <textarea
              value={form.descripcion}
              onChange={(e) =>
                setForm({ ...form, descripcion: e.target.value })
              }
              placeholder="Temas, aula, detalles..."
              rows={3}
            />
          </div>

          {/* Selector de materia (solo las que cursa el estudiante) */}
          <div className="field">
            <label>Materia</label>
            <select
              value={form.materiaId}
              onChange={(e) => setForm({ ...form, materiaId: e.target.value })}
              required
            >
              <option value="">Seleccionar materia</option>
              {materias.map((m) => (
                <option key={m.codigoMateria} value={m.codigoMateria}>
                  {m.materia}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de evento */}
          <div className="field">
            <label>Tipo de evento</label>
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            >
              <option value="parcial">📝 Parcial</option>
              <option value="final">📚 Examen Final</option>
              <option value="tarea">📋 Tarea</option>
              <option value="otro">📌 Otro</option>
            </select>
          </div>

          {/* Fecha con mini calendario desplegable hacia arriba */}
          <div className="field">
            <label>Fecha del evento</label>
            <div className="fecha-selector">
              <button
                type="button"
                className={`fecha-boton ${mostrarCalendario ? "abierto" : ""}`}
                onClick={() => {
                  setMostrarCalendario(!mostrarCalendario);
                  if (!mostrarCalendario) {
                    setCalendarioMes(fechaSeleccionada.getMonth());
                    setCalendarioAnio(fechaSeleccionada.getFullYear());
                  }
                }}
              >
                <span>📅 {formatearFechaVisual(form.fecha)}</span>
                <span>{mostrarCalendario ? "▼" : "▲"}</span>
              </button>

              {/* Mini calendario */}
              {mostrarCalendario && (
                <div className="mini-calendario">
                  <div className="mini-cal-nav">
                    <button type="button" onClick={() => cambiarMes(-1)}>
                      ←
                    </button>
                    <span>
                      {MESES_CAL[calendarioMes]} {calendarioAnio}
                    </span>
                    <button type="button" onClick={() => cambiarMes(1)}>
                      →
                    </button>
                  </div>
                  <div className="mini-cal-dias">
                    {DIAS_SEMANA_CAL.map((dia, i) => (
                      <div key={i}>{dia}</div>
                    ))}
                    {dias.map((dia, index) => {
                      if (dia === null) return <div key={`empty-${index}`} />;
                      const isHoy = esHoy(dia);
                      const isPasado = esPasado(dia);
                      const isSelected = esSeleccionado(dia);
                      return (
                        <button
                          key={index}
                          type="button"
                          className={`mini-dia ${isSelected ? "selected" : ""} ${isPasado ? "pasado" : ""}`}
                          disabled={isPasado}
                          onClick={() => !isPasado && seleccionarFecha(dia)}
                        >
                          {dia}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mensaje de error */}
          {error && <div className="error-msg">{error}</div>}

          {/* Botones de acción */}
          <div className="modal-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Guardando..." : evento ? "Actualizar" : "Crear Evento"}
            </button>
            {/* Botón Eliminar (solo visible en edición) */}
            {onDelete && (
              <button
                type="button"
                className="btn-eliminar"
                onClick={() => onDelete(evento.id)}
              >
                Eliminar
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
