const SHARED_ONEPAGE_RUNTIME_KEYS = new Set(["aly-onepages-runtime"]);
const LOCAL_QUERY_PARAM = "firebaseProject";
const STORAGE_CONTEXT_KEYS = ["systemProjectContextKey", "firebaseProjectTarget"];

function normalizeKey(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_.]+/g, "");
}

function isLocalHost(hostname = "") {
  const host = String(hostname || "").trim().toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function resolveContextProjectKeyFromWindow() {
  if (typeof window === "undefined") return "";

  const hostname = normalizeKey(window.location.hostname || "");
  const localHost = isLocalHost(hostname);

  if (localHost) {
    try {
      const searchParams = new URLSearchParams(window.location.search || "");
      const keyFromQuery = normalizeKey(searchParams.get(LOCAL_QUERY_PARAM) || "");
      if (keyFromQuery) {
        return keyFromQuery;
      }
    } catch {
      // Ignora erro de parse da URL.
    }
  }

  for (const storageKey of STORAGE_CONTEXT_KEYS) {
    try {
      const stored = normalizeKey(window.localStorage.getItem(storageKey) || "");
      if (stored) return stored;
    } catch {
      // Ignora indisponibilidade de storage.
    }
  }

  if (!localHost) {
    const slugHost = normalizeKey(String(hostname.split(".")[0] || ""));
    if (slugHost) return slugHost;
  }

  return "";
}

export function resolveProjectDataNamespaceKey(activeProjectKey = "") {
  const activeKey = normalizeKey(activeProjectKey);
  if (!SHARED_ONEPAGE_RUNTIME_KEYS.has(activeKey)) return "";

  const contextKey = resolveContextProjectKeyFromWindow();
  if (!contextKey || contextKey === activeKey) return "";

  return contextKey;
}

export function isProjectDataNamespaced(activeProjectKey = "") {
  return Boolean(resolveProjectDataNamespaceKey(activeProjectKey));
}

export function buildProjectDataPathSegments(
  segments = [],
  { activeProjectKey = "" } = {}
) {
  const path = Array.isArray(segments) ? segments.filter(Boolean) : [];
  const namespaceKey = resolveProjectDataNamespaceKey(activeProjectKey);
  if (!namespaceKey) return path;
  return ["projetos", namespaceKey, ...path];
}

export function buildProjectDataPathCandidates(
  segments = [],
  { activeProjectKey = "" } = {}
) {
  const legacyPath = Array.isArray(segments) ? segments.filter(Boolean) : [];
  const primaryPath = buildProjectDataPathSegments(legacyPath, { activeProjectKey });

  const primaryKey = primaryPath.join("/");
  const legacyKey = legacyPath.join("/");

  if (!primaryKey || primaryKey === legacyKey) {
    return [legacyPath];
  }

  // Runtime onepage com namespace ativo: usa somente caminho namespaced.
  // Isso evita criar/ler dados duplicados em /users na raiz.
  return [primaryPath];
}
