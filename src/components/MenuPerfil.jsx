import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../api";

function inicialesDe(nombre) {
  return (nombre || "")
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export default function MenuPerfil({ session, onLogout, onNavegar }) {
  const [abierto, setAbierto] = useState(false);
  const [perfil, setPerfil] = useState(null);
  const refMenu = useRef(null);

  useEffect(() => {
    if (!session?.id) return;
    let cancelado = false;
    apiFetch(`/perfil/${session.id}`, { token: session.token })
      .then((p) => {
        if (!cancelado) setPerfil(p);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [session.id, session.token]);

  useEffect(() => {
    if (!abierto) return;
    function onClickFuera(e) {
      if (refMenu.current && !refMenu.current.contains(e.target)) {
        setAbierto(false);
      }
    }
    function onEscape(e) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", onClickFuera);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickFuera);
      document.removeEventListener("keydown", onEscape);
    };
  }, [abierto]);

  return (
    <div className="avatar-menu" ref={refMenu}>
      <button
        className="avatar-btn"
        onClick={() => setAbierto(!abierto)}
        aria-label="Menú de usuario"
        aria-expanded={abierto}
      >
        {perfil?.foto ? (
          <img
            src={`data:${perfil.fotoTipo || "image/jpeg"};base64,${perfil.foto}`}
            alt="Foto de perfil"
          />
        ) : (
          <span>{inicialesDe(session.nombre) || "?"}</span>
        )}
      </button>

      {abierto && (
        <div className="avatar-dropdown">
          <button
            onClick={() => {
              setAbierto(false);
              onNavegar("perfil");
            }}
          >
            Mi perfil
          </button>
          <button className="avatar-dropdown-salir" onClick={onLogout}>
            Salir
          </button>
        </div>
      )}
    </div>
  );
}