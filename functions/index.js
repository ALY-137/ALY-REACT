const admin = require("firebase-admin");
const { randomUUID } = require("crypto");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const {
  beforeUserCreated,
  beforeUserSignedIn,
  HttpsError: IdentityHttpsError,
} = require("firebase-functions/v2/identity");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
const REGION = "us-central1";
const runtimeServiceAccount =
  sanitizeString(process.env.FUNCTIONS_RUNTIME_SERVICE_ACCOUNT) ||
  `functions-runtime@${sanitizeString(process.env.GCLOUD_PROJECT) || "teste-aa015"}.iam.gserviceaccount.com`;
const CALLABLE_OPTIONS = {
  region: REGION,
  cors: true,
};
const HTTP_OPTIONS = {
  region: REGION,
  cors: true,
};
const IDENTITY_OPTIONS = {
  region: REGION,
};

if (runtimeServiceAccount) {
  CALLABLE_OPTIONS.serviceAccount = runtimeServiceAccount;
  HTTP_OPTIONS.serviceAccount = runtimeServiceAccount;
  IDENTITY_OPTIONS.serviceAccount = runtimeServiceAccount;
}

const SHARED_BUCKET_NAME =
  sanitizeString(process.env.SHARED_STORAGE_BUCKET) ||
  `${sanitizeString(process.env.GCLOUD_PROJECT) || "teste-aa015"}.appspot.com`;
const CURRENT_PROJECT_ID = sanitizeString(process.env.GCLOUD_PROJECT) || "teste-aa015";
const SYSTEM_MANAGER_PROJECT_ID =
  sanitizeString(process.env.SYSTEM_MANAGER_PROJECT_ID) || "gerenciador-aly";
const SHARED_BUCKET_ALLOWED_AUTH_PROJECTS = [
  CURRENT_PROJECT_ID,
  "teste-aa015",
  ...parseCsv(process.env.SHARED_BUCKET_AUTH_PROJECTS),
  "obeyon-project",
  "aly-onepages-runtime",
  SYSTEM_MANAGER_PROJECT_ID,
].filter(Boolean);
const UNIQUE_SHARED_BUCKET_AUTH_PROJECTS = [...new Set(SHARED_BUCKET_ALLOWED_AUTH_PROJECTS)];
const SHARED_ONEOWNER_RUNTIME_KEYS = new Set(["aly-onepages-runtime"]);
const ACCESS_SETTINGS_COLLECTION = "access_settings";
const ACCESS_REGISTRATION_SETTINGS_DOC = "registro";
const sharedVerifierApps = new Map();
const sharedProjectRuntimeApps = new Map();
const ADMIN_ONLY_AUTH_PROJECTS = [
  ...parseCsv(process.env.ADMIN_ONLY_AUTH_PROJECTS),
  SYSTEM_MANAGER_PROJECT_ID,
].filter(Boolean);
const ADMIN_ONLY_ALLOWED_UIDS = new Set(
  [
    ...parseCsv(process.env.SYSTEM_MANAGER_OWNER_UIDS),
    sanitizeString(process.env.SYSTEM_MANAGER_OWNER_UID),
    ...parseCsv(process.env.SYSTEM_MANAGER_ADMIN_UIDS),
    sanitizeString(process.env.SYSTEM_MANAGER_ADMIN_UID),
  ].filter(Boolean)
);
const ADMIN_ONLY_ALLOWED_EMAILS = new Set(
  [
    ...parseCsv(process.env.SYSTEM_MANAGER_OWNER_EMAILS),
    sanitizeString(process.env.SYSTEM_MANAGER_OWNER_EMAIL),
    ...parseCsv(process.env.SYSTEM_MANAGER_ADMIN_EMAILS),
    sanitizeString(process.env.SYSTEM_MANAGER_ADMIN_EMAIL),
  ]
    .map((item) => item.toLowerCase())
    .filter(Boolean)
);

async function assertSystemManagerAdminIdentity({ uid = "", email = "" } = {}) {
  const normalizedUid = sanitizeString(uid);
  const normalizedEmail = sanitizeString(email).toLowerCase();
  const dynamicAdminUid = await getDynamicAdminUidFromConfig();
  const hasAnyAdminConfigured =
    ADMIN_ONLY_ALLOWED_UIDS.size > 0 ||
    ADMIN_ONLY_ALLOWED_EMAILS.size > 0 ||
    Boolean(dynamicAdminUid);

  if (!hasAnyAdminConfigured) {
    if (shouldEnforceAdminOnlyAuth()) {
      return normalizedUid;
    }

    throw new HttpsError(
      "permission-denied",
      "Admin do gerenciador nao configurado para executar esta acao."
    );
  }

  if (ADMIN_ONLY_ALLOWED_UIDS.has(normalizedUid)) {
    return normalizedUid;
  }

  if (normalizedEmail && ADMIN_ONLY_ALLOWED_EMAILS.has(normalizedEmail)) {
    return normalizedUid;
  }

  if (dynamicAdminUid && dynamicAdminUid === normalizedUid) {
    return normalizedUid;
  }

  throw new HttpsError(
    "permission-denied",
    "Apenas owner pode executar esta acao."
  );
}

function sanitizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeSkinsResumo(value) {
  if (!Array.isArray(value)) return [];

  const dedupe = new Map();
  value.forEach((item, index) => {
    const id = sanitizeString(item?.id || item?.id_skin || `skin_${index}`);
    const username = sanitizeString(item?.username);
    if (!id && !username) return;

    const key = id || username.toLowerCase();
    if (!key || dedupe.has(key)) return;

    dedupe.set(key, {
      id,
      username,
      is_main: Boolean(item?.is_main),
      theme: sanitizeString(item?.theme),
    });
  });

  return Array.from(dedupe.values());
}

function parseCsv(value) {
  return sanitizeString(value)
    .split(",")
    .map((item) => sanitizeString(item))
    .filter(Boolean);
}

function normalizePushTokens(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => sanitizeString(item)).filter(Boolean))];
}

function formatarValorCentavos(precoCentavos) {
  const valor = Number(precoCentavos);
  if (!Number.isFinite(valor) || valor <= 0) return "";
  return `R$ ${(valor / 100).toFixed(2).replace(".", ",")}`;
}

function normalizeSystemKeyToEnvPrefix(systemKey) {
  return sanitizeString(systemKey).replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase();
}

function getVercelRuntimeConfig() {
  return {
    token: sanitizeString(process.env.VERCEL_TOKEN),
    projectId: sanitizeString(process.env.VERCEL_PROJECT_ID),
    teamId: sanitizeString(process.env.VERCEL_TEAM_ID),
  };
}

function buildVercelApiUrl(pathname, teamId = "", query = {}) {
  const url = new URL(`https://api.vercel.com${pathname}`);
  if (teamId) {
    url.searchParams.set("teamId", teamId);
  }

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        const normalized = sanitizeString(item);
        if (normalized) {
          url.searchParams.append(key, normalized);
        }
      });
      return;
    }

    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

async function callVercelApi({
  token,
  teamId = "",
  method = "GET",
  pathname,
  query = {},
  body = null,
}) {
  const url = buildVercelApiUrl(pathname, teamId, query);
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorMessage =
      sanitizeString(payload?.error?.message) ||
      sanitizeString(payload?.error?.code) ||
      sanitizeString(payload?.message) ||
      `Falha na API da Vercel (${response.status}).`;
    throw new HttpsError("internal", errorMessage);
  }

  return payload || {};
}

async function assertSystemManagerAdminPermission(request) {
  const uid = ensureAuth(request);
  const email = sanitizeString(request?.auth?.token?.email).toLowerCase();
  return assertSystemManagerAdminIdentity({ uid, email });
}

function shouldEnforceAdminOnlyAuth() {
  return ADMIN_ONLY_AUTH_PROJECTS.includes(CURRENT_PROJECT_ID);
}

async function getDynamicAdminUidFromConfig() {
  try {
    const configDb = getSystemManagerDb();
    const configSnap = await configDb.doc("add_ons/sistema_config").get();
    if (!configSnap.exists) return "";
    return (
      sanitizeString(configSnap.data()?.ownerUid) ||
      sanitizeString(configSnap.data()?.adminUid)
    );
  } catch {
    return "";
  }
}

async function assertAdminOnlyAuthAllowed(event) {
  if (!shouldEnforceAdminOnlyAuth()) {
    return;
  }

  const uid = sanitizeString(event?.data?.uid);
  const email = sanitizeString(event?.data?.email).toLowerCase();
  const dynamicAdminUid = await getDynamicAdminUidFromConfig();
  const hasAnyAdminConfigured =
    ADMIN_ONLY_ALLOWED_UIDS.size > 0 ||
    ADMIN_ONLY_ALLOWED_EMAILS.size > 0 ||
    Boolean(dynamicAdminUid);

  // Evita lockout acidental antes da primeira configuracao de admin.
  if (!hasAnyAdminConfigured) {
    console.warn(
      `[AUTH-ADMIN-ONLY] Nenhum admin configurado para ${CURRENT_PROJECT_ID}. ` +
        "Defina SYSTEM_MANAGER_OWNER_UID(S)/EMAIL(S) (ou ADMIN_ legado) ou add_ons/sistema_config.ownerUid."
    );
    return;
  }

  if (!uid) {
    throw new IdentityHttpsError(
      "unauthenticated",
      "Nao foi possivel identificar o usuario."
    );
  }

  if (ADMIN_ONLY_ALLOWED_UIDS.has(uid)) {
    return;
  }

  if (email && ADMIN_ONLY_ALLOWED_EMAILS.has(email)) {
    return;
  }

  if (dynamicAdminUid && dynamicAdminUid === uid) {
    return;
  }

  throw new IdentityHttpsError(
    "permission-denied",
    "Acesso permitido apenas para owners."
  );
}

