import { useState } from "react";
import { useAuth } from "./context/AuthContext";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Mapa from "./components/Mapa";
import Calendario from "./components/Calendario";
import Aulas from "./components/Aulas";
import Examenes from "./components/Examenes";
import Perfil from "./components/Perfil";
import Sidebar from "./components/Sidebar";
import ToggleTema from "./components/ToggleTema";
import MenuPerfil from "./components/MenuPerfil";

export default function App() {
  const { session, login, logout } = useAuth();
  const [vista, setVista] = useState("dashboard");
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  if (!session) return <Login onLogin={login} />;

  return (
    <>
      <header className="header">
        <div className="header-izq">
          <button
            className="btn-hamburguesa"
            onClick={() => setSidebarAbierto(true)}
            aria-label="Abrir menú"
          >
            ☰
          </button>
         { /*  Voy a eliminar hasta que encuentre un mejor logo
         <div className="header-logo">
            <img src="/Fiuni-Logo.svg" alt="FIUNI" height={36} />
          </div>  */}
        </div>
        <nav className="header-nav">
          {[
            ["dashboard", "Mis Materias"],
            ["mapa", "Correlativas"],
            ["calendario", "Calendario"],
          ].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              style={{
                background: vista === v ? "var(--accent)" : "transparent",
                color: vista === v ? "#000" : "var(--text-dim)",
                padding: ".4rem .9rem",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                fontFamily: "Lora, serif",
                fontSize: ".85rem",
                fontWeight: "600",
                transition: "all .2s",
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="header-user">
          <ToggleTema />
          <span className="header-nombre">{session?.nombre || "Usuario"}</span>
          <MenuPerfil
            session={session}
            onLogout={logout}
            onNavegar={setVista}
          />
        </div>
      </header>

      {vista === "dashboard" ? (
        <Dashboard session={session} />
      ) : vista === "calendario" ? (
        <Calendario session={session} />
      ) : vista === "aulas" ? (
        <Aulas />
      ) : vista === "examenes" ? (
        <Examenes session={session} />
      ) : vista === "perfil" ? (
        <Perfil session={session} />
      ) : (
        <Mapa session={session} />
      )}
      <Sidebar
        abierto={sidebarAbierto}
        onClose={() => setSidebarAbierto(false)}
        vista={vista}
        onNavegar={setVista}
      />
    </>
  );
}
