import { useState, useEffect } from "react";
import { apiFetch } from "../api";

function aTexto(valor) {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "object") {
    if (valor.label !== undefined && valor.label !== null) return String(valor.label);
    if (valor.nombre !== undefined && valor.nombre !== null) return String(valor.nombre);
    if (valor.value !== undefined && valor.value !== null) return String(valor.value);
    try {
      return JSON.stringify(valor);
    } catch {
      return "";
    }
  }
  return String(valor);
}

const GENEROS = { 1: "Masculino", 2: "Femenino" };
const ESTADOS_CIVILES = { 0: "Soltero/a", 1: "Casado/a", 2: "Divorciado/a", 3: "Viudo/a" };

//Paises del form_data de la api de integral (usuarios/form_data)
const PAISES = [
  { id: 1, nombre: "Paraguay" },
  { id: 2, nombre: "Argentina" },
  { id: 3, nombre: "Brasil" },
  { id: 4, nombre: "Chile" },
  { id: 5, nombre: "Uruguay" },
  { id: 6, nombre: "Bolivia" },
];

function formatearFecha(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return aTexto(iso);
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// Fila del grid de datos: etiqueta arriba, valor abajo
function Campo({ etiqueta, valor }) {
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

// Sección con título y grilla de campos
function Seccion({ titulo, hijos }) {
  return (
    <div
      style={{
        background: "var(--bg3)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "1.1rem 1.25rem",
      }}
    >
      <div
        style={{
          fontSize: ".65rem",
          textTransform: "uppercase",
          letterSpacing: "2px",
          color: "var(--accent)",
          fontFamily: "Inter, sans-serif",
          fontWeight: "600",
          marginBottom: ".85rem",
        }}
      >
        {titulo}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: ".9rem",
        }}
      >
        {hijos}
      </div>
    </div>
  );
}

// modal para ampliar la foto
function FotoModal({ perfil, nombreCompleto, onClose }) {
  //cierra con esc
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
          padding: "1.25rem",
          position: "relative",
          maxWidth: "480px",
          width: "100%",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            background: "none",
            border: "none",
            color: "var(--text-dim)",
            cursor: "pointer",
            fontSize: "1.1rem",
            zIndex: 1,
          }}
        >
          ✕
        </button>
        <img
          src={`data:${perfil.fotoTipo || "image/jpeg"};base64,${perfil.foto}`}
          alt={nombreCompleto}
          style={{
            width: "100%",
            height: "auto",
            maxHeight: "70vh",
            objectFit: "contain",
            borderRadius: "12px",
            display: "block",
          }}
        />
        <div
          style={{
            textAlign: "center",
            marginTop: ".75rem",
            fontSize: ".85rem",
            fontWeight: "600",
          }}
        >
          {nombreCompleto || "Foto de perfil"}
        </div>
      </div>
    </div>
  );
}

// Formulario para editar el perfil
// Campos editables del perfil (solo los que la api oficial permite al alumno, documento y legajo quedan de solo lectura)
const GRUPOS_FORM = [
  {
    titulo: "Datos personales",
    campos: [
      ["nombre", "Nombre", "text"],
      ["apellido", "Apellido", "text"],
      ["fechaNacimiento", "Fecha de nacimiento", "date"],
      ["lugarNacimiento", "Lugar de nacimiento", "text"],
      ["genero", "Género", "select:1:Masculino:2:Femenino"],
      ["nacionalidadPaisId", "Nacionalidad", "pais"],
      ["estadoCivil", "Estado civil", "select:0:Soltero/a:1:Casado/a:2:Divorciado/a:3:Viudo/a"],
    ],
  },
  {
    titulo: "Domicilio y trabajo",
    campos: [
      ["domicilioCalle", "Domicilio", "text"],
      ["domicilioLocalidad", "Localidad", "text"],
      ["domicilioNumero", "N° de casa", "number"],
      ["domicilioTelefono", "Teléfono", "text"],
      ["trabajoEmpresa", "Empresa", "text"],
      ["trabajoLocalidad", "Trabajo localidad", "text"],
      ["trabajoTelefono", "Trabajo teléfono", "text"],
      ["trabajoHorario", "Horario", "text"],
    ],
  },
  {
    titulo: "Salud",
    campos: [
      ["saludAlergia", "Alergias", "text"],
      ["saludMedicamente", "Medicamentos", "text"],
      ["saludEnfermedad", "Enfermedad", "text"],
    ],
  },
  {
    titulo: "Contacto de emergencia",
    campos: [
      ["emergenciaContacto", "Contacto", "text"],
      ["emergenciaNumero", "Teléfono", "text"],
      ["emergenciaRelacionParentesca", "Parentesco", "text"],
    ],
  },
];

