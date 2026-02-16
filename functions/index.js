const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
const REGION = "us-central1";
const RUNTIME_SERVICE_ACCOUNT = "functions-runtime@teste-aa015.iam.gserviceaccount.com";
const CALLABLE_OPTIONS = {
  region: REGION,
  serviceAccount: RUNTIME_SERVICE_ACCOUNT,
};

function sanitizeString(value) {
  return typeof value === "string" ? value.trim() : "";
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