function buildTokenizedStorageUrl(bucket, path, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(
    bucket
  )}/o/${encodeURIComponent(path)}?alt=media&token=${encodeURIComponent(token)}`;
}

function normalizeRequestBody(req) {
  if (req?.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req?.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return {};
}

function getBearerToken(req) {
  const authHeader = sanitizeString(req.headers?.authorization || "");
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return "";
  }
  return sanitizeString(authHeader.slice(7));
}

function applyHttpCorsHeaders(req, res) {
  const origin = sanitizeString(req.headers?.origin) || "*";
  res.set("Access-Control-Allow-Origin", origin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.set("Access-Control-Max-Age", "3600");
}

function handleHttpCorsPreflight(req, res) {
  applyHttpCorsHeaders(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true;
  }
  return false;
}

function normalizeHostValue(value = "") {
  return sanitizeString(value)
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .trim();
}

function buildCurrentProjectPublicHosts() {
  const hosts = [
    `${CURRENT_PROJECT_ID}.vercel.app`,
    `www.${CURRENT_PROJECT_ID}.vercel.app`,
    `${CURRENT_PROJECT_ID}.web.app`,
    `${CURRENT_PROJECT_ID}.firebaseapp.com`,
    ...parseCsv(process.env.SYSTEM_MANAGER_PUBLIC_HOSTS).map((item) =>
      normalizeHostValue(item)
    ),
  ].filter(Boolean);

  return [...new Set(hosts)];
}

function isCurrentProjectPublicHost(hostname = "") {
  const normalizedHost = normalizeHostValue(hostname);
  if (!normalizedHost) return false;
  return buildCurrentProjectPublicHosts().includes(normalizedHost);
}

function buildSystemManagerPublicHosts() {
  const hosts = [
    `${SYSTEM_MANAGER_PROJECT_ID}.vercel.app`,
    `www.${SYSTEM_MANAGER_PROJECT_ID}.vercel.app`,
    `${SYSTEM_MANAGER_PROJECT_ID}.web.app`,
    `${SYSTEM_MANAGER_PROJECT_ID}.firebaseapp.com`,
    ...parseCsv(process.env.SYSTEM_MANAGER_PUBLIC_HOSTS).map((item) =>
      normalizeHostValue(item)
    ),
  ].filter(Boolean);

  return [...new Set(hosts)];
}

function isSystemManagerPublicHost(hostname = "") {
  const normalizedHost = normalizeHostValue(hostname);
  if (!normalizedHost) return false;
  return buildSystemManagerPublicHosts().includes(normalizedHost);
}

function canAccessSharedBucketPath(path = "", uid = "") {
  const normalizedPath = sanitizeString(path);
  const normalizedUid = sanitizeString(uid);

  if (!normalizedPath || !normalizedUid) return false;

  const parts = normalizedPath.split("/").filter(Boolean);
  if (parts.length < 3) return false;

  if (parts[0] === "users") {
    return parts[1] === normalizedUid;
  }

  if (parts[0] === "branding") {
    return parts.length >= 4 && parts[2] === normalizedUid;
  }

  return false;
}

function getSharedVerifierAuth(projectId) {
  const appName = `shared-auth-${projectId}`;
  if (!sharedVerifierApps.has(appName)) {
    const app = admin.initializeApp({ projectId }, appName);
    sharedVerifierApps.set(appName, app);
  }
  return admin.auth(sharedVerifierApps.get(appName));
}

function getSharedProjectRuntimeApp(projectId) {
  const normalizedProjectId = sanitizeString(projectId) || CURRENT_PROJECT_ID;
  if (normalizedProjectId === CURRENT_PROJECT_ID) {
    return admin.app();
  }

  const appName = `shared-runtime-${normalizedProjectId}`;
  if (!sharedProjectRuntimeApps.has(appName)) {
    const existingApp = admin.apps.find((app) => app.name === appName);
    const app = existingApp || admin.initializeApp({ projectId: normalizedProjectId }, appName);
    sharedProjectRuntimeApps.set(appName, app);
  }

  return sharedProjectRuntimeApps.get(appName);
}

function ensureAllowedTargetProjectId(targetProjectId = "", fallbackProjectId = "") {
  const normalizedProjectId =
    sanitizeString(targetProjectId) || sanitizeString(fallbackProjectId) || CURRENT_PROJECT_ID;

  if (
    normalizedProjectId !== CURRENT_PROJECT_ID &&
    !UNIQUE_SHARED_BUCKET_AUTH_PROJECTS.includes(normalizedProjectId)
  ) {
    throw new HttpsError(
      "permission-denied",
      `Projeto alvo nao permitido para backend compartilhado: ${normalizedProjectId}.`
    );
  }

  return normalizedProjectId;
}

function getProjectDb(targetProjectId = "", fallbackProjectId = "") {
  const normalizedProjectId = ensureAllowedTargetProjectId(targetProjectId, fallbackProjectId);
  if (normalizedProjectId === CURRENT_PROJECT_ID) {
    return db;
  }
  return admin.firestore(getSharedProjectRuntimeApp(normalizedProjectId));
}

function getSystemManagerDb() {
  return getProjectDb(SYSTEM_MANAGER_PROJECT_ID, CURRENT_PROJECT_ID);
}

function extractSystemFirebaseProjectId(data = {}) {
  const runtimeConfig =
    data?.firebaseRuntimeConfig && typeof data.firebaseRuntimeConfig === "object"
      ? data.firebaseRuntimeConfig
      : {};

  return sanitizeString(runtimeConfig?.projectId || data?.firebaseProjectId || data?.projectId);
}

function addAllowedProjectId(targetSet, projectId = "") {
  const normalizedProjectId = sanitizeString(projectId);
  if (!normalizedProjectId) return;

  try {
    targetSet.add(ensureAllowedTargetProjectId(normalizedProjectId, CURRENT_PROJECT_ID));
  } catch {
    // Projetos fora da lista autorizada nao devem bloquear a leitura dos demais.
  }
}

async function resolveRuntimeProjectIdsForSystem(managerDb, projectSystemKey = "") {
  const normalizedProjectKey = sanitizeString(projectSystemKey).toLowerCase();
  const projectIds = new Set();

  addAllowedProjectId(projectIds, SYSTEM_MANAGER_PROJECT_ID);
  addAllowedProjectId(projectIds, CURRENT_PROJECT_ID);
  addAllowedProjectId(projectIds, "aly-onepages-runtime");

  if (normalizedProjectKey) {
    addAllowedProjectId(projectIds, normalizedProjectKey);

    const docs = [];
    const directSnap = await managerDb.collection("systems").doc(normalizedProjectKey).get().catch(() => null);
    if (directSnap?.exists) docs.push(directSnap);

    const systemKeySnap = await managerDb
      .collection("systems")
      .where("systemKey", "==", normalizedProjectKey)
      .limit(5)
      .get()
      .catch(() => null);
    systemKeySnap?.docs?.forEach((docItem) => docs.push(docItem));

    docs.forEach((docItem) => {
      const data = docItem.data() || {};
      addAllowedProjectId(projectIds, extractSystemFirebaseProjectId(data));
    });

    return Array.from(projectIds);
  }

  const systemsSnap = await managerDb.collection("systems").limit(200).get().catch(() => null);
  systemsSnap?.docs?.forEach((docItem) => {
    const data = docItem.data() || {};
    addAllowedProjectId(projectIds, extractSystemFirebaseProjectId(data));
    addAllowedProjectId(projectIds, sanitizeString(data?.systemKey || docItem.id).toLowerCase());
  });

  return Array.from(projectIds);
}

async function resolveRuntimeDbEntriesForSystem(managerDb, projectSystemKey = "") {
  const projectIds = await resolveRuntimeProjectIdsForSystem(managerDb, projectSystemKey);
  const entries = [];
  const seen = new Set();

  projectIds.forEach((projectId) => {
    const normalizedProjectId = sanitizeString(projectId);
    if (!normalizedProjectId || seen.has(normalizedProjectId)) return;

    try {
      entries.push({
        projectId: normalizedProjectId,
        db: getProjectDb(normalizedProjectId, CURRENT_PROJECT_ID),
      });
      seen.add(normalizedProjectId);
    } catch {
      // Ignora projetos sem permissao/credencial no backend compartilhado.
    }
  });

  return entries;
}

async function verifySharedBucketIdToken(idToken) {
  const token = sanitizeString(idToken);
  if (!token) {
    throw new HttpsError("unauthenticated", "Token de autenticacao ausente.");
  }

  for (const projectId of UNIQUE_SHARED_BUCKET_AUTH_PROJECTS) {
    try {
      const decoded = await getSharedVerifierAuth(projectId).verifyIdToken(token);
      return { decoded, projectId };
    } catch {
      // tenta proximo projeto permitido
    }
  }

  throw new HttpsError("unauthenticated", "Token de autenticacao invalido.");
}

function decodeBase64Payload(base64Input) {
  const base64 = sanitizeString(base64Input);
  if (!base64) {
    throw new HttpsError("invalid-argument", "Arquivo base64 ausente.");
  }

  const matchDataUrl = base64.match(/^data:([^;]+);base64,(.+)$/i);
  const mimeFromDataUrl = matchDataUrl?.[1] || "";
  const rawBase64 = matchDataUrl?.[2] || base64;

  let buffer;
  try {
    buffer = Buffer.from(rawBase64, "base64");
  } catch {
    throw new HttpsError("invalid-argument", "Conteudo base64 invalido.");
  }

  if (!buffer?.length) {
    throw new HttpsError("invalid-argument", "Arquivo vazio.");
  }

  return { buffer, mimeFromDataUrl };
}

function sendHttpError(res, error) {
  if (error instanceof HttpsError) {
    const map = {
      unauthenticated: 401,
      "permission-denied": 403,
      "invalid-argument": 400,
      "not-found": 404,
      "failed-precondition": 412,
    };
    const status = map[error.code] || 500;
    res.status(status).json({ ok: false, error: error.message, code: error.code });
    return;
  }

  const errorCode = sanitizeString(error?.code).toLowerCase();
  const errorMessage = sanitizeString(error?.message);
  const permissionDenied =
    errorCode === "7" ||
    errorCode === "permission-denied" ||
    /missing or insufficient permissions/i.test(errorMessage);

  if (permissionDenied) {
    res.status(403).json({
      ok: false,
      error: errorMessage || "Permissao insuficiente.",
      code: "permission-denied",
    });
    return;
  }

  res.status(500).json({
    ok: false,
    error: errorMessage || "Erro interno.",
    code: "internal",
  });
}

function isFirestorePreconditionError(error) {
  const codeText = sanitizeString(error?.code).toLowerCase();
  const codeNumber = Number(error?.code);
  const message = sanitizeString(error?.message).toLowerCase();
  const details = sanitizeString(error?.details).toLowerCase();

  return (
    codeText === "failed-precondition" ||
    codeText === "9" ||
    codeNumber === 9 ||
    message.includes("failed_precondition") ||
    message.includes("failed precondition") ||
    message.includes("requires an index") ||
    details.includes("requires an index")
  );
}

function getFirestoreTimestampMs(item = {}, fields = ["data", "criadoEm"]) {
  const fieldList = Array.isArray(fields) && fields.length ? fields : ["data", "criadoEm"];
  const value = fieldList.map((field) => item?.[field]).find(Boolean);
  if (!value) return NaN;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (typeof value?._seconds === "number") return value._seconds * 1000;
  if (value instanceof Date) return value.getTime();

  const timestamp = Number.isFinite(Number(value))
    ? Number(value)
    : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : NaN;
}

function ensureAuth(request) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Usuario nao autenticado.");
  }
  return request.auth.uid;
}

function ensureRequiredString(value, fieldName) {
  const normalized = sanitizeString(value);
  if (!normalized) {
    throw new HttpsError("invalid-argument", `Campo obrigatorio: ${fieldName}.`);
  }
  return normalized;
}

function normalizeBaseUrl(baseUrl) {
  const normalized = sanitizeString(baseUrl).replace(/\/+$/, "");
  if (!/^https?:\/\/[^\s]+$/i.test(normalized)) {
    throw new HttpsError("invalid-argument", "URL base invalida.");
  }
  return normalized;
}

function extractClientIp(req) {
  const splitCandidates = (value) => {
    if (Array.isArray(value)) {
      return value
        .flatMap((item) => splitCandidates(item))
        .map((item) => sanitizeString(item).replace(/^::ffff:/, ""))
        .filter(Boolean);
    }

    return String(value || "")
      .split(",")
      .map((item) => sanitizeString(item).replace(/^::ffff:/, ""))
      .filter(Boolean);
  };

  const headerCandidates = [
    req?.headers?.["x-forwarded-for"],
    req?.headers?.["X-Forwarded-For"],
    req?.headers?.["x-real-ip"],
    req?.headers?.["X-Real-IP"],
    req?.headers?.["true-client-ip"],
    req?.headers?.["True-Client-IP"],
    req?.headers?.["cf-connecting-ip"],
    req?.headers?.["CF-Connecting-IP"],
    req?.headers?.["fastly-client-ip"],
    req?.headers?.["Fastly-Client-IP"],
    req?.headers?.["x-client-ip"],
    req?.headers?.["X-Client-IP"],
    req?.headers?.["x-appengine-user-ip"],
    req?.headers?.["X-Appengine-User-Ip"],
    req?.headers?.["x-vercel-forwarded-for"],
    req?.headers?.["X-Vercel-Forwarded-For"],
  ].flatMap((value) => splitCandidates(value));

  const candidates = [
    ...headerCandidates,
    req?.ip,
    req?.socket?.remoteAddress,
    req?.connection?.remoteAddress,
  ]
    .map((candidate) => sanitizeString(candidate).replace(/^::ffff:/, ""))
    .filter(Boolean);

  const publicCandidate = candidates.find((candidate) => !isPrivateOrLocalIp(candidate));
  if (publicCandidate) {
    return publicCandidate;
  }

  for (const candidate of candidates) {
    const normalized = sanitizeString(candidate).replace(/^::ffff:/, "");
    if (normalized) return normalized;
  }

  return "";
}

function normalizeGeoCompareValue(value = "") {
  return sanitizeString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeStringList(value = []) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => sanitizeString(item)).filter(Boolean))];
}

function normalizeIpForAccessBlock(value = "") {
  return sanitizeString(value).replace(/^::ffff:/, "").toLowerCase();
}

function normalizeAccessIpBlockList(value = []) {
  return normalizeStringList(value)
    .map((item) => normalizeIpForAccessBlock(item))
    .filter(Boolean)
    .slice(0, 500);
}

function normalizeAccessUserBlockIdentifier(value = "") {
  const normalized = sanitizeString(value);
  if (!normalized) return "";
  return normalized.includes("@") ? normalized.toLowerCase() : normalized;
}

function normalizeAccessUserBlockList(value = []) {
  return normalizeStringList(value)
    .map((item) => normalizeAccessUserBlockIdentifier(item))
    .filter(Boolean)
    .slice(0, 500);
}

function getAccessRegistrationSettingsRef(managerDb) {
  return managerDb
    .collection(ACCESS_SETTINGS_COLLECTION)
    .doc(ACCESS_REGISTRATION_SETTINGS_DOC);
}

async function getAccessRegistrationSettings(managerDb) {
  try {
    const snap = await getAccessRegistrationSettingsRef(managerDb).get();
    const data = snap.exists ? snap.data() || {} : {};
    const ipsBloqueadosRegistro = normalizeAccessIpBlockList(
      data.ipsBloqueadosRegistro || data.ipsBloqueados || data.blockedIps
    );
    const usuariosBloqueadosRegistro = normalizeAccessUserBlockList(
      data.usuariosBloqueadosRegistro ||
        data.usuariosBloqueados ||
        data.blockedUsers ||
        data.uidsBloqueadosRegistro
    );

    return {
      ipsBloqueadosRegistro,
      usuariosBloqueadosRegistro,
    };
  } catch {
    return {
      ipsBloqueadosRegistro: [],
      usuariosBloqueadosRegistro: [],
    };
  }
}

async function isAccessRegistrationIpBlocked(managerDb, ip = "") {
  const ipNormalizado = normalizeIpForAccessBlock(ip);
  if (!ipNormalizado) return false;

  const settings = await getAccessRegistrationSettings(managerDb);
  return settings.ipsBloqueadosRegistro.includes(ipNormalizado);
}

async function isAccessRegistrationUserBlocked(managerDb, payload = {}) {
  const candidates = [
    normalizeAccessUserBlockIdentifier(payload?.uid),
    normalizeAccessUserBlockIdentifier(payload?.email),
  ].filter(Boolean);
  if (!candidates.length) return false;

  const settings = await getAccessRegistrationSettings(managerDb);
  const blockedSet = new Set(settings.usuariosBloqueadosRegistro || []);
  return candidates.some((candidate) => blockedSet.has(candidate));
}

async function resolveAccessRegistrationUserBlockMatch(managerDb, payload = {}) {
  const candidates = [
    normalizeAccessUserBlockIdentifier(payload?.uid),
    normalizeAccessUserBlockIdentifier(payload?.email),
  ].filter(Boolean);
  if (!candidates.length) {
    return {
      blocked: false,
      candidates: [],
      matchedIdentifier: "",
    };
  }

  const settings = await getAccessRegistrationSettings(managerDb);
  const blockedSet = new Set(settings.usuariosBloqueadosRegistro || []);
  const matchedIdentifier =
    candidates.find((candidate) => blockedSet.has(candidate)) || "";

  return {
    blocked: Boolean(matchedIdentifier),
    candidates,
    matchedIdentifier,
  };
}

function resolveAccessNavigationIdCandidates(payload = {}) {
  return normalizeStringList([
    payload?.navigationId,
    payload?.visitorHash,
    payload?.hash,
    payload?.navegacaoHash,
  ]);
}

function normalizeAccessDocIds(value = []) {
  return normalizeStringList(value)
    .map((item) => sanitizeString(item).replace(/[\/\\]/g, ""))
    .filter(Boolean)
    .slice(0, 500);
}

async function updateAccessDocsAsBlocked(managerDb, refs = [], payload = {}) {
  const uniqueRefs = [];
  const seenPaths = new Set();

  refs.forEach((ref) => {
    if (!ref?.path || seenPaths.has(ref.path)) return;
    seenPaths.add(ref.path);
    uniqueRefs.push(ref);
  });

  if (!uniqueRefs.length) return 0;

  const basePayload = {
    registroBloqueado: true,
    bloqueadoEm: serverTimestamp(),
    ...payload,
  };

  let updated = 0;
  for (let index = 0; index < uniqueRefs.length; index += 450) {
    const batch = managerDb.batch();
    const chunk = uniqueRefs.slice(index, index + 450);
    chunk.forEach((ref) => {
      batch.update(ref, basePayload);
    });
    await batch.commit();
    updated += chunk.length;
  }

  return updated;
}

async function markAccessRecordsBlockedByNavigationIds(
  managerDb,
  navigationIds = [],
  payload = {}
) {
  const navigationIdList = normalizeStringList(navigationIds).slice(0, 30);
  if (!navigationIdList.length) return 0;

  const refs = [];
  for (const navigationId of navigationIdList) {
    const [navigationIdSnap, visitorSnap, hashSnap] = await Promise.all([
      managerDb.collection("acessos").where("navigationId", "==", navigationId).limit(300).get(),
      managerDb.collection("acessos").where("visitorHash", "==", navigationId).limit(300).get(),
      managerDb.collection("acessos").where("hash", "==", navigationId).limit(300).get(),
    ]);
    navigationIdSnap.docs.forEach((docItem) => refs.push(docItem.ref));
    visitorSnap.docs.forEach((docItem) => refs.push(docItem.ref));
    hashSnap.docs.forEach((docItem) => refs.push(docItem.ref));
  }

  return updateAccessDocsAsBlocked(managerDb, refs, {
    navigationIdBloqueado: navigationIdList[0] || null,
    ...payload,
  });
}

async function markAccessRecordsBlockedByUsers(
  managerDb,
  identifiers = [],
  payload = {}
) {
  const userIdentifiers = normalizeAccessUserBlockList(identifiers).slice(0, 50);
  if (!userIdentifiers.length) {
    return {
      docs: 0,
      hashes: 0,
    };
  }

  const refs = [];
  const navigationIds = new Set();

  for (const identifier of userIdentifiers) {
    const field = identifier.includes("@") ? "email" : "uid";
    const snap = await managerDb
      .collection("acessos")
      .where(field, "==", identifier)
      .limit(300)
      .get();

    snap.docs.forEach((docItem) => {
      const data = docItem.data() || {};
      refs.push(docItem.ref);
      resolveAccessNavigationIdCandidates(data).forEach((navigationId) =>
        navigationIds.add(navigationId)
      );
    });
  }

  const directUpdates = await updateAccessDocsAsBlocked(managerDb, refs, {
    usuarioBloqueado: userIdentifiers[0] || null,
    ...payload,
  });
  const navigationIdUpdates = await markAccessRecordsBlockedByNavigationIds(
    managerDb,
    Array.from(navigationIds),
    {
      usuarioBloqueado: userIdentifiers[0] || null,
      ...payload,
    }
  );

    return {
      docs: directUpdates,
      hashes: navigationIdUpdates,
    };
}

async function markAccessRecordsAsRead(managerDb, ids = [], payload = {}) {
  const accessIds = normalizeAccessDocIds(ids);
  if (!accessIds.length) return 0;

  let updated = 0;
  for (let index = 0; index < accessIds.length; index += 450) {
    const batch = managerDb.batch();
    const chunk = accessIds.slice(index, index + 450);
    chunk.forEach((accessId) => {
      batch.update(
        managerDb.collection("acessos").doc(accessId),
        {
          visto: true,
          lido: true,
          statusLeitura: "lido",
          lidoEm: serverTimestamp(),
          ...payload,
        }
      );
    });
    await batch.commit();
    updated += chunk.length;
  }

  return updated;
}

async function getTrackableLinksSnapshotWithFallback(ref, maxItems = 300) {
  try {
    return await ref.orderBy("atualizadoEm", "desc").limit(maxItems).get();
  } catch (error) {
    if (!isFirestorePreconditionError(error)) {
      throw error;
    }

    return ref.limit(maxItems).get();
  }
}

function isDeletedStatusValue(status = "") {
  return [
    "excluido",
    "excluida",
    "excluído",
    "excluída",
    "deletado",
    "deletada",
    "deleted",
    "removido",
    "removida",
  ].includes(sanitizeString(status).toLowerCase());
}

function isTrackableLinkDeleted(data = {}) {
  const status = sanitizeString(data?.status).toLowerCase();
  return (
    data?.excluido === true ||
    data?.removido === true ||
    data?.deletado === true ||
    isDeletedStatusValue(status)
  );
}

function isQrPrintDeleted(data = {}) {
  const status = sanitizeString(data?.status).toLowerCase();
  return (
    data?.excluido === true ||
    data?.removido === true ||
    data?.deletado === true ||
    data?.ativo === false ||
    isDeletedStatusValue(status)
  );
}

function isSourceRecordDeleted(data = {}) {
  const status = sanitizeString(data?.status).toLowerCase();
  return (
    data?.excluido === true ||
    data?.removido === true ||
    data?.deletado === true ||
    data?.ativo === false ||
    isDeletedStatusValue(status)
  );
}

function buildUniqueRefs(refs = []) {
  const seen = new Set();
  return refs.filter((ref) => {
    const path = sanitizeString(ref?.path);
    if (!path || seen.has(path)) return false;
    seen.add(path);
    return true;
  });
}

function cardExistsInBlockPayload(blockData = {}, cardId = "") {
  const normalizedCardId = sanitizeString(cardId);
  if (!normalizedCardId) return false;
  const cards = Array.isArray(blockData?.cards) ? blockData.cards : [];
  return cards.some((card) => {
    const currentCardId = sanitizeString(card?.id || card?.cardId);
    return currentCardId === normalizedCardId && !isSourceRecordDeleted(card);
  });
}

async function qrPrintSourceCardExists(firestoreDb, docItem, data = {}) {
  const ownerUserId = sanitizeString(data?.ownerUserId);
  const espacoId = sanitizeString(data?.espacoId);
  const blocoId = sanitizeString(data?.blocoId);
  const cardId = sanitizeString(data?.cardId);
  const projectSystemKey = resolveDocProjectSystemKey(docItem, data);

  if (!ownerUserId || !espacoId || !blocoId || !cardId) {
    return false;
  }

  const cardRefs = [];
  const blockRefs = [];

  const addSourceRefs = (root = firestoreDb) => {
    if (ownerUserId && espacoId) {
      const blockRef = root
        .collection("users")
        .doc(ownerUserId)
        .collection("espacos")
        .doc(espacoId)
        .collection("blocos")
        .doc(blocoId);
      blockRefs.push(blockRef);
      cardRefs.push(blockRef.collection("cards").doc(cardId));
      return;
    }

    const legacyBlockRef = root.collection("blocos").doc(blocoId);
    blockRefs.push(legacyBlockRef);
    cardRefs.push(legacyBlockRef.collection("cards").doc(cardId));
  };

  if (projectSystemKey) {
    addSourceRefs(firestoreDb.collection("projetos").doc(projectSystemKey));
  }
  addSourceRefs(firestoreDb);

  let foundActiveBlock = false;
  let foundBlockCardsPayload = false;
  for (const blockRef of buildUniqueRefs(blockRefs)) {
    const blockSnap = await blockRef.get().catch(() => null);
    if (!blockSnap?.exists) continue;
    const blockData = blockSnap.data() || {};
    if (isSourceRecordDeleted(blockData)) continue;
    foundActiveBlock = true;

    if (Array.isArray(blockData?.cards)) {
      foundBlockCardsPayload = true;
    }

    if (cardExistsInBlockPayload(blockData, cardId)) {
      return true;
    }
  }

  if (!foundActiveBlock || foundBlockCardsPayload) {
    return false;
  }

  for (const cardRef of buildUniqueRefs(cardRefs)) {
    const cardSnap = await cardRef.get().catch(() => null);
    if (cardSnap?.exists && !isSourceRecordDeleted(cardSnap.data() || {})) {
      return true;
    }
  }

  return false;
}

async function listTrackableLinkDocsForManager(
  managerDb,
  { projectSystemKey = "", maxItems = 300 } = {}
) {
  const normalizedProjectKey = sanitizeString(projectSystemKey).toLowerCase();
  const safeLimit = Math.min(Math.max(Number(maxItems) || 300, 1), 800);
  const docsByTrackingId = new Map();
  const deletedTrackingIds = new Set();

  const addDocs = (snap) => {
    snap.docs.forEach((docItem) => {
      const data = docItem.data() || {};
      const trackingId = sanitizeString(data?.trackingId || docItem.id);
      const key = trackingId || docItem.ref.path;
      if (!key) return;

      if (isTrackableLinkDeleted(data)) {
        deletedTrackingIds.add(key);
        docsByTrackingId.delete(key);
        return;
      }

      if (deletedTrackingIds.has(key)) return;

      const currentTimestamp = getFirestoreTimestampMs(data, ["atualizadoEm", "criadoEm"]) || 0;
      const previous = docsByTrackingId.get(key);
      const previousTimestamp = previous
        ? getFirestoreTimestampMs(previous.data() || {}, ["atualizadoEm", "criadoEm"]) || 0
        : 0;
      if (!previous || currentTimestamp >= previousTimestamp) {
        docsByTrackingId.set(key, docItem);
      }
    });
  };

  if (normalizedProjectKey) {
    const rootSnap = await getTrackableLinksSnapshotWithFallback(
      managerDb.collection("trackableLinks").where("runtimeProjectKey", "==", normalizedProjectKey),
      safeLimit
    );
    addDocs(rootSnap);

    const projectSnap = await getTrackableLinksSnapshotWithFallback(
      managerDb.collection("projetos").doc(normalizedProjectKey).collection("trackableLinks"),
      safeLimit
    );
    addDocs(projectSnap);
  } else {
    try {
      const groupSnap = await getTrackableLinksSnapshotWithFallback(
        managerDb.collectionGroup("trackableLinks"),
        safeLimit
      );
      addDocs(groupSnap);
    } catch (error) {
      if (!isFirestorePreconditionError(error)) {
        throw error;
      }

      const rootSnap = await getTrackableLinksSnapshotWithFallback(
        managerDb.collection("trackableLinks"),
        safeLimit
      );
      addDocs(rootSnap);
    }
  }

  return Array.from(docsByTrackingId.values())
    .sort((a, b) => {
      const dataA = a.data() || {};
      const dataB = b.data() || {};
      const timestampA = getFirestoreTimestampMs(dataA, ["atualizadoEm", "criadoEm"]) || 0;
      const timestampB = getFirestoreTimestampMs(dataB, ["atualizadoEm", "criadoEm"]) || 0;
      return timestampB - timestampA;
    })
    .slice(0, safeLimit);
}

async function listQrPrintDocsForManager(
  managerDb,
  { projectSystemKey = "", maxItems = 300 } = {}
) {
  const normalizedProjectKey = sanitizeString(projectSystemKey).toLowerCase();
  const safeLimit = Math.min(Math.max(Number(maxItems) || 300, 1), 800);
  const docsByPrintId = new Map();
  const deletedPrintIds = new Set();

  const addDocs = (snap) => {
    snap.docs.forEach((docItem) => {
      const data = docItem.data() || {};
      const printId = sanitizeString(data?.printId || docItem.id);
      const key = printId || docItem.ref.path;
      if (!key) return;

      if (isQrPrintDeleted(data)) {
        deletedPrintIds.add(key);
        docsByPrintId.delete(key);
        return;
      }

      if (deletedPrintIds.has(key)) return;

      const currentTimestamp = getFirestoreTimestampMs(data, ["atualizadoEm", "criadoEm"]) || 0;
      const previous = docsByPrintId.get(key);
      const previousTimestamp = previous
        ? getFirestoreTimestampMs(previous.data() || {}, ["atualizadoEm", "criadoEm"]) || 0
        : 0;
      if (!previous || currentTimestamp >= previousTimestamp) {
        docsByPrintId.set(key, docItem);
      }
    });
  };

  if (normalizedProjectKey) {
    const rootSnap = await getTrackableLinksSnapshotWithFallback(
      managerDb.collection("qrPrints").where("runtimeProjectKey", "==", normalizedProjectKey),
      safeLimit
    );
    addDocs(rootSnap);

    const projectSnap = await getTrackableLinksSnapshotWithFallback(
      managerDb.collection("projetos").doc(normalizedProjectKey).collection("qrPrints"),
      safeLimit
    );
    addDocs(projectSnap);
  } else {
    try {
      const groupSnap = await getTrackableLinksSnapshotWithFallback(
        managerDb.collectionGroup("qrPrints"),
        safeLimit
      );
      addDocs(groupSnap);
    } catch (error) {
      if (!isFirestorePreconditionError(error)) {
        throw error;
      }

      const rootSnap = await getTrackableLinksSnapshotWithFallback(
        managerDb.collection("qrPrints"),
        safeLimit
      );
      addDocs(rootSnap);
    }
  }

  const docsComFonteAtiva = [];
  for (const docItem of Array.from(docsByPrintId.values())) {
    const data = docItem.data() || {};
    const fonteExiste = await qrPrintSourceCardExists(managerDb, docItem, data);
    if (fonteExiste) {
      docsComFonteAtiva.push(docItem);
    }
  }

  return docsComFonteAtiva
    .sort((a, b) => {
      const dataA = a.data() || {};
      const dataB = b.data() || {};
      const timestampA = getFirestoreTimestampMs(dataA, ["atualizadoEm", "criadoEm"]) || 0;
      const timestampB = getFirestoreTimestampMs(dataB, ["atualizadoEm", "criadoEm"]) || 0;
      return timestampB - timestampA;
    })
    .slice(0, safeLimit);
}

async function listTrackableLinkDocsAcrossRuntimeDbs(
  managerDb,
  { projectSystemKey = "", maxItems = 300 } = {}
) {
  const safeLimit = Math.min(Math.max(Number(maxItems) || 300, 1), 800);
  const entries = await resolveRuntimeDbEntriesForSystem(managerDb, projectSystemKey);
  const docs = [];
  const seen = new Set();

  for (const entry of entries) {
    const partialDocs = await listTrackableLinkDocsForManager(entry.db, {
      projectSystemKey,
      maxItems: safeLimit,
    }).catch(() => []);

    partialDocs.forEach((docItem) => {
      const data = docItem.data() || {};
      const trackingId = sanitizeString(data?.trackingId || docItem.id);
      const key = `${entry.projectId}:${trackingId || docItem.ref.path}`;
      if (!key || seen.has(key)) return;
      seen.add(key);
      docs.push(docItem);
    });
  }

  return docs
    .sort((a, b) => {
      const dataA = a.data() || {};
      const dataB = b.data() || {};
      const timestampA = getFirestoreTimestampMs(dataA, ["atualizadoEm", "criadoEm"]) || 0;
      const timestampB = getFirestoreTimestampMs(dataB, ["atualizadoEm", "criadoEm"]) || 0;
      return timestampB - timestampA;
    })
    .slice(0, safeLimit);
}

async function listQrPrintDocsAcrossRuntimeDbs(
  managerDb,
  { projectSystemKey = "", maxItems = 300 } = {}
) {
  const safeLimit = Math.min(Math.max(Number(maxItems) || 300, 1), 800);
  const entries = await resolveRuntimeDbEntriesForSystem(managerDb, projectSystemKey);
  const docs = [];
  const seen = new Set();

  for (const entry of entries) {
    const partialDocs = await listQrPrintDocsForManager(entry.db, {
      projectSystemKey,
      maxItems: safeLimit,
    }).catch(() => []);

    partialDocs.forEach((docItem) => {
      const data = docItem.data() || {};
      const printId = sanitizeString(data?.printId || docItem.id);
      const key = `${entry.projectId}:${printId || docItem.ref.path}`;
      if (!key || seen.has(key)) return;
      seen.add(key);
      docs.push(docItem);
    });
  }

  return docs
    .sort((a, b) => {
      const dataA = a.data() || {};
      const dataB = b.data() || {};
      const timestampA = getFirestoreTimestampMs(dataA, ["atualizadoEm", "criadoEm"]) || 0;
      const timestampB = getFirestoreTimestampMs(dataB, ["atualizadoEm", "criadoEm"]) || 0;
      return timestampB - timestampA;
    })
    .slice(0, safeLimit);
}

async function getAuditLogsSnapshotWithFallback(ref, maxItems = 300) {
  try {
    return await ref.orderBy("criadoEm", "desc").limit(maxItems).get();
  } catch (error) {
    if (!isFirestorePreconditionError(error)) {
      throw error;
    }

    return ref.limit(maxItems).get();
  }
}

function resolveAuditLogProjectKey(docItem, data = {}, fallback = "") {
  return (
    resolveProjectSystemKeyFromDocRef(docItem) ||
    sanitizeString(data?.projectSystemKey).toLowerCase() ||
    sanitizeString(data?.runtimeProjectKey).toLowerCase() ||
    sanitizeString(fallback).toLowerCase()
  );
}

function auditLogPassesFilters(data = {}, {
  projectSystemKey = "",
  action = "",
  entityType = "",
  entityId = "",
  auditCategory = "",
  severity = "",
  startMs = NaN,
  endMs = NaN,
} = {}) {
  const itemProjectKey = sanitizeString(data?.projectSystemKey || data?.runtimeProjectKey).toLowerCase();
  const itemAction = sanitizeString(data?.action).toLowerCase();
  const itemEntityType = sanitizeString(data?.entityType).toLowerCase();
  const itemEntityId = sanitizeString(data?.entityId);
  const itemAuditCategory = sanitizeString(
    data?.auditCategory || resolveAuditCategory(data)
  ).toLowerCase();
  const itemSeverity = sanitizeString(
    data?.severity || resolveAuditSeverity(data)
  ).toLowerCase();
  const timestampMs = getFirestoreTimestampMs(data, ["criadoEm", "data", "createdAt"]) || 0;

  if (projectSystemKey && itemProjectKey !== projectSystemKey) return false;
  if (action && itemAction !== action) return false;
  if (entityType && itemEntityType !== entityType) return false;
  if (entityId && itemEntityId !== entityId) return false;
  if (auditCategory && itemAuditCategory !== auditCategory) return false;
  if (severity && itemSeverity !== severity) return false;
  if (Number.isFinite(startMs) && (!Number.isFinite(timestampMs) || timestampMs < startMs)) {
    return false;
  }
  if (Number.isFinite(endMs) && (!Number.isFinite(timestampMs) || timestampMs > endMs)) {
    return false;
  }

  return true;
}

async function listAuditLogDocsForManager(
  managerDb,
  {
    projectSystemKey = "",
    action = "",
    entityType = "",
    entityId = "",
    auditCategory = "",
    severity = "",
    startDate = "",
    endDate = "",
    maxItems = 300,
  } = {}
) {
  const normalizedProjectKey = sanitizeString(projectSystemKey).toLowerCase();
  const normalizedAction = sanitizeString(action).toLowerCase();
  const normalizedEntityType = sanitizeString(entityType).toLowerCase();
  const normalizedEntityId = sanitizeString(entityId);
  const normalizedAuditCategory = sanitizeString(auditCategory).toLowerCase();
  const normalizedSeverity = sanitizeString(severity).toLowerCase();
  const safeLimit = Math.min(Math.max(Number(maxItems) || 300, 1), 1000);
  const startDateObject = startDate ? new Date(`${startDate}T00:00:00.000Z`) : null;
  const endDateObject = endDate ? new Date(`${endDate}T23:59:59.999Z`) : null;
  const startMs =
    startDateObject && !Number.isNaN(startDateObject.getTime()) ? startDateObject.getTime() : NaN;
  const endMs =
    endDateObject && !Number.isNaN(endDateObject.getTime()) ? endDateObject.getTime() : NaN;
  const entries = await resolveRuntimeDbEntriesForSystem(managerDb, normalizedProjectKey);
  const docs = [];
  const seen = new Set();

  for (const entry of entries) {
    const addDocs = (snap) => {
      snap.docs.forEach((docItem) => {
        const data = docItem.data() || {};
        const resolvedProjectKey = resolveAuditLogProjectKey(docItem, data, normalizedProjectKey);
        const enrichedData = {
          ...data,
          projectSystemKey: sanitizeString(data?.projectSystemKey).toLowerCase() || resolvedProjectKey || null,
          runtimeProjectId: sanitizeString(data?.runtimeProjectId || entry.projectId) || null,
        };
        const key = `${entry.projectId}:${docItem.ref.path}`;
        if (!key || seen.has(key)) return;
        if (
          !auditLogPassesFilters(enrichedData, {
            projectSystemKey: normalizedProjectKey,
            action: normalizedAction,
            entityType: normalizedEntityType,
            entityId: normalizedEntityId,
            auditCategory: normalizedAuditCategory,
            severity: normalizedSeverity,
            startMs,
            endMs,
          })
        ) {
          return;
        }

        seen.add(key);
        docs.push({
          docItem,
          data: enrichedData,
          runtimeProjectId: entry.projectId,
        });
      });
    };

    try {
      const groupSnap = await getAuditLogsSnapshotWithFallback(
        entry.db.collectionGroup("auditLogs"),
        safeLimit
      );
      addDocs(groupSnap);
    } catch (error) {
      if (!isFirestorePreconditionError(error)) {
        // Mantem leitura das demais bases mesmo se uma delas falhar.
      }
    }

    if (normalizedProjectKey) {
      const projectSnap = await getAuditLogsSnapshotWithFallback(
        entry.db.collection("projetos").doc(normalizedProjectKey).collection("auditLogs"),
        safeLimit
      ).catch(() => null);
      if (projectSnap) addDocs(projectSnap);
    }

    const rootSnap = await getAuditLogsSnapshotWithFallback(
      entry.db.collection("auditLogs"),
      safeLimit
    ).catch(() => null);
    if (rootSnap) addDocs(rootSnap);
  }

  return docs
    .sort((a, b) => {
      const timestampA = getFirestoreTimestampMs(a.data, ["criadoEm", "data", "createdAt"]) || 0;
      const timestampB = getFirestoreTimestampMs(b.data, ["criadoEm", "data", "createdAt"]) || 0;
      return timestampB - timestampA;
    })
    .slice(0, safeLimit);
}

function resolveProjectSystemKeyFromDocRef(docItem) {
  const pathParts = String(docItem?.ref?.path || "").split("/");
  const projetosIndex = pathParts.findIndex((part) => part === "projetos");
  if (projetosIndex < 0 || !pathParts[projetosIndex + 1]) return "";
  return sanitizeString(pathParts[projetosIndex + 1]).toLowerCase();
}

function resolveDocProjectSystemKey(docItem, data = {}, fallback = "") {
  return (
    resolveProjectSystemKeyFromDocRef(docItem) ||
    sanitizeString(data?.projectSystemKey).toLowerCase() ||
    sanitizeString(data?.runtimeProjectKey).toLowerCase() ||
    sanitizeString(fallback).toLowerCase()
  );
}

function cleanFirestorePayload(payload = {}) {
  return Object.entries(payload || {}).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

const AUDIT_CATEGORY_BY_ENTITY = {
  acesso: "acessos",
  accessSettings: "acessos",
  usuario_projeto: "acessos",
  qrPrint: "rastreaveis",
  trackableLink: "rastreaveis",
  system: "configuracoes",
  systemConfig: "configuracoes",
  systemPreconfig: "configuracoes",
  iconCollection: "configuracoes",
  espaco: "conteudo",
  bloco: "conteudo",
  card: "conteudo",
  skin: "conteudo",
  addOn: "conteudo",
  addOnUsuario: "conteudo",
};

function resolveAuditCategory({
  action = "",
  entityType = "",
  metadata = null,
} = {}) {
  const explicitCategory = sanitizeString(
    metadata?.auditCategory || metadata?.categoriaAuditoria || ""
  );
  if (explicitCategory) return explicitCategory;

  const normalizedEntityType = sanitizeString(entityType);
  if (AUDIT_CATEGORY_BY_ENTITY[normalizedEntityType]) {
    return AUDIT_CATEGORY_BY_ENTITY[normalizedEntityType];
  }

  const normalizedAction = sanitizeString(action).toLowerCase();
  if (normalizedAction.includes("rastreavel")) return "rastreaveis";
  if (normalizedAction.includes("acesso")) return "acessos";
  if (normalizedAction.includes("config") || normalizedAction.includes("projeto")) {
    return "configuracoes";
  }
  return "conteudo";
}

function resolveAuditSeverity({
  action = "",
  entityType = "",
  metadata = null,
} = {}) {
  const explicitSeverity = sanitizeString(
    metadata?.auditSeverity || metadata?.severity || metadata?.severidade || ""
  ).toLowerCase();
  if (["baixo", "medio", "alto"].includes(explicitSeverity)) return explicitSeverity;

  const normalizedAction = sanitizeString(action).toLowerCase();
  const normalizedEntityType = sanitizeString(entityType);

  if (
    normalizedAction.includes("exclu") ||
    normalizedAction.includes("removeu") ||
    normalizedAction.includes("bloque") ||
    normalizedAction.includes("limpou_env") ||
    normalizedAction.includes("permiss")
  ) {
    return "alto";
  }

  if (["accessSettings", "usuario_projeto"].includes(normalizedEntityType)) {
    return "alto";
  }

  if (
    normalizedAction.includes("config") ||
    normalizedAction.includes("projeto") ||
    normalizedAction.includes("rastreavel") ||
    normalizedAction.includes("preconfig")
  ) {
    return "medio";
  }

  if (["system", "systemConfig", "systemPreconfig", "trackableLink", "qrPrint"].includes(normalizedEntityType)) {
    return "medio";
  }

  return "baixo";
}

function auditCategoryEnabledFromConfig(configSistema = {}, category = "conteudo") {
  if (configSistema?.auditoriaAtiva === false) return false;
  if (category === "acessos") return configSistema?.auditarAcessos !== false;
  if (category === "rastreaveis") return configSistema?.auditarRastreaveis !== false;
  if (category === "configuracoes") return configSistema?.auditarConfiguracoes !== false;
  return configSistema?.auditarConteudo !== false;
}

function resolveAuditProjectKey({
  projectSystemKey = "",
  sourcePath = "",
} = {}) {
  const pathParts = sanitizeString(sourcePath).split("/").filter(Boolean);
  const projetosIndex = pathParts.findIndex((part) => part === "projetos");
  const pathProjectKey =
    projetosIndex >= 0 ? sanitizeString(pathParts[projetosIndex + 1]) : "";
  return sanitizeString(pathProjectKey || projectSystemKey).toLowerCase();
}

async function getAuditConfigForProject(targetDb, projectSystemKey = "") {
  const normalizedProjectKey = sanitizeString(projectSystemKey).toLowerCase();
  if (!targetDb || !normalizedProjectKey) return {};

  const mergeConfigFromSnap = (acc, snap) => {
    if (!snap?.exists) return acc;
    const data = snap.data() || {};
    const configSistema =
      data?.configSistema && typeof data.configSistema === "object"
        ? data.configSistema
        : {};
    return {
      ...acc,
      ...data,
      ...configSistema,
    };
  };

  try {
    let config = {};

    const rootConfigSnap = await targetDb.doc("add_ons/sistema_config").get().catch(() => null);
    config = mergeConfigFromSnap(config, rootConfigSnap);

    const projectSnap = await targetDb.collection("projetos").doc(normalizedProjectKey).get().catch(() => null);
    config = mergeConfigFromSnap(config, projectSnap);

    const projectConfigSnap = await targetDb
      .doc(`projetos/${normalizedProjectKey}/add_ons/sistema_config`)
      .get()
      .catch(() => null);
    config = mergeConfigFromSnap(config, projectConfigSnap);

    const systemSnap = await targetDb.collection("systems").doc(normalizedProjectKey).get().catch(() => null);
    config = mergeConfigFromSnap(config, systemSnap);

    if (!systemSnap?.exists) {
      const bySystemKeySnap = await targetDb
        .collection("systems")
        .where("systemKey", "==", normalizedProjectKey)
        .limit(1)
        .get()
        .catch(() => null);
      if (bySystemKeySnap && !bySystemKeySnap.empty) {
        config = mergeConfigFromSnap(config, bySystemKeySnap.docs[0]);
      }
    }

    return config;
  } catch {
    return {};
  }
}

function normalizeAuditPermission(value = "", fallback = "owner_projeto") {
  const normalized = sanitizeString(value).toLowerCase();
  if (["owner_projeto", "dono_espaco", "admin_ou_dono_espaco"].includes(normalized)) {
    return normalized;
  }
  return ["owner_projeto", "dono_espaco", "admin_ou_dono_espaco"].includes(fallback)
    ? fallback
    : "owner_projeto";
}

function normalizeAuditRetentionDays(value, fallback = 180) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  const rounded = Math.round(numberValue);
  if (rounded < 0) return 0;
  if (rounded > 3650) return 3650;
  return rounded;
}

function buildAuditExpiresAt(configSistema = {}) {
  const retentionDays = normalizeAuditRetentionDays(configSistema?.auditoriaRetencaoDias, 180);
  if (!retentionDays) return null;
  return admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000)
  );
}

async function isSystemManagerAdminIdentity({ uid = "", email = "" } = {}) {
  try {
    await assertSystemManagerAdminIdentity({ uid, email });
    return true;
  } catch {
    return false;
  }
}

function normalizeAuditEmail(value = "") {
  return sanitizeString(value).toLowerCase();
}

function resolveAuditActorCanManageProject(configSistema = {}, { uid = "", email = "" } = {}) {
  const normalizedUid = sanitizeString(uid);
  const normalizedEmail = normalizeAuditEmail(email);
  const projectOwnerUids = [
    configSistema?.ownerUid,
    configSistema?.adminUid,
    configSistema?.projectOwnerUid,
  ].map((item) => sanitizeString(item)).filter(Boolean);
  const projectOwnerEmails = [
    configSistema?.ownerEmail,
    configSistema?.adminEmail,
    configSistema?.projectOwnerEmail,
  ].map((item) => normalizeAuditEmail(item)).filter(Boolean);

  return Boolean(
    (normalizedUid && projectOwnerUids.includes(normalizedUid)) ||
      (normalizedEmail && projectOwnerEmails.includes(normalizedEmail))
  );
}

function resolveAuditOwnerUidFromItem(item = {}) {
  return sanitizeString(
    item?.ownerUserId ||
      item?.ownerUid ||
      item?.projectOwnerUid ||
      item?.uidOwner ||
      item?.uid ||
      item?.actorUid ||
      item?.criadoPor ||
      item?.criadoPorUid
  );
}

function resolveAuditCoCreatorsFromItem(item = {}) {
  const candidates = [item?.coCriadoresUids, item?.coCriadores];
  return candidates
    .flatMap((candidate) => (Array.isArray(candidate) ? candidate : []))
    .map((value) => sanitizeString(typeof value === "string" ? value : value?.uid))
    .filter(Boolean);
}

function resolveAuditActorCanManageResource(item = {}, { uid = "" } = {}) {
  const normalizedUid = sanitizeString(uid);
  if (!normalizedUid) return false;
  const ownerUid = resolveAuditOwnerUidFromItem(item);
  const coCreators = resolveAuditCoCreatorsFromItem(item);
  return ownerUid === normalizedUid || coCreators.includes(normalizedUid);
}

function canManageAuditByPermission({
  configSistema = {},
  permissao = "owner_projeto",
  actor = {},
  resource = {},
  isManagerAdmin = false,
} = {}) {
  if (isManagerAdmin) return true;
  if (configSistema?.auditoriaAtiva === false) return false;

  const normalizedPermission = normalizeAuditPermission(permissao);
  const isProjectOwner = resolveAuditActorCanManageProject(configSistema, actor);
  const isResourceOwner = resolveAuditActorCanManageResource(resource, actor);

  if (normalizedPermission === "owner_projeto") return isProjectOwner;
  if (normalizedPermission === "admin_ou_dono_espaco") return isProjectOwner || isResourceOwner;
  return isResourceOwner;
}

function resolveAuditViewPermissionFieldForCategory(category = "") {
  const normalizedCategory = sanitizeString(category).toLowerCase();
  if (normalizedCategory === "acessos") return "auditoriaVerAcessosPermissao";
  if (normalizedCategory === "configuracoes") return "auditoriaVerConfiguracoesPermissao";
  if (normalizedCategory === "rastreaveis") return "auditoriaVerRastreaveisPermissao";
  return "auditoriaVerConteudoPermissao";
}

function resolveAuditCategoryFromLogData(data = {}) {
  return sanitizeString(
    data?.auditCategory ||
      resolveAuditCategory({
        action: data?.action,
        entityType: data?.entityType,
        metadata: data?.metadata,
      })
  ).toLowerCase() || "conteudo";
}

function resolveAuditViewPermissionForCategory(configSistema = {}, category = "") {
  const field = resolveAuditViewPermissionFieldForCategory(category);
  return normalizeAuditPermission(
    configSistema?.[field],
    configSistema?.auditoriaVerHistoricoPermissao || "owner_projeto"
  );
}

async function filterAuditDocsByPermissions(managerDb, docs = [], {
  decoded = null,
  purpose = "",
  projectSystemKey = "",
} = {}) {
  const actor = {
    uid: sanitizeString(decoded?.uid),
    email: sanitizeString(decoded?.email).toLowerCase(),
  };
  const isManagerAdmin = await isSystemManagerAdminIdentity(actor);
  if (isManagerAdmin) return docs;

  const purposeNormalized = sanitizeString(purpose).toLowerCase();
  const configCache = new Map();
  const getConfig = async (projectKey = "") => {
    const normalizedProjectKey = sanitizeString(projectKey).toLowerCase();
    if (!normalizedProjectKey) return null;
    if (!configCache.has(normalizedProjectKey)) {
      configCache.set(
        normalizedProjectKey,
        await getAuditConfigForProject(managerDb, normalizedProjectKey)
      );
    }
    return configCache.get(normalizedProjectKey);
  };

  const allowedDocs = [];
  for (const item of docs) {
    const data = item?.data || {};
    const normalizedProjectKey = resolveDocProjectSystemKey(
      item?.docItem,
      data,
      projectSystemKey
    );
    if (!normalizedProjectKey) continue;

    const configSistema = await getConfig(normalizedProjectKey);
    if (!configSistema || configSistema?.auditoriaAtiva === false) continue;

    const category = resolveAuditCategoryFromLogData(data);
    if (!auditCategoryEnabledFromConfig(configSistema, category)) continue;

    const canViewCategory = canManageAuditByPermission({
      configSistema,
      permissao: resolveAuditViewPermissionForCategory(configSistema, category),
      actor,
      resource: data,
      isManagerAdmin: false,
    });
    if (!canViewCategory) continue;

    if (purposeNormalized === "export") {
      const canExport = canManageAuditByPermission({
        configSistema,
        permissao: normalizeAuditPermission(
          configSistema?.auditoriaExportarPermissao,
          "owner_projeto"
        ),
        actor,
        resource: data,
        isManagerAdmin: false,
      });
      if (!canExport) continue;
    }

    allowedDocs.push(item);
  }

  return allowedDocs;
}

async function assertAuditPermissionForProject(managerDb, {
  projectSystemKey = "",
  decoded = null,
  permissionField = "auditoriaVerHistoricoPermissao",
  defaultPermission = "owner_projeto",
  resource = {},
  allowAllProjectsForManager = false,
} = {}) {
  const actor = {
    uid: sanitizeString(decoded?.uid),
    email: sanitizeString(decoded?.email).toLowerCase(),
  };
  const isManagerAdmin = await isSystemManagerAdminIdentity(actor);
  const normalizedProjectKey = sanitizeString(projectSystemKey).toLowerCase();

  if (!normalizedProjectKey) {
    if (allowAllProjectsForManager && isManagerAdmin) return {};
    throw new HttpsError("permission-denied", "Informe um projeto para aplicar a permissao de auditoria.");
  }

  const configSistema = await getAuditConfigForProject(managerDb, normalizedProjectKey);
  const fallbackPermission =
    permissionField.startsWith("auditoriaVer") &&
    permissionField !== "auditoriaVerHistoricoPermissao"
      ? (configSistema?.auditoriaVerHistoricoPermissao || defaultPermission)
      : defaultPermission;
  const permission = normalizeAuditPermission(configSistema?.[permissionField], fallbackPermission);
  const allowed = canManageAuditByPermission({
    configSistema,
    permissao: permission,
    actor,
    resource,
    isManagerAdmin,
  });

  if (!allowed) {
    throw new HttpsError("permission-denied", "Sem permissao para executar esta acao de auditoria.");
  }

  return configSistema;
}

function serializeAuditValue(value, depth = 0) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (depth > 4) return "[max-depth]";
  if (["string", "number", "boolean"].includes(typeof value)) return value;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) {
    return value.slice(0, 80).map((item) => serializeAuditValue(item, depth + 1));
  }
  if (typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, item]) => {
      if (key.startsWith("__") || typeof item === "function") return acc;
      acc[key] = serializeAuditValue(item, depth + 1);
      return acc;
    }, {});
  }
  return sanitizeString(value);
}

function getAuditCollectionRef(targetDb, {
  projectSystemKey = "",
  sourcePath = "",
} = {}) {
  const pathParts = sanitizeString(sourcePath).split("/").filter(Boolean);
  const hasProjectInSource = pathParts.findIndex((part) => part === "projetos") >= 0;
  const normalizedProjectKey = resolveAuditProjectKey({ projectSystemKey, sourcePath });

  if (hasProjectInSource && normalizedProjectKey) {
    return targetDb.collection("projetos").doc(normalizedProjectKey).collection("auditLogs");
  }

  return targetDb.collection("auditLogs");
}

async function writeAuditLog(targetDb, {
  action = "",
  entityType = "",
  entityId = "",
  projectSystemKey = "",
  runtimeProjectId = "",
  ownerUserId = "",
  espacoId = "",
  blocoId = "",
  cardId = "",
  actorUid = "",
  actorEmail = "",
  motivo = "",
  source = "function",
  sourcePath = "",
  snapshotAntes = null,
  snapshotDepois = null,
  metadata = null,
} = {}) {
  const normalizedAction = sanitizeString(action);
  const normalizedEntityType = sanitizeString(entityType);
  const normalizedEntityId = sanitizeString(entityId);
  if (!targetDb || !normalizedAction || !normalizedEntityType || !normalizedEntityId) return null;

  try {
    const normalizedProjectKey = resolveAuditProjectKey({ projectSystemKey, sourcePath });
    const auditCategory = resolveAuditCategory({
      action: normalizedAction,
      entityType: normalizedEntityType,
      metadata,
    });
    const auditSeverity = resolveAuditSeverity({
      action: normalizedAction,
      entityType: normalizedEntityType,
      metadata,
    });
    const auditConfig = await getAuditConfigForProject(targetDb, normalizedProjectKey);
    if (!auditCategoryEnabledFromConfig(auditConfig, auditCategory)) return null;

    const auditRef = getAuditCollectionRef(targetDb, { projectSystemKey, sourcePath });
    return await auditRef.add(cleanFirestorePayload({
      action: normalizedAction,
      entityType: normalizedEntityType,
      entityId: normalizedEntityId,
      projectSystemKey: normalizedProjectKey || sanitizeString(projectSystemKey).toLowerCase() || null,
      runtimeProjectId: sanitizeString(runtimeProjectId) || null,
      ownerUserId: sanitizeString(ownerUserId) || null,
      espacoId: sanitizeString(espacoId) || null,
      blocoId: sanitizeString(blocoId) || null,
      cardId: sanitizeString(cardId) || null,
      actorUid: sanitizeString(actorUid) || null,
      actorEmail: sanitizeString(actorEmail).toLowerCase() || null,
      motivo: sanitizeString(motivo) || null,
      source: sanitizeString(source) || "function",
      sourcePath: sanitizeString(sourcePath) || null,
      auditCategory,
      severity: auditSeverity,
      snapshotAntes: snapshotAntes ? serializeAuditValue(snapshotAntes) : null,
      snapshotDepois: snapshotDepois ? serializeAuditValue(snapshotDepois) : null,
      metadata: metadata ? serializeAuditValue(metadata) : null,
      criadoEm: serverTimestamp(),
      expiresAt: buildAuditExpiresAt(auditConfig),
    }));
  } catch (error) {
    console.warn("Falha ao registrar auditoria:", error?.message || error);
    return null;
  }
}

function normalizeOptionalBaseUrl(baseUrl = "") {
  const normalized = sanitizeString(baseUrl);
  if (!normalized) return "";
  return normalizeBaseUrl(normalized);
}

function buildTrackableBaseUrlFromSystem(systemData = {}, baseUrlInput = "") {
  const baseUrl = normalizeOptionalBaseUrl(baseUrlInput);
  if (baseUrl) return baseUrl;

  const domains = Array.isArray(systemData?.domains) ? systemData.domains : [];
  const firstDomain = domains.map((domain) => normalizeHostValue(domain)).find(Boolean);
  if (firstDomain) return `https://${firstDomain}`;

  const runtimeProjectId = extractSystemFirebaseProjectId(systemData);
  if (runtimeProjectId) return `https://${runtimeProjectId}.vercel.app`;

  return "";
}

