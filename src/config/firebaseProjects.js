const DEFAULT_FUNCTIONS_REGION = "us-central1";
const LOCAL_STORAGE_PROJECT_KEY = "firebaseProjectTarget";
const LOCAL_STORAGE_PROJECT_ALIASES_KEY = "firebaseProjectAliases";
const LOCAL_QUERY_PARAM = "firebaseProject";
const FIREBASE_ENV_PREFIX = "REACT_APP_FIREBASE_";
const FIREBASE_PROJECT_KEYS_ENV = "REACT_APP_FIREBASE_PROJECT_KEYS";
const FORCED_SHARED_STORAGE_BUCKET = "teste-aa015.appspot.com";
const MANAGER_QUERY_CACHE_PREFIX = "firebaseManagerDomain:";
const STATIC_PROJECT_ALIASES = {
  obaydon: "obeyon",
  obeydon: "obeyon",
  obeydom: "obeyon",
  obaydom: "obeyon",
};

function sanitizeEnvScalar(value) {
  return String(value || "")
    .replace(/[\r\n]+/g, "")
    .trim();
}

const TESTE_AA015_CONFIG = {
  apiKey: "AIzaSyCJMHDdf-GwLwyqKQLRWR8kkyWXDP2v02A",
  authDomain: "teste-aa015.firebaseapp.com",
  databaseURL: "https://teste-aa015-default-rtdb.firebaseio.com",
  projectId: "teste-aa015",
  storageBucket: "teste-aa015.appspot.com",
  messagingSenderId: "99960275074",
  appId: "1:99960275074:web:e2923f7e34a0c0c18c749b",
};


function normalizeStorageBucket(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/^gs:\/\//i, "")
    .replace(/\/+$/, "");
  return normalized;
}

