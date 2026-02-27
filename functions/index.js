const admin = require("firebase-admin");
const { randomUUID } = require("crypto");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
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
const SHARED_BUCKET_ALLOWED_AUTH_PROJECTS = [
  sanitizeString(process.env.GCLOUD_PROJECT) || "teste-aa015",
  ...parseCsv(process.env.SHARED_BUCKET_AUTH_PROJECTS),
  "obeyon-project",
  "aly-onepages-runtime",
  "gerenciador-aly",
].filter(Boolean);
const UNIQUE_SHARED_BUCKET_AUTH_PROJECTS = [...new Set(SHARED_BUCKET_ALLOWED_AUTH_PROJECTS)];
const sharedVerifierApps = new Map();
const CURRENT_PROJECT_ID = sanitizeString(process.env.GCLOUD_PROJECT) || "teste-aa015";
const ADMIN_ONLY_AUTH_PROJECTS = [
  ...parseCsv(process.env.ADMIN_ONLY_AUTH_PROJECTS),
  "gerenciador-aly",
].filter(Boolean);
const ADMIN_ONLY_ALLOWED_UIDS = new Set(
  [
    ...parseCsv(process.env.SYSTEM_MANAGER_ADMIN_UIDS),
    sanitizeString(process.env.SYSTEM_MANAGER_ADMIN_UID),
  ].filter(Boolean)
);
const ADMIN_ONLY_ALLOWED_EMAILS = new Set(
  [
    ...parseCsv(process.env.SYSTEM_MANAGER_ADMIN_EMAILS),
    sanitizeString(process.env.SYSTEM_MANAGER_ADMIN_EMAIL),
  ]
    .map((item) => item.toLowerCase())
    .filter(Boolean)
);

function sanitizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseCsv(value) {
  return sanitizeString(value)
    .split(",")
    .map((item) => sanitizeString(item))
    .filter(Boolean);
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
  const dynamicAdminUid = await getDynamicAdminUidFromConfig();
  const hasAnyAdminConfigured =
    ADMIN_ONLY_ALLOWED_UIDS.size > 0 ||
    ADMIN_ONLY_ALLOWED_EMAILS.size > 0 ||
    Boolean(dynamicAdminUid);

  if (!hasAnyAdminConfigured) {
    if (shouldEnforceAdminOnlyAuth()) {
      return uid;
    }

    throw new HttpsError(
      "permission-denied",
      "Admin do gerenciador nao configurado para executar esta acao."
    );
  }

  if (ADMIN_ONLY_ALLOWED_UIDS.has(uid)) {
    return uid;
  }

  if (email && ADMIN_ONLY_ALLOWED_EMAILS.has(email)) {
    return uid;
  }

  if (dynamicAdminUid && dynamicAdminUid === uid) {
    return uid;
  }

  throw new HttpsError(
    "permission-denied",
    "Apenas administrador pode executar esta acao."
  );
}

function shouldEnforceAdminOnlyAuth() {
  return ADMIN_ONLY_AUTH_PROJECTS.includes(CURRENT_PROJECT_ID);
}