function buildTrackableAbsoluteUrlFromBase(baseUrl = "", route = "") {
  const normalizedRoute = sanitizeString(route);
  if (!normalizedRoute) return "";
  const normalizedBaseUrl = normalizeOptionalBaseUrl(baseUrl);
  if (!normalizedBaseUrl) return normalizedRoute;
  return `${normalizedBaseUrl}${normalizedRoute.startsWith("/") ? "" : "/"}${normalizedRoute}`;
}

function getTrackableLinkWriteRefForTarget(target, trackingId = "") {
  const normalizedTrackingId = ensureRequiredString(trackingId, "trackingId");
  if (SHARED_ONEOWNER_RUNTIME_KEYS.has(sanitizeString(target?.runtimeProjectId).toLowerCase())) {
    return target.db
      .collection("projetos")
      .doc(target.projectSystemKey)
      .collection("trackableLinks")
      .doc(normalizedTrackingId);
  }

  return target.db.collection("trackableLinks").doc(normalizedTrackingId);
}

async function resolveSystemDocForTrackableWrite(managerDb, projectSystemKey = "") {
  const normalizedProjectKey = ensureRequiredString(projectSystemKey, "projectSystemKey").toLowerCase();

  const directSnap = await managerDb.collection("systems").doc(normalizedProjectKey).get();
  if (directSnap.exists) {
    return {
      id: directSnap.id,
      data: directSnap.data() || {},
    };
  }

  const bySystemKeySnap = await managerDb
    .collection("systems")
    .where("systemKey", "==", normalizedProjectKey)
    .limit(1)
    .get();

  if (!bySystemKeySnap.empty) {
    const docItem = bySystemKeySnap.docs[0];
    return {
      id: docItem.id,
      data: docItem.data() || {},
    };
  }

  throw new HttpsError("not-found", "Projeto alvo nao encontrado no gerenciador.");
}