function normalizeHost(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";

  const semProtocolo = raw.replace(/^https?:\/\//i, "");
  const [host] = semProtocolo.split("/");
  return host.trim();
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseDomains(value) {
  return parseCsv(value).map((host) => normalizeHost(host)).filter(Boolean);
}

function resolveStaticProjectAlias(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return STATIC_PROJECT_ALIASES[raw.toLowerCase()] || raw;
}

function getHostAliases(host) {
  const normalized = normalizeHost(host);
  if (!normalized) return [];

  const aliases = new Set([normalized]);
  if (normalized.startsWith("www.")) {
    aliases.add(normalized.replace(/^www\./, ""));
  } else {
    aliases.add(`www.${normalized}`);
  }

  return Array.from(aliases).filter(Boolean);
}

function normalizeAuthDomain(value, projectId) {
  const host = normalizeHost(value);
  const fallback = projectId ? `${projectId}.firebaseapp.com` : "";

  if (!host) return fallback;

  if (host.endsWith(".vercel.app")) {
    return fallback || host;
  }

  return host;
}

function applySharedStorageBucket(firebaseConfig) {
  return {
    ...firebaseConfig,
    storageBucket: normalizeStorageBucket(FORCED_SHARED_STORAGE_BUCKET),
  };
}

function buildProjectFromEnvPrefix(prefixoBruto) {
  const prefixo = sanitizeEnvScalar(prefixoBruto).toUpperCase();
  if (!prefixo) return null;

  const envKey = `${FIREBASE_ENV_PREFIX}${prefixo}_`;
  const keyPersonalizada = sanitizeEnvScalar(process.env[`${envKey}KEY`]);
  const apiKey = sanitizeEnvScalar(process.env[`${envKey}API_KEY`]);
  const projectId = sanitizeEnvScalar(process.env[`${envKey}PROJECT_ID`]);
  const authDomain = normalizeAuthDomain(
    sanitizeEnvScalar(process.env[`${envKey}AUTH_DOMAIN`]),
    projectId
  );
  const databaseURL = sanitizeEnvScalar(process.env[`${envKey}DATABASE_URL`]);
  const storageBucket = sanitizeEnvScalar(process.env[`${envKey}STORAGE_BUCKET`]);
  const messagingSenderId = sanitizeEnvScalar(
    process.env[`${envKey}MESSAGING_SENDER_ID`]
  );
  const appId = sanitizeEnvScalar(process.env[`${envKey}APP_ID`]);
  const messagingVapidKey = sanitizeEnvScalar(
    process.env[`${envKey}VAPID_KEY`] || process.env.REACT_APP_FIREBASE_VAPID_KEY
  );
  const functionsRegion =
    sanitizeEnvScalar(process.env[`${envKey}FUNCTIONS_REGION`]) ||
    DEFAULT_FUNCTIONS_REGION;
  const domains = parseDomains(process.env[`${envKey}DOMAINS`]);

  const hasRequired =
    !!apiKey &&
    !!authDomain &&
    !!projectId &&
    !!storageBucket &&
    !!messagingSenderId &&
    !!appId;

  if (!hasRequired) {
    return null;
  }

  return {
    key: (keyPersonalizada || prefixo.toLowerCase()).trim(),
    config: applySharedStorageBucket({
      apiKey,
      authDomain,
      databaseURL,
      projectId,
      storageBucket,
      messagingSenderId,
      appId,
    }),
    functionsRegion,
    domains,
    envPrefix: prefixo,
    messagingVapidKey,
  };
}

function descobrirPrefixosProjetosEnv() {
  const explicitos = parseCsv(process.env[FIREBASE_PROJECT_KEYS_ENV] || "").map((key) =>
    key.toUpperCase()
  );

  if (explicitos.length) {
    return Array.from(new Set(explicitos));
  }

  const regex = /^REACT_APP_FIREBASE_([A-Z0-9_]+)_PROJECT_ID$/;
  const detectados = Object.keys(process.env || {})
    .map((nomeEnv) => {
      const match = nomeEnv.match(regex);
      return match ? match[1] : "";
    })
    .filter(Boolean);

  return Array.from(new Set(detectados));
}

function coletarProjetosEnv() {
  return descobrirPrefixosProjetosEnv()
    .map((prefixo) => buildProjectFromEnvPrefix(prefixo))
    .filter(Boolean);
}

function getHostProjectMap(projects) {
  const hostMap = {};

  Object.values(projects).forEach((project) => {
    (project.domains || []).forEach((domainHost) => {
      getHostAliases(domainHost).forEach((alias) => {
        hostMap[alias] = project.key;
      });
    });
  });

  return hostMap;
}

function isLocalHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

function safeReadLocalProjectFromUrl() {
  if (typeof window === "undefined") return "";
  try {
    const params = new URLSearchParams(window.location.search);
    return (params.get(LOCAL_QUERY_PARAM) || "").trim();
  } catch {
    return "";
  }
}

function safeReadLocalProjectFromStorage() {
  if (typeof window === "undefined") return "";
  try {
    return (localStorage.getItem(LOCAL_STORAGE_PROJECT_KEY) || "").trim();
  } catch {
    return "";
  }
}

function safeReadProjectAliasesFromStorage() {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PROJECT_ALIASES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function safeWriteProjectAliasToStorage(aliasKey, projectKey) {
  if (typeof window === "undefined") return;
  const alias = String(aliasKey || "").trim().toLowerCase();
  const target = String(projectKey || "").trim();
  if (!alias || !target) return;

  try {
    const existentes = safeReadProjectAliasesFromStorage();
    const atualizados = {
      ...existentes,
      [alias]: target,
    };
    localStorage.setItem(
      LOCAL_STORAGE_PROJECT_ALIASES_KEY,
      JSON.stringify(atualizados)
    );
  } catch {
    // Ignora erros de storage.
  }
}

function resolveProjectKeyByProjectId(projects, projectId) {
  const normalizedProjectId = String(projectId || "").trim().toLowerCase();
  if (!normalizedProjectId) return "";

  const match = Object.values(projects).find(
    (project) =>
      String(project?.config?.projectId || "").trim().toLowerCase() === normalizedProjectId
  );

  return match?.key || "";
}

function getOneownerRuntimeProjectKey(projects) {
  const keyConfigurada = String(
    process.env.REACT_APP_FIREBASE_ALY_ONEPAGES_RUNTIME_KEY || ""
  ).trim();
  if (keyConfigurada && projects[keyConfigurada]) {
    return keyConfigurada;
  }

  const byProjectId = resolveProjectKeyByProjectId(
    projects,
    "aly-onepages-runtime"
  );
  return byProjectId || "";
}

function isProbablySystemKey(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return false;
  return /^[a-z0-9][a-z0-9-_]{1,79}$/i.test(normalized);
}

function extrairSlugDeHostname(hostname) {
  const host = normalizeHost(hostname);
  if (!host) return "";
  const partes = host.split(".");
  return String(partes[0] || "").trim().toLowerCase();
}

function safeWriteLocalProjectToStorage(projectKey) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_PROJECT_KEY, projectKey);
  } catch {
    // Ignora erros de storage.
  }
}

