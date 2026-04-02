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
  const forwarded = sanitizeString(
    req?.headers?.["x-forwarded-for"] || req?.headers?.["X-Forwarded-For"] || ""
  );
  if (forwarded) {
    const firstForwarded = forwarded
      .split(",")
      .map((item) => sanitizeString(item))
      .find(Boolean);
    if (firstForwarded) {
      return firstForwarded;
    }
  }

  const candidates = [
    req?.ip,
    req?.socket?.remoteAddress,
    req?.connection?.remoteAddress,
  ];

  for (const candidate of candidates) {
    const normalized = sanitizeString(candidate);
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
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(normalizedIp)}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
    const payload = await response.json().catch(() => ({}));

    return {
      ip: normalizedIp,
      country: sanitizeString(payload?.country) || null,
      region: sanitizeString(payload?.region) || null,
      city: sanitizeString(payload?.city) || null,
      uf: sanitizeString(payload?.region_code) || null,
      regionCode: sanitizeString(payload?.region_code) || null,
      org: sanitizeString(payload?.connection?.org || payload?.org) || null,
      cep: sanitizeString(payload?.postal) || null,
      latitude:
        Number.isFinite(Number(payload?.latitude)) ? Number(payload.latitude) : null,
      longitude:
        Number.isFinite(Number(payload?.longitude)) ? Number(payload.longitude) : null,
      resolvedAt: Date.now(),
    };
  } catch {
    return {
      ip: normalizedIp,
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
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function resolveGeoDataFromRequest(req, fallback = {}) {
  const clientIp = sanitizeString(fallback?.ip) || extractClientIp(req) || null;
  const geoByIp = await fetchGeoByIp(clientIp);

  return {
    ip: geoByIp.ip || clientIp || null,
    country: geoByIp.country || sanitizeString(fallback?.country) || null,
    region: geoByIp.region || sanitizeString(fallback?.region) || null,
    city:
      geoByIp.city ||
      sanitizeString(fallback?.city) ||
      sanitizeString(fallback?.cidade) ||
      null,
    uf:
      geoByIp.uf ||
      sanitizeString(fallback?.uf) ||
      sanitizeString(fallback?.regionCode) ||
      null,
    regionCode:
      geoByIp.regionCode ||
      sanitizeString(fallback?.regionCode) ||
      sanitizeString(fallback?.uf) ||
      null,
    org: geoByIp.org || sanitizeString(fallback?.org) || null,
    cep: geoByIp.cep || sanitizeString(fallback?.cep) || null,
    logradouro: sanitizeString(fallback?.logradouro) || null,
    bairro: sanitizeString(fallback?.bairro) || null,
    cidade: sanitizeString(fallback?.cidade) || geoByIp.city || null,
    latitude: geoByIp.latitude,
    longitude: geoByIp.longitude,
    resolvedAt: geoByIp.resolvedAt || Date.now(),
  };
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
      const geo = await resolveGeoDataFromRequest(req, body || {});
      const clientIp = sanitizeString(geo?.ip) || null;
      const managerDb = getSystemManagerDb();

      await managerDb.collection("acessos").add({
        uid: sanitizeString(body?.uid) || null,
        email: sanitizeString(body?.email) || null,
        displayName: sanitizeString(body?.displayName) || null,
        perfilAcesso: sanitizeString(body?.perfilAcesso) || "visitante",
        autenticado: Boolean(body?.autenticado),
        hash: sanitizeString(body?.hash) || null,
        visitorHash: sanitizeString(body?.visitorHash) || null,

        projectSystemKey: sanitizeString(body?.projectSystemKey) || null,
        projectNome: sanitizeString(body?.projectNome) || null,
        runtimeProjectKey: sanitizeString(body?.runtimeProjectKey) || null,
        runtimeProjectId: sanitizeString(body?.runtimeProjectId) || null,
        tipoExperiencia: sanitizeString(body?.tipoExperiencia) || null,
        modoAcessoProjeto: sanitizeString(body?.modoAcessoProjeto) || null,
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
        duracaoMs: Number.isFinite(Number(body?.duracaoMs)) ? Number(body?.duracaoMs) : null,

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
        latitude: Number.isFinite(Number(geo?.latitude)) ? Number(geo.latitude) : null,
        longitude: Number.isFinite(Number(geo?.longitude)) ? Number(geo.longitude) : null,

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

exports.listarAcessosGerenciadorHttp = onRequest(
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
      await assertSystemManagerAdminIdentity({
        uid: decoded?.uid,
        email: decoded?.email,
      });

      const maxItems = Math.min(Math.max(Number(body?.limit) || 3000, 1), 8000);
      const projectSystemKey = sanitizeString(body?.projectSystemKey).toLowerCase();
      const managerDb = getSystemManagerDb();
      let ref = managerDb.collection("acessos");

      if (projectSystemKey) {
        ref = ref.where("projectSystemKey", "==", projectSystemKey);
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