async function resolveTrackableTargetForManagerWrite(managerDb, projectSystemKey = "") {
  const systemDoc = await resolveSystemDocForTrackableWrite(managerDb, projectSystemKey);
  const systemData = systemDoc.data || {};
  const normalizedProjectKey = sanitizeString(systemData?.systemKey || systemDoc.id || projectSystemKey)
    .toLowerCase();
  const runtimeProjectId =
    extractSystemFirebaseProjectId(systemData) || normalizedProjectKey || CURRENT_PROJECT_ID;

  return {
    projectSystemKey: normalizedProjectKey,
    runtimeProjectId: ensureAllowedTargetProjectId(runtimeProjectId, CURRENT_PROJECT_ID),
    systemData,
    db: getProjectDb(runtimeProjectId, CURRENT_PROJECT_ID),
  };
}

async function resolveTrackableLinkRefForManagerAction(managerDb, {
  projectSystemKey = "",
  trackingId = "",
} = {}) {
  const normalizedTrackingId = ensureRequiredString(trackingId, "trackingId");
  const tryTarget = async (target) => {
    const rootRef = target.db.collection("trackableLinks").doc(normalizedTrackingId);
    const rootSnap = await rootRef.get();
    if (rootSnap.exists) {
      return { ...target, ref: rootRef, snap: rootSnap };
    }

    const projectRef = target.db
      .collection("projetos")
      .doc(target.projectSystemKey)
      .collection("trackableLinks")
      .doc(normalizedTrackingId);
    const projectSnap = await projectRef.get();
    if (projectSnap.exists) {
      return { ...target, ref: projectRef, snap: projectSnap };
    }

    const groupSnap = await target.db
      .collectionGroup("trackableLinks")
      .where("trackingId", "==", normalizedTrackingId)
      .limit(1)
      .get()
      .catch(() => null);
    if (groupSnap && !groupSnap.empty) {
      const snap = groupSnap.docs[0];
      const data = snap.data() || {};
      return {
        ...target,
        projectSystemKey: resolveDocProjectSystemKey(snap, data, target.projectSystemKey),
        ref: snap.ref,
        snap,
      };
    }

    return null;
  };

  try {
    const target = await resolveTrackableTargetForManagerWrite(managerDb, projectSystemKey);
    const resolved = await tryTarget(target);
    if (resolved) return resolved;
  } catch {
    // Se o projectSystemKey estiver legado/incorreto, procura em todos os runtimes permitidos.
  }

  const entries = await resolveRuntimeDbEntriesForSystem(managerDb, projectSystemKey);
  for (const entry of entries) {
    const resolved = await tryTarget({
      projectSystemKey: sanitizeString(projectSystemKey).toLowerCase() || entry.projectId,
      runtimeProjectId: entry.projectId,
      systemData: {},
      db: entry.db,
    });
    if (resolved) return resolved;
  }

  throw new HttpsError("not-found", "Link rastreavel nao encontrado no projeto alvo.");
}

async function resolveQrPrintRefForManagerAction(managerDb, {
  projectSystemKey = "",
  printId = "",
} = {}) {
  const normalizedPrintId = ensureRequiredString(printId, "printId");
  const tryTarget = async (target) => {
    const rootRef = target.db.collection("qrPrints").doc(normalizedPrintId);
    const rootSnap = await rootRef.get();
    if (rootSnap.exists) {
      return { ...target, ref: rootRef, snap: rootSnap };
    }

    const projectRef = target.db
      .collection("projetos")
      .doc(target.projectSystemKey)
      .collection("qrPrints")
      .doc(normalizedPrintId);
    const projectSnap = await projectRef.get();
    if (projectSnap.exists) {
      return { ...target, ref: projectRef, snap: projectSnap };
    }

    const groupSnap = await target.db
      .collectionGroup("qrPrints")
      .where("printId", "==", normalizedPrintId)
      .limit(1)
      .get()
      .catch(() => null);
    if (groupSnap && !groupSnap.empty) {
      const snap = groupSnap.docs[0];
      const data = snap.data() || {};
      return {
        ...target,
        projectSystemKey: resolveDocProjectSystemKey(snap, data, target.projectSystemKey),
        ref: snap.ref,
        snap,
      };
    }

    return null;
  };

  try {
    const target = await resolveTrackableTargetForManagerWrite(managerDb, projectSystemKey);
    const resolved = await tryTarget(target);
    if (resolved) return resolved;
  } catch {
    // Se o projectSystemKey estiver legado/incorreto, procura em todos os runtimes permitidos.
  }

  const entries = await resolveRuntimeDbEntriesForSystem(managerDb, projectSystemKey);
  for (const entry of entries) {
    const resolved = await tryTarget({
      projectSystemKey: sanitizeString(projectSystemKey).toLowerCase() || entry.projectId,
      runtimeProjectId: entry.projectId,
      systemData: {},
      db: entry.db,
    });
    if (resolved) return resolved;
  }

  throw new HttpsError("not-found", "Card QR rastreavel nao encontrado no projeto alvo.");
}

async function deleteAccessRecords(managerDb, ids = []) {
  const accessIds = normalizeAccessDocIds(ids);
  if (!accessIds.length) return 0;

  let deleted = 0;
  for (let index = 0; index < accessIds.length; index += 450) {
    const batch = managerDb.batch();
    const chunk = accessIds.slice(index, index + 450);
    chunk.forEach((accessId) => {
      batch.delete(managerDb.collection("acessos").doc(accessId));
    });
    await batch.commit();
    deleted += chunk.length;
  }

  return deleted;
}

function isPrivateOrLocalIp(ip = "") {
  const value = sanitizeString(ip).toLowerCase();
  if (!value) return true;

  const normalized = value.replace(/^::ffff:/, "");
  if (
    normalized === "::1" ||
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized.startsWith("10.") ||
    normalized.startsWith("192.168.") ||
    normalized.startsWith("169.254.") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  ) {
    return true;
  }

  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) {
    return true;
  }

  return false;
}

async function fetchGeoByIp(ip = "") {
  const normalizedIp = sanitizeString(ip).replace(/^::ffff:/, "");
  if (!normalizedIp || isPrivateOrLocalIp(normalizedIp)) {
    console.info("[geo] skip lookup for private/local ip", {
      ip: normalizedIp || null,
      reason: !normalizedIp ? "missing_ip" : "private_or_local_ip",
    });
    return {
      ip: normalizedIp || null,
      country: null,
      region: null,
      city: null,
      uf: null,
      regionCode: null,
      org: null,
      cep: null,
      latitude: null,
      longitude: null,
      resolvedAt: Date.now(),
      _geoSource: !normalizedIp ? "missing_ip" : "private_or_local_ip",
      _geoError: null,
    };
  }

  const fetchJsonWithTimeout = async (url, timeoutMs = 2200) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "ALY-REACT geo resolver",
        },
      });
      const payload = await response.json().catch(() => ({}));
      return { response, payload };
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const parseCoordinates = (loc = "") => {
    const [latitude, longitude] = sanitizeString(loc)
      .split(",")
      .map((item) => Number(item.trim()));

    return {
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
    };
  };

  const normalizeGeoResult = (source, values = {}) => ({
    ip: sanitizeString(values.ip) || normalizedIp,
    country: sanitizeString(values.country) || null,
    region: sanitizeString(values.region) || null,
    city: sanitizeString(values.city) || null,
    uf: sanitizeString(values.uf || values.regionCode) || null,
    regionCode: sanitizeString(values.regionCode || values.uf) || null,
    org: sanitizeString(values.org) || null,
    cep: sanitizeString(values.cep) || null,
    latitude: Number.isFinite(Number(values.latitude)) ? Number(values.latitude) : null,
    longitude: Number.isFinite(Number(values.longitude)) ? Number(values.longitude) : null,
    resolvedAt: Date.now(),
    _geoSource: source,
    _geoError: sanitizeString(values.error) || null,
  });

  const hasLocationData = (geo = {}) =>
    Boolean(
      geo.country ||
        geo.region ||
        geo.city ||
        geo.uf ||
        geo.org ||
        Number.isFinite(Number(geo.latitude)) ||
        Number.isFinite(Number(geo.longitude))
    );

  const providers = [
    {
      source: "ipwho.is",
      lookup: async () => {
        const { response, payload } = await fetchJsonWithTimeout(
          `https://ipwho.is/${encodeURIComponent(normalizedIp)}`
        );
        const error =
          !response?.ok || payload?.success === false
            ? sanitizeString(payload?.message) ||
              `HTTP ${Number(response?.status) || "sem_status"}`
            : null;

        return normalizeGeoResult("ipwho.is", {
          country: payload?.country,
          region: payload?.region,
          city: payload?.city,
          uf: payload?.region_code,
          regionCode: payload?.region_code,
          org: payload?.connection?.org || payload?.org,
          cep: payload?.postal,
          latitude: payload?.latitude,
          longitude: payload?.longitude,
          error,
        });
      },
    },
    {
      source: "geojs.io",
      lookup: async () => {
        const { response, payload } = await fetchJsonWithTimeout(
          `https://get.geojs.io/v1/ip/geo/${encodeURIComponent(normalizedIp)}.json`
        );
        const error = !response?.ok
          ? `HTTP ${Number(response?.status) || "sem_status"}`
          : null;

        return normalizeGeoResult("geojs.io", {
          country: payload?.country || payload?.country_code,
          region: payload?.region,
          city: payload?.city,
          org: payload?.organization_name || payload?.organization,
          latitude: payload?.latitude,
          longitude: payload?.longitude,
          error,
        });
      },
    },
    {
      source: "ipapi.co",
      lookup: async () => {
        const { response, payload } = await fetchJsonWithTimeout(
          `https://ipapi.co/${encodeURIComponent(normalizedIp)}/json/`
        );
        const error =
          !response?.ok || payload?.error
            ? sanitizeString(payload?.reason || payload?.message) ||
              `HTTP ${Number(response?.status) || "sem_status"}`
            : null;

        return normalizeGeoResult("ipapi.co", {
          country: payload?.country_name || payload?.country,
          region: payload?.region,
          city: payload?.city,
          uf: payload?.region_code,
          regionCode: payload?.region_code,
          org: payload?.org,
          cep: payload?.postal,
          latitude: payload?.latitude,
          longitude: payload?.longitude,
          error,
        });
      },
    },
    {
      source: "ipinfo.io",
      lookup: async () => {
        const { response, payload } = await fetchJsonWithTimeout(
          `https://ipinfo.io/${encodeURIComponent(normalizedIp)}/json`
        );
        const coordinates = parseCoordinates(payload?.loc);
        const error =
          !response?.ok || payload?.error
            ? sanitizeString(payload?.error?.message || payload?.message) ||
              `HTTP ${Number(response?.status) || "sem_status"}`
            : null;

        return normalizeGeoResult("ipinfo.io", {
          country: payload?.country,
          region: payload?.region,
          city: payload?.city,
          org: payload?.org,
          cep: payload?.postal,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          error,
        });
      },
    },
  ];

  let lastGeo = null;
  for (const provider of providers) {
    try {
      const geo = await provider.lookup();
      lastGeo = geo;

      console.info("[geo] provider lookup result", {
        provider: provider.source,
        ip: normalizedIp,
        success: hasLocationData(geo) && !geo._geoError,
        country: geo.country,
        region: geo.region,
        city: geo.city,
        regionCode: geo.regionCode,
        error: geo._geoError,
      });

      if (hasLocationData(geo) && !geo._geoError) {
        return geo;
      }
    } catch (error) {
      lastGeo = normalizeGeoResult(provider.source, {
        error: sanitizeString(error?.message) || sanitizeString(error?.name) || null,
      });
      console.warn("[geo] provider lookup failed", {
        provider: provider.source,
        ip: normalizedIp,
        errorName: sanitizeString(error?.name) || null,
        errorMessage: sanitizeString(error?.message) || null,
      });
    }
  }

  return (
    lastGeo ||
    normalizeGeoResult("lookup_error", {
      error: "Nenhum provedor de geolocalizacao retornou dados.",
    })
  );
}

async function resolveGeoDataFromRequest(req, fallback = {}) {
  const fallbackGeo =
    fallback?.geo && typeof fallback.geo === "object" ? fallback.geo : {};
  const fallbackPayload = {
    ...fallbackGeo,
    ...fallback,
  };
  const clientIp = sanitizeString(fallbackPayload?.ip) || extractClientIp(req) || null;
  const geoByIp = await fetchGeoByIp(clientIp);
  const resolvedGeo = {
    ip: geoByIp.ip || clientIp || null,
    country: geoByIp.country || sanitizeString(fallbackPayload?.country) || null,
    region: geoByIp.region || sanitizeString(fallbackPayload?.region) || null,
    city:
      geoByIp.city ||
      sanitizeString(fallbackPayload?.city) ||
      sanitizeString(fallbackPayload?.cidade) ||
      null,
    uf:
      geoByIp.uf ||
      sanitizeString(fallbackPayload?.uf) ||
      sanitizeString(fallbackPayload?.regionCode) ||
      null,
    regionCode:
      geoByIp.regionCode ||
      sanitizeString(fallbackPayload?.regionCode) ||
      sanitizeString(fallbackPayload?.uf) ||
      null,
    org: geoByIp.org || sanitizeString(fallbackPayload?.org) || null,
    cep: geoByIp.cep || sanitizeString(fallbackPayload?.cep) || null,
    logradouro: sanitizeString(fallbackPayload?.logradouro) || null,
    bairro: sanitizeString(fallbackPayload?.bairro) || null,
    cidade: sanitizeString(fallbackPayload?.cidade) || geoByIp.city || null,
    latitude:
      geoByIp.latitude ??
      (Number.isFinite(Number(fallbackPayload?.latitude))
        ? Number(fallbackPayload.latitude)
        : null),
    longitude:
      geoByIp.longitude ??
      (Number.isFinite(Number(fallbackPayload?.longitude))
        ? Number(fallbackPayload.longitude)
        : null),
    resolvedAt: geoByIp.resolvedAt || Date.now(),
    _geoSource: sanitizeString(geoByIp?._geoSource) || "unknown",
    _geoError: sanitizeString(geoByIp?._geoError) || null,
  };

  console.info("[geo] resolved request geo", {
    ip: resolvedGeo.ip,
    source: resolvedGeo._geoSource,
    error: resolvedGeo._geoError,
    country: resolvedGeo.country,
    region: resolvedGeo.region,
    city: resolvedGeo.city,
    uf: resolvedGeo.uf,
  });

  return resolvedGeo;
}

async function getProjectSystemConfigSnapshot(firestoreDb = db) {
  try {
    const snap = await firestoreDb.doc("add_ons/sistema_config").get();
    return snap.exists ? snap.data() || {} : {};
  } catch {
    return {};
  }
}

function resolveCompraAssinaturaLocationBlock(config = {}, geo = {}) {
  const rules = [
    {
      field: "country",
      values: normalizeStringList(config?.compraAssinaturaPaisesBloqueados),
      label: "pais",
      currentValue: geo?.country,
    },
    {
      field: "region",
      values: normalizeStringList(config?.compraAssinaturaRegioesBloqueadas),
      label: "regiao",
      currentValue: geo?.region,
    },
    {
      field: "uf",
      values: normalizeStringList(config?.compraAssinaturaUfsBloqueadas),
      label: "UF",
      currentValue: geo?.uf || geo?.regionCode,
    },
    {
      field: "city",
      values: normalizeStringList(config?.compraAssinaturaCidadesBloqueadas),
      label: "cidade",
      currentValue: geo?.city || geo?.cidade,
    },
  ];

  for (const rule of rules) {
    const currentNormalized = normalizeGeoCompareValue(rule.currentValue);
    if (!currentNormalized) continue;

    const matched = rule.values.find(
      (item) => normalizeGeoCompareValue(item) === currentNormalized
    );
    if (matched) {
      return {
        blocked: true,
        field: rule.field,
        label: rule.label,
        value: matched,
        currentValue: rule.currentValue,
      };
    }
  }

  return {
    blocked: false,
    field: "",
    label: "",
    value: "",
    currentValue: "",
  };
}

async function assertCompraAssinaturaPermitidaPorLocalizacao({
  firestoreDb = db,
  geo = {},
}) {
  const config = await getProjectSystemConfigSnapshot(firestoreDb);
  const block = resolveCompraAssinaturaLocationBlock(config, geo);
  if (!block.blocked) return;

  throw new HttpsError(
    "permission-denied",
    `Compra/assinatura bloqueada para sua localizacao (${block.currentValue || block.value}).`
  );
}

