import { buildSharedFunctionsUrl } from "../../Banco/sharedFunctionsApi";

export const UX_ACCESS_GEO_STORAGE_KEY = "uxAccessGeo";
const GEO_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function normalizeText(value) {
  return String(value || "").trim();
}

function sanitizeGeoPayload(payload = {}) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const geo = {
    ip: normalizeText(payload.ip) || null,
    country: normalizeText(payload.country) || null,
    region: normalizeText(payload.region) || null,
    city: normalizeText(payload.city) || null,
    regionCode: normalizeText(payload.regionCode || payload.uf) || null,
    uf: normalizeText(payload.uf || payload.regionCode) || null,
    org: normalizeText(payload.org) || null,
    cep: normalizeText(payload.cep) || null,
    logradouro: normalizeText(payload.logradouro) || null,
    bairro: normalizeText(payload.bairro) || null,
    cidade: normalizeText(payload.cidade || payload.city) || null,
    latitude:
      Number.isFinite(Number(payload.latitude)) ? Number(payload.latitude) : null,
    longitude:
      Number.isFinite(Number(payload.longitude)) ? Number(payload.longitude) : null,
    resolvedAt: Number.isFinite(Number(payload.resolvedAt))
      ? Number(payload.resolvedAt)
      : Date.now(),
  };

  const hasUsefulInfo = Boolean(
    geo.ip ||
      geo.country ||
      geo.region ||
      geo.city ||
      geo.uf ||
      geo.org ||
      geo.cep
  );

  return hasUsefulInfo ? geo : null;
}

export function salvarGeoAcessoCache(payload = {}) {
  if (typeof window === "undefined") return null;

  const geo = sanitizeGeoPayload(payload);
  if (!geo) return null;

  try {
    window.localStorage.setItem(UX_ACCESS_GEO_STORAGE_KEY, JSON.stringify(geo));
  } catch {
    // Ignora falha de storage.
  }

  return geo;
}

export function lerGeoAcessoCache() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(UX_ACCESS_GEO_STORAGE_KEY);
    if (!raw) return null;
    return sanitizeGeoPayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

function geoCacheAindaValido(geo = null) {
  const resolvedAt = Number(geo?.resolvedAt || 0);
  return resolvedAt > 0 && Date.now() - resolvedAt <= GEO_CACHE_TTL_MS;
}

export async function obterGeoAcessoAtual({ forceRefresh = false } = {}) {
  if (typeof window === "undefined") return null;

  const cached = lerGeoAcessoCache();
  if (!forceRefresh && geoCacheAindaValido(cached)) {
    return cached;
  }

  const endpoint = buildSharedFunctionsUrl("resolverGeoAcessoPublico");
  if (!endpoint) {
    return cached;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        hostname:
          typeof window !== "undefined" ? normalizeText(window.location.hostname) : null,
      }),
    });

    if (!response.ok) {
      throw new Error(`Falha ao resolver geolocalizacao (${response.status}).`);
    }

    const data = await response.json();
    const geo = salvarGeoAcessoCache(data?.geo || {});
    return geo || cached;
  } catch {
    return cached;
  }
}