function estiloInput() {
  return {
    width: "100%",
    boxSizing: "border-box",
    background: "var(--bg2)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    color: "var(--text)",
    fontSize: ".8rem",
    padding: ".45rem .7rem",
    fontFamily: "Inter, sans-serif",
  };
}

function FormularioEdicion({ perfil, session, onClose, onGuardado }) {
  // estado inicial del formulario desde el perfil actual
  const [form, setForm] = useState(() => {
    const base = {};
    for (const grupo of GRUPOS_FORM) {
      for (const [key] of grupo.campos) {
        const v = perfil[key];
        base[key] = v === null || v === undefined ? "" : String(v);
      }
    }
    return base;
  });
  const [guardando, setGuardando] = useState(false);
  const [errorEdit, setErrorEdit] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !guardando && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [guardando, onClose]);

  const setCampo = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function guardar() {
    setGuardando(true);
    setErrorEdit("");
    try {
      const payload = { ...form };
      // campos numericos: vacio -> null (igual que en la api)
      for (const key of ["genero", "estadoCivil", "nacionalidadPaisId", "domicilioNumero"]) {
        payload[key] = payload[key] === "" ? null : Number(payload[key]);
      }
      await apiFetch(`/perfil/${session.id}`, {
        method: "POST",
        token: session.token,
        body: payload,
      });
      onGuardado();
    } catch (err) {
      setErrorEdit(err.message);
    } finally {
      setGuardando(false);
    }
  }

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
      onClick={(e) => e.target === e.currentTarget && !guardando && onClose()}
    >
      <div
        style={{
          background: "var(--bg3)",
          border: "1px solid var(--border2)",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "560px",
          maxHeight: "85vh",
          overflowY: "auto",
          padding: "1.75rem",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          disabled={guardando}
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

        <div style={{ fontSize: "1.15rem", fontWeight: "800", marginBottom: ".25rem" }}>
          Editar perfil
        </div>
        <div
          style={{
            fontSize: ".7rem",
            color: "var(--bloqueada-t)",
            fontFamily: "Inter, sans-serif",
            marginBottom: "1.25rem",
          }}
        >
          Se guarda en el sistema oficial de la FIUNI. Documento y legajo no se pueden
          modificar.
        </div>

        {GRUPOS_FORM.map((grupo) => (
          <div key={grupo.titulo} style={{ marginBottom: "1.25rem" }}>
            <div
              style={{
                fontSize: ".65rem",
                textTransform: "uppercase",
                letterSpacing: "2px",
                color: "var(--accent)",
                fontFamily: "Inter, sans-serif",
                fontWeight: "600",
                marginBottom: ".6rem",
              }}
            >
              {grupo.titulo}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: ".7rem",
              }}
            >
              {grupo.campos.map(([key, label, tipo]) => {
                if (tipo === "pais") {
                  return (
                    <label key={key} style={{ fontSize: ".7rem", color: "var(--text-dim)" }}>
                      {label}
                      <select
                        value={form[key]}
                        onChange={setCampo(key)}
                        style={{ ...estiloInput(), marginTop: ".25rem" }}
                      >
                        <option value="">—</option>
                        {PAISES.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }
                if (tipo.startsWith("select:")) {
                  const opciones = tipo.split(":").slice(1);
                  return (
                    <label key={key} style={{ fontSize: ".7rem", color: "var(--text-dim)" }}>
                      {label}
                      <select
                        value={form[key]}
                        onChange={setCampo(key)}
                        style={{ ...estiloInput(), marginTop: ".25rem" }}
                      >
                        <option value="">—</option>
                        {opciones.map((op, i) =>
                          i % 2 === 0 ? (
                            <option key={op} value={op}>
                              {opciones[i + 1]}
                            </option>
                          ) : null,
                        )}
                      </select>
                    </label>
                  );
                }
                return (
                  <label key={key} style={{ fontSize: ".7rem", color: "var(--text-dim)" }}>
                    {label}
                    <input
                      type={tipo}
                      value={form[key]}
                      onChange={setCampo(key)}
                      style={{ ...estiloInput(), marginTop: ".25rem" }}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        ))}

        {errorEdit && (
          <div
            style={{
              color: "var(--bloqueada-t)",
              fontSize: ".75rem",
              marginBottom: ".75rem",
              fontFamily: "Inter, sans-serif",
            }}
          >
            ⚠ {errorEdit}
          </div>
        )}

        <div style={{ display: "flex", gap: ".5rem", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            disabled={guardando}
            style={{
              ...estiloInput(),
              width: "auto",
              cursor: "pointer",
              color: "var(--text-dim)",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            style={{
              background: "var(--accent)",
              border: "none",
              borderRadius: "8px",
              color: "#000",
              fontWeight: "700",
              fontSize: ".8rem",
              padding: ".45rem 1rem",
              cursor: guardando ? "wait" : "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

//Vista principal

export default function Perfil({ session }) {
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sinId, setSinId] = useState(false);
  // foto ampliada / formulario de edicion
  const [fotoAmpliada, setFotoAmpliada] = useState(false);
  const [editando, setEditando] = useState(false);

  const cargar = () => {
    if (!session?.token) return;
    if (!session?.id) {
      setSinId(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    apiFetch(`/perfil/${session.id}`, { token: session.token })
      .then(setPerfil)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(cargar, [session.token, session.id]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <div className="spinner" />
        <span style={{ color: "var(--text-dim)" }}>Cargando perfil...</span>
      </div>
    );
  }

  if (sinId) {
    return (
      <div
        style={{
          padding: "2rem",
          textAlign: "center",
          color: "var(--text-dim)",
        }}
      >
        Tu sesión es de antes de la última actualización.{" "}
        <strong>Cerrá sesión y volvé a entrar</strong> para ver tu perfil.
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

  if (!perfil) {
    return (
      <div
        style={{
          padding: "2rem",
          textAlign: "center",
          color: "var(--text-dim)",
        }}
      >
        No se pudo cargar el perfil
      </div>
    );
  }

  const nombreCompleto = [aTexto(perfil.nombre), aTexto(perfil.apellido)]
    .filter(Boolean)
    .join(" ");
  const iniciales = nombreCompleto
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Discapacidades declaradas (todas booleanas en la API)
  const discapacidades = [
    perfil.saludPoseeDiscapacidadVisual && "Visual",
    perfil.saludPoseeDiscapacidadAuditiva && "Auditiva",
    perfil.saludPoseeDiscapacidadMotora && "Motora",
    perfil.saludPoseeDiscapacidadCognitiva && "Cognitiva",
    perfil.saludPoseeOtraDiscapacidad && (aTexto(perfil.saludOtraDiscapacidad) || "Otra"),
  ].filter(Boolean);

  return (
    <div className="main" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Tarjeta con foto*/}
      <div
        style={{
          background: "var(--bg3)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          padding: "1.5rem",
          display: "flex",
          gap: "1.25rem",
          alignItems: "center",
          flexWrap: "wrap",
          position: "relative",
        }}
      >
        {perfil.foto ? (
          <button
            onClick={() => setFotoAmpliada(true)}
            title="Ampliar foto"
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "zoom-in",
              borderRadius: "50%",
            }}
          >
            <img
              src={`data:${perfil.fotoTipo || "image/jpeg"};base64,${perfil.foto}`}
              alt={nombreCompleto}
              style={{
                width: "84px",
                height: "84px",
                borderRadius: "50%",
                objectFit: "cover",
                border: "2px solid var(--border2)",
                background: "var(--bg2)",
                display: "block",
              }}
            />
          </button>
        ) : (
          <div
            style={{
              width: "84px",
              height: "84px",
              borderRadius: "50%",
              background: "var(--accent)",
              color: "#000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.6rem",
              fontWeight: "800",
              fontFamily: "Lora, serif",
            }}
          >
            {iniciales || "?"}
          </div>
        )}
        <div style={{ minWidth: 0, flex: "1 1 200px" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: "800" }}>
            {nombreCompleto || "Alumno"}
          </div>
          <div
            style={{
              fontSize: ".75rem",
              color: "var(--text-dim)",
              fontFamily: "Inter, sans-serif",
              marginTop: ".2rem",
            }}
          >
            {[aTexto(perfil.numeroDocumento), session?.email].filter(Boolean).join(" · ")}
          </div>
          <div style={{ marginTop: ".6rem", display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
            {aTexto(perfil.grupoSanguineo) && (
              <span className="badge-examen">Grupo {aTexto(perfil.grupoSanguineo)}</span>
            )}
            {aTexto(perfil.nacionalidadPais) && (
              <span className="badge-examen badge-examen-dim">
                {aTexto(perfil.nacionalidadPais)}
              </span>
            )}
          </div>
          {perfil.foto && (
            <div
              style={{
                fontSize: ".6rem",
                color: "var(--text-dim)",
                fontFamily: "Inter, sans-serif",
                marginTop: ".35rem",
              }}
            >
            </div>
          )}
        </div>
        <button
          onClick={() => setEditando(true)}
          style={{
            background: "var(--accent)",
            border: "none",
            borderRadius: "8px",
            color: "#000",
            fontWeight: "700",
            fontSize: ".8rem",
            padding: ".45rem 1rem",
            cursor: "pointer",
            fontFamily: "Inter, sans-serif",
          }}
        >
          Editar perfil
        </button>
      </div>

      {/* Datos personales */}
      <Seccion
        titulo="Datos personales"
        hijos={
          <>
            <Campo etiqueta="Fecha de nacimiento" valor={formatearFecha(perfil.fechaNacimiento)} />
            <Campo etiqueta="Edad" valor={perfil.age ?? ""} />
            <Campo
              etiqueta="Género"
              valor={GENEROS[perfil.genero] ?? aTexto(perfil.genero)}
            />
            <Campo etiqueta="Nacionalidad" valor={aTexto(perfil.nacionalidadPais)} />
            <Campo
              etiqueta="Estado civil"
              valor={ESTADOS_CIVILES[perfil.estadoCivil] ?? aTexto(perfil.estadoCivil)}
            />
            <Campo etiqueta="Documento" valor={aTexto(perfil.numeroDocumento)} />
          </>
        }
      />

      {/* Domicilio y trabajo*/}
      <Seccion
        titulo="Domicilio y trabajo"
        hijos={
          <>
            <Campo etiqueta="Domicilio" valor={aTexto(perfil.domicilioCalle)} />
            <Campo etiqueta="Localidad" valor={aTexto(perfil.domicilioLocalidad)} />
            <Campo etiqueta="Teléfono" valor={aTexto(perfil.domicilioTelefono)} />
            <Campo etiqueta="Empresa" valor={aTexto(perfil.trabajoEmpresa)} />
            <Campo etiqueta="Trabajo localidad" valor={aTexto(perfil.trabajoLocalidad)} />
            <Campo etiqueta="Trabajo teléfono" valor={aTexto(perfil.trabajoTelefono)} />
            <Campo etiqueta="Horario" valor={aTexto(perfil.trabajoHorario)} />
          </>
        }
      />

      {/* Salud*/}
      <Seccion
        titulo="Salud"
        hijos={
          <>
            <Campo etiqueta="Alergias" valor={aTexto(perfil.saludAlergia)} />
            <Campo etiqueta="Medicamentos" valor={aTexto(perfil.saludMedicamente)} />
            <Campo etiqueta="Enfermedad" valor={aTexto(perfil.saludEnfermedad)} />
            <Campo
              etiqueta="Discapacidades"
              valor={discapacidades.length ? discapacidades.join(", ") : ""}
            />
          </>
        }
      />

      {/* Emergencias*/}
      <Seccion
        titulo="Contacto de emergencia"
        hijos={
          <>
            <Campo etiqueta="Contacto" valor={aTexto(perfil.emergenciaContacto)} />
            <Campo etiqueta="Teléfono" valor={aTexto(perfil.emergenciaNumero)} />
            <Campo
              etiqueta="Parentesco"
              valor={aTexto(perfil.emergenciaRelacionParentesca)}
            />
          </>
        }
      />

      {/* Modales*/}
      {fotoAmpliada && perfil.foto && (
        <FotoModal
          perfil={perfil}
          nombreCompleto={nombreCompleto}
          onClose={() => setFotoAmpliada(false)}
        />
      )}
      {editando && (
        <FormularioEdicion
          perfil={perfil}
          session={session}
          onClose={() => setEditando(false)}
          onGuardado={() => {
            setEditando(false);
            cargar();
          }}
        />
      )}
    </div>
  );
}