function isLocalhostUrl(urlValue) {
  try {
    const parsed = new URL(urlValue);
    const host = (parsed.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

function buildMenuUrl({
  baseUrl,
  skinUsername,
  ownerUserId,
  espacoId,
  blocoId,
  returnTo,
  mpStatus = "",
}) {
  const safeBaseUrl = normalizeBaseUrl(baseUrl);
  const skin = ensureRequiredString(skinUsername, "skinUsername");
  const url = new URL(`${safeBaseUrl}/menu/${encodeURIComponent(skin)}`);
  url.searchParams.set("comprarBloco", blocoId);
  url.searchParams.set("espacoId", espacoId);
  url.searchParams.set("ownerUserId", ownerUserId);
  if (returnTo) {
    url.searchParams.set("returnTo", returnTo);
  }
  if (mpStatus) {
    url.searchParams.set("mpStatus", mpStatus);
  }
  return url.toString();
}

function parseExternalReference(reference) {
  const normalized = sanitizeString(reference);
  const parts = normalized.split("|");
  if (parts.length < 5 || parts[0] !== "bloco") {
    return null;
  }

  return {
    ownerUserId: parts[1] || "",
    espacoId: parts[2] || "",
    blocoId: parts[3] || "",
    compradorUid: parts[4] || "",
  };
}

function normalizeProjectSystemKey(projectSystemKey = "") {
  return sanitizeString(projectSystemKey).toLowerCase();
}

function shouldUseProjectNamespace(targetProjectId = "", projectSystemKey = "") {
  const targetProjectIdNormalizado = sanitizeString(targetProjectId).toLowerCase();
  const projectSystemKeyNormalizado = normalizeProjectSystemKey(projectSystemKey);
  return (
    SHARED_ONEOWNER_RUNTIME_KEYS.has(targetProjectIdNormalizado) &&
    !!projectSystemKeyNormalizado &&
    projectSystemKeyNormalizado !== targetProjectIdNormalizado
  );
}

function buildProjectDataPath(segments = [], { targetProjectId = "", projectSystemKey = "" } = {}) {
  const path = Array.isArray(segments) ? segments.filter(Boolean).map((item) => String(item)) : [];
  if (!path.length) return "";
  if (!shouldUseProjectNamespace(targetProjectId, projectSystemKey)) {
    return path.join("/");
  }
  return ["projetos", normalizeProjectSystemKey(projectSystemKey), ...path].join("/");
}

function getProjectDataDocRef(firestoreDb = db, segments = [], options = {}) {
  const path = buildProjectDataPath(segments, options);
  return firestoreDb.doc(path);
}

function getUserDocRef(userId, firestoreDb = db, options = {}) {
  return getProjectDataDocRef(firestoreDb, ["users", userId], options);
}

function getBlockDocRef(ownerUserId, espacoId, blocoId, firestoreDb = db, options = {}) {
  return getProjectDataDocRef(
    firestoreDb,
    ["users", ownerUserId, "espacos", espacoId, "blocos", blocoId],
    options
  );
}

function getOwnerIntegrationRef(ownerUserId, firestoreDb = db, options = {}) {
  return getProjectDataDocRef(
    firestoreDb,
    ["users", ownerUserId, "integracoes", "mercadoPago"],
    options
  );
}

function getSharedMercadoPagoIntegrationRef(targetProjectId = "", ownerUserId = "", firestoreDb = db) {
  const projectIdNormalizado = sanitizeString(targetProjectId) || CURRENT_PROJECT_ID;
  const ownerUidNormalizado = ensureRequiredString(ownerUserId, "uid");
  return firestoreDb.doc(
    `shared_mercado_pago_integracoes/${projectIdNormalizado}__${ownerUidNormalizado}`
  );
}

function getOwnerPixManualRef(ownerUserId, firestoreDb = db, options = {}) {
  return getProjectDataDocRef(
    firestoreDb,
    ["users", ownerUserId, "integracoes", "pixManual"],
    options
  );
}

async function getOwnerMercadoPagoAccessToken(
  ownerUserId,
  firestoreDb = db,
  targetProjectId = CURRENT_PROJECT_ID,
  projectSystemKey = ""
) {
  let integrationData = null;

  try {
    const sharedIntegrationSnap = await getSharedMercadoPagoIntegrationRef(
      targetProjectId,
      ownerUserId,
      db
    ).get();
    if (sharedIntegrationSnap.exists) {
      integrationData = sharedIntegrationSnap.data() || null;
    }
  } catch {
    // Segue para fallback abaixo.
  }

  if (!integrationData) {
    const integrationSnap = await getOwnerIntegrationRef(ownerUserId, firestoreDb, {
      targetProjectId,
      projectSystemKey,
    }).get();
    integrationData = integrationSnap.exists ? integrationSnap.data() : null;
  }

  const accessToken = sanitizeString(integrationData?.accessToken);

  if (!accessToken) {
    throw new HttpsError(
      "failed-precondition",
      "Criador do bloco nao conectou o Mercado Pago."
    );
  }

  return { accessToken, integrationData };
}

async function getBuyerContext(
  compradorUid,
  firestoreDb = db,
  { targetProjectId = CURRENT_PROJECT_ID, projectSystemKey = "" } = {}
) {
  const buyerSnap = await getUserDocRef(compradorUid, firestoreDb, {
    targetProjectId,
    projectSystemKey,
  }).get();
  const buyerData = buyerSnap.exists ? buyerSnap.data() : null;
  const activeSkinId =
    typeof buyerData?.skinAtivaId === "string" && buyerData.skinAtivaId
      ? buyerData.skinAtivaId
      : null;

  return {
    activeSkinId,
    email: sanitizeString(buyerData?.email),
  };
}

async function buyerAlreadyHasAccess({
  ownerUserId,
  espacoId,
  blocoId,
  compradorUid,
  activeSkinId,
  firestoreDb = db,
  targetProjectId = CURRENT_PROJECT_ID,
  projectSystemKey = "",
}) {
  const basePath = buildProjectDataPath(
    ["users", ownerUserId, "espacos", espacoId, "blocos", blocoId, "compradores"],
    { targetProjectId, projectSystemKey }
  );
  const buyerDoc = await firestoreDb.doc(`${basePath}/${compradorUid}`).get();
  if (buyerDoc.exists) return true;

  if (activeSkinId) {
    const skinDoc = await firestoreDb.doc(`${basePath}/${activeSkinId}`).get();
    if (skinDoc.exists) return true;
  }

  return false;
}

function ensureValidBlockForPurchase(blocoData) {
  const visibilidade = sanitizeString(blocoData?.visibilidade) || "publico";
  if (visibilidade !== "exclusivo_comprador" && visibilidade !== "comprado") {
    throw new HttpsError(
      "failed-precondition",
      "Esse bloco nao esta configurado para compra."
    );
  }

  const precoCentavos = Number(blocoData?.precoCentavos);
  if (!Number.isFinite(precoCentavos) || precoCentavos <= 0) {
    throw new HttpsError(
      "failed-precondition",
      "Bloco sem preco valido para checkout."
    );
  }

  return {
    precoCentavos: Math.round(precoCentavos),
    moeda: sanitizeString(blocoData?.moeda) || "BRL",
  };
}

function getBlockPaymentMethods(blocoData = {}) {
  const metodos = blocoData?.metodosPagamento || blocoData?.metodosPagamentoPermitidos || {};
  return {
    mercadoPago:
      typeof metodos?.mercadoPago === "boolean" ? metodos.mercadoPago : true,
    pixManual:
      typeof metodos?.pixManual === "boolean" ? metodos.pixManual : true,
  };
}

function assertBlockPaymentMethodEnabled(blocoData = {}, metodo = "") {
  const metodos = getBlockPaymentMethods(blocoData);
  const metodoNormalizado = sanitizeString(metodo);

  if (metodoNormalizado === "mercadoPago" && !metodos.mercadoPago) {
    throw new HttpsError(
      "failed-precondition",
      "Mercado Pago desativado para esta live."
    );
  }

  if (metodoNormalizado === "pixManual" && !metodos.pixManual) {
    throw new HttpsError(
      "failed-precondition",
      "PIX manual desativado para esta live."
    );
  }

  return metodos;
}

async function fetchMercadoPago(endpoint, accessToken, options = {}) {
  const response = await fetch(`https://api.mercadopago.com${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    console.error("MercadoPago request failed", {
      endpoint,
      status: response.status,
      body,
    });
    throw new HttpsError(
      "internal",
      body?.message || body?.error || "Falha na comunicacao com Mercado Pago."
    );
  }

  return body;
}

async function salvarMercadoPagoCredenciaisCore({
  firestoreDb = db,
  targetProjectId = CURRENT_PROJECT_ID,
  projectSystemKey = "",
  uid,
  accessToken,
  publicKey = "",
}) {
  const accessTokenNormalizado = ensureRequiredString(accessToken, "accessToken");
  const publicKeyNormalizada = sanitizeString(publicKey);

  if (accessTokenNormalizado.length < 20) {
    throw new HttpsError("invalid-argument", "Access Token invalido.");
  }

  const me = await fetchMercadoPago("/users/me", accessTokenNormalizado, { method: "GET" });

  const payload = {
    accessToken: accessTokenNormalizado,
    publicKey: publicKeyNormalizada || null,
    mpUserId: me?.id || null,
    mpEmail: sanitizeString(me?.email) || null,
    connectedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    targetProjectId: sanitizeString(targetProjectId) || CURRENT_PROJECT_ID,
    ownerUid: sanitizeString(uid),
  };

  await getSharedMercadoPagoIntegrationRef(targetProjectId, uid, db).set(
    payload,
    { merge: true }
  );

  try {
    await getOwnerIntegrationRef(uid, firestoreDb, {
      targetProjectId,
      projectSystemKey,
    }).set(
      payload,
      { merge: true }
    );
  } catch {
    // O espelho no projeto-alvo é opcional quando não há IAM cross-project.
  }

  return {
    ok: true,
    conectado: true,
    mpUserId: me?.id || null,
    mpEmail: sanitizeString(me?.email) || null,
  };
}

async function obterStatusMercadoPagoCore({
  firestoreDb = db,
  targetProjectId = CURRENT_PROJECT_ID,
  projectSystemKey = "",
  uid,
}) {
  let integrationData = {};

  try {
    const sharedIntegrationSnap = await getSharedMercadoPagoIntegrationRef(
      targetProjectId,
      uid,
      db
    ).get();
    if (sharedIntegrationSnap.exists) {
      integrationData = sharedIntegrationSnap.data() || {};
    } else {
      const integrationSnap = await getOwnerIntegrationRef(uid, firestoreDb, {
        targetProjectId,
        projectSystemKey,
      }).get();
      integrationData = integrationSnap.exists ? integrationSnap.data() : {};
    }
  } catch {
    const integrationSnap = await getSharedMercadoPagoIntegrationRef(
      targetProjectId,
      uid,
      db
    ).get();
    integrationData = integrationSnap.exists ? integrationSnap.data() : {};
  }

  return {
    conectado: Boolean(sanitizeString(integrationData?.accessToken)),
    mpUserId: integrationData?.mpUserId || null,
    mpEmail: integrationData?.mpEmail || null,
    hasPublicKey: Boolean(sanitizeString(integrationData?.publicKey)),
  };
}

async function desconectarMercadoPagoCore({
  firestoreDb = db,
  targetProjectId = CURRENT_PROJECT_ID,
  projectSystemKey = "",
  uid,
}) {
  const payload = {
    accessToken: null,
    publicKey: null,
    mpUserId: null,
    mpEmail: null,
    disconnectedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    targetProjectId: sanitizeString(targetProjectId) || CURRENT_PROJECT_ID,
    ownerUid: sanitizeString(uid),
  };

  await getSharedMercadoPagoIntegrationRef(targetProjectId, uid, db).set(
    payload,
    { merge: true }
  );

  try {
    const integrationRef = getOwnerIntegrationRef(uid, firestoreDb, {
      targetProjectId,
      projectSystemKey,
    });
    await integrationRef.set(
      payload,
      { merge: true }
    );
  } catch {
    // O espelho no projeto-alvo é opcional quando não há IAM cross-project.
  }

  return {
    ok: true,
    conectado: false,
  };
}

async function criarCheckoutBlocoMercadoPagoCore({
  firestoreDb = db,
  targetProjectId = CURRENT_PROJECT_ID,
  projectSystemKey = "",
  clientGeo = null,
  compradorUid,
  authEmail = "",
  ownerUserId,
  espacoId,
  blocoId,
  skinUsername,
  baseUrlInput,
  returnTo = "",
}) {
  const ownerUserIdNormalizado = ensureRequiredString(ownerUserId, "ownerUserId");
  const espacoIdNormalizado = ensureRequiredString(espacoId, "espacoId");
  const blocoIdNormalizado = ensureRequiredString(blocoId, "blocoId");
  const skinUsernameNormalizado = ensureRequiredString(skinUsername, "skinUsername");
  const normalizedBaseUrl = normalizeBaseUrl(baseUrlInput);
  const fallbackBaseUrl = sanitizeString(process.env.MERCADO_PAGO_BACK_URL_BASE);
  const defaultHostedBaseUrl = `https://${sanitizeString(targetProjectId) || CURRENT_PROJECT_ID}.web.app`;
  const baseUrl =
    isLocalhostUrl(normalizedBaseUrl)
      ? normalizeBaseUrl(fallbackBaseUrl || defaultHostedBaseUrl)
      : normalizedBaseUrl;

  await assertCompraAssinaturaPermitidaPorLocalizacao({
    firestoreDb,
    geo: clientGeo || {},
  });

  if (ownerUserIdNormalizado === compradorUid) {
    throw new HttpsError(
      "failed-precondition",
      "O criador nao pode comprar o proprio bloco."
    );
  }

  const blocoRef = getBlockDocRef(
    ownerUserIdNormalizado,
    espacoIdNormalizado,
    blocoIdNormalizado,
    firestoreDb,
    { targetProjectId, projectSystemKey }
  );
  const blocoSnap = await blocoRef.get();
  if (!blocoSnap.exists) {
    throw new HttpsError("not-found", "Bloco nao encontrado.");
  }

  const blocoData = blocoSnap.data() || {};
  const { precoCentavos, moeda } = ensureValidBlockForPurchase(blocoData);
  assertBlockPaymentMethodEnabled(blocoData, "mercadoPago");
  const buyerContext = await getBuyerContext(compradorUid, firestoreDb, {
    targetProjectId,
    projectSystemKey,
  });

  const alreadyPurchased = await buyerAlreadyHasAccess({
    ownerUserId: ownerUserIdNormalizado,
    espacoId: espacoIdNormalizado,
    blocoId: blocoIdNormalizado,
    compradorUid,
    activeSkinId: buyerContext.activeSkinId,
    firestoreDb,
    targetProjectId,
    projectSystemKey,
  });
  if (alreadyPurchased) {
    return {
      ok: true,
      alreadyPurchased: true,
      message: "Esse bloco ja esta liberado para este comprador.",
    };
  }

  const { accessToken } = await getOwnerMercadoPagoAccessToken(
    ownerUserIdNormalizado,
    firestoreDb,
    targetProjectId,
    projectSystemKey
  );
  const isTestAccessToken = /^TEST-/i.test(accessToken);

  const successUrl = buildMenuUrl({
    baseUrl,
    skinUsername: skinUsernameNormalizado,
    ownerUserId: ownerUserIdNormalizado,
    espacoId: espacoIdNormalizado,
    blocoId: blocoIdNormalizado,
    returnTo,
    mpStatus: "success",
  });
  const pendingUrl = buildMenuUrl({
    baseUrl,
    skinUsername: skinUsernameNormalizado,
    ownerUserId: ownerUserIdNormalizado,
    espacoId: espacoIdNormalizado,
    blocoId: blocoIdNormalizado,
    returnTo,
    mpStatus: "pending",
  });
  const failureUrl = buildMenuUrl({
    baseUrl,
    skinUsername: skinUsernameNormalizado,
    ownerUserId: ownerUserIdNormalizado,
    espacoId: espacoIdNormalizado,
    blocoId: blocoIdNormalizado,
    returnTo,
    mpStatus: "failure",
  });

  const externalReference = `bloco|${ownerUserIdNormalizado}|${espacoIdNormalizado}|${blocoIdNormalizado}|${compradorUid}`;

  const payload = {
    items: [
      {
        id: blocoIdNormalizado,
        title: `Acesso ao bloco ${blocoIdNormalizado}`,
        quantity: 1,
        unit_price: Number((precoCentavos / 100).toFixed(2)),
        currency_id: moeda || "BRL",
      },
    ],
    back_urls: {
      success: successUrl,
      pending: pendingUrl,
      failure: failureUrl,
    },
    external_reference: externalReference,
    metadata: {
      ownerUserId: ownerUserIdNormalizado,
      espacoId: espacoIdNormalizado,
      blocoId: blocoIdNormalizado,
      compradorUid,
      compradorSkinId: buyerContext.activeSkinId || null,
      targetProjectId: sanitizeString(targetProjectId) || CURRENT_PROJECT_ID,
      projectSystemKey: normalizeProjectSystemKey(projectSystemKey) || null,
    },
  };

  if (/^https:\/\//i.test(successUrl) && !isLocalhostUrl(successUrl)) {
    payload.auto_return = "approved";
  }

  const buyerEmail = sanitizeString(authEmail) || buyerContext.email;
  if (buyerEmail) {
    payload.payer = { email: buyerEmail };
  }

  const preference = await fetchMercadoPago("/checkout/preferences", accessToken, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const checkoutUrl =
    isTestAccessToken && sanitizeString(preference?.sandbox_init_point)
      ? preference.sandbox_init_point
      : preference?.init_point;

  if (!preference?.id || !checkoutUrl) {
    throw new HttpsError(
      "internal",
      "Checkout do Mercado Pago nao retornou URL de pagamento."
    );
  }

  await blocoRef.collection("pagamentos").doc(preference.id).set(
    {
      tipo: "mercado_pago_checkout_preference",
      status: "created",
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point || null,
      checkoutUrl,
      isSandbox: isTestAccessToken,
      targetProjectId: sanitizeString(targetProjectId) || CURRENT_PROJECT_ID,
      ownerUserId: ownerUserIdNormalizado,
      espacoId: espacoIdNormalizado,
      blocoId: blocoIdNormalizado,
      compradorUid,
      compradorSkinId: buyerContext.activeSkinId || null,
      precoCentavos,
      moeda,
      projectSystemKey: normalizeProjectSystemKey(projectSystemKey) || null,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    },
    { merge: true }
  );

  return {
    ok: true,
    alreadyPurchased: false,
    preferenceId: preference.id,
    initPoint: preference.init_point,
    sandboxInitPoint: preference.sandbox_init_point || null,
    checkoutUrl,
    isSandbox: isTestAccessToken,
  };
}

async function confirmarPagamentoBlocoMercadoPagoCore({
  firestoreDb = db,
  targetProjectId = CURRENT_PROJECT_ID,
  projectSystemKey = "",
  compradorUid,
  ownerUserId,
  espacoId,
  blocoId,
  paymentId,
}) {
  const ownerUserIdNormalizado = ensureRequiredString(ownerUserId, "ownerUserId");
  const espacoIdNormalizado = ensureRequiredString(espacoId, "espacoId");
  const blocoIdNormalizado = ensureRequiredString(blocoId, "blocoId");
  const paymentIdNormalizado = ensureRequiredString(paymentId, "paymentId");
  const projectSystemKeyNormalizado = normalizeProjectSystemKey(projectSystemKey);

  const blocoRef = getBlockDocRef(
    ownerUserIdNormalizado,
    espacoIdNormalizado,
    blocoIdNormalizado,
    firestoreDb,
    { targetProjectId, projectSystemKey: projectSystemKeyNormalizado }
  );
  const blocoSnap = await blocoRef.get();
  if (!blocoSnap.exists) {
    throw new HttpsError("not-found", "Bloco nao encontrado.");
  }
  const blocoData = blocoSnap.data() || {};
  const { moeda } = ensureValidBlockForPurchase(blocoData);

  const { accessToken } = await getOwnerMercadoPagoAccessToken(
    ownerUserIdNormalizado,
    firestoreDb,
    targetProjectId,
    projectSystemKeyNormalizado
  );
  const payment = await fetchMercadoPago(
    `/v1/payments/${encodeURIComponent(paymentIdNormalizado)}`,
    accessToken,
    {
      method: "GET",
    }
  );

  const referenceData = parseExternalReference(payment?.external_reference);
  const metadata = payment?.metadata || {};
  const ownerFromMetadata = sanitizeString(metadata.ownerUserId);
  const espacoFromMetadata = sanitizeString(metadata.espacoId);
  const blocoFromMetadata = sanitizeString(metadata.blocoId);
  const compradorFromMetadata = sanitizeString(metadata.compradorUid);
  const projectSystemKeyFromMetadata = normalizeProjectSystemKey(metadata.projectSystemKey);

  const metadataMatches =
    ownerFromMetadata === ownerUserIdNormalizado &&
    espacoFromMetadata === espacoIdNormalizado &&
    blocoFromMetadata === blocoIdNormalizado;
  const externalMatches =
    referenceData &&
    referenceData.ownerUserId === ownerUserIdNormalizado &&
    referenceData.espacoId === espacoIdNormalizado &&
    referenceData.blocoId === blocoIdNormalizado;
  const compradorMatchesAuth =
    (metadataMatches && (!compradorFromMetadata || compradorFromMetadata === compradorUid)) ||
    (externalMatches && (!referenceData.compradorUid || referenceData.compradorUid === compradorUid));

  if (!(metadataMatches || externalMatches) || !compradorMatchesAuth) {
    throw new HttpsError(
      "permission-denied",
      "Pagamento nao corresponde ao bloco/usuario informado."
    );
  }

  const paymentStatus = sanitizeString(payment?.status);
  const statusDetail = sanitizeString(payment?.status_detail);
  const transactionAmount = Number(payment?.transaction_amount);
  const amountCentavos = Number.isFinite(transactionAmount)
    ? Math.round(transactionAmount * 100)
    : Number(blocoData?.precoCentavos) || null;

  const projectSystemKeyFinal = projectSystemKeyNormalizado || projectSystemKeyFromMetadata;
  const blocoRefFinal =
    projectSystemKeyFinal && projectSystemKeyFinal !== projectSystemKeyNormalizado
      ? getBlockDocRef(ownerUserIdNormalizado, espacoIdNormalizado, blocoIdNormalizado, firestoreDb, {
          targetProjectId,
          projectSystemKey: projectSystemKeyFinal,
        })
      : blocoRef;
  const buyerContext = await getBuyerContext(compradorUid, firestoreDb, {
    targetProjectId,
    projectSystemKey: projectSystemKeyFinal,
  });
  const compradoresRef = blocoRefFinal.collection("compradores");
  const pagamentoRef = blocoRefFinal.collection("pagamentos").doc(String(paymentIdNormalizado));

  await pagamentoRef.set(
    {
      tipo: "mercado_pago_payment",
      paymentId: String(paymentIdNormalizado),
      status: paymentStatus || "unknown",
      statusDetail: statusDetail || null,
      targetProjectId: sanitizeString(targetProjectId) || CURRENT_PROJECT_ID,
      ownerUserId: ownerUserIdNormalizado,
      espacoId: espacoIdNormalizado,
      blocoId: blocoIdNormalizado,
      compradorUid,
      compradorSkinId: buyerContext.activeSkinId || null,
      amountCentavos: amountCentavos || null,
      moeda: sanitizeString(payment?.currency_id) || moeda,
      projectSystemKey: projectSystemKeyFinal || null,
      raw: payment || null,
      atualizadoEm: serverTimestamp(),
    },
    { merge: true }
  );

  const approved = paymentStatus === "approved";
  if (approved) {
    const basePayload = {
      origem: "mercado_pago",
      paymentId: String(paymentIdNormalizado),
      status: paymentStatus,
      statusDetail: statusDetail || null,
      amountCentavos: amountCentavos || null,
      moeda: sanitizeString(payment?.currency_id) || moeda,
      compradorUid,
      compradorSkinId: buyerContext.activeSkinId || null,
      aprovadoEm: payment?.date_approved || null,
      atualizadoEm: serverTimestamp(),
      criadoEm: serverTimestamp(),
    };

    await compradoresRef.doc(compradorUid).set(
      {
        ...basePayload,
        compradorId: compradorUid,
      },
      { merge: true }
    );

    if (buyerContext.activeSkinId && buyerContext.activeSkinId !== compradorUid) {
      await compradoresRef.doc(buyerContext.activeSkinId).set(
        {
          ...basePayload,
          compradorId: buyerContext.activeSkinId,
        },
        { merge: true }
      );
    }
  }

  return {
    ok: true,
    approved,
    status: paymentStatus || "unknown",
    statusDetail: statusDetail || null,
    paymentId: String(paymentIdNormalizado),
  };
}

exports.bloquearCriacaoUsuarioNaoAdmin = beforeUserCreated(
  IDENTITY_OPTIONS,
  async (event) => {
    await assertAdminOnlyAuthAllowed(event);
  }
);

exports.bloquearLoginUsuarioNaoAdmin = beforeUserSignedIn(
  IDENTITY_OPTIONS,
  async (event) => {
    await assertAdminOnlyAuthAllowed(event);
  }
);

exports.salvarMercadoPagoCredenciais = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = ensureAuth(request);
  return salvarMercadoPagoCredenciaisCore({
    firestoreDb: db,
    uid,
    accessToken: request.data?.accessToken,
    publicKey: request.data?.publicKey,
  });
});

exports.obterStatusMercadoPago = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = ensureAuth(request);
  return obterStatusMercadoPagoCore({ firestoreDb: db, uid });
});

exports.desconectarMercadoPago = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = ensureAuth(request);
  return desconectarMercadoPagoCore({ firestoreDb: db, uid });
});

