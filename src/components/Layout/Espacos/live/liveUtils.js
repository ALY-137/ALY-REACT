const LIVE_TURN_URLS = String(process.env.REACT_APP_LIVE_TURN_URLS || "")
  .split(",")
  .map((item) => String(item || "").trim())
  .filter(Boolean);
const LIVE_TURN_USERNAME = String(process.env.REACT_APP_LIVE_TURN_USERNAME || "").trim();
const LIVE_TURN_CREDENTIAL = String(process.env.REACT_APP_LIVE_TURN_CREDENTIAL || "").trim();
const LIVE_FALLBACK_TURN_URLS = [
  "stun:openrelay.metered.ca:80",
  "turn:openrelay.metered.ca:80",
  "turn:openrelay.metered.ca:443",
  "turn:openrelay.metered.ca:443?transport=tcp",
];
const LIVE_FALLBACK_TURN_USERNAME = "openrelayproject";
const LIVE_FALLBACK_TURN_CREDENTIAL = "openrelayproject";
const LIVE_USA_TURN_ENV = LIVE_TURN_URLS.length > 0;

export const LIVE_EFETIVE_TURN_URLS = LIVE_USA_TURN_ENV
  ? LIVE_TURN_URLS
  : LIVE_FALLBACK_TURN_URLS;
const LIVE_EFETIVE_TURN_USERNAME = LIVE_USA_TURN_ENV
  ? LIVE_TURN_USERNAME
  : LIVE_FALLBACK_TURN_USERNAME;
const LIVE_EFETIVE_TURN_CREDENTIAL = LIVE_USA_TURN_ENV
  ? LIVE_TURN_CREDENTIAL
  : LIVE_FALLBACK_TURN_CREDENTIAL;

export const LIVE_WEBRTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    ...(LIVE_EFETIVE_TURN_URLS.length
      ? [
          {
            urls: LIVE_EFETIVE_TURN_URLS,
            username: LIVE_EFETIVE_TURN_USERNAME || undefined,
            credential: LIVE_EFETIVE_TURN_CREDENTIAL || undefined,
          },
        ]
      : []),
  ],
};

export const normalizarRtcSdp = (sdp = "") => {
  let valor = String(sdp || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!valor) return "";

  // Alguns fluxos acabam achatando o SDP em uma linha so.
  if (!valor.includes("\n")) {
    valor = valor.replace(/\s(?=[a-z]=)/g, "\r\n");
  } else {
    valor = valor
      .split("\n")
      .map((linha) => String(linha || "").trim())
      .filter(Boolean)
      .join("\r\n");
  }

  if (!valor.endsWith("\r\n")) {
    valor = `${valor}\r\n`;
  }

  return valor;
};

export const normalizarRtcDescricao = (descricao) => {
  if (!descricao) return null;
  return {
    type: String(descricao.type || "").trim(),
    sdp: normalizarRtcSdp(descricao.sdp || ""),
  };
};

export const serializarRtcDescricao = (descricao) => {
  if (!descricao) return null;
  if (typeof descricao.toJSON === "function") {
    try {
      return normalizarRtcDescricao(descricao.toJSON());
    } catch {
      // fallback para shape minimo abaixo.
    }
  }
  return normalizarRtcDescricao(descricao);
};

export const serializarIceCandidate = (candidate) => {
  if (!candidate) return null;
  if (typeof candidate.toJSON === "function") {
    try {
      return candidate.toJSON();
    } catch {
      // fallback para shape minimo abaixo.
    }
  }
  return {
    candidate: String(candidate.candidate || "").trim(),
    sdpMid: candidate.sdpMid ?? null,
    sdpMLineIndex:
      typeof candidate.sdpMLineIndex === "number" ? candidate.sdpMLineIndex : null,
    usernameFragment: candidate.usernameFragment ?? null,
  };
};

export const parseLiveMs = (valorMs, valorIso) => {
  const fromMs = Number(valorMs);
  if (Number.isFinite(fromMs) && fromMs > 0) return fromMs;
  const fromIso = Date.parse(String(valorIso || "").trim());
  return Number.isFinite(fromIso) ? fromIso : null;
};

export const formatarDataHoraLive = (valorMs) => {
  const ms = Number(valorMs);
  if (!Number.isFinite(ms) || ms <= 0) return "-";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString("pt-BR");
  }
};

const sanitizarTokenLive = (valor = "") =>
  String(valor || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 80);

export const montarLiveContactId = ({ ownerUserId = "", espacoId = "", blocoId = "" } = {}) => {
  const owner = sanitizarTokenLive(ownerUserId);
  const espaco = sanitizarTokenLive(espacoId);
  const bloco = sanitizarTokenLive(blocoId);
  if (espaco && bloco) {
    return `live_${espaco}_${bloco}`.slice(0, 180);
  }
  if (bloco) {
    return `live_${bloco}`.slice(0, 180);
  }
  return `live_${owner}_${espaco}_${bloco}`.slice(0, 180);
};

export const normalizarEmbedLiveUrl = (url = "") => {
  const origem = String(url || "").trim();
  if (!origem) return "";

  try {
    const parsed = new URL(origem);
    const host = String(parsed.hostname || "").toLowerCase();
    const path = String(parsed.pathname || "");
    const segmentos = path.split("/").filter(Boolean);
    const hostAtual =
      typeof window !== "undefined"
        ? String(window.location.hostname || "localhost").trim().toLowerCase()
        : "localhost";
    const parentTwitch = hostAtual || "localhost";

    if (/\.(mp4|webm|ogg|m3u8)(\?|$)/i.test(origem)) {
      return "";
    }

    if (host.includes("youtu.be")) {
      const id = path.replace("/", "").trim();
      if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
    }

    if (host.includes("youtube.com")) {
      if (path.includes("/embed/")) return `${parsed.toString()}${parsed.search ? "&" : "?"}autoplay=1`;
      const id = String(parsed.searchParams.get("v") || "").trim();
      if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
      if (path.includes("/live/")) {
        const idFromPath = path.split("/live/")[1]?.split("/")[0] || "";
        if (idFromPath) {
          return `https://www.youtube.com/embed/${idFromPath}?autoplay=1&rel=0`;
        }
      }
      if (path.includes("/shorts/")) {
        const idFromPath = path.split("/shorts/")[1]?.split("/")[0] || "";
        if (idFromPath) {
          return `https://www.youtube.com/embed/${idFromPath}?autoplay=1&rel=0`;
        }
      }
    }

    if (host.includes("vimeo.com")) {
      const id = path.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}?autoplay=1`;
    }

    if (host.includes("player.twitch.tv")) {
      return parsed.toString();
    }

    if (host.includes("twitch.tv") && path.includes("/videos/")) {
      const videoId = segmentos[1] || "";
      if (videoId) {
        return `https://player.twitch.tv/?video=v${videoId}&parent=${encodeURIComponent(
          parentTwitch
        )}&autoplay=true`;
      }
    }

    if (host.includes("twitch.tv")) {
      const reservados = new Set([
        "videos",
        "directory",
        "downloads",
        "jobs",
        "p",
        "settings",
        "subscriptions",
        "wallet",
        "products",
        "drops",
        "search",
      ]);
      const canal = String(segmentos[0] || "").trim();
      if (canal && !reservados.has(canal.toLowerCase())) {
        return `https://player.twitch.tv/?channel=${encodeURIComponent(
          canal
        )}&parent=${encodeURIComponent(parentTwitch)}&autoplay=true`;
      }
    }

    return "";
  } catch {
    return "";
  }
};
