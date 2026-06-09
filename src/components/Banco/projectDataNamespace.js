const SHARED_ONEOWNER_RUNTIME_KEYS = new Set(["aly-onepages-runtime"]);
const LOCAL_QUERY_PARAM = "firebaseProject";
const LOCAL_CONTEXT_QUERY_PARAMS = ["projectSystemKey", "systemKey", "slug", "projectSlug"];
const STORAGE_CONTEXT_KEYS = ["systemProjectContextKey", "firebaseProjectTarget"];

function normalizeKey(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9-_.]+/g, "");
}

function isLocalHost(hostname = "") {
  const host = String(hostname || "").trim().toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function resolveLocalProjectSystemKeyFromSearch(search = "") {
  try {
    const searchParams = new URLSearchParams(search || "");
    for (const key of LOCAL_CONTEXT_QUERY_PARAMS) {
      const value = normalizeKey(searchParams.get(key) || "");
      if (value) return value;
    }
  } catch {
    // Ignora erro de parse da URL.
  }
  return "";
}

function resolveContextProjectKeyFromWindow(activeProjectKey = "") {
  if (typeof window === "undefined") return "";

  const hostname = normalizeKey(window.location.hostname || "");
  const localHost = isLocalHost(hostname);
  const sharedRuntimeAtivo = SHARED_ONEOWNER_RUNTIME_KEYS.has(normalizeKey(activeProjectKey));

  if (localHost) {
    const explicitProjectKey = resolveLocalProjectSystemKeyFromSearch(window.location.search || "");
    if (explicitProjectKey) {
      return explicitProjectKey;
    }

    if (!sharedRuntimeAtivo) {
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
  if (!SHARED_ONEOWNER_RUNTIME_KEYS.has(activeKey)) return "";

  const contextKey = resolveContextProjectKeyFromWindow(activeKey);
  if (!contextKey || contextKey === activeKey) return "";

  return contextKey;
}

export function getProjectDataNamespaceStamp(activeProjectKey = "") {
  const namespaceKey = resolveProjectDataNamespaceKey(activeProjectKey);
  return namespaceKey
    ? {
        projectSystemKey: namespaceKey,
      }
    : {};
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

  // Runtime oneowner com namespace ativo: usa somente caminho namespaced.
  // Isso evita criar/ler dados duplicados em /users na raiz.
  return [primaryPath];
}