function getManagerRuntimeConfig() {
  const apiKey = sanitizeEnvScalar(process.env.REACT_APP_SYSTEM_MANAGER_API_KEY);
  const projectId = sanitizeEnvScalar(process.env.REACT_APP_SYSTEM_MANAGER_PROJECT_ID);

  if (!apiKey || !projectId) return null;
  return { apiKey, projectId };
}

function decodeFirestoreValue(value = {}) {
  if ("stringValue" in value) return String(value.stringValue || "");
  if ("integerValue" in value) return Number(value.integerValue || 0);
  if ("doubleValue" in value) return Number(value.doubleValue || 0);
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return String(value.timestampValue || "");
  if ("mapValue" in value) {
    const fields = value.mapValue?.fields || {};
    return Object.fromEntries(
      Object.entries(fields).map(([key, fieldValue]) => [key, decodeFirestoreValue(fieldValue)])
    );
  }
  if ("arrayValue" in value) {
    const values = Array.isArray(value.arrayValue?.values) ? value.arrayValue.values : [];
    return values.map((item) => decodeFirestoreValue(item));
  }
  return undefined;
}

function decodeFirestoreDocument(documentValue = {}) {
  const fields = documentValue?.fields || {};
  return Object.fromEntries(
    Object.entries(fields).map(([key, fieldValue]) => [key, decodeFirestoreValue(fieldValue)])
  );
}

function buildManagerDomainCacheKey(hostname) {
  return `${MANAGER_QUERY_CACHE_PREFIX}${normalizeHost(hostname)}`;
}

function safeReadManagerDomainCache(hostname) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(buildManagerDomainCacheKey(hostname));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function safeWriteManagerDomainCache(hostname, payload) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(buildManagerDomainCacheKey(hostname), JSON.stringify(payload));
  } catch {
    // Ignora indisponibilidade de storage.
  }
}

async function queryManagerProjectByDomain(hostname) {
  const normalizedHost = normalizeHost(hostname);
  if (!normalizedHost) return null;

  const cache = safeReadManagerDomainCache(normalizedHost);
  if (cache?.hostname === normalizedHost && cache?.firebaseProjectId) {
    return cache;
  }

  const managerRuntime = getManagerRuntimeConfig();
  if (!managerRuntime) return null;

  try {
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        managerRuntime.projectId
      )}/databases/(default)/documents:runQuery?key=${encodeURIComponent(managerRuntime.apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: "systems" }],
            where: {
              fieldFilter: {
                field: { fieldPath: "domains" },
                op: "ARRAY_CONTAINS",
                value: { stringValue: normalizedHost },
              },
            },
            limit: 1,
          },
        }),
      }
    );

    if (!response.ok) return null;

    const payload = await response.json();
    const linhas = Array.isArray(payload) ? payload : [];
    const document = linhas.find((item) => item?.document)?.document;
    if (!document) return null;

    const data = decodeFirestoreDocument(document);
    const firebaseRuntimeConfig =
      data?.firebaseRuntimeConfig && typeof data.firebaseRuntimeConfig === "object"
        ? data.firebaseRuntimeConfig
        : {};
    const firebaseProjectId = String(
      firebaseRuntimeConfig.projectId || data?.firebaseProjectId || ""
    ).trim();
    const systemKey = String(data?.systemKey || "").trim().toLowerCase();

    if (!firebaseProjectId) return null;

    const resultado = {
      hostname: normalizedHost,
      firebaseProjectId,
      systemKey,
    };
    safeWriteManagerDomainCache(normalizedHost, resultado);
    return resultado;
  } catch {
    return null;
  }
}

