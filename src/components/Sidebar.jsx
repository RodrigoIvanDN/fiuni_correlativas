import { useState, useEffect } from "react";
import { CARRERAS_DOCUMENTOS } from "../data/carreras";

const OPCIONES_NAV = [
  ["aulas", "Aulas"],
  ["dashboard", "Mis Materias"],
  ["mapa", "Correlativas"],
  ["calendario", "Calendario"],
  ["examenes", "Exámenes"], 
];

export default function Sidebar({ abierto, onClose, vista, onNavegar }) {
  const [submenuDoc, setSubmenuDoc] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    if (abierto) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto, onClose]);

  useEffect(() => {
    if (!abierto) setSubmenuDoc(false);
  }, [abierto]);

  const ir = (v) => {
    onNavegar(v);
    onClose();
  };

  return (
    <div className={`sidebar-overlay ${abierto ? "abierto" : ""}`} onClick={onClose}>
      <aside className="sidebar" onClick={(e) => e.stopPropagation()}>
        <div className="sidebar-cabecera">
          <span className="sidebar-titulo">Menú</span>
          <button className="sidebar-cerrar" onClick={onClose} aria-label="Cerrar menú">
            ✕
          </button>
        </div>

        <nav className="sidebar-nav">
          {OPCIONES_NAV.map(([v, label]) => (
            <button
              key={v}
              className={`sidebar-item ${vista === v ? "activo" : ""}`}
              onClick={() => ir(v)}
            >
              {label}
            </button>
          ))}

          {/* submenu para formularios para documentos */}
          <div className="sidebar-submenu">
            <button
              className={`sidebar-item ${submenuDoc ? "activo" : ""}`}
              onClick={() => setSubmenuDoc(!submenuDoc)}
            >
              <span>Formularios para Documentos</span>
              <span className="sidebar-flecha">{submenuDoc ? "▾" : "▸"}</span>
            </button>
            {submenuDoc && (
              <div className="sidebar-submenu-items">
                {CARRERAS_DOCUMENTOS.map((c) => (
                  <a
                    key={c.id}
                    className="sidebar-link"
                    href={c.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onClose}
                  >
                    {c.nombre}
                  </a>
                ))}
              </div>
            )}
          </div>
        </nav>
      </aside>
    </div>
  );
}