exports.salvarPixManualConfig = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = ensureAuth(request);
  const enabled = Boolean(request.data?.enabled);
  const chavePix = sanitizeString(request.data?.chavePix);
  const nomeRecebedor = sanitizeString(request.data?.nomeRecebedor);
  const cidadeRecebedor = sanitizeString(request.data?.cidadeRecebedor);
  const instrucoes = sanitizeString(request.data?.instrucoes);
  const pixCopiaECola = sanitizeString(request.data?.pixCopiaECola);

  if (enabled && !chavePix) {
    throw new HttpsError("invalid-argument", "Informe a chave PIX para ativar pagamento manual.");
  }

  await getOwnerPixManualRef(uid).set(
    {
      enabled,
      chavePix: chavePix || null,
      nomeRecebedor: nomeRecebedor || null,
      cidadeRecebedor: cidadeRecebedor || null,
      instrucoes: instrucoes || null,
      pixCopiaECola: pixCopiaECola || null,
      updatedAt: serverTimestamp(),
      connectedAt: enabled ? serverTimestamp() : null,
    },
    { merge: true }
  );

  return {
    ok: true,
    conectado: Boolean(enabled && chavePix),
    enabled,
    hasPixCopiaECola: Boolean(pixCopiaECola),
  };
});

exports.obterStatusPixManual = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = ensureAuth(request);
  const pixSnap = await getOwnerPixManualRef(uid).get();
  const pixData = pixSnap.exists ? pixSnap.data() : {};

  const enabled = Boolean(pixData?.enabled);
  const chavePix = sanitizeString(pixData?.chavePix);

  return {
    conectado: Boolean(enabled && chavePix),
    enabled,
    chavePix: chavePix || "",
    nomeRecebedor: sanitizeString(pixData?.nomeRecebedor) || "",
    cidadeRecebedor: sanitizeString(pixData?.cidadeRecebedor) || "",
    instrucoes: sanitizeString(pixData?.instrucoes) || "",
    pixCopiaECola: sanitizeString(pixData?.pixCopiaECola) || "",
  };
});

exports.obterCheckoutPixManualBloco = onCall(CALLABLE_OPTIONS, async (request) => {
  const compradorUid = ensureAuth(request);
  const ownerUserId = ensureRequiredString(request.data?.ownerUserId, "ownerUserId");
  const espacoId = ensureRequiredString(request.data?.espacoId, "espacoId");
  const blocoId = ensureRequiredString(request.data?.blocoId, "blocoId");

  if (ownerUserId === compradorUid) {
    throw new HttpsError(
      "failed-precondition",
      "O criador nao pode comprar o proprio bloco."
    );
  }

  const blocoRef = getBlockDocRef(ownerUserId, espacoId, blocoId);
  const blocoSnap = await blocoRef.get();
  if (!blocoSnap.exists) {
    throw new HttpsError("not-found", "Bloco nao encontrado.");
  }

  const blocoData = blocoSnap.data() || {};
  const { precoCentavos, moeda } = ensureValidBlockForPurchase(blocoData);
  assertBlockPaymentMethodEnabled(blocoData, "pixManual");
  const buyerContext = await getBuyerContext(compradorUid);

  const alreadyPurchased = await buyerAlreadyHasAccess({
    ownerUserId,
    espacoId,
    blocoId,
    compradorUid,
    activeSkinId: buyerContext.activeSkinId,
  });
  if (alreadyPurchased) {
    return {
      ok: true,
      alreadyPurchased: true,
      message: "Esse bloco ja esta liberado para este comprador.",
    };
  }

  const pixSnap = await getOwnerPixManualRef(ownerUserId).get();
  const pixData = pixSnap.exists ? pixSnap.data() : {};
  const enabled = Boolean(pixData?.enabled);
  const chavePix = sanitizeString(pixData?.chavePix);

  if (!enabled || !chavePix) {
    throw new HttpsError(
      "failed-precondition",
      "Pagamento manual por PIX indisponivel para este criador."
    );
  }

  return {
    ok: true,
    alreadyPurchased: false,
    bloco: {
      blocoId,
      espacoId,
      ownerUserId,
      precoCentavos,
      moeda,
    },
    pagamento: {
      tipo: "pix_manual",
      chavePix,
      nomeRecebedor: sanitizeString(pixData?.nomeRecebedor) || "",
      cidadeRecebedor: sanitizeString(pixData?.cidadeRecebedor) || "",
      instrucoes: sanitizeString(pixData?.instrucoes) || "",
      pixCopiaECola: sanitizeString(pixData?.pixCopiaECola) || "",
    },
  };
});

exports.notificarAdminNovaSolicitacaoPix = onDocumentCreated(
  {
    region: REGION,
    document: "users/{ownerUserId}/pedidos/{pedidoId}",
    ...(runtimeServiceAccount ? { serviceAccount: runtimeServiceAccount } : {}),
  },
  async (event) => {
    try {
      const ownerUserId = sanitizeString(event?.params?.ownerUserId);
      const pedidoId = sanitizeString(event?.params?.pedidoId);
      const pedidoData = event?.data?.data() || {};
      if (!ownerUserId || !pedidoId) return;

      const status = sanitizeString(pedidoData?.status).toLowerCase();
      if (status && status !== "pedido_solicitado") {
        return;
      }

      const ownerRef = db.doc(`users/${ownerUserId}`);
      const ownerSnap = await ownerRef.get();
      if (!ownerSnap.exists) {
        return;
      }

      const ownerData = ownerSnap.data() || {};
      const tokens = normalizePushTokens([
        ...(Array.isArray(ownerData?.ownerPushTokens) ? ownerData.ownerPushTokens : []),
        ...(Array.isArray(ownerData?.adminPushTokens) ? ownerData.adminPushTokens : []),
      ]);
      if (!tokens.length) {
        console.log(
          `[PUSH-SOLICITACAO] Owner sem token registrado. owner=${ownerUserId}, pedido=${pedidoId}`
        );
        return;
      }

      const blocoId = sanitizeString(pedidoData?.blocoId);
      const espacoId = sanitizeString(pedidoData?.espacoId);
      const compradorNome =
        sanitizeString(pedidoData?.compradorNome) ||
        sanitizeString(pedidoData?.compradorEmail) ||
        sanitizeString(pedidoData?.compradorUid) ||
        "Usuario";
      const valor = formatarValorCentavos(pedidoData?.precoCentavos);
      const body = valor
        ? `${compradorNome} solicitou desbloqueio de ${valor}.`
        : `${compradorNome} solicitou desbloqueio de bloco.`;
      const link = `/menu/owner/solicitacoes?ownerUserId=${encodeURIComponent(ownerUserId)}`;

      const result = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title: "Nova solicitacao de desbloqueio",
          body,
        },
        data: {
          type: "solicitacao_desbloqueio",
          ownerUserId,
          pedidoId,
          blocoId,
          espacoId,
          link,
        },
        android: {
          priority: "high",
          notification: {
            sound: "default",
            channelId: "solicitacoes",
          },
        },
        webpush: {
          fcmOptions: {
            link,
          },
          notification: {
            title: "Nova solicitacao de desbloqueio",
            body,
            icon: "/favicon.ico",
            badge: "/favicon.ico",
          },
        },
      });

      const invalidTokens = [];
      result.responses.forEach((responseItem, index) => {
        if (responseItem.success) return;
        const code = sanitizeString(responseItem?.error?.code);
        if (
          code === "messaging/invalid-registration-token" ||
          code === "messaging/registration-token-not-registered"
        ) {
          invalidTokens.push(tokens[index]);
        }
      });

      if (invalidTokens.length) {
        await ownerRef.set(
          {
            ownerPushTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
            ownerPushTokensUpdatedAt: serverTimestamp(),
            adminPushTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
            adminPushTokensUpdatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch (error) {
      console.error("[PUSH-SOLICITACAO] Falha ao enviar notificacao:", error);
    }
  }
);

async function limparEnvsProjetoNoVercelCore({ systemKey = "" } = {}) {
  const systemKeyNormalizado = ensureRequiredString(systemKey, "systemKey");
  const systemKeyOriginal = sanitizeString(systemKey);
  const envPrefixSuffix = normalizeSystemKeyToEnvPrefix(systemKeyNormalizado);
  if (!envPrefixSuffix) {
    throw new HttpsError("invalid-argument", "systemKey invalida.");
  }

  const { token, projectId, teamId } = getVercelRuntimeConfig();
  if (!token || !projectId) {
    throw new HttpsError(
      "failed-precondition",
      "Defina VERCEL_TOKEN e VERCEL_PROJECT_ID no ambiente das Functions."
    );
  }

  const envPrefix = `REACT_APP_FIREBASE_${envPrefixSuffix}_`;
  const listResponse = await callVercelApi({
    token,
    teamId,
    method: "GET",
    pathname: `/v10/projects/${encodeURIComponent(projectId)}/env`,
    query: { limit: 100, decrypt: "true" },
  });

  const envs = Array.isArray(listResponse?.envs) ? listResponse.envs : [];
  const prefixedEnvs = envs.filter((item) =>
    sanitizeString(item?.key).startsWith(envPrefix)
  );
  const removedKeys = new Set();

  for (const envItem of prefixedEnvs) {
    const envId = sanitizeString(envItem?.id);
    if (!envId) continue;

    await callVercelApi({
      token,
      teamId,
      method: "DELETE",
      pathname: `/v10/projects/${encodeURIComponent(projectId)}/env/${encodeURIComponent(envId)}`,
    });

    removedKeys.add(sanitizeString(envItem?.key));
  }

  const projectKeysToken = envPrefixSuffix;
  const projectKeysEnvs = envs.filter(
    (item) => sanitizeString(item?.key) === "REACT_APP_FIREBASE_PROJECT_KEYS"
  );
  let updatedProjectKeysCount = 0;
  let skippedProjectKeysCount = 0;

  for (const envItem of projectKeysEnvs) {
    const envId = sanitizeString(envItem?.id);
    const rawValue = sanitizeString(envItem?.value);
    if (!envId || !rawValue) {
      skippedProjectKeysCount += 1;
      continue;
    }

    const keysAtuais = parseCsv(rawValue).map((item) => item.toUpperCase());
    const keysFiltradas = keysAtuais.filter((item) => item !== projectKeysToken);

    if (keysFiltradas.length === keysAtuais.length) {
      continue;
    }

    const target = Array.isArray(envItem?.target) ? envItem.target : [];
    const type = sanitizeString(envItem?.type) || "encrypted";
    const customEnvironmentIds = Array.isArray(envItem?.customEnvironmentIds)
      ? envItem.customEnvironmentIds
          .map((item) => sanitizeString(item))
          .filter(Boolean)
      : [];

    await callVercelApi({
      token,
      teamId,
      method: "DELETE",
      pathname: `/v10/projects/${encodeURIComponent(projectId)}/env/${encodeURIComponent(envId)}`,
    });

    if (keysFiltradas.length > 0) {
      await callVercelApi({
        token,
        teamId,
        method: "POST",
        pathname: `/v10/projects/${encodeURIComponent(projectId)}/env`,
        body: {
          key: "REACT_APP_FIREBASE_PROJECT_KEYS",
          value: keysFiltradas.join(","),
          type,
          target,
          ...(customEnvironmentIds.length > 0
            ? { customEnvironmentIds }
            : {}),
        },
      });
    }

    updatedProjectKeysCount += 1;
  }

  return {
    ok: true,
    systemKey: sanitizeString(systemKeyOriginal || systemKeyNormalizado).toLowerCase(),
    envPrefix,
    removedCount: prefixedEnvs.length,
    removedKeys: Array.from(removedKeys.values()),
    updatedProjectKeysCount,
    skippedProjectKeysCount,
  };
}

exports.limparEnvsProjetoNoVercel = onCall(CALLABLE_OPTIONS, async (request) => {
  await assertSystemManagerAdminPermission(request);
  return limparEnvsProjetoNoVercelCore({
    systemKey: request.data?.systemKey,
  });
});

exports.limparEnvsProjetoNoVercelHttp = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        throw new HttpsError("failed-precondition", "Metodo nao permitido.");
      }

      const body = normalizeRequestBody(req);
      const token = getBearerToken(req);
      const { decoded } = await verifySharedBucketIdToken(token);
      await assertSystemManagerAdminIdentity({
        uid: decoded?.uid,
        email: decoded?.email,
      });

      const result = await limparEnvsProjetoNoVercelCore({
        systemKey: body?.systemKey,
      });
      res.json(result);
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.criarCheckoutBlocoMercadoPago = onCall(CALLABLE_OPTIONS, async (request) => {
  const compradorUid = ensureAuth(request);
  const clientGeo = await resolveGeoDataFromRequest(request.rawRequest || {}, {});
  return criarCheckoutBlocoMercadoPagoCore({
    firestoreDb: db,
    targetProjectId: CURRENT_PROJECT_ID,
    clientGeo,
    compradorUid,
    authEmail: request?.auth?.token?.email,
    ownerUserId: request.data?.ownerUserId,
    espacoId: request.data?.espacoId,
    blocoId: request.data?.blocoId,
    skinUsername: request.data?.skinUsername,
    baseUrlInput: request.data?.baseUrl,
    returnTo: request.data?.returnTo,
  });
});

exports.confirmarPagamentoBlocoMercadoPago = onCall(CALLABLE_OPTIONS, async (request) => {
  const compradorUid = ensureAuth(request);
  return confirmarPagamentoBlocoMercadoPagoCore({
    firestoreDb: db,
    targetProjectId: CURRENT_PROJECT_ID,
    compradorUid,
    ownerUserId: request.data?.ownerUserId,
    espacoId: request.data?.espacoId,
    blocoId: request.data?.blocoId,
    paymentId: request.data?.paymentId,
  });
});

async function getUnifiedMercadoPagoHttpContext(req, { resolveFirestoreDb = true } = {}) {
  if (req.method !== "POST") {
    throw new HttpsError("failed-precondition", "Metodo nao permitido.");
  }

  const body = normalizeRequestBody(req);
  const token = getBearerToken(req);
  const { decoded, projectId: sourceAuthProjectId } = await verifySharedBucketIdToken(token);
  const targetProjectId = ensureAllowedTargetProjectId(
    body?.targetProjectId,
    sourceAuthProjectId
  );
  const projectSystemKey = normalizeProjectSystemKey(body?.projectSystemKey);

  return {
    body,
    decoded,
    sourceAuthProjectId,
    targetProjectId,
    projectSystemKey,
    firestoreDb: resolveFirestoreDb
      ? getProjectDb(targetProjectId, sourceAuthProjectId)
      : null,
  };
}

