const DEFAULT_FUNCTIONS_REGION = "us-central1";
const LOCAL_STORAGE_PROJECT_KEY = "firebaseProjectTarget";
const LOCAL_QUERY_PARAM = "firebaseProject";
const FIREBASE_ENV_PREFIX = "REACT_APP_FIREBASE_";
const FIREBASE_PROJECT_KEYS_ENV = "REACT_APP_FIREBASE_PROJECT_KEYS";
const SHARED_STORAGE_BUCKET_ENV =
  process.env.REACT_APP_FIREBASE_SHARED_STORAGE_BUCKET || "";

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

function applySharedStorageBucket(firebaseConfig) {
  const sharedBucket = normalizeStorageBucket(SHARED_STORAGE_BUCKET_ENV);
  if (!sharedBucket) {
    return firebaseConfig;
  }

  return {
    ...firebaseConfig,
    storageBucket: sharedBucket,
  };
}

function buildProjectFromEnvPrefix(prefixoBruto) {
  const prefixo = String(prefixoBruto || "").trim().toUpperCase();
  if (!prefixo) return null;

  const envKey = `${FIREBASE_ENV_PREFIX}${prefixo}_`;
  const keyPersonalizada = process.env[`${envKey}KEY`] || "";
  const apiKey = process.env[`${envKey}API_KEY`] || "";
  const authDomain = process.env[`${envKey}AUTH_DOMAIN`] || "";
  const databaseURL = process.env[`${envKey}DATABASE_URL`] || "";
  const projectId = process.env[`${envKey}PROJECT_ID`] || "";
  const storageBucket = process.env[`${envKey}STORAGE_BUCKET`] || "";
  const messagingSenderId = process.env[`${envKey}MESSAGING_SENDER_ID`] || "";
  const appId = process.env[`${envKey}APP_ID`] || "";
  const functionsRegion =
    process.env[`${envKey}FUNCTIONS_REGION`] || DEFAULT_FUNCTIONS_REGION;
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
  const hostMap = {
    "obeyon.vercel.app": "obeyon",
    "teste-aa015.web.app": "teste-aa015",
    "teste-aa015.firebaseapp.com": "teste-aa015",
  };

  Object.values(projects).forEach((project) => {
    (project.domains || []).forEach((domainHost) => {
      hostMap[domainHost] = project.key;
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

function safeWriteLocalProjectToStorage(projectKey) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_PROJECT_KEY, projectKey);
  } catch {
    // Ignora erros de storage.
  }
}

function resolveRequestedProjectKey(projects, hostProjectMap) {
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
    if (queryTarget && projects[queryTarget]) {
      safeWriteLocalProjectToStorage(queryTarget);
      return queryTarget;
    }

    const storageTarget = safeReadLocalProjectFromStorage();
    if (storageTarget && projects[storageTarget]) {
      return storageTarget;
    }
  }

  const hostTarget = hostProjectMap[hostname];
  if (hostTarget && projects[hostTarget]) {
    return hostTarget;
  }

  return "teste-aa015";
}

export function resolveFirebaseProject() {
  const testeConfig = applySharedStorageBucket(TESTE_AA015_CONFIG);

  const projects = {
    "teste-aa015": {
      key: "teste-aa015",
      config: testeConfig,
      functionsRegion: DEFAULT_FUNCTIONS_REGION,
      domains: [],
    },
  };

  coletarProjetosEnv().forEach((project) => {
    projects[project.key] = {
      key: project.key,
      config: project.config,
      functionsRegion: project.functionsRegion || DEFAULT_FUNCTIONS_REGION,
      domains: project.domains || [],
      envPrefix: project.envPrefix || "",
    };
  });

  const hostProjectMap = getHostProjectMap(projects);
  const selectedKey = resolveRequestedProjectKey(projects, hostProjectMap);
  const selectedProject = projects[selectedKey] || projects["teste-aa015"];

  if (typeof window !== "undefined") {
    const hostname = (window.location.hostname || "").toLowerCase();
    const hostTarget = hostProjectMap[hostname];
    if (hostTarget && !projects[hostTarget]) {
      console.warn(
        `[firebase] Config do projeto '${hostTarget}' ausente para o dominio '${hostname}'.`
      );
    }
  }

  return {
    projectKey: selectedProject.key,
    firebaseConfig: selectedProject.config,
    functionsRegion: selectedProject.functionsRegion || DEFAULT_FUNCTIONS_REGION,
  };
}
