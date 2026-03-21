const DEFAULT_SHARED_FUNCTIONS_PROJECT_ID = "teste-aa015";
const DEFAULT_SHARED_FUNCTIONS_REGION = "us-central1";

function sanitizeText(value) {
  return String(value || "").trim();
}

export function getSharedFunctionsProjectId() {
  return sanitizeText(
    process.env.REACT_APP_SHARED_FUNCTIONS_PROJECT_ID || DEFAULT_SHARED_FUNCTIONS_PROJECT_ID
  );
}

export function getSharedFunctionsRegion() {
  return sanitizeText(process.env.REACT_APP_SHARED_FUNCTIONS_REGION) || DEFAULT_SHARED_FUNCTIONS_REGION;
}

export function getSharedFunctionsBaseUrl() {
  const projectId = getSharedFunctionsProjectId();
  const region = getSharedFunctionsRegion();
  if (!projectId || !region) return "";
  return `https://${region}-${projectId}.cloudfunctions.net`;
}

export function buildSharedFunctionsUrl(endpoint = "", query = null) {
  const baseUrl = getSharedFunctionsBaseUrl();
  const path = sanitizeText(endpoint).replace(/^\/+/, "");
  if (!baseUrl || !path) return "";

  const url = new URL(`${baseUrl}/${path}`);
  if (query && typeof query === "object") {
    Object.entries(query).forEach(([key, value]) => {
      const normalized = sanitizeText(value);
      if (!normalized) return;
      url.searchParams.set(key, normalized);
    });
  }
  return url.toString();
}

export async function postSharedFunctionJson(endpoint, { payload = {}, idToken = "" } = {}) {
  const url = buildSharedFunctionsUrl(endpoint);
  if (!url) {
    throw new Error("Backend compartilhado nao configurado.");
  }

  const headers = {
    "Content-Type": "application/json",
  };

  if (sanitizeText(idToken)) {
    headers.Authorization = `Bearer ${sanitizeText(idToken)}`;
  }

  const response = await fetch(url, {
    method: "POST",
    mode: "cors",
    credentials: "omit",
    headers,
    body: JSON.stringify(payload || {}),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    const error = new Error(body?.error || `Falha em ${endpoint}.`);
    error.code = body?.code || `http-${response.status}`;
    error.details = body?.details || "";
    throw error;
  }

  return body;
}
