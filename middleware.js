function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizeHost(value = "") {
  return normalizeText(value)
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .replace(/:\d+$/, "");
}

function parseCsv(value = "") {
  return normalizeText(value)
    .split(",")
    .map((item) => normalizeHost(item))
    .filter(Boolean);
}

function getManagerHosts() {
  const managerProjectId =
    normalizeText(process.env.REACT_APP_SYSTEM_MANAGER_PROJECT_ID) || "gerenciador-aly";
  return Array.from(
    new Set([
      `${managerProjectId}.vercel.app`,
      `www.${managerProjectId}.vercel.app`,
      ...parseCsv(process.env.MANAGER_ACCESS_HOSTS),
    ])
  );
}

function shouldProtectHost(hostname = "") {
  const host = normalizeHost(hostname);
  if (!host) return false;
  return getManagerHosts().includes(host);
}

function getSharedFunctionsBaseUrl() {
  const explicit = normalizeText(process.env.MANAGER_ACCESS_GATE_FUNCTION_URL);
  if (explicit) return explicit;

  const projectId =
    normalizeText(process.env.REACT_APP_SHARED_FUNCTIONS_PROJECT_ID) || "teste-aa015";
  const region =
    normalizeText(process.env.REACT_APP_SHARED_FUNCTIONS_REGION) || "us-central1";
  return `https://${region}-${projectId}.cloudfunctions.net/verificarAcessoGerenciadorHttp`;
}

function getClientIp(request) {
  const headers = request.headers;
  const candidates = [
    headers.get("x-forwarded-for"),
    headers.get("x-real-ip"),
    headers.get("true-client-ip"),
    headers.get("cf-connecting-ip"),
    headers.get("x-vercel-forwarded-for"),
  ]
    .flatMap((value) => normalizeText(value).split(","))
    .map((value) => normalizeText(value).replace(/^::ffff:/, ""))
    .filter(Boolean);

  return candidates[0] || "";
}

function denyManagerAccess(message, status = 403) {
  return new Response(message || "Acesso administrativo indisponivel para esta rede.", {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export default async function middleware(request) {
  const url = new URL(request.url);
  if (!shouldProtectHost(url.hostname)) return undefined;

  const secret = normalizeText(process.env.MANAGER_ACCESS_GATE_SECRET);
  const gateUrl = getSharedFunctionsBaseUrl();
  if (!gateUrl) {
    return denyManagerAccess(
      "Acesso administrativo temporariamente indisponivel: gate de rede nao configurado.",
      503
    );
  }

  try {
    const response = await fetch(gateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "x-aly137-manager-gate-secret": secret } : {}),
      },
      body: JSON.stringify({
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        clientIp: getClientIp(request),
        source: "vercel_middleware",
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) {
      return denyManagerAccess(
        "Nao foi possivel validar a rede de acesso ao gerenciador.",
        503
      );
    }

    if (payload?.allowed !== true) {
      return denyManagerAccess("Acesso administrativo indisponivel para esta rede.");
    }
  } catch {
    return denyManagerAccess(
      "Nao foi possivel validar a rede de acesso ao gerenciador.",
      503
    );
  }

  return undefined;
}
