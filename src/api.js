import { API } from "./constants";

//funcion para manejar el localStorage
export const storage = {
  get: (k) => {
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  del: (k) => localStorage.removeItem(k),
};

//funcion para hacer fetch al beckend
export async function apiFetch(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`; //si hay token se agrega al header

  if (esCacheable(method, path)) {
    const key = cacheKey(path, token);
    const cacheado = cacheGet(key);
    if (cacheado) return clonar(cacheado);
    const enVuelo = inflight.get(key);
    if (enVuelo) return clonar(await enVuelo);
    const promesa = fetch(`${API}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
      .then((res) => manejarRespuesta(res, path))
      .then((data) => {
        cacheSet(key, data);
        return data;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, promesa);
    return clonar(await promesa);
  }

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return manejarRespuesta(res, path);
}

async function manejarRespuesta(res, path) {
  const manejarError401 = !path.includes("/login"); //manejamos el error 401 solo si no es una peticion al login

  if (res.status === 401 && manejarError401) {
    storage.del("session");
    window.location.reload();
    throw new Error("Sesión expirada");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    //obtenemos el mensaje y el status desde el backend
    const errorMessage = err.detail || err.message || `Error ${res.status}`;
    const error = new Error(errorMessage);
    error.status = res.status;
    throw error;
  }

  return res.json();
}

// implementacion de cache
// Evita requests duplicados del StrictMode y entre vistas
// Las escrituras y /auth nunca se cachean.
const CACHE_TTL_MS = 30000;
const cache = new Map(); // key -> { expira, data }
const inflight = new Map(); 

function esCacheable(method, path) {
  return method === "GET" && !path.includes("/auth");
}

function cacheKey(path, token) {
  return `${path}|${token || ""}`;
}

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expira) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function cacheSet(key, data) {
  cache.set(key, { expira: Date.now() + CACHE_TTL_MS, data });
}

function clonar(data) {
  return JSON.parse(JSON.stringify(data));
}

// ─── NUEVA FUNCIÓN ────────────────────────────────────────────────────

/**
 * Extrae el payload de un token JWT sin verificar la firma.
 * Esto permite obtener el nombre real del usuario desde el token,
 * que no puede ser manipulado desde localStorage sin romper la sesión.
 */
export function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}