async function getDynamicAdminUidFromConfig() {
  try {
    const configSnap = await db.doc("add_ons/sistema_config").get();
    if (!configSnap.exists) return "";
    return sanitizeString(configSnap.data()?.adminUid);
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
        "Defina SYSTEM_MANAGER_ADMIN_UID(S)/EMAIL(S) ou add_ons/sistema_config.adminUid."
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
    "Acesso permitido apenas para administradores."
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

function getSharedVerifierAuth(projectId) {
  const appName = `shared-auth-${projectId}`;
  if (!sharedVerifierApps.has(appName)) {
    const app = admin.initializeApp({ projectId }, appName);
    sharedVerifierApps.set(appName, app);
  }
  return admin.auth(sharedVerifierApps.get(appName));
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

  res.status(500).json({
    ok: false,
    error: sanitizeString(error?.message) || "Erro interno.",
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

function getBlockDocRef(ownerUserId, espacoId, blocoId) {
  return db.doc(`users/${ownerUserId}/espacos/${espacoId}/blocos/${blocoId}`);
}

function getOwnerIntegrationRef(ownerUserId) {
  return db.doc(`users/${ownerUserId}/integracoes/mercadoPago`);
}

async function getOwnerMercadoPagoAccessToken(ownerUserId) {
  const integrationSnap = await getOwnerIntegrationRef(ownerUserId).get();
  const integrationData = integrationSnap.exists ? integrationSnap.data() : null;
  const accessToken = sanitizeString(integrationData?.accessToken);

  if (!accessToken) {
    throw new HttpsError(
      "failed-precondition",
      "Criador do bloco nao conectou o Mercado Pago."
    );
  }

  return { accessToken, integrationData };
}

async function getBuyerContext(compradorUid) {
  const buyerSnap = await db.doc(`users/${compradorUid}`).get();
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

async function buyerAlreadyHasAccess({ ownerUserId, espacoId, blocoId, compradorUid, activeSkinId }) {
  const basePath = `users/${ownerUserId}/espacos/${espacoId}/blocos/${blocoId}/compradores`;
  const buyerDoc = await db.doc(`${basePath}/${compradorUid}`).get();
  if (buyerDoc.exists) return true;

  if (activeSkinId) {
    const skinDoc = await db.doc(`${basePath}/${activeSkinId}`).get();
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
  const accessToken = ensureRequiredString(request.data?.accessToken, "accessToken");
  const publicKey = sanitizeString(request.data?.publicKey);

  if (accessToken.length < 20) {
    throw new HttpsError("invalid-argument", "Access Token invalido.");
  }

  const me = await fetchMercadoPago("/users/me", accessToken, { method: "GET" });

  await getOwnerIntegrationRef(uid).set(
    {
      accessToken,
      publicKey: publicKey || null,
      mpUserId: me?.id || null,
      mpEmail: sanitizeString(me?.email) || null,
      connectedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return {
    ok: true,
    conectado: true,
    mpUserId: me?.id || null,
    mpEmail: sanitizeString(me?.email) || null,
  };
});

exports.obterStatusMercadoPago = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = ensureAuth(request);
  const integrationSnap = await getOwnerIntegrationRef(uid).get();
  const integrationData = integrationSnap.exists ? integrationSnap.data() : {};

  return {
    conectado: Boolean(sanitizeString(integrationData?.accessToken)),
    mpUserId: integrationData?.mpUserId || null,
    mpEmail: integrationData?.mpEmail || null,
    hasPublicKey: Boolean(sanitizeString(integrationData?.publicKey)),
  };
});

exports.desconectarMercadoPago = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = ensureAuth(request);
  const integrationRef = getOwnerIntegrationRef(uid);

  await integrationRef.set(
    {
      accessToken: null,
      publicKey: null,
      mpUserId: null,
      mpEmail: null,
      disconnectedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return {
    ok: true,
    conectado: false,
  };
});

exports.limparEnvsProjetoNoVercel = onCall(CALLABLE_OPTIONS, async (request) => {
  await assertSystemManagerAdminPermission(request);

  const systemKey = ensureRequiredString(request.data?.systemKey, "systemKey");
  const envPrefixSuffix = normalizeSystemKeyToEnvPrefix(systemKey);
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
    systemKey: sanitizeString(systemKey).toLowerCase(),
    envPrefix,
    removedCount: prefixedEnvs.length,
    removedKeys: Array.from(removedKeys.values()),
    updatedProjectKeysCount,
    skippedProjectKeysCount,
  };
});

exports.criarCheckoutBlocoMercadoPago = onCall(CALLABLE_OPTIONS, async (request) => {
  const compradorUid = ensureAuth(request);
  const ownerUserId = ensureRequiredString(request.data?.ownerUserId, "ownerUserId");
  const espacoId = ensureRequiredString(request.data?.espacoId, "espacoId");
  const blocoId = ensureRequiredString(request.data?.blocoId, "blocoId");
  const skinUsername = ensureRequiredString(request.data?.skinUsername, "skinUsername");
  const baseUrlInput = ensureRequiredString(request.data?.baseUrl, "baseUrl");
  const returnTo = sanitizeString(request.data?.returnTo);

  const normalizedBaseUrl = normalizeBaseUrl(baseUrlInput);
  const fallbackBaseUrl = sanitizeString(process.env.MERCADO_PAGO_BACK_URL_BASE);
  const projectId = sanitizeString(process.env.GCLOUD_PROJECT) || "teste-aa015";
  const defaultHostedBaseUrl = `https://${projectId}.web.app`;
  const baseUrl =
    isLocalhostUrl(normalizedBaseUrl)
      ? normalizeBaseUrl(fallbackBaseUrl || defaultHostedBaseUrl)
      : normalizedBaseUrl;

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

  const { accessToken } = await getOwnerMercadoPagoAccessToken(ownerUserId);
  const isTestAccessToken = /^TEST-/i.test(accessToken);

  const successUrl = buildMenuUrl({
    baseUrl,
    skinUsername,
    ownerUserId,
    espacoId,
    blocoId,
    returnTo,
    mpStatus: "success",
  });
  const pendingUrl = buildMenuUrl({
    baseUrl,
    skinUsername,
    ownerUserId,
    espacoId,
    blocoId,
    returnTo,
    mpStatus: "pending",
  });
  const failureUrl = buildMenuUrl({
    baseUrl,
    skinUsername,
    ownerUserId,
    espacoId,
    blocoId,
    returnTo,
    mpStatus: "failure",
  });

  const externalReference = `bloco|${ownerUserId}|${espacoId}|${blocoId}|${compradorUid}`;

  const payload = {
    items: [
      {
        id: blocoId,
        title: `Acesso ao bloco ${blocoId}`,
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
      ownerUserId,
      espacoId,
      blocoId,
      compradorUid,
      compradorSkinId: buyerContext.activeSkinId || null,
    },
  };

  if (/^https:\/\//i.test(successUrl) && !isLocalhostUrl(successUrl)) {
    payload.auto_return = "approved";
  }

  const buyerEmail = sanitizeString(request?.auth?.token?.email) || buyerContext.email;
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
      ownerUserId,
      espacoId,
      blocoId,
      compradorUid,
      compradorSkinId: buyerContext.activeSkinId || null,
      precoCentavos,
      moeda,
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
});

exports.confirmarPagamentoBlocoMercadoPago = onCall(CALLABLE_OPTIONS, async (request) => {
  const compradorUid = ensureAuth(request);
  const ownerUserId = ensureRequiredString(request.data?.ownerUserId, "ownerUserId");
  const espacoId = ensureRequiredString(request.data?.espacoId, "espacoId");
  const blocoId = ensureRequiredString(request.data?.blocoId, "blocoId");
  const paymentId = ensureRequiredString(request.data?.paymentId, "paymentId");

  const blocoRef = getBlockDocRef(ownerUserId, espacoId, blocoId);
  const blocoSnap = await blocoRef.get();
  if (!blocoSnap.exists) {
    throw new HttpsError("not-found", "Bloco nao encontrado.");
  }
  const blocoData = blocoSnap.data() || {};
  const { moeda } = ensureValidBlockForPurchase(blocoData);

  const { accessToken } = await getOwnerMercadoPagoAccessToken(ownerUserId);
  const payment = await fetchMercadoPago(`/v1/payments/${encodeURIComponent(paymentId)}`, accessToken, {
    method: "GET",
  });

  const referenceData = parseExternalReference(payment?.external_reference);
  const metadata = payment?.metadata || {};
  const ownerFromMetadata = sanitizeString(metadata.ownerUserId);
  const espacoFromMetadata = sanitizeString(metadata.espacoId);
  const blocoFromMetadata = sanitizeString(metadata.blocoId);
  const compradorFromMetadata = sanitizeString(metadata.compradorUid);

  const metadataMatches =
    ownerFromMetadata === ownerUserId &&
    espacoFromMetadata === espacoId &&
    blocoFromMetadata === blocoId;
  const externalMatches =
    referenceData &&
    referenceData.ownerUserId === ownerUserId &&
    referenceData.espacoId === espacoId &&
    referenceData.blocoId === blocoId;
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

  const buyerContext = await getBuyerContext(compradorUid);
  const compradoresRef = blocoRef.collection("compradores");
  const pagamentoRef = blocoRef.collection("pagamentos").doc(String(paymentId));

  await pagamentoRef.set(
    {
      tipo: "mercado_pago_payment",
      paymentId: String(paymentId),
      status: paymentStatus || "unknown",
      statusDetail: statusDetail || null,
      ownerUserId,
      espacoId,
      blocoId,
      compradorUid,
      compradorSkinId: buyerContext.activeSkinId || null,
      amountCentavos: amountCentavos || null,
      moeda: sanitizeString(payment?.currency_id) || moeda,
      raw: payment || null,
      atualizadoEm: serverTimestamp(),
    },
    { merge: true }
  );

  const approved = paymentStatus === "approved";
  if (approved) {
    const basePayload = {
      origem: "mercado_pago",
      paymentId: String(paymentId),
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
    paymentId: String(paymentId),
  };
});

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

      if (!path.startsWith(`users/${decoded.uid}/`)) {
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

      if (!path.startsWith(`users/${decoded.uid}/`)) {
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