function resolveRequestedProjectKeySync(projects, hostProjectMap) {
  const hostname =
    typeof window !== "undefined"
      ? (window.location.hostname || "").toLowerCase()
      : "";
  const localHost = isLocalHost(hostname);
  const envTarget = (process.env.REACT_APP_FIREBASE_TARGET || "").trim();

  if (localHost && envTarget && projects[envTarget]) {
    return envTarget;
  }

  if (localHost) {
    const queryTarget = safeReadLocalProjectFromUrl();
    const queryTargetAlias = resolveStaticProjectAlias(queryTarget);
    if (queryTargetAlias && projects[queryTargetAlias]) {
      safeWriteLocalProjectToStorage(queryTargetAlias);
      return queryTargetAlias;
    }

    if (queryTarget) {
      const byProjectId = resolveProjectKeyByProjectId(projects, queryTargetAlias);
      if (byProjectId) {
        safeWriteLocalProjectToStorage(byProjectId);
        return byProjectId;
      }

      const aliases = safeReadProjectAliasesFromStorage();
      const aliasValue =
        aliases[queryTargetAlias] || aliases[queryTargetAlias.toLowerCase()] || "";
      const aliasValueNormalizado = resolveStaticProjectAlias(aliasValue);
      if (aliasValueNormalizado && projects[aliasValueNormalizado]) {
        safeWriteLocalProjectToStorage(aliasValueNormalizado);
        return aliasValueNormalizado;
      }

      if (aliasValueNormalizado) {
        const aliasByProjectId = resolveProjectKeyByProjectId(projects, aliasValueNormalizado);
        if (aliasByProjectId) {
          safeWriteLocalProjectToStorage(aliasByProjectId);
          return aliasByProjectId;
        }
      }

      const oneownerRuntimeKey = getOneownerRuntimeProjectKey(projects);
      if (oneownerRuntimeKey && isProbablySystemKey(queryTargetAlias)) {
        safeWriteProjectAliasToStorage(queryTargetAlias, oneownerRuntimeKey);
        safeWriteLocalProjectToStorage(oneownerRuntimeKey);
        return oneownerRuntimeKey;
      }
    }

    const storageTarget = safeReadLocalProjectFromStorage();
    const storageTargetAlias = resolveStaticProjectAlias(storageTarget);
    if (storageTargetAlias && projects[storageTargetAlias]) {
      return storageTargetAlias;
    }
    if (storageTargetAlias) {
      const storageByProjectId = resolveProjectKeyByProjectId(projects, storageTargetAlias);
      if (storageByProjectId) {
        return storageByProjectId;
      }
    }

    return "teste-aa015";
  }

  const hostTarget = hostProjectMap[hostname];
  if (hostTarget && projects[hostTarget]) {
    return hostTarget;
  }

  const slugHost = extrairSlugDeHostname(hostname);
  const slugHostAlias = resolveStaticProjectAlias(slugHost);
  if (slugHostAlias && projects[slugHostAlias]) {
    return slugHostAlias;
  }

  const aliases = safeReadProjectAliasesFromStorage();
  const aliasSlug = aliases[slugHostAlias] || aliases[String(slugHostAlias).toLowerCase()] || "";
  const aliasSlugNormalizado = resolveStaticProjectAlias(aliasSlug);
  if (aliasSlugNormalizado && projects[aliasSlugNormalizado]) {
    return aliasSlugNormalizado;
  }

  return "";
}