exports.mercadoPagoSalvarCredenciaisHttp = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    try {
      const { body, decoded, targetProjectId, projectSystemKey } = await getUnifiedMercadoPagoHttpContext(req, {
        resolveFirestoreDb: false,
      });
      const result = await salvarMercadoPagoCredenciaisCore({
        targetProjectId,
        projectSystemKey,
        uid: decoded.uid,
        accessToken: body?.accessToken,
        publicKey: body?.publicKey,
      });
      res.json(result);
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.mercadoPagoObterStatusHttp = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    try {
      const { decoded, targetProjectId, projectSystemKey } = await getUnifiedMercadoPagoHttpContext(req, {
        resolveFirestoreDb: false,
      });
      const result = await obterStatusMercadoPagoCore({
        targetProjectId,
        projectSystemKey,
        uid: decoded.uid,
      });
      res.json(result);
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.mercadoPagoDesconectarHttp = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    try {
      const { decoded, targetProjectId, projectSystemKey } = await getUnifiedMercadoPagoHttpContext(req, {
        resolveFirestoreDb: false,
      });
      const result = await desconectarMercadoPagoCore({
        targetProjectId,
        projectSystemKey,
        uid: decoded.uid,
      });
      res.json(result);
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.mercadoPagoCriarCheckoutHttp = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    try {
      const { body, decoded, targetProjectId, projectSystemKey, firestoreDb } =
        await getUnifiedMercadoPagoHttpContext(req);
      const clientGeo = await resolveGeoDataFromRequest(req, body || {});
      const result = await criarCheckoutBlocoMercadoPagoCore({
        firestoreDb,
        targetProjectId,
        projectSystemKey,
        clientGeo,
        compradorUid: decoded.uid,
        authEmail: decoded.email,
        ownerUserId: body?.ownerUserId,
        espacoId: body?.espacoId,
        blocoId: body?.blocoId,
        skinUsername: body?.skinUsername,
        baseUrlInput: body?.baseUrl,
        returnTo: body?.returnTo,
      });
      res.json(result);
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.mercadoPagoConfirmarPagamentoHttp = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    try {
      const { body, decoded, targetProjectId, projectSystemKey, firestoreDb } =
        await getUnifiedMercadoPagoHttpContext(req);
      const result = await confirmarPagamentoBlocoMercadoPagoCore({
        firestoreDb,
        targetProjectId,
        projectSystemKey,
        compradorUid: decoded.uid,
        ownerUserId: body?.ownerUserId,
        espacoId: body?.espacoId,
        blocoId: body?.blocoId,
        paymentId: body?.paymentId,
      });
      res.json(result);
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.uploadArquivoBucketCompartilhado = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Metodo nao permitido." });
        return;
      }

      const body = normalizeRequestBody(req);
      const token = getBearerToken(req);
      const { decoded } = await verifySharedBucketIdToken(token);
      const path = ensureRequiredString(body?.path, "path");
      const declaredContentType = sanitizeString(body?.contentType);
      const { buffer, mimeFromDataUrl } = decodeBase64Payload(body?.base64);
      const contentType = declaredContentType || mimeFromDataUrl || "application/octet-stream";

      if (!contentType.toLowerCase().startsWith("image/")) {
        throw new HttpsError("invalid-argument", "Somente imagem e permitida.");
      }

      if (buffer.length > 15 * 1024 * 1024) {
        throw new HttpsError("invalid-argument", "Arquivo acima de 15MB.");
      }

      if (!canAccessSharedBucketPath(path, decoded.uid)) {
        throw new HttpsError(
          "permission-denied",
          "Voce so pode enviar arquivos para sua propria pasta."
        );
      }

      const bucket = admin.storage().bucket(SHARED_BUCKET_NAME);
      const file = bucket.file(path);
      const tokenDownload = randomUUID();

      await file.save(buffer, {
        resumable: false,
        metadata: {
          contentType,
          metadata: {
            firebaseStorageDownloadTokens: tokenDownload,
          },
        },
      });

      res.json({
        ok: true,
        path,
        bucket: bucket.name,
        url: buildTokenizedStorageUrl(bucket.name, path, tokenDownload),
      });
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.obterUrlArquivoBucketCompartilhado = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Metodo nao permitido." });
        return;
      }

      const body = normalizeRequestBody(req);
      const token = getBearerToken(req);
      await verifySharedBucketIdToken(token);

      const path = ensureRequiredString(body?.path, "path");
      const bucket = admin.storage().bucket(SHARED_BUCKET_NAME);
      const file = bucket.file(path);

      const [exists] = await file.exists();
      if (!exists) {
        throw new HttpsError("not-found", "Arquivo nao encontrado.");
      }

      const [metadata] = await file.getMetadata();
      let tokenDownload = sanitizeString(metadata?.metadata?.firebaseStorageDownloadTokens);
      if (tokenDownload.includes(",")) {
        tokenDownload = sanitizeString(tokenDownload.split(",")[0]);
      }

      if (!tokenDownload) {
        tokenDownload = randomUUID();
        await file.setMetadata({
          metadata: {
            ...(metadata?.metadata || {}),
            firebaseStorageDownloadTokens: tokenDownload,
          },
        });
      }

      res.json({
        ok: true,
        path,
        bucket: bucket.name,
        url: buildTokenizedStorageUrl(bucket.name, path, tokenDownload),
      });
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.registrarAcessoPublico = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Metodo nao permitido." });
        return;
      }

      const body = normalizeRequestBody(req);
      const hostname = normalizeHostValue(body?.hostname);
      const fullPath = sanitizeString(body?.fullPath || body?.path || "/").slice(0, 300);
      const managerDb = getSystemManagerDb();
      const requestIp = extractClientIp(req) || sanitizeString(body?.ip || body?.geo?.ip);
      const projectSystemKey = normalizeProjectSystemKey(body?.projectSystemKey);

      let accessConfig = {};
      try {
        const configRefs = projectSystemKey
          ? [
              managerDb.doc(`projetos/${projectSystemKey}/add_ons/sistema_config`),
              managerDb.doc("add_ons/sistema_config"),
            ]
          : [managerDb.doc("add_ons/sistema_config")];
        for (const configRef of configRefs) {
          const configSnap = await configRef.get();
          if (configSnap.exists) {
            accessConfig = configSnap.data() || {};
            break;
          }
        }
      } catch {
        accessConfig = {};
      }

      const origemRastreavel = sanitizeString(body?.origemRastreavel);
      const trackingId = sanitizeString(body?.trackingId);
      const acessoDireto =
        origemRastreavel !== "link_rastreavel" &&
        !trackingId;
      if (
        accessConfig?.rastreabilidadeAcessosHabilitada === true &&
        accessConfig?.registrarAcessoDiretoRastreabilidade === false &&
        acessoDireto
      ) {
        res.json({
          ok: true,
          skipped: true,
          reason: "direct_access_tracking_disabled",
        });
        return;
      }

      const userBlockMatch = await resolveAccessRegistrationUserBlockMatch(managerDb, body);
      if (userBlockMatch.blocked) {
        const markedCount = await markAccessRecordsBlockedByNavigationIds(
          managerDb,
          resolveAccessNavigationIdCandidates(body),
          {
            bloqueadoPor: "user_blocked",
            uidBloqueado: sanitizeString(body?.uid) || null,
            emailBloqueado: sanitizeString(body?.email) || null,
            usuarioBloqueado: userBlockMatch.matchedIdentifier || null,
          }
        );

        res.json({
          ok: true,
          blocked: true,
          reason: "user_blocked",
          markedCount,
        });
        return;
      }

      if (await isAccessRegistrationIpBlocked(managerDb, requestIp)) {
        res.json({
          ok: true,
          blocked: true,
          reason: "ip_blocked",
        });
        return;
      }

      const geo = await resolveGeoDataFromRequest(req, body || {});
      const clientIp = sanitizeString(geo?.ip) || null;

      if (await isAccessRegistrationIpBlocked(managerDb, clientIp)) {
        res.json({
          ok: true,
          blocked: true,
          reason: "ip_blocked",
          geo,
        });
        return;
      }

      const geoPayload = {
        ip: clientIp,
        country: sanitizeString(geo?.country) || null,
        region: sanitizeString(geo?.region) || null,
        city: sanitizeString(geo?.city) || null,
        org: sanitizeString(geo?.org) || null,
        cep: sanitizeString(geo?.cep) || null,
        logradouro: sanitizeString(geo?.logradouro) || null,
        bairro: sanitizeString(geo?.bairro) || null,
        cidade: sanitizeString(geo?.cidade) || null,
        uf: sanitizeString(geo?.uf) || null,
        regionCode: sanitizeString(geo?.regionCode || geo?.uf) || null,
        latitude: Number.isFinite(Number(geo?.latitude)) ? Number(geo.latitude) : null,
        longitude: Number.isFinite(Number(geo?.longitude)) ? Number(geo.longitude) : null,
        resolvedAt: Number.isFinite(Number(geo?.resolvedAt)) ? Number(geo.resolvedAt) : null,
        source: sanitizeString(geo?._geoSource) || null,
        error: sanitizeString(geo?._geoError) || null,
      };

      await managerDb.collection("acessos").add({
        uid: sanitizeString(body?.uid) || null,
        email: sanitizeString(body?.email) || null,
        displayName: sanitizeString(body?.displayName) || null,
        perfilAcesso: sanitizeString(body?.perfilAcesso) || "visitante",
        autenticado: Boolean(body?.autenticado),
        navigationId:
          sanitizeString(
            body?.navigationId || body?.visitorHash || body?.hash || body?.navegacaoHash
          ) || null,
        trackingId: sanitizeString(body?.trackingId) || null,
        trackingTipo: sanitizeString(body?.trackingTipo) || null,
        trackingDestinoTipo: sanitizeString(body?.trackingDestinoTipo) || null,
        trackingDestinoUrl: sanitizeString(body?.trackingDestinoUrl) || null,
        trackingOrigemPlanejada: sanitizeString(body?.trackingOrigemPlanejada) || null,
        origemRastreavel: sanitizeString(body?.origemRastreavel) || null,

        projectSystemKey: sanitizeString(body?.projectSystemKey) || null,
        projectNome: sanitizeString(body?.projectNome) || null,
        runtimeProjectKey: sanitizeString(body?.runtimeProjectKey) || null,
        runtimeProjectId: sanitizeString(body?.runtimeProjectId) || null,
        tipoExperiencia: sanitizeString(body?.tipoExperiencia) || null,
        modoAcessoProjeto: sanitizeString(body?.modoAcessoProjeto) || null,
        statusProjeto: sanitizeString(body?.statusProjeto) || null,
        skinUsername: sanitizeString(body?.skinUsername) || null,
        skinId: sanitizeString(body?.skinId) || null,
        skinUsernameRota: sanitizeString(body?.skinUsernameRota) || null,

        hostname: hostname || null,
        path: sanitizeString(body?.path) || "/",
        search: sanitizeString(body?.search) || "",
        urlHash: sanitizeString(body?.urlHash) || "",
        fullPath,
        userAgent: sanitizeString(body?.userAgent) || null,
        eventoTipo: sanitizeString(body?.eventoTipo) || "page_view",
        eventoAcao: sanitizeString(body?.eventoAcao) || null,
        pageSessionId: sanitizeString(body?.pageSessionId) || null,
        elementoTag: sanitizeString(body?.elementoTag) || null,
        elementoId: sanitizeString(body?.elementoId) || null,
        elementoTexto: sanitizeString(body?.elementoTexto) || null,
        elementoHref: sanitizeString(body?.elementoHref) || null,
        origemEspacoId: sanitizeString(body?.origemEspacoId) || null,
        origemEspacoNome: sanitizeString(body?.origemEspacoNome) || null,
        origemRota: sanitizeString(body?.origemRota) || null,
        destinoEspacoId: sanitizeString(body?.destinoEspacoId) || null,
        destinoEspacoNome: sanitizeString(body?.destinoEspacoNome) || null,
        destinoRota: sanitizeString(body?.destinoRota) || null,
        duracaoMs: Number.isFinite(Number(body?.duracaoMs)) ? Number(body?.duracaoMs) : null,
        documentVisibility: sanitizeString(
          body?.documentVisibility || body?.visibilityState
        ) || null,
        registroMotivo: sanitizeString(body?.registroMotivo || body?.motivoRegistro) || null,
        pageOpenedAtMs: Number.isFinite(Number(body?.pageOpenedAtMs))
          ? Number(body.pageOpenedAtMs)
          : null,
        tempoDesdeAberturaMs: Number.isFinite(Number(body?.tempoDesdeAberturaMs))
          ? Number(body.tempoDesdeAberturaMs)
          : null,
        clientCapturedAtMs: Number.isFinite(Number(body?.clientCapturedAtMs))
          ? Number(body.clientCapturedAtMs)
          : null,

        ip: geoPayload.ip,
        country: geoPayload.country,
        region: geoPayload.region,
        city: geoPayload.city,
        org: geoPayload.org,
        cep: geoPayload.cep,
        logradouro: geoPayload.logradouro,
        bairro: geoPayload.bairro,
        cidade: geoPayload.cidade,
        uf: geoPayload.uf,
        latitude: geoPayload.latitude,
        longitude: geoPayload.longitude,
        geoSource: geoPayload.source,
        geoError: geoPayload.error,
        geo: geoPayload,

        visto: false,
        origem: "cliente-web",
        data: serverTimestamp(),
        criadoEm: serverTimestamp(),
      });

      res.json({ ok: true, geo });
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.resolverGeoAcessoPublico = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Metodo nao permitido." });
        return;
      }

      const body = normalizeRequestBody(req);
      const geo = await resolveGeoDataFromRequest(req, body || {});
      res.json({ ok: true, geo });
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.resolverProjetoPorDominioPublico = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    try {
      const hostname =
        normalizeHostValue(req.query?.hostname) ||
        normalizeHostValue(req.query?.host) ||
        normalizeHostValue(normalizeRequestBody(req)?.hostname) ||
        normalizeHostValue(normalizeRequestBody(req)?.host);

      if (!hostname) {
        throw new HttpsError("invalid-argument", "Hostname obrigatorio.");
      }

      const managerDb = getSystemManagerDb();
      const systemsSnap = await managerDb
        .collection("systems")
        .where("domains", "array-contains", hostname)
        .limit(1)
        .get();

      if (!systemsSnap.empty) {
        const docSnap = systemsSnap.docs[0];
        const data = docSnap.data() || {};
        const runtimeConfig =
          data?.firebaseRuntimeConfig && typeof data.firebaseRuntimeConfig === "object"
            ? data.firebaseRuntimeConfig
            : {};
        const firebaseProjectId =
          sanitizeString(runtimeConfig.projectId) || sanitizeString(data.firebaseProjectId);

        if (firebaseProjectId) {
          res.json({
            ok: true,
            hostname,
            firebaseProjectId,
            systemKey: sanitizeString(data.systemKey || docSnap.id).toLowerCase(),
          });
          return;
        }
      }

      if (isSystemManagerPublicHost(hostname)) {
        res.json({
          ok: true,
          hostname,
          firebaseProjectId: SYSTEM_MANAGER_PROJECT_ID,
          systemKey: SYSTEM_MANAGER_PROJECT_ID,
        });
        return;
      }

      if (isCurrentProjectPublicHost(hostname)) {
        res.json({
          ok: true,
          hostname,
          firebaseProjectId: CURRENT_PROJECT_ID,
          systemKey: CURRENT_PROJECT_ID,
        });
        return;
      }

      res.status(404).json({
        ok: false,
        code: "not-found",
        error: "Dominio nao vinculado a nenhum projeto.",
      });
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.listarUsuariosGerenciadorHttp = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    if (handleHttpCorsPreflight(req, res)) return;

    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Metodo nao permitido." });
        return;
      }

      const body = normalizeRequestBody(req);
      const token = getBearerToken(req);
      const { decoded } = await verifySharedBucketIdToken(token);
      await assertSystemManagerAdminIdentity({
        uid: decoded?.uid,
        email: decoded?.email,
      });

      const maxItems = Math.min(Math.max(Number(body?.limit) || 1500, 1), 5000);
      const managerDb = getSystemManagerDb();
      const snap = await managerDb
        .collection("usuarios_projetos")
        .orderBy("updatedAt", "desc")
        .limit(maxItems)
        .get();

      res.json({
        ok: true,
        items: snap.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        })),
      });
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.removerRegistrosUsuarioGerenciadorHttp = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    if (handleHttpCorsPreflight(req, res)) return;

    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Metodo nao permitido." });
        return;
      }

      const body = normalizeRequestBody(req);
      const token = getBearerToken(req);
      const { decoded } = await verifySharedBucketIdToken(token);
      await assertSystemManagerAdminIdentity({
        uid: decoded?.uid,
        email: decoded?.email,
      });

      const ids = normalizeAccessDocIds(body?.ids || body?.registroIds || body?.userRecordIds);
      const uid = sanitizeString(body?.uid || body?.userUid || body?.ownerUid);
      const emailRaw = sanitizeString(body?.email || body?.emailGoogle || body?.emailUser);
      const email = emailRaw.toLowerCase();
      const navigationId = sanitizeString(
        body?.navigationId || body?.visitorHash || body?.hash || body?.navegacaoHash
      );

      if (!ids.length && !uid && !email && !navigationId) {
        throw new HttpsError(
          "invalid-argument",
          "Informe ids, uid, email ou identificador de navegacao do usuario."
        );
      }

      const managerDb = getSystemManagerDb();
      const refsByPath = new Map();
      const addRef = (ref) => {
        if (!ref?.path || refsByPath.has(ref.path)) return;
        refsByPath.set(ref.path, ref);
      };

      ids.forEach((id) => addRef(managerDb.collection("usuarios_projetos").doc(id)));

      const queryByField = async (field, value) => {
        const normalizedValue = sanitizeString(value);
        if (!normalizedValue) return;
        const snap = await managerDb
          .collection("usuarios_projetos")
          .where(field, "==", normalizedValue)
          .limit(500)
          .get();
        snap.docs.forEach((docItem) => addRef(docItem.ref));
      };

      await Promise.all([
        queryByField("uid", uid),
        queryByField("userUid", uid),
        queryByField("ownerUid", uid),
        queryByField("emailGoogle", emailRaw),
        queryByField("emailGoogle", email),
        queryByField("email", emailRaw),
        queryByField("email", email),
        queryByField("emailUser", emailRaw),
        queryByField("emailUser", email),
        queryByField("ownerEmail", emailRaw),
        queryByField("ownerEmail", email),
        queryByField("navigationId", navigationId),
        queryByField("visitorHash", navigationId),
        queryByField("hash", navigationId),
        queryByField("navegacaoHash", navigationId),
      ]);

      const refs = Array.from(refsByPath.values());
      const snapshots = await Promise.all(refs.map((ref) => ref.get().catch(() => null)));
      const existentes = snapshots.filter((snap) => snap?.exists);

      for (let index = 0; index < existentes.length; index += 450) {
        const batch = managerDb.batch();
        existentes.slice(index, index + 450).forEach((snap) => {
          batch.delete(snap.ref);
        });
        await batch.commit();
      }

      const idsRemovidos = existentes.map((snap) => snap.id);
      await writeAuditLog(managerDb, {
        action: "removeu_registros_usuario",
        entityType: "usuario_projeto",
        entityId: uid || email || navigationId || idsRemovidos[0] || "bulk",
        actorUid: decoded?.uid,
        actorEmail: decoded?.email,
        motivo: sanitizeString(body?.motivo) || "remocao_gerenciador_users",
        source: "gerenciador_function",
        snapshotAntes: {
          criterios: {
            ids,
            uid,
            email,
            navigationId,
          },
          registros: existentes.map((snap) => ({ id: snap.id, ...(snap.data() || {}) })),
        },
        metadata: {
          totalRemovido: idsRemovidos.length,
        },
      });

      res.json({
        ok: true,
        total: idsRemovidos.length,
        ids: idsRemovidos,
      });
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.listarAcessosGerenciadorHttp = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    if (handleHttpCorsPreflight(req, res)) return;

    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Metodo nao permitido." });
        return;
      }

      const body = normalizeRequestBody(req);
      const token = getBearerToken(req);
      const { decoded } = await verifySharedBucketIdToken(token);
      await assertSystemManagerAdminIdentity({
        uid: decoded?.uid,
        email: decoded?.email,
      });

      const maxItems = Math.min(Math.max(Number(body?.limit) || 100, 1), 500);
      const projectSystemKey = sanitizeString(body?.projectSystemKey).toLowerCase();
      const startDate = sanitizeString(body?.startDate);
      const endDate = sanitizeString(body?.endDate);
      const startDateObject = startDate ? new Date(`${startDate}T00:00:00.000`) : null;
      const endDateObject = endDate ? new Date(`${endDate}T23:59:59.999`) : null;
      const startAt =
        startDateObject && !Number.isNaN(startDateObject.getTime())
          ? admin.firestore.Timestamp.fromDate(startDateObject)
          : null;
      const endAt =
        endDateObject && !Number.isNaN(endDateObject.getTime())
          ? admin.firestore.Timestamp.fromDate(endDateObject)
          : null;
      const managerDb = getSystemManagerDb();
      let ref = managerDb.collection("acessos");

      if (projectSystemKey) {
        ref = ref.where("projectSystemKey", "==", projectSystemKey);
      }
      if (startAt) {
        ref = ref.where("data", ">=", startAt);
      }
      if (endAt) {
        ref = ref.where("data", "<=", endAt);
      }

      const snap = await ref.orderBy("data", "desc").limit(maxItems).get();

      res.json({
        ok: true,
        items: snap.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        })),
      });
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.listarLinksRastreaveisGerenciadorHttp = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    if (handleHttpCorsPreflight(req, res)) return;

    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Metodo nao permitido." });
        return;
      }

      const body = normalizeRequestBody(req);
      const token = getBearerToken(req);
      const { decoded } = await verifySharedBucketIdToken(token);
      await assertSystemManagerAdminIdentity({
        uid: decoded?.uid,
        email: decoded?.email,
      });

      const maxItems = Math.min(Math.max(Number(body?.limit) || 300, 1), 800);
      const projectSystemKey = sanitizeString(body?.projectSystemKey).toLowerCase();
      const managerDb = getSystemManagerDb();
      const linkDocs = await listTrackableLinkDocsAcrossRuntimeDbs(managerDb, {
        projectSystemKey,
        maxItems,
      });

      res.json({
        ok: true,
        items: linkDocs.map((docItem) => {
          const data = docItem.data() || {};
          const pathProjectKey = resolveProjectSystemKeyFromDocRef(docItem);
          const runtimeProjectKey =
            sanitizeString(data?.runtimeProjectKey).toLowerCase() ||
            pathProjectKey;
          const itemProjectSystemKey =
            sanitizeString(data?.projectSystemKey).toLowerCase() ||
            pathProjectKey ||
            runtimeProjectKey;

          return {
            id: docItem.id,
            ...data,
            projectSystemKey: itemProjectSystemKey || null,
            runtimeProjectKey: runtimeProjectKey || null,
            sourceCardExists: true,
            sourceCardChecked: true,
          };
        }),
      });
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.criarLinkRastreavelGerenciadorHttp = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    if (handleHttpCorsPreflight(req, res)) return;

    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Metodo nao permitido." });
        return;
      }

      const body = normalizeRequestBody(req);
      const token = getBearerToken(req);
      const { decoded } = await verifySharedBucketIdToken(token);
      await assertSystemManagerAdminIdentity({
        uid: decoded?.uid,
        email: decoded?.email,
      });

      const managerDb = getSystemManagerDb();
      const projectSystemKeyInput = ensureRequiredString(
        body?.projectSystemKey,
        "projectSystemKey"
      ).toLowerCase();
      const ownerUserId = ensureRequiredString(body?.ownerUserId, "ownerUserId");
      const espacoId = ensureRequiredString(body?.espacoId, "espacoId");
      const destinoUrl = ensureRequiredString(body?.destinoUrl, "destinoUrl");
      const target = await resolveTrackableTargetForManagerWrite(managerDb, projectSystemKeyInput);
      const trackingId = target.db.collection("trackableLinks").doc().id;
      const trackingRoute = `/r/${encodeURIComponent(trackingId)}`;
      const baseUrl = buildTrackableBaseUrlFromSystem(target.systemData, body?.baseUrl);
      const urlRastreavel = buildTrackableAbsoluteUrlFromBase(baseUrl, trackingRoute);
      const origemPlanejada =
        sanitizeString(body?.origemPlanejada || body?.descricao) || "Link rastreavel";
      const currentUid = sanitizeString(decoded?.uid);
      const currentEmail = sanitizeString(decoded?.email).toLowerCase();

      const payload = cleanFirestorePayload({
        id: trackingId,
        trackingId,
        tipo: "link_espaco",
        targetType: "espaco",
        destinoTipo: "espaco",
        ownerUserId,
        espacoId,
        espacoNome: sanitizeString(body?.espacoNome) || null,
        skinsUsername: sanitizeString(body?.skinsUsername) || null,
        spaceKey: [ownerUserId, espacoId].join("|"),
        destinoUrl,
        trackingRoute,
        urlRastreavel,
        descricao: sanitizeString(body?.descricao) || origemPlanejada,
        origemPlanejada,
        permissaoCriarLinks: sanitizeString(body?.permissaoCriarLinks) || null,
        permissaoHistoricoLinks: sanitizeString(body?.permissaoHistoricoLinks) || null,
        ativo: true,
        excluido: false,
        status: "ativo",
        modoRastreabilidade: "preferencial",
        projectSystemKey: target.projectSystemKey,
        runtimeProjectKey: target.projectSystemKey,
        runtimeProjectId: target.runtimeProjectId,
        criadoPor: currentUid || null,
        criadoPorEmail: currentEmail || null,
        criadoVia: "gerenciador_rastreabilidade",
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      });

      const linkRef = getTrackableLinkWriteRefForTarget(target, trackingId);
      await linkRef.set(payload, { merge: true });
      await writeAuditLog(target.db, {
        action: "criou_link_rastreavel",
        entityType: "trackableLink",
        entityId: trackingId,
        projectSystemKey: target.projectSystemKey,
        runtimeProjectId: target.runtimeProjectId,
        ownerUserId,
        espacoId,
        actorUid: currentUid,
        actorEmail: currentEmail,
        source: "gerenciador_function",
        sourcePath: linkRef.path,
        snapshotDepois: {
          trackingId,
          destinoUrl,
          urlRastreavel,
          origemPlanejada,
          status: "ativo",
        },
      });

      res.json({
        ok: true,
        item: {
          ...payload,
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
        },
        trackingId,
        trackingRoute,
        urlRastreavel,
        destinoUrl,
        projectSystemKey: target.projectSystemKey,
        runtimeProjectId: target.runtimeProjectId,
      });
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.atualizarStatusLinkRastreavelGerenciadorHttp = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    if (handleHttpCorsPreflight(req, res)) return;

    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Metodo nao permitido." });
        return;
      }

      const body = normalizeRequestBody(req);
      const token = getBearerToken(req);
      const { decoded } = await verifySharedBucketIdToken(token);
      await assertSystemManagerAdminIdentity({
        uid: decoded?.uid,
        email: decoded?.email,
      });

      const managerDb = getSystemManagerDb();
      const trackingId = ensureRequiredString(body?.trackingId, "trackingId");
      const action = sanitizeString(body?.action || body?.acao).toLowerCase();
      if (!["ativar", "pausar", "excluir"].includes(action)) {
        throw new HttpsError("invalid-argument", "Acao invalida para link rastreavel.");
      }

      const target = await resolveTrackableLinkRefForManagerAction(managerDb, {
        projectSystemKey: body?.projectSystemKey,
        trackingId,
      });
      const currentUid = sanitizeString(decoded?.uid);
      const currentEmail = sanitizeString(decoded?.email).toLowerCase();
      if (action === "excluir") {
        await assertAuditPermissionForProject(managerDb, {
          projectSystemKey: target.projectSystemKey,
          decoded,
          permissionField: "auditoriaExcluirRegistrosPermissao",
          resource: target.snap?.data?.() || {},
        });
      }

      const patchBase = {
        atualizadoEm: serverTimestamp(),
        atualizadoPor: currentUid || null,
        atualizadoPorEmail: currentEmail || null,
      };
      const patch =
        action === "ativar"
          ? {
              ...patchBase,
              ativo: true,
              excluido: false,
              status: "ativo",
              reativadoEm: serverTimestamp(),
            }
          : action === "pausar"
            ? {
                ...patchBase,
                ativo: false,
                excluido: false,
                status: "pausado",
                pausadoEm: serverTimestamp(),
              }
            : {
                ...patchBase,
                ativo: false,
                excluido: true,
                status: "excluido",
                excluidoPor: currentUid || null,
                excluidoPorEmail: currentEmail || null,
                excluidoEm: serverTimestamp(),
              };

      await target.ref.set(cleanFirestorePayload(patch), { merge: true });
      const snapAtualizado = await target.ref.get();
      const data = snapAtualizado.data() || {};
      await writeAuditLog(target.db, {
        action:
          action === "excluir"
            ? "excluiu_link_rastreavel"
            : action === "pausar"
              ? "pausou_link_rastreavel"
              : "ativou_link_rastreavel",
        entityType: "trackableLink",
        entityId: trackingId,
        projectSystemKey: target.projectSystemKey,
        runtimeProjectId: target.runtimeProjectId,
        ownerUserId: data?.ownerUserId,
        espacoId: data?.espacoId,
        actorUid: currentUid,
        actorEmail: currentEmail,
        motivo: sanitizeString(body?.motivo) || action,
        source: "gerenciador_function",
        sourcePath: target.ref.path,
        snapshotAntes: target.snap?.data?.() || null,
        snapshotDepois: data,
      });

      res.json({
        ok: true,
        item: {
          id: snapAtualizado.id,
          ...data,
          projectSystemKey:
            sanitizeString(data?.projectSystemKey || data?.runtimeProjectKey || target.projectSystemKey)
              .toLowerCase() || null,
          runtimeProjectKey:
            sanitizeString(data?.runtimeProjectKey || target.projectSystemKey).toLowerCase() || null,
          runtimeProjectId:
            sanitizeString(data?.runtimeProjectId || target.runtimeProjectId) || null,
        },
      });
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.atualizarStatusQrPrintGerenciadorHttp = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    if (handleHttpCorsPreflight(req, res)) return;

    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Metodo nao permitido." });
        return;
      }

      const body = normalizeRequestBody(req);
      const token = getBearerToken(req);
      const { decoded } = await verifySharedBucketIdToken(token);
      await assertSystemManagerAdminIdentity({
        uid: decoded?.uid,
        email: decoded?.email,
      });

      const managerDb = getSystemManagerDb();
      const printId = ensureRequiredString(body?.printId || body?.qrPrintId, "printId");
      const action = sanitizeString(body?.action || body?.acao).toLowerCase();
      if (!["excluir"].includes(action)) {
        throw new HttpsError("invalid-argument", "Acao invalida para card QR rastreavel.");
      }

      const target = await resolveQrPrintRefForManagerAction(managerDb, {
        projectSystemKey: body?.projectSystemKey,
        printId,
      });
      const currentUid = sanitizeString(decoded?.uid);
      const currentEmail = sanitizeString(decoded?.email).toLowerCase();
      await assertAuditPermissionForProject(managerDb, {
        projectSystemKey: target.projectSystemKey,
        decoded,
        permissionField: "auditoriaExcluirRegistrosPermissao",
        resource: target.snap?.data?.() || {},
      });

      const patch = {
        ativo: false,
        excluido: true,
        status: "excluido",
        motivoExclusao: sanitizeString(body?.motivo) || "exclusao_gerenciador",
        atualizadoEm: serverTimestamp(),
        atualizadoPor: currentUid || null,
        atualizadoPorEmail: currentEmail || null,
        excluidoEm: serverTimestamp(),
        excluidoPor: currentUid || null,
        excluidoPorEmail: currentEmail || null,
      };

      await target.ref.set(cleanFirestorePayload(patch), { merge: true });
      const snapAtualizado = await target.ref.get();
      const data = snapAtualizado.data() || {};
      await writeAuditLog(target.db, {
        action: "excluiu_card_rastreavel",
        entityType: "qrPrint",
        entityId: printId,
        projectSystemKey: target.projectSystemKey,
        runtimeProjectId: target.runtimeProjectId,
        ownerUserId: data?.ownerUserId,
        espacoId: data?.espacoId,
        blocoId: data?.blocoId,
        cardId: data?.cardId,
        actorUid: currentUid,
        actorEmail: currentEmail,
        motivo: patch.motivoExclusao,
        source: "gerenciador_function",
        sourcePath: target.ref.path,
        snapshotAntes: target.snap?.data?.() || null,
        snapshotDepois: data,
      });

      res.json({
        ok: true,
        item: {
          id: snapAtualizado.id,
          ...data,
          projectSystemKey:
            sanitizeString(data?.projectSystemKey || data?.runtimeProjectKey || target.projectSystemKey)
              .toLowerCase() || null,
          runtimeProjectKey:
            sanitizeString(data?.runtimeProjectKey || target.projectSystemKey).toLowerCase() || null,
          runtimeProjectId:
            sanitizeString(data?.runtimeProjectId || target.runtimeProjectId) || null,
        },
      });
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.listarAcessosLinksRastreaveisGerenciadorHttp = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    if (handleHttpCorsPreflight(req, res)) return;

    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Metodo nao permitido." });
        return;
      }

      const body = normalizeRequestBody(req);
      const token = getBearerToken(req);
      const { decoded } = await verifySharedBucketIdToken(token);
      await assertSystemManagerAdminIdentity({
        uid: decoded?.uid,
        email: decoded?.email,
      });

      const maxItems = Math.min(Math.max(Number(body?.limit) || 500, 1), 800);
      const projectSystemKey = sanitizeString(body?.projectSystemKey).toLowerCase();
      const startDate = sanitizeString(body?.startDate);
      const endDate = sanitizeString(body?.endDate);
      const startDateObject = startDate ? new Date(`${startDate}T00:00:00.000`) : null;
      const endDateObject = endDate ? new Date(`${endDate}T23:59:59.999`) : null;
      const startMs =
        startDateObject && !Number.isNaN(startDateObject.getTime())
          ? startDateObject.getTime()
          : NaN;
      const endMs =
        endDateObject && !Number.isNaN(endDateObject.getTime())
          ? endDateObject.getTime()
          : NaN;

      const managerDb = getSystemManagerDb();
      const linkDocs = await listTrackableLinkDocsAcrossRuntimeDbs(managerDb, {
        projectSystemKey,
        maxItems,
      });
      const perLinkLimit = Math.max(5, Math.min(100, Math.ceil(maxItems / Math.max(linkDocs.length, 1))));
      const accessDocs = [];

      for (const linkDoc of linkDocs) {
        let accessSnap;
        try {
          accessSnap = await linkDoc.ref
            .collection("acessos")
            .orderBy("data", "desc")
            .limit(perLinkLimit)
            .get();
        } catch (error) {
          if (!isFirestorePreconditionError(error)) {
            throw error;
          }

          accessSnap = await linkDoc.ref.collection("acessos").limit(perLinkLimit).get();
        }

        const linkData = linkDoc.data() || {};
        const linkProjectSystemKey = resolveDocProjectSystemKey(linkDoc, linkData);
        accessSnap.docs.forEach((docItem) => {
          const accessData = docItem.data() || {};
          const runtimeProjectKey =
            sanitizeString(accessData?.runtimeProjectKey || linkData?.runtimeProjectKey).toLowerCase() ||
            linkProjectSystemKey;
          const itemProjectSystemKey =
            sanitizeString(accessData?.projectSystemKey || linkData?.projectSystemKey).toLowerCase() ||
            linkProjectSystemKey ||
            runtimeProjectKey;

          accessDocs.push({
            id: docItem.id,
            ...accessData,
            trackingId: sanitizeString(linkData?.trackingId || linkDoc.id) || null,
            trackingDestinoUrl: sanitizeString(linkData?.destinoUrl) || null,
            trackingOrigemPlanejada:
              sanitizeString(linkData?.origemPlanejada || linkData?.descricao) || null,
            ownerUserId: sanitizeString(linkData?.ownerUserId) || null,
            espacoId: sanitizeString(linkData?.espacoId) || null,
            espacoNome: sanitizeString(linkData?.espacoNome) || null,
            skinsUsername: sanitizeString(linkData?.skinsUsername) || null,
            projectSystemKey: itemProjectSystemKey || null,
            runtimeProjectKey: runtimeProjectKey || null,
          });
        });
      }

      const items = accessDocs
        .filter((item) => {
          const trackingId = sanitizeString(item?.trackingId);
          const eventType = sanitizeString(item?.eventoTipo || item?.tipo).toLowerCase();
          const itemProjectKey = sanitizeString(item?.projectSystemKey || item?.runtimeProjectKey).toLowerCase();
          const itemTimestamp = getFirestoreTimestampMs(item);

          if (!trackingId) return false;
          if (eventType && eventType !== "access_link") return false;
          if (projectSystemKey && itemProjectKey !== projectSystemKey) return false;
          if (Number.isFinite(startMs) && (!Number.isFinite(itemTimestamp) || itemTimestamp < startMs)) {
            return false;
          }
          if (Number.isFinite(endMs) && (!Number.isFinite(itemTimestamp) || itemTimestamp > endMs)) {
            return false;
          }

          return true;
        })
        .sort((a, b) => (getFirestoreTimestampMs(b) || 0) - (getFirestoreTimestampMs(a) || 0))
        .slice(0, maxItems);

      res.json({
        ok: true,
        items,
      });
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.listarQrPrintsGerenciadorHttp = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    if (handleHttpCorsPreflight(req, res)) return;

    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Metodo nao permitido." });
        return;
      }

      const body = normalizeRequestBody(req);
      const token = getBearerToken(req);
      const { decoded } = await verifySharedBucketIdToken(token);
      await assertSystemManagerAdminIdentity({
        uid: decoded?.uid,
        email: decoded?.email,
      });

      const maxItems = Math.min(Math.max(Number(body?.limit) || 300, 1), 800);
      const projectSystemKey = sanitizeString(body?.projectSystemKey).toLowerCase();
      const managerDb = getSystemManagerDb();
      const printDocs = await listQrPrintDocsAcrossRuntimeDbs(managerDb, {
        projectSystemKey,
        maxItems,
      });

      res.json({
        ok: true,
        items: printDocs.map((docItem) => {
          const data = docItem.data() || {};
          const pathProjectKey = resolveProjectSystemKeyFromDocRef(docItem);
          const runtimeProjectKey =
            sanitizeString(data?.runtimeProjectKey).toLowerCase() ||
            pathProjectKey;
          const itemProjectSystemKey =
            sanitizeString(data?.projectSystemKey).toLowerCase() ||
            pathProjectKey ||
            runtimeProjectKey;

          return {
            id: docItem.id,
            ...data,
            projectSystemKey: itemProjectSystemKey || null,
            runtimeProjectKey: runtimeProjectKey || null,
            sourceCardExists: true,
            sourceCardChecked: true,
            sourceCardMissing: false,
          };
        }),
      });
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.listarLeiturasQrPrintsGerenciadorHttp = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    if (handleHttpCorsPreflight(req, res)) return;

    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Metodo nao permitido." });
        return;
      }

      const body = normalizeRequestBody(req);
      const token = getBearerToken(req);
      const { decoded } = await verifySharedBucketIdToken(token);
      await assertSystemManagerAdminIdentity({
        uid: decoded?.uid,
        email: decoded?.email,
      });

      const maxItems = Math.min(Math.max(Number(body?.limit) || 300, 1), 800);
      const projectSystemKey = sanitizeString(body?.projectSystemKey).toLowerCase();
      const managerDb = getSystemManagerDb();
      const printDocs = await listQrPrintDocsAcrossRuntimeDbs(managerDb, {
        projectSystemKey,
        maxItems,
      });
      const perPrintLimit = Math.max(5, Math.min(100, Math.ceil(maxItems / Math.max(printDocs.length, 1))));
      const readingDocs = [];

      for (const printDoc of printDocs) {
        let readingSnap;
        try {
          readingSnap = await printDoc.ref
            .collection("leituras")
            .orderBy("data", "desc")
            .limit(perPrintLimit)
            .get();
        } catch (error) {
          if (!isFirestorePreconditionError(error)) {
            throw error;
          }

          readingSnap = await printDoc.ref.collection("leituras").limit(perPrintLimit).get();
        }

        const printData = printDoc.data() || {};
        const printProjectSystemKey = resolveDocProjectSystemKey(printDoc, printData);
        readingSnap.docs.forEach((docItem) => {
          const readingData = docItem.data() || {};
          const runtimeProjectKey =
            sanitizeString(readingData?.runtimeProjectKey || printData?.runtimeProjectKey).toLowerCase() ||
            printProjectSystemKey;
          const itemProjectSystemKey =
            sanitizeString(readingData?.projectSystemKey || printData?.projectSystemKey).toLowerCase() ||
            printProjectSystemKey ||
            runtimeProjectKey;

          readingDocs.push({
            id: docItem.id,
            ...readingData,
            printId: sanitizeString(printData?.printId || printDoc.id) || null,
            cardNome: sanitizeString(printData?.cardNome) || null,
            urlCard: sanitizeString(printData?.urlCard) || null,
            ownerUserId: sanitizeString(printData?.ownerUserId) || null,
            espacoId: sanitizeString(printData?.espacoId) || null,
            espacoNome: sanitizeString(printData?.espacoNome) || null,
            skinsUsername: sanitizeString(printData?.skinsUsername) || null,
            projectSystemKey: itemProjectSystemKey || null,
            runtimeProjectKey: runtimeProjectKey || null,
          });
        });
      }

      const items = readingDocs
        .filter((item) => {
          const printId = sanitizeString(item?.printId || item?.qrPrintId);
          const itemProjectKey = sanitizeString(item?.projectSystemKey || item?.runtimeProjectKey).toLowerCase();
          if (!printId) return false;
          if (projectSystemKey && itemProjectKey !== projectSystemKey) return false;
          return true;
        })
        .sort((a, b) => (getFirestoreTimestampMs(b) || 0) - (getFirestoreTimestampMs(a) || 0))
        .slice(0, maxItems);

      res.json({
        ok: true,
        items,
      });
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.obterResumoAcessosGerenciadorHttp = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    if (handleHttpCorsPreflight(req, res)) return;

    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Metodo nao permitido." });
        return;
      }

      const body = normalizeRequestBody(req);
      const token = getBearerToken(req);
      const { decoded } = await verifySharedBucketIdToken(token);
      await assertSystemManagerAdminIdentity({
        uid: decoded?.uid,
        email: decoded?.email,
      });

      const maxItems = Math.min(Math.max(Number(body?.limit) || 500, 1), 500);
      const managerDb = getSystemManagerDb();
      const snap = await managerDb
        .collection("acessos")
        .where("visto", "==", false)
        .limit(maxItems)
        .get();

      let naoLidos = 0;
      snap.docs.forEach((docItem) => {
        const data = docItem.data() || {};
        if (data.registroBloqueado === true || data.bloqueado === true) return;
        naoLidos += 1;
      });

      res.json({
        ok: true,
        naoLidos,
        temNaoLidos: naoLidos > 0,
        limiteAtingido: snap.size >= maxItems,
      });
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.listarAuditLogsGerenciadorHttp = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    if (handleHttpCorsPreflight(req, res)) return;

    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Metodo nao permitido." });
        return;
      }

      const body = normalizeRequestBody(req);
      const token = getBearerToken(req);
      const { decoded } = await verifySharedBucketIdToken(token);
      const managerDb = getSystemManagerDb();
      const purpose = sanitizeString(body?.purpose).toLowerCase();
      const auditCategory = sanitizeString(body?.auditCategory).toLowerCase();
      await assertAuditPermissionForProject(managerDb, {
        projectSystemKey: body?.projectSystemKey,
        decoded,
        permissionField:
          purpose === "export"
            ? "auditoriaExportarPermissao"
            : (auditCategory
                ? resolveAuditViewPermissionFieldForCategory(auditCategory)
                : "auditoriaVerHistoricoPermissao"),
        defaultPermission:
          purpose === "export" || !auditCategory
            ? "owner_projeto"
            : "owner_projeto",
        allowAllProjectsForManager: true,
      });

      const docs = await listAuditLogDocsForManager(managerDb, {
        projectSystemKey: body?.projectSystemKey,
        action: body?.action,
        entityType: body?.entityType,
        entityId: body?.entityId,
        auditCategory: body?.auditCategory,
        severity: body?.severity,
        startDate: body?.startDate,
        endDate: body?.endDate,
        maxItems: body?.limit,
      });
      const filteredDocs = await filterAuditDocsByPermissions(managerDb, docs, {
        decoded,
        purpose,
        projectSystemKey: body?.projectSystemKey,
      });

      res.json({
        ok: true,
        items: filteredDocs.map(({ docItem, data, runtimeProjectId }) => ({
          id: docItem.id,
          auditPath: docItem.ref.path,
          runtimeProjectId: sanitizeString(data?.runtimeProjectId || runtimeProjectId) || null,
          ...data,
        })),
      });
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.marcarAcessosLidosGerenciadorHttp = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    if (handleHttpCorsPreflight(req, res)) return;

    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Metodo nao permitido." });
        return;
      }

      const body = normalizeRequestBody(req);
      const token = getBearerToken(req);
      const { decoded } = await verifySharedBucketIdToken(token);
      await assertSystemManagerAdminIdentity({
        uid: decoded?.uid,
        email: decoded?.email,
      });

      const ids = normalizeAccessDocIds(body?.ids || body?.accessIds);
      if (!ids.length) {
        throw new HttpsError("invalid-argument", "Informe ao menos um acesso.");
      }

      const managerDb = getSystemManagerDb();
      const total = await markAccessRecordsAsRead(managerDb, ids, {
        lidoPorUid: sanitizeString(decoded?.uid) || null,
        lidoPorEmail: sanitizeString(decoded?.email) || null,
      });
      await writeAuditLog(managerDb, {
        action: "marcou_acessos_lidos",
        entityType: "acesso",
        entityId: ids.length === 1 ? ids[0] : "bulk",
        actorUid: decoded?.uid,
        actorEmail: decoded?.email,
        source: "gerenciador_function",
        metadata: {
          ids,
          total,
        },
      });

      res.json({
        ok: true,
        total,
        ids,
      });
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.removerAcessosGerenciadorHttp = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    if (handleHttpCorsPreflight(req, res)) return;

    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Metodo nao permitido." });
        return;
      }

      const body = normalizeRequestBody(req);
      const token = getBearerToken(req);
      const { decoded } = await verifySharedBucketIdToken(token);
      await assertSystemManagerAdminIdentity({
        uid: decoded?.uid,
        email: decoded?.email,
      });

      const ids = normalizeAccessDocIds(body?.ids || body?.accessIds);
      if (!ids.length) {
        throw new HttpsError("invalid-argument", "Informe ao menos um acesso.");
      }

      const managerDb = getSystemManagerDb();
      const accessSnapshots = await Promise.all(
        ids.map((accessId) => managerDb.collection("acessos").doc(accessId).get().catch(() => null))
      );
      const projectKeys = Array.from(
        new Set(
          accessSnapshots
            .filter((snap) => snap?.exists)
            .map((snap) => {
              const data = snap.data() || {};
              return sanitizeString(data?.projectSystemKey || data?.runtimeProjectKey).toLowerCase();
            })
            .filter(Boolean)
        )
      );
      if (!projectKeys.length) {
        await assertAuditPermissionForProject(managerDb, {
          decoded,
          permissionField: "auditoriaExcluirRegistrosPermissao",
          allowAllProjectsForManager: true,
        });
      } else {
        await Promise.all(
          projectKeys.map((projectSystemKey) =>
            assertAuditPermissionForProject(managerDb, {
              projectSystemKey,
              decoded,
              permissionField: "auditoriaExcluirRegistrosPermissao",
            })
          )
        );
      }

      const total = await deleteAccessRecords(managerDb, ids);
      await writeAuditLog(managerDb, {
        action: "removeu_acessos",
        entityType: "acesso",
        entityId: ids.length === 1 ? ids[0] : "bulk",
        actorUid: decoded?.uid,
        actorEmail: decoded?.email,
        motivo: sanitizeString(body?.motivo) || "remocao_gerenciador",
        source: "gerenciador_function",
        snapshotAntes: {
          ids,
          totalSolicitado: ids.length,
          registros: accessSnapshots
            .filter((snap) => snap?.exists)
            .map((snap) => ({ id: snap.id, ...(snap.data() || {}) })),
        },
        metadata: {
          totalRemovido: total,
        },
      });

      res.json({
        ok: true,
        total,
        ids,
      });
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.obterConfigAcessosGerenciadorHttp = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    if (handleHttpCorsPreflight(req, res)) return;

    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Metodo nao permitido." });
        return;
      }

      const token = getBearerToken(req);
      const { decoded } = await verifySharedBucketIdToken(token);
      await assertSystemManagerAdminIdentity({
        uid: decoded?.uid,
        email: decoded?.email,
      });

      const managerDb = getSystemManagerDb();
      const settings = await getAccessRegistrationSettings(managerDb);

      res.json({
        ok: true,
        ...settings,
      });
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.salvarConfigAcessosGerenciadorHttp = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    if (handleHttpCorsPreflight(req, res)) return;

    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Metodo nao permitido." });
        return;
      }

      const body = normalizeRequestBody(req);
      const token = getBearerToken(req);
      const { decoded } = await verifySharedBucketIdToken(token);
      await assertSystemManagerAdminIdentity({
        uid: decoded?.uid,
        email: decoded?.email,
      });

      const ipsBloqueadosRegistro = normalizeAccessIpBlockList(
        body?.ipsBloqueadosRegistro || body?.ipsBloqueados || body?.blockedIps
      );
      const usuariosBloqueadosRegistro = normalizeAccessUserBlockList(
        body?.usuariosBloqueadosRegistro ||
          body?.usuariosBloqueados ||
          body?.blockedUsers ||
          body?.uidsBloqueadosRegistro
      );
      const managerDb = getSystemManagerDb();
      await getAccessRegistrationSettingsRef(managerDb).set(
        {
          ipsBloqueadosRegistro,
          usuariosBloqueadosRegistro,
          updatedAt: serverTimestamp(),
          updatedByUid: sanitizeString(decoded?.uid) || null,
          updatedByEmail: sanitizeString(decoded?.email) || null,
        },
        { merge: true }
      );
      const registrosOcultados = await markAccessRecordsBlockedByUsers(
        managerDb,
        usuariosBloqueadosRegistro,
        {
          bloqueadoPor: "user_blocked",
          bloqueadoPorConfigUid: sanitizeString(decoded?.uid) || null,
          bloqueadoPorConfigEmail: sanitizeString(decoded?.email) || null,
        }
      );
      await writeAuditLog(managerDb, {
        action: "salvou_config_acessos",
        entityType: "accessSettings",
        entityId: "registro",
        actorUid: decoded?.uid,
        actorEmail: decoded?.email,
        source: "gerenciador_function",
        snapshotDepois: {
          ipsBloqueadosRegistro,
          usuariosBloqueadosRegistro,
        },
        metadata: {
          totalIps: ipsBloqueadosRegistro.length,
          totalUsuarios: usuariosBloqueadosRegistro.length,
          registrosOcultados,
        },
      });

      res.json({
        ok: true,
        ipsBloqueadosRegistro,
        usuariosBloqueadosRegistro,
        registrosOcultados,
      });
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.espelharUsuarioProjeto = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Metodo nao permitido." });
        return;
      }

      const body = normalizeRequestBody(req);
      const token = getBearerToken(req);
      const { decoded, projectId } = await verifySharedBucketIdToken(token);
      const uid = ensureRequiredString(body?.uid, "uid");

      if (decoded.uid !== uid) {
        throw new HttpsError("permission-denied", "UID invalido para espelhamento.");
      }

      const projectSystemKey =
        sanitizeString(body?.projectSystemKey).toLowerCase() ||
        sanitizeString(body?.runtimeProjectKey).toLowerCase() ||
        sanitizeString(projectId).toLowerCase();
      const docId = `${projectSystemKey}__${uid}`.slice(0, 180);
      const managerDb = getSystemManagerDb();
      const ref = managerDb.collection("usuarios_projetos").doc(docId);
      const snap = await ref.get();
      const skinsResumo = sanitizeSkinsResumo(body?.skinsResumo);
      const payload = {
        uid,
        nomeGoogle: sanitizeString(body?.nomeGoogle) || "",
        nomeCompletoGoogle: sanitizeString(body?.nomeCompletoGoogle) || "",
        emailGoogle: sanitizeString(body?.emailGoogle) || "",
        picGoogle: sanitizeString(body?.picGoogle) || "",
        projectSystemKey,
        runtimeProjectKey: sanitizeString(body?.runtimeProjectKey) || null,
        sourceAuthProjectId: sanitizeString(projectId) || null,
        skinsResumo,
        skinUsernames: skinsResumo
          .map((item) => sanitizeString(item?.username))
          .filter(Boolean),
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (!snap.exists) {
        payload.createdAt = serverTimestamp();
      }

      await ref.set(payload, { merge: true });
      res.json({ ok: true, id: docId });
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);

exports.excluirArquivoBucketCompartilhado = onRequest(
  HTTP_OPTIONS,
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Metodo nao permitido." });
        return;
      }

      const body = normalizeRequestBody(req);
      const token = getBearerToken(req);
      const { decoded } = await verifySharedBucketIdToken(token);
      const path = ensureRequiredString(body?.path, "path");

      if (!canAccessSharedBucketPath(path, decoded.uid)) {
        throw new HttpsError(
          "permission-denied",
          "Voce so pode excluir arquivos da sua propria pasta."
        );
      }

      const bucket = admin.storage().bucket(SHARED_BUCKET_NAME);
      const file = bucket.file(path);
      await file.delete({ ignoreNotFound: true });

      res.json({
        ok: true,
        path,
        bucket: bucket.name,
      });
    } catch (error) {
      sendHttpError(res, error);
    }
  }
);
