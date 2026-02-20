const DEFAULT_FUNCTIONS_REGION = "us-central1";
const LOCAL_STORAGE_PROJECT_KEY = "firebaseProjectTarget";
const LOCAL_QUERY_PARAM = "firebaseProject";
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

function buildObeyonConfigFromEnv() {
  const apiKey = process.env.REACT_APP_FIREBASE_OBEYON_API_KEY || "";
  const authDomain = process.env.REACT_APP_FIREBASE_OBEYON_AUTH_DOMAIN || "";
  const databaseURL = process.env.REACT_APP_FIREBASE_OBEYON_DATABASE_URL || "";
  const projectId = process.env.REACT_APP_FIREBASE_OBEYON_PROJECT_ID || "";
  const storageBucket = process.env.REACT_APP_FIREBASE_OBEYON_STORAGE_BUCKET || "";
  const messagingSenderId =
    process.env.REACT_APP_FIREBASE_OBEYON_MESSAGING_SENDER_ID || "";
  const appId = process.env.REACT_APP_FIREBASE_OBEYON_APP_ID || "";

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

  return applySharedStorageBucket({
    apiKey,
    authDomain,
    databaseURL,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  });
}

function getHostProjectMap() {
  return {
    "obeyon.vercel.app": "obeyon",
    "teste-aa015.web.app": "teste-aa015",
    "teste-aa015.firebaseapp.com": "teste-aa015",
  };
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

function resolveRequestedProjectKey(projects) {
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

  const hostMap = getHostProjectMap();
  const hostTarget = hostMap[hostname];
  if (hostTarget && projects[hostTarget]) {
    return hostTarget;
  }

  return "teste-aa015";
}

export function resolveFirebaseProject() {
  const obeyonConfig = buildObeyonConfigFromEnv();
  const testeConfig = applySharedStorageBucket(TESTE_AA015_CONFIG);

  const projects = {
    "teste-aa015": {
      key: "teste-aa015",
      config: testeConfig,
      functionsRegion: DEFAULT_FUNCTIONS_REGION,
    },
  };

  if (obeyonConfig) {
    projects.obeyon = {
      key: "obeyon",
      config: obeyonConfig,
      functionsRegion: DEFAULT_FUNCTIONS_REGION,
    };
  }

  const selectedKey = resolveRequestedProjectKey(projects);
  const selectedProject = projects[selectedKey] || projects["teste-aa015"];

  if (
    typeof window !== "undefined" &&
    window.location.hostname.toLowerCase() === "obeyon.vercel.app" &&
    !projects.obeyon
  ) {
    console.warn(
      "[firebase] Config do projeto obeyon ausente. " +
        "Defina as variaveis REACT_APP_FIREBASE_OBEYON_* no Vercel."
    );
  }

  return {
    projectKey: selectedProject.key,
    firebaseConfig: selectedProject.config,
    functionsRegion: selectedProject.functionsRegion || DEFAULT_FUNCTIONS_REGION,
  };
}