function buildProjectsMap() {
  const testeConfig = applySharedStorageBucket(TESTE_AA015_CONFIG);
  const defaultMessagingVapidKey = sanitizeEnvScalar(process.env.REACT_APP_FIREBASE_VAPID_KEY);

  const projects = {
    "teste-aa015": {
      key: "teste-aa015",
      config: testeConfig,
      functionsRegion: DEFAULT_FUNCTIONS_REGION,
      domains: [],
      messagingVapidKey: defaultMessagingVapidKey,
    },
  };

  coletarProjetosEnv().forEach((project) => {
    projects[project.key] = {
      key: project.key,
      config: project.config,
      functionsRegion: project.functionsRegion || DEFAULT_FUNCTIONS_REGION,
      domains: project.domains || [],
      envPrefix: project.envPrefix || "",
      messagingVapidKey: project.messagingVapidKey || defaultMessagingVapidKey,
    };
  });

  return projects;
}

export function listConfiguredFirebaseProjects() {
  const projects = buildProjectsMap();

  return Object.values(projects).map((project) => ({
    key: project.key,
    projectId: project.config?.projectId || "",
    domains: Array.isArray(project.domains) ? project.domains : [],
    functionsRegion: project.functionsRegion || DEFAULT_FUNCTIONS_REGION,
    firebaseConfig: project.config || {},
    envPrefix: project.envPrefix || "",
    messagingVapidKey: project.messagingVapidKey || "",
  }));
}

function montarResultadoProjeto(selectedProject) {
  return {
    projectKey: selectedProject.key,
    firebaseConfig: selectedProject.config,
    functionsRegion: selectedProject.functionsRegion || DEFAULT_FUNCTIONS_REGION,
    messagingVapidKey: selectedProject.messagingVapidKey || "",
  };
}

export function resolveFirebaseProject() {
  const projects = buildProjectsMap();
  const hostProjectMap = getHostProjectMap(projects);
  const selectedKey = resolveRequestedProjectKeySync(projects, hostProjectMap);
  const selectedProject =
    projects[selectedKey] ||
    projects[getOneownerRuntimeProjectKey(projects)] ||
    projects["teste-aa015"];

  return montarResultadoProjeto(selectedProject);
}

export async function resolveFirebaseProjectAsync() {
  const projects = buildProjectsMap();
  const hostProjectMap = getHostProjectMap(projects);
  const hostname =
    typeof window !== "undefined"
      ? (window.location.hostname || "").toLowerCase()
      : "";

  const selectedKeySync = resolveRequestedProjectKeySync(projects, hostProjectMap);
  if (selectedKeySync && projects[selectedKeySync]) {
    return montarResultadoProjeto(projects[selectedKeySync]);
  }

  if (!isLocalHost(hostname)) {
    const managerMatch = await queryManagerProjectByDomain(hostname);
    if (managerMatch?.firebaseProjectId) {
      const projectKeyById = resolveProjectKeyByProjectId(projects, managerMatch.firebaseProjectId);
      if (projectKeyById && projects[projectKeyById]) {
        const slugHost = extrairSlugDeHostname(hostname);
        if (slugHost) {
          safeWriteProjectAliasToStorage(slugHost, projectKeyById);
        }
        if (managerMatch.systemKey) {
          safeWriteProjectAliasToStorage(managerMatch.systemKey, projectKeyById);
        }
        return montarResultadoProjeto(projects[projectKeyById]);
      }
    }
  }

  const oneownerRuntimeKey = getOneownerRuntimeProjectKey(projects);
  if (oneownerRuntimeKey && projects[oneownerRuntimeKey]) {
    return montarResultadoProjeto(projects[oneownerRuntimeKey]);
  }

  return montarResultadoProjeto(projects["teste-aa015"]);
}
