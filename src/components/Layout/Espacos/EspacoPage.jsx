import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";

import CriadorBloco from "../Blocos/CriadorBloco";
import EditorBloco from "../Blocos/EditorBloco";
import LoginButton from "../Geral/LoginButton";
import Card from "../Objects/Objetos/Card";
import Container from "../Objects/Containers/Container";
import { auth, db, storage } from "../../Banco/init-firebase";
import {
  getProjectCollectionCandidates,
  getProjectDocCandidates,
} from "../../Banco/projectDataRefs";
import {
  excluirArquivoNoBucketCompartilhado,
  obterUrlArquivoNoBucketCompartilhado,
  uploadArquivoNoBucketCompartilhado,
  usandoBucketCompartilhadoCrossProject,
} from "../Storage/sharedBucketApi";
import {
  DEFAULT_SISTEMA_CONFIG,
  isOnePageComEntradaPublica,
  obterConfigSistema,
  obterConfigSistemaCacheLocal,
  obterRotulosBloco,
  obterRotulosEspaco,
  obterRotulosSkin,
} from "../Sistema/configSistema";
import { solicitarSolicitacaoPixManualBloco } from "../Pagamentos/mercadoPagoApi";
import { seforAdm } from "../../Scripts/verificacoes/verificaAdm";
import { getEspacoCompleto } from "./firebaseEspacos";

const getFirstRef = (refs = []) => (Array.isArray(refs) && refs.length ? refs[0] : null);
const getBlocosCollectionRefs = (ownerUserId, espacoId) =>
  getProjectCollectionCandidates(db, "users", ownerUserId, "espacos", espacoId, "blocos");
const getBlocoDocRefs = (ownerUserId, espacoId, blocoId) =>
  getProjectDocCandidates(db, "users", ownerUserId, "espacos", espacoId, "blocos", blocoId);
const getBlocoCardsCollectionRefs = (ownerUserId, espacoId, blocoId) =>
  getProjectCollectionCandidates(
    db,
    "users",
    ownerUserId,
    "espacos",
    espacoId,
    "blocos",
    blocoId,
    "cards"
  );
const getBlocoCompradorRefs = (ownerUserId, espacoId, blocoId, compradorId) =>
  getProjectDocCandidates(
    db,
    "users",
    ownerUserId,
    "espacos",
    espacoId,
    "blocos",
    blocoId,
    "compradores",
    compradorId
  );
const getEspacoAssinanteRefs = (ownerUserId, espacoId, assinanteId) =>
  getProjectDocCandidates(
    db,
    "users",
    ownerUserId,
    "espacos",
    espacoId,
    "assinantes",
    assinanteId
  );
const getPedidosCollectionRefs = (ownerUserId) =>
  getProjectCollectionCandidates(db, "users", ownerUserId, "pedidos");
const getContatoDocRefs = (contactId) => getProjectDocCandidates(db, "contatos", contactId);
const getConversaDocRefs = (contactId, conversationId) =>
  getProjectDocCandidates(db, "contatos", contactId, "conversas", conversationId);
const getChatCollectionRefs = (contactId, conversationId) =>
  getProjectCollectionCandidates(db, "contatos", contactId, "conversas", conversationId, "chat");
const getLiveRtcSessionCollectionRefs = (contactId, conversationId) =>
  getProjectCollectionCandidates(
    db,
    "contatos",
    contactId,
    "conversas",
    conversationId,
    "webrtc"
  );
const getLiveRtcSessionDocRefs = (contactId, conversationId, viewerUid) =>
  getProjectDocCandidates(
    db,
    "contatos",
    contactId,
    "conversas",
    conversationId,
    "webrtc",
    viewerUid
  );
const getLiveRtcCandidatesCollectionRefs = (
  contactId,
  conversationId,
  viewerUid,
  side = "viewerCandidates"
) =>
  getProjectCollectionCandidates(
    db,
    "contatos",
    contactId,
    "conversas",
    conversationId,
    "webrtc",
    viewerUid,
    side
  );

const LIVE_WEBRTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const serializarRtcDescricao = (descricao) => {
  if (!descricao) return null;
  if (typeof descricao.toJSON === "function") {
    try {
      return descricao.toJSON();
    } catch {
      // fallback para shape minimo abaixo.
    }
  }
  return {
    type: String(descricao.type || "").trim(),
    sdp: String(descricao.sdp || "").trim(),
  };
};

const serializarIceCandidate = (candidate) => {
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

const isRenderableUrl = (valor) =>
  typeof valor === "string" &&
  (
    valor.startsWith("https://") ||
    valor.startsWith("http://") ||
    valor.startsWith("blob:") ||
    valor.startsWith("data:image/")
  );

const normalizarListaImagens = (valor) => {
  if (Array.isArray(valor)) {
    return valor.filter(Boolean);
  }
  if (typeof valor === "string" && valor) {
    return [valor];
  }
  return [];
};

const normalizarCardsDoBloco = (valor) => {
  if (!Array.isArray(valor)) return [];

  return valor
    .map((card, index) => ({
      id: String(card?.id || `card_${index}`),
      ordem: Number.isFinite(card?.ordem) ? Number(card.ordem) : index,
      nome: String(card?.nome || "").trim(),
      descricao: String(card?.descricao || "").trim(),
      imagem: String(card?.imagem || "").trim(),
      imagemPath: String(card?.imagemPath || "").trim(),
      linkExterno: String(card?.linkExterno || "").trim(),
    }))
    .filter(
      (card) =>
        card.nome || card.descricao || card.imagem || card.imagemPath || card.linkExterno
    )
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
};

const formatarPreco = (precoCentavos, moeda = "BRL") => {
  const valorNumerico = Number(precoCentavos);
  if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) return null;

  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: moeda || "BRL",
    }).format(valorNumerico / 100);
  } catch {
    return `R$ ${(valorNumerico / 100).toFixed(2)}`;
  }
};

const gerarNomeArquivoSeguro = (nome = "imagem") => {
  const nomeLimpo = String(nome || "imagem")
    .trim()
    .replace(/[^\w.\-]/g, "_");
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${nomeLimpo || "imagem"}`;
};

const PLACEHOLDER_HOME_CONTENT = "conteudo da pagina principal";

const capitalizar = (texto = "") =>
  texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "";

const parseLiveMs = (valorMs, valorIso) => {
  const fromMs = Number(valorMs);
  if (Number.isFinite(fromMs) && fromMs > 0) return fromMs;
  const fromIso = Date.parse(String(valorIso || "").trim());
  return Number.isFinite(fromIso) ? fromIso : null;
};

const formatarDataHoraLive = (valorMs) => {
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

const montarLiveContactId = ({ ownerUserId = "", espacoId = "", blocoId = "" } = {}) => {
  const owner = sanitizarTokenLive(ownerUserId);
  const espaco = sanitizarTokenLive(espacoId);
  const bloco = sanitizarTokenLive(blocoId);
  return `live_${owner}_${espaco}_${bloco}`.slice(0, 180);
};

const normalizarEmbedLiveUrl = (url = "") => {
  const origem = String(url || "").trim();
  if (!origem) return "";

  try {
    const parsed = new URL(origem);
    const host = String(parsed.hostname || "").toLowerCase();
    const path = String(parsed.pathname || "");

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
    }

    if (host.includes("vimeo.com")) {
      const id = path.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}?autoplay=1`;
    }

    if (host.includes("twitch.tv") && path.includes("/videos/")) {
      return parsed.toString();
    }

    return parsed.toString();
  } catch {
    return origem;
  }
};

const extrairPrimeiraUrl = (texto = "") => {
  const bruto = String(texto || "").trim();
  if (!bruto) return "";

  const semAspas = bruto.replace(/^['"]|['"]$/g, "").trim();
  if (/^https?:\/\//i.test(semAspas)) return semAspas;

  const hrefMatch = bruto.match(/href\s*=\s*["']([^"']+)["']/i);
  if (hrefMatch?.[1]) {
    const href = String(hrefMatch[1]).trim();
    if (/^https?:\/\//i.test(href)) return href;
  }

  const importMatch = bruto.match(/url\(([^)]+)\)/i);
  if (importMatch?.[1]) {
    const href = String(importMatch[1]).replace(/^['"]|['"]$/g, "").trim();
    if (/^https?:\/\//i.test(href)) return href;
  }

  const geral = bruto.match(/https?:\/\/[^\s"'<>]+/i);
  return geral?.[0] ? String(geral[0]).trim() : "";
};

const formatarFamilyGoogleCss2 = (value = "") =>
  encodeURI(String(value || "").trim().replace(/\s+/g, "+"));

const normalizarUrlGoogleFonts = (url = "") => {
  const href = extrairPrimeiraUrl(url);
  if (!href) return "";

  try {
    const parsed = new URL(href);
    const host = String(parsed.hostname || "").toLowerCase();

    if (host.includes("fonts.googleapis.com")) {
      return parsed.toString();
    }

    if (host.includes("fonts.google.com") && parsed.pathname.startsWith("/share")) {
      const familias = parsed.searchParams
        .getAll("selection.family")
        .flatMap((value) => String(value || "").split("|"))
        .map((value) => value.trim())
        .filter(Boolean);

      if (!familias.length) return "";

      const queryFamilias = familias
        .map((family) => `family=${formatarFamilyGoogleCss2(family)}`)
        .join("&");
      return `https://fonts.googleapis.com/css2?${queryFamilias}&display=swap`;
    }
  } catch {
    return "";
  }

  return "";
};

const carregarGoogleFontsNoDocumento = (urls = []) => {
  if (typeof document === "undefined") return;

  const lista = Array.isArray(urls) ? urls : [];
  for (const url of lista) {
    const href = normalizarUrlGoogleFonts(url);
    if (!/^https?:\/\/fonts\.googleapis\.com\//i.test(href)) continue;

    const existente = document.querySelector(
      `link[data-google-font-project="true"][href="${href}"]`
    );
    if (existente) continue;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-google-font-project", "true");
    document.head.appendChild(link);
  }
};

const montarFontFamilyCss = (fontFamily = "") => {
  const nome = String(fontFamily || "").trim();
  if (!nome) return "";
  if (nome.includes(",")) return nome;
  return `'${nome}', sans-serif`;
};

async function gerarPreviewDesfocado(file) {
  try {
    const imageBitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;

    const ctx = canvas.getContext("2d");
    ctx.filter = "blur(30px)";
    ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

    if (typeof imageBitmap.close === "function") {
      imageBitmap.close();
    }

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.75)
    );

    if (!blob) {
      throw new Error("Falha ao gerar preview desfocado.");
    }

    return new File([blob], `preview-${Date.now()}.webp`, {
      type: "image/webp",
    });
  } catch {
    // Fallback seguro: nunca reutiliza arquivo original como preview.
    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 48;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 48, 48);
      gradient.addColorStop(0, "#2a2a2a");
      gradient.addColorStop(1, "#5a5a5a");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 48, 48);
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fillRect(0, 20, 48, 8);
    }

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.7)
    );

    if (!blob) {
      throw new Error("Falha ao gerar preview seguro.");
    }

    return new File([blob], `preview-seguro-${Date.now()}.webp`, {
      type: "image/webp",
    });
  }
}

export default function EspacoPage() {
  const navigate = useNavigate();
  const { espacoNome } = useParams();
  const {
    espacos,
    skinIdAtual,
    user,
    onePagePublicaAtiva: onePagePublicaAtivaContexto = false,
  } = useOutletContext();
  const configSistemaCacheLocal = obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG;
  const [blocos, setBlocos] = useState([]);
  const [erroBlocos, setErroBlocos] = useState("");
  const [isAssinante, setIsAssinante] = useState(false);
  const [assinaturaCheckPronto, setAssinaturaCheckPronto] = useState(false);
  const [compradorPorBloco, setCompradorPorBloco] = useState({});
  const [sessaoChatPorBloco, setSessaoChatPorBloco] = useState({});
  const [originaisPorBloco, setOriginaisPorBloco] = useState({});
  const [previewsPorBloco, setPreviewsPorBloco] = useState({});
  const [imagensCardsPorBloco, setImagensCardsPorBloco] = useState({});
  const [reloadNonce, setReloadNonce] = useState(0);
  const [blocoEmAtualizacaoId, setBlocoEmAtualizacaoId] = useState(null);
  const [blocoEmExclusaoId, setBlocoEmExclusaoId] = useState(null);
  const [erroAcaoBloco, setErroAcaoBloco] = useState("");
  const [mercadoPagoSistemaHabilitado, setMercadoPagoSistemaHabilitado] = useState(
    DEFAULT_SISTEMA_CONFIG.mercadoPagoHabilitado
  );
  const [pixManualSistemaHabilitado, setPixManualSistemaHabilitado] = useState(
    DEFAULT_SISTEMA_CONFIG.pixManualHabilitado
  );
  const [livesHabilitadas, setLivesHabilitadas] = useState(
    DEFAULT_SISTEMA_CONFIG.livesHabilitadas
  );
  const [espacoDetalheAtual, setEspacoDetalheAtual] = useState(null);
  const [onePagePublicaAtiva, setOnePagePublicaAtiva] = useState(
    isOnePageComEntradaPublica(configSistemaCacheLocal)
  );
  const [adminUidProjeto, setAdminUidProjeto] = useState(
    String(configSistemaCacheLocal?.adminUid || localStorage.getItem("systemAdminUid") || "").trim()
  );
  const [adminEmailProjeto, setAdminEmailProjeto] = useState(
    String(
      configSistemaCacheLocal?.adminEmail || localStorage.getItem("systemAdminEmail") || ""
    )
      .trim()
      .toLowerCase()
  );
  const [nomeSkinSingular, setNomeSkinSingular] = useState(
    DEFAULT_SISTEMA_CONFIG.nomeSkinSingular
  );
  const [nomeEspacoSingular, setNomeEspacoSingular] = useState(
    DEFAULT_SISTEMA_CONFIG.nomeEspacoSingular
  );
  const [nomeEspacoPlural, setNomeEspacoPlural] = useState(
    DEFAULT_SISTEMA_CONFIG.nomeEspacoPlural
  );
  const [nomeBlocoSingular, setNomeBlocoSingular] = useState(
    DEFAULT_SISTEMA_CONFIG.nomeBlocoSingular
  );
  const [nomeBlocoPlural, setNomeBlocoPlural] = useState(
    DEFAULT_SISTEMA_CONFIG.nomeBlocoPlural
  );
  const [mensagemEspacoLoginRestrito, setMensagemEspacoLoginRestrito] = useState(
    DEFAULT_SISTEMA_CONFIG.mensagemEspacoLoginRestrito
  );
  const [
    mensagemEspacoLoginRestritoFontFamily,
    setMensagemEspacoLoginRestritoFontFamily,
  ] = useState(DEFAULT_SISTEMA_CONFIG.mensagemEspacoLoginRestritoFontFamily);
  const [mensagemEspacoAssinanteRestrito, setMensagemEspacoAssinanteRestrito] = useState(
    DEFAULT_SISTEMA_CONFIG.mensagemEspacoAssinanteRestrito
  );
  const [
    mensagemEspacoAssinanteRestritoFontFamily,
    setMensagemEspacoAssinanteRestritoFontFamily,
  ] = useState(DEFAULT_SISTEMA_CONFIG.mensagemEspacoAssinanteRestritoFontFamily);
  const [googleFontsUrlsProjeto, setGoogleFontsUrlsProjeto] = useState(
    Array.isArray(DEFAULT_SISTEMA_CONFIG.googleFontsUrls)
      ? DEFAULT_SISTEMA_CONFIG.googleFontsUrls
      : []
  );
  const [exibirBotaoLoginMensagemRestricao, setExibirBotaoLoginMensagemRestricao] = useState(
    DEFAULT_SISTEMA_CONFIG.exibirBotaoLoginMensagemRestricao
  );
  const [mensagemRestricaoAvatarUrl, setMensagemRestricaoAvatarUrl] = useState(
    DEFAULT_SISTEMA_CONFIG.mensagemRestricaoAvatarUrl
  );
  const [imagemModal, setImagemModal] = useState({
    aberto: false,
    url: "",
    titulo: "",
    alt: "Imagem ampliada",
  });
  const [liveModal, setLiveModal] = useState({
    aberto: false,
    blocoId: "",
    titulo: "",
    liveUrl: "",
    embedUrl: "",
    contactId: "",
    conversationId: "principal",
  });
  const [liveChatMensagens, setLiveChatMensagens] = useState([]);
  const [liveChatMensagem, setLiveChatMensagem] = useState("");
  const [liveChatErro, setLiveChatErro] = useState("");
  const [liveCameraAtiva, setLiveCameraAtiva] = useState(false);
  const [liveCameraErro, setLiveCameraErro] = useState("");
  const [liveCameraRemotaAtiva, setLiveCameraRemotaAtiva] = useState(false);
  const [liveCameraRemotaErro, setLiveCameraRemotaErro] = useState("");
  const [liveCameraRemotaStatus, setLiveCameraRemotaStatus] = useState("");
  const liveModalEhVideoDireto = useMemo(
    () => /\.(mp4|webm|ogg)(\?|$)/i.test(String(liveModal.liveUrl || "").trim()),
    [liveModal.liveUrl]
  );
  const blockedOriginalPathsRef = useRef(new Set());
  const blockedPreviewPathsRef = useRef(new Set());
  const backfilledPublicUrlsRef = useRef(new Set());
  const liveChatScrollRef = useRef(null);
  const liveCameraVideoRef = useRef(null);
  const liveCameraStreamRef = useRef(null);
  const liveCameraRemotaVideoRef = useRef(null);
  const liveCameraRemotaStreamRef = useRef(null);
  const liveRtcHostPeersRef = useRef(new Map());
  const liveRtcHostRoomUnsubRef = useRef(null);
  const liveRtcViewerPeerRef = useRef(null);
  const liveRtcViewerUnsubsRef = useRef([]);
  const nomeEspacoSingularCapitalizado = capitalizar(nomeEspacoSingular);
  const nomeBlocoSingularCapitalizado = capitalizar(nomeBlocoSingular);
  const loginLoadingMode = String(configSistemaCacheLocal?.loginLoadingMode || "")
    .trim()
    .toLowerCase();
  const loginLoadingSpriteUrl = String(configSistemaCacheLocal?.loginLoadingSpriteUrl || "").trim();
  const exibirLoaderSprite = loginLoadingMode === "sprite_sheet" && Boolean(loginLoadingSpriteUrl);
  const carregamentoAcessoEspacoJSX = exibirLoaderSprite ? (
    <div className="sprite-loader-layer sprite-loader-layer-inline" aria-live="polite">
      <div
        className="loader-cherry"
        aria-hidden="true"
        style={loginLoadingSpriteUrl ? { backgroundImage: `url("${loginLoadingSpriteUrl}")` } : undefined}
      />
    </div>
  ) : (
    <div className="system-loading-indicator" aria-live="polite">
      <div className="system-loading-dot" aria-hidden="true" />
    </div>
  );

  if (!espacos) return null;

  const persistedUid = localStorage.getItem("userId");
  const authUserAtual = user || auth.currentUser || null;
  const authUid = auth.currentUser?.uid || null;
  const currentUidAutenticado = user?.uid || authUid || null;
  const currentUid = user?.uid || authUid || persistedUid || null;
  const espacoAtual = espacos.find((e) => e.nome === espacoNome);
  const espacoId = espacoAtual?.id || espacoAtual?.id_espaco;
  const onePagePublicaAtivaEfetiva = Boolean(onePagePublicaAtivaContexto || onePagePublicaAtiva);
  const emailUsuarioAtual = String(authUserAtual?.email || "")
    .trim()
    .toLowerCase();
  const adminUidProjetoEfetivo = String(
    adminUidProjeto || localStorage.getItem("systemAdminUid") || ""
  ).trim();
  const adminEmailProjetoEfetivo = String(
    adminEmailProjeto || localStorage.getItem("systemAdminEmail") || ""
  )
    .trim()
    .toLowerCase();
  const adminProjetoConfigurado = Boolean(
    adminUidProjetoEfetivo || adminEmailProjetoEfetivo
  );
  const espacoAtualEfetivo =
    espacoDetalheAtual &&
    String(espacoDetalheAtual.id || espacoDetalheAtual.id_espaco) === String(espacoId || "")
      ? { ...espacoAtual, ...espacoDetalheAtual }
      : espacoAtual;
  const usuarioEhAdminProjeto = Boolean(
    currentUid &&
      (
        (adminUidProjetoEfetivo && currentUid === adminUidProjetoEfetivo) ||
        (adminEmailProjetoEfetivo && emailUsuarioAtual === adminEmailProjetoEfetivo) ||
        (!adminProjetoConfigurado && authUserAtual && seforAdm(authUserAtual))
      )
  );
  const ownerUserId =
    espacoAtualEfetivo?.ownerUserId ||
    espacos?.[0]?.ownerUserId ||
    (
      onePagePublicaAtivaEfetiva
        ? adminUidProjetoEfetivo || (usuarioEhAdminProjeto ? currentUid : null)
        : null
    );
  const isOwner = !!currentUid && ownerUserId === currentUid;
  const isCoCriador =
    !!currentUid &&
    Array.isArray(espacoAtualEfetivo?.coCriadoresUids) &&
    espacoAtualEfetivo.coCriadoresUids.includes(currentUid);
  const podeGerenciarPadrao = isOwner || isCoCriador;
  const podeGerenciar = onePagePublicaAtivaEfetiva
    ? usuarioEhAdminProjeto
    : (podeGerenciarPadrao || usuarioEhAdminProjeto);
  const visibilidadeEspaco = espacoAtualEfetivo?.visibilidade || "publico";
  const visitanteOnePagePublico =
    onePagePublicaAtivaEfetiva && !currentUid && !podeGerenciar;
  const nomeRemetenteLive = String(
    localStorage.getItem("skinLogadoUser") ||
      authUserAtual?.displayName ||
      authUserAtual?.email ||
      currentUid ||
      "usuario"
  ).trim();
  const usuarioPodeControlarCameraLive = Boolean(
    liveModal.aberto &&
      currentUidAutenticado &&
      (
        String(ownerUserId || "").trim() === String(currentUidAutenticado || "").trim() ||
        usuarioEhAdminProjeto
      )
  );

  const limparCameraRemotaLive = (limparErro = false) => {
    const streamRemoto = liveCameraRemotaStreamRef.current;
    if (streamRemoto?.getTracks) {
      streamRemoto.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignora falha ao finalizar track remoto.
        }
      });
    }
    liveCameraRemotaStreamRef.current = null;

    if (liveCameraRemotaVideoRef.current) {
      try {
        liveCameraRemotaVideoRef.current.srcObject = null;
      } catch {
        // no-op
      }
    }

    setLiveCameraRemotaAtiva(false);
    setLiveCameraRemotaStatus("");
    if (limparErro) {
      setLiveCameraRemotaErro("");
    }
  };

  const encerrarViewerRtcLive = (limparErro = false) => {
    for (const unsubscribe of liveRtcViewerUnsubsRef.current) {
      try {
        unsubscribe?.();
      } catch {
        // no-op
      }
    }
    liveRtcViewerUnsubsRef.current = [];

    if (liveRtcViewerPeerRef.current) {
      try {
        liveRtcViewerPeerRef.current.close();
      } catch {
        // no-op
      }
      liveRtcViewerPeerRef.current = null;
    }

    limparCameraRemotaLive(limparErro);
  };

  const encerrarPeerRtcHost = (viewerUid) => {
    const chave = String(viewerUid || "").trim();
    if (!chave) return;

    const peerContexto = liveRtcHostPeersRef.current.get(chave);
    if (!peerContexto) return;

    for (const unsubscribe of peerContexto.unsubscribers || []) {
      try {
        unsubscribe?.();
      } catch {
        // no-op
      }
    }

    try {
      peerContexto.pc?.close?.();
    } catch {
      // no-op
    }

    liveRtcHostPeersRef.current.delete(chave);
  };

  const encerrarHostRtcLive = () => {
    if (liveRtcHostRoomUnsubRef.current) {
      try {
        liveRtcHostRoomUnsubRef.current();
      } catch {
        // no-op
      }
      liveRtcHostRoomUnsubRef.current = null;
    }

    for (const viewerUid of liveRtcHostPeersRef.current.keys()) {
      encerrarPeerRtcHost(viewerUid);
    }
    liveRtcHostPeersRef.current.clear();
  };

  const desligarCameraLive = (limparErro = false) => {
    encerrarHostRtcLive();
    const streamAtual = liveCameraStreamRef.current;
    if (streamAtual?.getTracks) {
      streamAtual.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignora falhas ao encerrar track.
        }
      });
    }
    liveCameraStreamRef.current = null;

    if (liveCameraVideoRef.current) {
      try {
        liveCameraVideoRef.current.srcObject = null;
      } catch {
        // fallback no-op
      }
    }

    setLiveCameraAtiva(false);
    if (limparErro) {
      setLiveCameraErro("");
    }
  };

  const alternarCameraLive = async () => {
    if (!usuarioPodeControlarCameraLive) return;

    if (liveCameraAtiva) {
      desligarCameraLive(true);
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator?.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      setLiveCameraErro("Seu navegador nao suporta camera neste dispositivo.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      const tracksVideo = stream?.getVideoTracks?.() || [];
      if (!tracksVideo.length) {
        throw new Error("Nenhuma trilha de video foi disponibilizada.");
      }

      desligarCameraLive();
      liveCameraStreamRef.current = stream;
      if (liveCameraVideoRef.current) {
        liveCameraVideoRef.current.srcObject = stream;
        liveCameraVideoRef.current.setAttribute("playsinline", "true");
        liveCameraVideoRef.current.setAttribute("autoplay", "true");
        liveCameraVideoRef.current.muted = true;
        await liveCameraVideoRef.current.play().catch(() => {});
      }
      setLiveCameraAtiva(true);
      setLiveCameraErro("");
    } catch (erroCamera) {
      setLiveCameraAtiva(false);
      setLiveCameraErro("Nao foi possivel acessar a camera.");
    }
  };

  useEffect(() => {
    const videoElement = liveCameraVideoRef.current;
    const streamLocal = liveCameraStreamRef.current;
    if (!liveModal.aberto || !liveCameraAtiva || !videoElement || !streamLocal) return;

    try {
      if (videoElement.srcObject !== streamLocal) {
        videoElement.srcObject = streamLocal;
      }
      videoElement.setAttribute("playsinline", "true");
      videoElement.setAttribute("autoplay", "true");
      videoElement.muted = true;
      videoElement.play().catch(() => {});
    } catch {
      // no-op
    }
  }, [liveModal.aberto, liveCameraAtiva, liveModal.contactId, liveModal.conversationId]);

  useEffect(() => {
    const videoElement = liveCameraRemotaVideoRef.current;
    const streamRemoto = liveCameraRemotaStreamRef.current;
    if (!liveModal.aberto || !liveCameraRemotaAtiva || !videoElement || !streamRemoto) return;

    try {
      if (videoElement.srcObject !== streamRemoto) {
        videoElement.srcObject = streamRemoto;
      }
      videoElement.setAttribute("playsinline", "true");
      videoElement.setAttribute("autoplay", "true");
      videoElement.play().catch(() => {});
    } catch {
      // no-op
    }
  }, [
    liveModal.aberto,
    liveCameraRemotaAtiva,
    liveModal.contactId,
    liveModal.conversationId,
  ]);

  const abrirModalImagem = ({ url = "", titulo = "", alt = "Imagem ampliada" } = {}) => {
    const imagemUrl = String(url || "").trim();
    if (!imagemUrl) return;
    setImagemModal({
      aberto: true,
      url: imagemUrl,
      titulo: String(titulo || "").trim(),
      alt: String(alt || "Imagem ampliada").trim() || "Imagem ampliada",
    });
  };

  useEffect(() => {
    if (!imagemModal.aberto) return undefined;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setImagemModal((prev) => ({ ...prev, aberto: false }));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [imagemModal.aberto]);

  useEffect(() => {
    if (!liveModal.aberto) return undefined;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setLiveModal((prev) => ({ ...prev, aberto: false }));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [liveModal.aberto]);

  useEffect(() => {
    if (liveModal.aberto) return;
    desligarCameraLive(true);
  }, [liveModal.aberto]);

  useEffect(() => {
    if (usuarioPodeControlarCameraLive) return;
    desligarCameraLive(true);
  }, [usuarioPodeControlarCameraLive]);

  useEffect(
    () => () => {
      try {
        liveRtcHostRoomUnsubRef.current?.();
      } catch {
        // no-op
      }
      liveRtcHostRoomUnsubRef.current = null;
      for (const peerContexto of liveRtcHostPeersRef.current.values()) {
        for (const unsubscribe of peerContexto?.unsubscribers || []) {
          try {
            unsubscribe?.();
          } catch {
            // no-op
          }
        }
        try {
          peerContexto?.pc?.close?.();
        } catch {
          // no-op
        }
      }
      liveRtcHostPeersRef.current.clear();

      for (const unsubscribe of liveRtcViewerUnsubsRef.current) {
        try {
          unsubscribe?.();
        } catch {
          // no-op
        }
      }
      liveRtcViewerUnsubsRef.current = [];
      try {
        liveRtcViewerPeerRef.current?.close?.();
      } catch {
        // no-op
      }
      liveRtcViewerPeerRef.current = null;

      const streamAtual = liveCameraStreamRef.current;
      if (streamAtual?.getTracks) {
        streamAtual.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // cleanup silencioso
          }
        });
      }

      const streamRemoto = liveCameraRemotaStreamRef.current;
      if (streamRemoto?.getTracks) {
        streamRemoto.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // cleanup silencioso
          }
        });
      }
    },
    []
  );

  useEffect(() => {
    const deveAtivarHostRtc =
      liveModal.aberto &&
      usuarioPodeControlarCameraLive &&
      liveCameraAtiva &&
      currentUidAutenticado &&
      liveModal.contactId &&
      liveModal.conversationId;

    if (!deveAtivarHostRtc) {
      encerrarHostRtcLive();
      return undefined;
    }

    const contactId = String(liveModal.contactId || "").trim();
    const conversationId = String(liveModal.conversationId || "principal").trim();
    const ownerUidAtual = String(currentUidAutenticado || "").trim();
    const streamLocal = liveCameraStreamRef.current;
    const sessaoRtcRef = getFirstRef(
      getLiveRtcSessionCollectionRefs(contactId, conversationId)
    );

    if (typeof RTCPeerConnection !== "function") return undefined;
    if (!sessaoRtcRef || !streamLocal) return undefined;

    const unsubscribeRoom = onSnapshot(
      sessaoRtcRef,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const viewerUid = String(change.doc.id || "").trim();
          if (!viewerUid || viewerUid === ownerUidAtual) return;

          if (change.type === "removed") {
            encerrarPeerRtcHost(viewerUid);
            return;
          }

          const dadosSessao = change.doc.data() || {};
          const offer = dadosSessao?.offer;
          const sessionToken = String(dadosSessao?.sessionToken || "").trim();
          if (!offer || typeof offer !== "object") return;
          const offerSerializado = JSON.stringify(offer);

          const peerExistente = liveRtcHostPeersRef.current.get(viewerUid);
          if (peerExistente) {
            if (peerExistente.offerSerializado === offerSerializado) return;
            encerrarPeerRtcHost(viewerUid);
          }

          const peer = new RTCPeerConnection(LIVE_WEBRTC_CONFIG);
          const viewerCandidateIds = new Set();
          const unsubscribers = [];
          const pendingViewerCandidates = [];
          let hostRemoteDescriptionReady = false;

          const aplicarViewerCandidate = (candidateData) => {
            if (!candidateData) return;
            if (!hostRemoteDescriptionReady) {
              pendingViewerCandidates.push(candidateData);
              return;
            }
            peer
              .addIceCandidate(new RTCIceCandidate(candidateData))
              .catch(() => {});
          };

          streamLocal.getTracks().forEach((track) => {
            try {
              peer.addTrack(track, streamLocal);
            } catch {
              // Ignora track invalida.
            }
          });

          peer.onicecandidate = (event) => {
            const candidate = event.candidate;
            if (!candidate) return;
            const candidateSerializado = serializarIceCandidate(candidate);
            if (!candidateSerializado) return;
            const payload = {
              candidate: candidateSerializado,
              createdAt: serverTimestamp(),
              fromUid: ownerUidAtual,
              sessionToken: sessionToken || null,
            };
            const hostCandidateRefs = getLiveRtcCandidatesCollectionRefs(
              contactId,
              conversationId,
              viewerUid,
              "hostCandidates"
            );
            hostCandidateRefs.forEach((refCandidates) => {
              addDoc(refCandidates, payload).catch(() => {});
            });
          };

          const viewerCandidatesRef = getFirstRef(
            getLiveRtcCandidatesCollectionRefs(
              contactId,
              conversationId,
              viewerUid,
              "viewerCandidates"
            )
          );

          if (viewerCandidatesRef) {
            const unsubscribeCandidates = onSnapshot(
              viewerCandidatesRef,
              (candidateSnap) => {
                candidateSnap.docChanges().forEach((candidateChange) => {
                  if (candidateChange.type === "removed") return;
                  if (viewerCandidateIds.has(candidateChange.doc.id)) return;
                  viewerCandidateIds.add(candidateChange.doc.id);

                  const candidateData = candidateChange.doc.data()?.candidate;
                  const candidateSessionToken = String(
                    candidateChange.doc.data()?.sessionToken || ""
                  ).trim();
                  if (
                    sessionToken &&
                    candidateSessionToken &&
                    candidateSessionToken !== sessionToken
                  ) {
                    return;
                  }
                  aplicarViewerCandidate(candidateData);
                });
              },
              () => {}
            );
            unsubscribers.push(unsubscribeCandidates);
          }

          liveRtcHostPeersRef.current.set(viewerUid, {
            pc: peer,
            unsubscribers,
            offerSerializado,
            sessionToken,
          });

          const sessionDocRefs = getLiveRtcSessionDocRefs(
            contactId,
            conversationId,
            viewerUid
          );

          Promise.resolve()
            .then(async () => {
              await peer.setRemoteDescription(new RTCSessionDescription(offer));
              hostRemoteDescriptionReady = true;
              while (pendingViewerCandidates.length) {
                const queuedCandidate = pendingViewerCandidates.shift();
                if (!queuedCandidate) continue;
                await peer
                  .addIceCandidate(new RTCIceCandidate(queuedCandidate))
                  .catch(() => {});
              }
              const answer = await peer.createAnswer();
              await peer.setLocalDescription(answer);

              for (const sessionDocRef of sessionDocRefs) {
                await setDoc(
                  sessionDocRef,
                  {
                    answer: serializarRtcDescricao(answer),
                    answerAt: serverTimestamp(),
                    hostUid: ownerUidAtual,
                    status: "answered",
                    sessionToken: sessionToken || null,
                  },
                  { merge: true }
                );
              }
            })
            .catch(() => {
              encerrarPeerRtcHost(viewerUid);
            });
        });
      },
      () => {}
    );

    liveRtcHostRoomUnsubRef.current = unsubscribeRoom;

    return () => {
      encerrarHostRtcLive();
    };
  }, [
    liveModal.aberto,
    liveModal.contactId,
    liveModal.conversationId,
    usuarioPodeControlarCameraLive,
    liveCameraAtiva,
    currentUidAutenticado,
  ]);

  useEffect(() => {
    const deveConectarViewer =
      liveModal.aberto &&
      !usuarioPodeControlarCameraLive &&
      currentUidAutenticado &&
      liveModal.contactId &&
      liveModal.conversationId;

    if (!deveConectarViewer) {
      encerrarViewerRtcLive(true);
      return undefined;
    }

    const contactId = String(liveModal.contactId || "").trim();
    const conversationId = String(liveModal.conversationId || "principal").trim();
    const viewerUid = String(currentUidAutenticado || "").trim();
    const sessaoRef = getFirstRef(
      getLiveRtcSessionDocRefs(contactId, conversationId, viewerUid)
    );
    const hostCandidatesRef = getFirstRef(
      getLiveRtcCandidatesCollectionRefs(
        contactId,
        conversationId,
        viewerUid,
        "hostCandidates"
      )
    );
    const viewerCandidatesRefs = getLiveRtcCandidatesCollectionRefs(
      contactId,
      conversationId,
      viewerUid,
      "viewerCandidates"
    );

    if (!sessaoRef) {
      setLiveCameraRemotaErro("Canal da camera ao vivo indisponivel.");
      return undefined;
    }
    if (typeof RTCPeerConnection !== "function") {
      setLiveCameraRemotaErro("Seu navegador nao suporta transmissao ao vivo.");
      return undefined;
    }

    setLiveCameraRemotaErro("");
    setLiveCameraRemotaStatus("Aguardando camera do criador...");

    const peer = new RTCPeerConnection(LIVE_WEBRTC_CONFIG);
    liveRtcViewerPeerRef.current = peer;
    const sessionToken = `${viewerUid}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    let respostaAplicada = false;
    const hostCandidateIds = new Set();
    const pendingHostCandidates = [];
    let viewerRemoteDescriptionReady = false;

    const aplicarHostCandidate = (candidateData) => {
      if (!candidateData) return;
      if (!viewerRemoteDescriptionReady) {
        pendingHostCandidates.push(candidateData);
        return;
      }
      peer
        .addIceCandidate(new RTCIceCandidate(candidateData))
        .catch(() => {});
    };

    peer.addTransceiver("video", { direction: "recvonly" });

    peer.ontrack = (event) => {
      const stream = event.streams?.[0];
      if (!stream) return;
      liveCameraRemotaStreamRef.current = stream;
      if (liveCameraRemotaVideoRef.current) {
        try {
          liveCameraRemotaVideoRef.current.srcObject = stream;
          liveCameraRemotaVideoRef.current.play().catch(() => {});
        } catch {
          // no-op
        }
      }
      setLiveCameraRemotaAtiva(true);
      setLiveCameraRemotaErro("");
      setLiveCameraRemotaStatus("Camera do criador conectada.");
    };

    peer.onconnectionstatechange = () => {
      const estado = String(peer.connectionState || "").toLowerCase();
      if (estado === "failed" || estado === "disconnected") {
        setLiveCameraRemotaStatus("Conexao da camera interrompida.");
      }
    };

    peer.onicecandidate = (event) => {
      const candidate = event.candidate;
      if (!candidate) return;
      const candidateSerializado = serializarIceCandidate(candidate);
      if (!candidateSerializado) return;
      const payload = {
        candidate: candidateSerializado,
        createdAt: serverTimestamp(),
        fromUid: viewerUid,
        sessionToken,
      };
      viewerCandidatesRefs.forEach((refCandidates) => {
        addDoc(refCandidates, payload).catch(() => {});
      });
    };

    const unsubscribeSessao = onSnapshot(
      sessaoRef,
      async (sessionSnap) => {
        const dadosSessao = sessionSnap.data() || {};
        const answer = dadosSessao?.answer;
        const answerSessionToken = String(dadosSessao?.sessionToken || "").trim();
        if (answerSessionToken && answerSessionToken !== sessionToken) return;
        if (!answer || respostaAplicada) return;

        try {
          await peer.setRemoteDescription(new RTCSessionDescription(answer));
          viewerRemoteDescriptionReady = true;
          while (pendingHostCandidates.length) {
            const queuedCandidate = pendingHostCandidates.shift();
            if (!queuedCandidate) continue;
            await peer
              .addIceCandidate(new RTCIceCandidate(queuedCandidate))
              .catch(() => {});
          }
          respostaAplicada = true;
        } catch {
          setLiveCameraRemotaStatus("Falha ao conectar camera do criador.");
        }
      },
      () => {
        setLiveCameraRemotaStatus("Falha ao acompanhar camera ao vivo.");
      }
    );

    const unsubscribeHostCandidates = hostCandidatesRef
      ? onSnapshot(
          hostCandidatesRef,
          (candidateSnap) => {
            candidateSnap.docChanges().forEach((candidateChange) => {
              if (candidateChange.type === "removed") return;
              if (hostCandidateIds.has(candidateChange.doc.id)) return;
              hostCandidateIds.add(candidateChange.doc.id);
              const candidateData = candidateChange.doc.data()?.candidate;
              const candidateSessionToken = String(
                candidateChange.doc.data()?.sessionToken || ""
              ).trim();
              if (
                sessionToken &&
                candidateSessionToken &&
                candidateSessionToken !== sessionToken
              ) {
                return;
              }
              aplicarHostCandidate(candidateData);
            });
          },
          () => {}
        )
      : () => {};

    liveRtcViewerUnsubsRef.current = [unsubscribeSessao, unsubscribeHostCandidates];

    Promise.resolve()
      .then(async () => {
        const offer = await peer.createOffer({
          offerToReceiveVideo: true,
          offerToReceiveAudio: false,
        });
        await peer.setLocalDescription(offer);

        await setDoc(
          sessaoRef,
          {
            viewerUid,
            requestedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            status: "offer",
            offer: serializarRtcDescricao(offer),
            answer: null,
            answerAt: null,
            hostUid: null,
            sessionToken,
          },
          { merge: true }
        );
      })
      .catch((erroInitViewer) => {
        const code = String(erroInitViewer?.code || "").trim().toLowerCase();
        const message = String(erroInitViewer?.message || "").trim();
        console.error("Falha ao iniciar viewer WebRTC:", code || "-", message || "-", erroInitViewer);

        if (code === "permission-denied") {
          setLiveCameraRemotaErro("Sem permissao para iniciar camera ao vivo.");
          return;
        }
        if (code === "unauthenticated") {
          setLiveCameraRemotaErro("Sessao expirada. Faca login novamente para abrir a camera.");
          return;
        }
        if (code === "unavailable" || code === "network-request-failed") {
          setLiveCameraRemotaErro("Falha de rede com Firebase. Verifique sua conexao e tente novamente.");
          return;
        }

        setLiveCameraRemotaErro("Nao foi possivel iniciar camera ao vivo.");
      });

    return () => {
      encerrarViewerRtcLive(true);
    };
  }, [
    liveModal.aberto,
    liveModal.contactId,
    liveModal.conversationId,
    usuarioPodeControlarCameraLive,
    currentUidAutenticado,
  ]);

  useEffect(() => {
    if (!liveModal.aberto || !liveModal.contactId || !liveModal.conversationId) {
      setLiveChatMensagens([]);
      if (!currentUidAutenticado) {
        setLiveChatErro("Faça login para participar do chat da live.");
      } else {
        setLiveChatErro("");
      }
      return undefined;
    }
    if (!currentUidAutenticado) {
      setLiveChatMensagens([]);
      setLiveChatErro("Faça login para participar do chat da live.");
      return undefined;
    }

    const chatRef = getFirstRef(
      getChatCollectionRefs(liveModal.contactId, liveModal.conversationId)
    );
    if (!chatRef) {
      setLiveChatErro("Chat da live indisponivel.");
      return undefined;
    }
    const q = query(chatRef, orderBy("data", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setLiveChatErro("");
        const mensagens = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() || {};
          return {
            id: docSnap.id,
            mensagem: String(data?.mensagem || "").trim(),
            userRemetente: String(data?.userRemetente || "").trim(),
            userUid: String(data?.userUid || "").trim(),
            data: data?.data?.toDate ? data.data.toDate() : null,
          };
        });
        setLiveChatMensagens(mensagens);
      },
      (erroSnapshot) => {
        if (erroSnapshot?.code === "permission-denied") {
          setLiveChatErro("Sem permissao para visualizar o chat da live.");
          setLiveChatMensagens([]);
          return;
        }
        setLiveChatErro("Falha ao carregar mensagens da live.");
        setLiveChatMensagens([]);
      }
    );

    return () => unsubscribe();
  }, [liveModal.aberto, liveModal.contactId, liveModal.conversationId, currentUidAutenticado]);

  useEffect(() => {
    if (!liveChatScrollRef.current) return;
    liveChatScrollRef.current.scrollTop = liveChatScrollRef.current.scrollHeight;
  }, [liveChatMensagens, liveModal.aberto]);

  useEffect(() => {
    let ativo = true;

    async function carregarEspacoCompletoAtual() {
      if (!espacoId || !ownerUserId) {
        if (ativo) setEspacoDetalheAtual(null);
        return;
      }

      try {
        const detalhe = await getEspacoCompleto(ownerUserId, espacoId);
        if (ativo) {
          setEspacoDetalheAtual(detalhe);
        }
      } catch (err) {
        if (!ativo) return;
        if (err?.code === "permission-denied") {
          setEspacoDetalheAtual(null);
          return;
        }
        console.error("Erro ao carregar detalhes do espaco:", err);
        setEspacoDetalheAtual(null);
      }
    }

    carregarEspacoCompletoAtual();
    return () => {
      ativo = false;
    };
  }, [espacoId, ownerUserId, reloadNonce]);

  const idsAssinantePossiveis = useMemo(
    () => [currentUid, skinIdAtual].filter(Boolean),
    [currentUid, skinIdAtual]
  );

  const podeVerEspaco = (() => {
    if (podeGerenciar) return true;
    if (!visibilidadeEspaco || visibilidadeEspaco === "publico") return true;
    if (visibilidadeEspaco === "publico_restritivo" || visibilidadeEspaco === "privado") {
      return !!currentUid;
    }
    if (visibilidadeEspaco === "exclusivo_assinante") {
      return isAssinante;
    }
    return true;
  })();

  const espacoExigeChecagemAssinatura =
    visibilidadeEspaco === "exclusivo_assinante" && !podeGerenciar;
  const acessoEspacoResolvido = !espacoExigeChecagemAssinatura || assinaturaCheckPronto;

  const podeVerBloco = (bloco) => {
    if (podeGerenciar) return true;

    const vis = bloco?.visibilidade || "publico";
    if (vis === "publico") return true;
    if (vis === "publico_restritivo" || vis === "privado") return !!currentUid;
    if (vis === "exclusivo_assinante") return isAssinante;
    if (vis === "exclusivo_comprador" || vis === "comprado") {
      return !!compradorPorBloco[bloco.id];
    }
    return true;
  };

  const tipoRestricaoBloco = (bloco) => {
    const vis = bloco?.visibilidade || "publico";
    if (vis === "exclusivo_assinante") return "assinante";
    if (vis === "exclusivo_comprador" || vis === "comprado") return "comprador";
    return "login";
  };

  const resolverUrlArquivo = async (path) => {
    if (usandoBucketCompartilhadoCrossProject) {
      return obterUrlArquivoNoBucketCompartilhado({ user, path });
    }
    return getDownloadURL(ref(storage, path));
  };

  const subirArquivoStorage = async (path, arquivo) => {
    if (usandoBucketCompartilhadoCrossProject) {
      return uploadArquivoNoBucketCompartilhado({ user, path, file: arquivo });
    }

    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, arquivo);

    let url = "";
    try {
      url = await getDownloadURL(storageRef);
    } catch {
      url = "";
    }

    return { path, url };
  };

  const excluirArquivoStorage = async (path) => {
    if (usandoBucketCompartilhadoCrossProject) {
      await excluirArquivoNoBucketCompartilhado({ user, path });
      return;
    }
    await deleteObject(ref(storage, path));
  };

  useEffect(() => {
    let ativo = true;

    async function carregarConfigSistema() {
      try {
        const config = await obterConfigSistema();
        if (!ativo) return;
        setMercadoPagoSistemaHabilitado(config?.mercadoPagoHabilitado !== false);
        setPixManualSistemaHabilitado(config?.pixManualHabilitado !== false);
        setLivesHabilitadas(config?.livesHabilitadas === true);
        setOnePagePublicaAtiva(
          isOnePageComEntradaPublica(config)
        );
        setAdminUidProjeto(String(config?.adminUid || "").trim());
        setAdminEmailProjeto(String(config?.adminEmail || "").trim().toLowerCase());
        const rotulosSkin = obterRotulosSkin(config);
        const rotulosEspaco = obterRotulosEspaco(config);
        const rotulosBloco = obterRotulosBloco(config);
        setNomeSkinSingular(rotulosSkin.singular || DEFAULT_SISTEMA_CONFIG.nomeSkinSingular);
        setNomeEspacoSingular(
          rotulosEspaco.singular || DEFAULT_SISTEMA_CONFIG.nomeEspacoSingular
        );
        setNomeEspacoPlural(rotulosEspaco.plural || DEFAULT_SISTEMA_CONFIG.nomeEspacoPlural);
        setNomeBlocoSingular(rotulosBloco.singular || DEFAULT_SISTEMA_CONFIG.nomeBlocoSingular);
        setNomeBlocoPlural(rotulosBloco.plural || DEFAULT_SISTEMA_CONFIG.nomeBlocoPlural);
        setMensagemEspacoLoginRestrito(
          String(
            config?.mensagemEspacoLoginRestrito ||
              DEFAULT_SISTEMA_CONFIG.mensagemEspacoLoginRestrito
          )
        );
        setMensagemEspacoLoginRestritoFontFamily(
          String(
            config?.mensagemEspacoLoginRestritoFontFamily ||
              DEFAULT_SISTEMA_CONFIG.mensagemEspacoLoginRestritoFontFamily
          )
        );
        setMensagemEspacoAssinanteRestrito(
          String(
            config?.mensagemEspacoAssinanteRestrito ||
              DEFAULT_SISTEMA_CONFIG.mensagemEspacoAssinanteRestrito
          )
        );
        setMensagemEspacoAssinanteRestritoFontFamily(
          String(
            config?.mensagemEspacoAssinanteRestritoFontFamily ||
              DEFAULT_SISTEMA_CONFIG.mensagemEspacoAssinanteRestritoFontFamily
          )
        );
        setGoogleFontsUrlsProjeto(Array.isArray(config?.googleFontsUrls) ? config.googleFontsUrls : []);
        setExibirBotaoLoginMensagemRestricao(
          config?.exibirBotaoLoginMensagemRestricao !== false
        );
        setMensagemRestricaoAvatarUrl(
          String(
            config?.mensagemRestricaoAvatarUrl ||
              DEFAULT_SISTEMA_CONFIG.mensagemRestricaoAvatarUrl
          )
        );
      } catch {
        if (!ativo) return;
        const configFallback = obterConfigSistemaCacheLocal() || configSistemaCacheLocal;
        setMercadoPagoSistemaHabilitado(configFallback?.mercadoPagoHabilitado !== false);
        setPixManualSistemaHabilitado(configFallback?.pixManualHabilitado !== false);
        setLivesHabilitadas(configFallback?.livesHabilitadas === true);
        setOnePagePublicaAtiva(
          isOnePageComEntradaPublica(configFallback)
        );
        setAdminUidProjeto(
          String(
            configFallback?.adminUid || localStorage.getItem("systemAdminUid") || ""
          ).trim()
        );
        setAdminEmailProjeto(
          String(
            configFallback?.adminEmail || localStorage.getItem("systemAdminEmail") || ""
          )
            .trim()
            .toLowerCase()
        );
        const rotulosSkin = obterRotulosSkin(configFallback);
        const rotulosEspaco = obterRotulosEspaco(configFallback);
        const rotulosBloco = obterRotulosBloco(configFallback);
        setNomeSkinSingular(rotulosSkin.singular || DEFAULT_SISTEMA_CONFIG.nomeSkinSingular);
        setNomeEspacoSingular(
          rotulosEspaco.singular || DEFAULT_SISTEMA_CONFIG.nomeEspacoSingular
        );
        setNomeEspacoPlural(rotulosEspaco.plural || DEFAULT_SISTEMA_CONFIG.nomeEspacoPlural);
        setNomeBlocoSingular(rotulosBloco.singular || DEFAULT_SISTEMA_CONFIG.nomeBlocoSingular);
        setNomeBlocoPlural(rotulosBloco.plural || DEFAULT_SISTEMA_CONFIG.nomeBlocoPlural);
        setMensagemEspacoLoginRestrito(
          String(
            configFallback?.mensagemEspacoLoginRestrito ||
              DEFAULT_SISTEMA_CONFIG.mensagemEspacoLoginRestrito
          )
        );
        setMensagemEspacoLoginRestritoFontFamily(
          String(
            configFallback?.mensagemEspacoLoginRestritoFontFamily ||
              DEFAULT_SISTEMA_CONFIG.mensagemEspacoLoginRestritoFontFamily
          )
        );
        setMensagemEspacoAssinanteRestrito(
          String(
            configFallback?.mensagemEspacoAssinanteRestrito ||
              DEFAULT_SISTEMA_CONFIG.mensagemEspacoAssinanteRestrito
          )
        );
        setMensagemEspacoAssinanteRestritoFontFamily(
          String(
            configFallback?.mensagemEspacoAssinanteRestritoFontFamily ||
              DEFAULT_SISTEMA_CONFIG.mensagemEspacoAssinanteRestritoFontFamily
          )
        );
        setGoogleFontsUrlsProjeto(
          Array.isArray(configFallback?.googleFontsUrls) ? configFallback.googleFontsUrls : []
        );
        setExibirBotaoLoginMensagemRestricao(
          configFallback?.exibirBotaoLoginMensagemRestricao !== false
        );
        setMensagemRestricaoAvatarUrl(
          String(
            configFallback?.mensagemRestricaoAvatarUrl ||
              DEFAULT_SISTEMA_CONFIG.mensagemRestricaoAvatarUrl
          )
        );
      }
    }

    carregarConfigSistema();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    carregarGoogleFontsNoDocumento(googleFontsUrlsProjeto);
  }, [googleFontsUrlsProjeto]);

  useEffect(() => {
    if (!espacoId || !ownerUserId) return;

    async function checarAssinaturaEspaco() {
      if (!idsAssinantePossiveis.length) {
        setIsAssinante(false);
        setAssinaturaCheckPronto(true);
        return;
      }

      setAssinaturaCheckPronto(false);
        try {
          let found = false;
          for (const assinanteId of idsAssinantePossiveis) {
            try {
              for (const assinaturaRef of getEspacoAssinanteRefs(
                ownerUserId,
                espacoId,
                assinanteId
              )) {
                const assinaturaSnap = await getDoc(assinaturaRef);
                if (assinaturaSnap.exists()) {
                  found = true;
                  break;
                }
              }
              if (found) break;
            } catch (err) {
              if (err?.code !== "permission-denied") throw err;
            }
        }
        setIsAssinante(found);
      } catch (err) {
        console.error("Erro ao checar assinatura do espaco:", err);
        setIsAssinante(false);
      } finally {
        setAssinaturaCheckPronto(true);
      }
    }

    checarAssinaturaEspaco();
  }, [espacoId, ownerUserId, idsAssinantePossiveis]);

  useEffect(() => {
    if (!espacoId || !ownerUserId) return;

    if (espacoExigeChecagemAssinatura && !assinaturaCheckPronto) {
      return;
    }

    if (!podeVerEspaco) {
      setBlocos([]);
      setOriginaisPorBloco({});
      setPreviewsPorBloco({});
      setImagensCardsPorBloco({});
      blockedOriginalPathsRef.current.clear();
      blockedPreviewPathsRef.current.clear();
      setErroBlocos("");
      return;
    }

    async function carregarBlocos() {
      try {
        setErroBlocos("");
        const blocosRefs = getBlocosCollectionRefs(ownerUserId, espacoId);

        const docs = [];

        if (visitanteOnePagePublico) {
          for (const blocosRef of blocosRefs) {
            const queriesPublicas = [
              query(blocosRef, where("visibilidade", "==", "publico")),
              query(blocosRef, where("visibilidade", "==", null)),
            ];

            const results = await Promise.allSettled(
              queriesPublicas.map((qRef) => getDocs(qRef))
            );

            for (const result of results) {
              if (result.status === "fulfilled") {
                docs.push(
                  ...result.value.docs.map((d) => ({ __legacy: false, docSnap: d }))
                );
              } else if (
                result.reason?.code &&
                result.reason.code !== "permission-denied" &&
                result.reason.code !== "failed-precondition"
              ) {
                throw result.reason;
              }
            }

            if (!docs.length) {
              try {
                const snap = await getDocs(blocosRef);
                docs.push(...snap.docs.map((d) => ({ __legacy: false, docSnap: d })));
              } catch (allErr) {
                if (
                  allErr?.code !== "permission-denied" &&
                  allErr?.code !== "failed-precondition"
                ) {
                  throw allErr;
                }
              }
            }

            if (docs.length) break;
          }
        } else {
          for (const blocosRef of blocosRefs) {
            try {
              const snap = await getDocs(blocosRef);
              docs.push(...snap.docs.map((d) => ({ __legacy: false, docSnap: d })));
            } catch (allErr) {
              if (allErr?.code !== "permission-denied") throw allErr;

              const queries = [
                query(blocosRef, where("visibilidade", "==", "publico")),
                query(blocosRef, where("visibilidade", "==", "publico_restritivo")),
                query(blocosRef, where("visibilidade", "==", "privado")),
                query(blocosRef, where("visibilidade", "==", "exclusivo_assinante")),
                query(blocosRef, where("visibilidade", "==", "exclusivo_comprador")),
                query(blocosRef, where("visibilidade", "==", "comprado")),
                query(blocosRef, where("visibilidade", "==", null)),
              ];

              const results = await Promise.allSettled(
                queries.map((qRef) => getDocs(qRef))
              );

              for (const result of results) {
                if (result.status === "fulfilled") {
                  docs.push(
                    ...result.value.docs.map((d) => ({ __legacy: false, docSnap: d }))
                  );
                } else if (
                  result.reason?.code &&
                  result.reason.code !== "permission-denied" &&
                  result.reason.code !== "failed-precondition"
                ) {
                  throw result.reason;
                }
              }
            }

            if (docs.length) break;
          }
        }

        if (!docs.length) {
          const legacyQuery = query(
            collection(db, "blocos"),
            where("espacoId", "==", espacoId)
          );
          try {
            const legacySnap = await getDocs(legacyQuery);
            docs.push(
              ...legacySnap.docs.map((d) => ({ __legacy: true, docSnap: d }))
            );
          } catch (legacyErr) {
            if (legacyErr?.code !== "permission-denied") throw legacyErr;
          }
        }

        const dedupe = new Map();
        for (const item of docs) {
          const d = item.docSnap;
          const blocoData = d.data();
          dedupe.set(d.id, {
            id: d.id,
            __legacy: item.__legacy,
            ...blocoData,
            cards: normalizarCardsDoBloco(blocoData?.cards),
          });
        }

        const lista = [...dedupe.values()].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
        setBlocos(lista);
      } catch (err) {
        console.error("Erro ao carregar blocos:", err);
        setErroBlocos(err?.message || "Erro ao carregar blocos");
      }
    }

    carregarBlocos();
  }, [
    espacoId,
    ownerUserId,
    podeVerEspaco,
    espacoExigeChecagemAssinatura,
    assinaturaCheckPronto,
    reloadNonce,
  ]);

  useEffect(() => {
    if (!ownerUserId || !espacoId || !podeVerEspaco || !blocos.length) return;

    const blocosCardsSemLista = blocos.filter(
      (bloco) =>
        bloco?.tipo === "cards" &&
        (!Array.isArray(bloco.cards) || !bloco.cards.length)
    );

    if (!blocosCardsSemLista.length) return;

    let cancelado = false;

    async function carregarCardsSubcolecao() {
      const cardsPorBloco = {};

      for (const bloco of blocosCardsSemLista) {
        try {
          const cardsDocs = [];
          const cardsRefs = bloco?.__legacy
            ? [collection(db, "blocos", bloco.id, "cards")]
            : getBlocoCardsCollectionRefs(ownerUserId, espacoId, bloco.id);
          for (const cardsRef of cardsRefs) {
            const cardsSnap = await getDocs(cardsRef);
            cardsDocs.push(...cardsSnap.docs);
            if (cardsSnap.docs.length) break;
          }
          const cards = normalizarCardsDoBloco(
            cardsDocs.map((cardDoc) => ({
              id: cardDoc.id,
              ...cardDoc.data(),
            }))
          );
          if (cards.length) {
            cardsPorBloco[bloco.id] = cards;
          }
        } catch (err) {
          if (err?.code !== "permission-denied") {
            console.error("Erro ao carregar cards do bloco:", bloco.id, err);
          }
        }
      }

      if (cancelado || !Object.keys(cardsPorBloco).length) return;

      setBlocos((prev) =>
        prev.map((bloco) =>
          cardsPorBloco[bloco.id]
            ? { ...bloco, cards: cardsPorBloco[bloco.id] }
            : bloco
        )
      );
    }

    carregarCardsSubcolecao();

    return () => {
      cancelado = true;
    };
  }, [blocos, ownerUserId, espacoId, podeVerEspaco]);

  useEffect(() => {
    if (!podeVerEspaco || !blocos.length) {
      setImagensCardsPorBloco({});
      return;
    }

    const cardsComPath = [];
    for (const bloco of blocos) {
      if (bloco?.tipo !== "cards") continue;
      const cards = normalizarCardsDoBloco(bloco?.cards);
      for (const card of cards) {
        if (!card.imagemPath) continue;
        if (isRenderableUrl(card.imagem)) continue;
        cardsComPath.push({ blocoId: bloco.id, cardId: card.id, path: card.imagemPath });
      }
    }

    if (!cardsComPath.length) return;

    let cancelado = false;

    async function resolverImagensCards() {
      const mapa = {};
      for (const item of cardsComPath) {
        try {
          const url = await resolverUrlArquivo(item.path);
          if (!url) continue;
          if (!mapa[item.blocoId]) mapa[item.blocoId] = {};
          mapa[item.blocoId][item.cardId] = url;
        } catch (err) {
          if (err?.code !== "storage/object-not-found" && err?.code !== "storage/unauthorized") {
            console.warn("Erro ao resolver imagem do card:", item.path, err?.code, err?.message);
          }
        }
      }

      if (cancelado || !Object.keys(mapa).length) return;

      setImagensCardsPorBloco((prev) => {
        const next = { ...prev };
        for (const blocoId of Object.keys(mapa)) {
          next[blocoId] = {
            ...(next[blocoId] || {}),
            ...mapa[blocoId],
          };
        }
        return next;
      });
    }

    resolverImagensCards();

    return () => {
      cancelado = true;
    };
  }, [blocos, podeVerEspaco, currentUid]);

  useEffect(() => {
    if (!podeVerEspaco || !blocos.length) {
      setCompradorPorBloco({});
      return;
    }

    async function checarCompras() {
      if (!idsAssinantePossiveis.length) {
        setCompradorPorBloco({});
        return;
      }

      const mapa = {};

      for (const bloco of blocos) {
        const vis = bloco?.visibilidade || "publico";
        const exigeCompra = vis === "exclusivo_comprador" || vis === "comprado";
        if (!exigeCompra) continue;

        let found = false;
        for (const compradorId of idsAssinantePossiveis) {
          try {
            const compradorRefs = bloco.__legacy
              ? [doc(db, "blocos", bloco.id, "compradores", compradorId)]
              : getBlocoCompradorRefs(ownerUserId, espacoId, bloco.id, compradorId);
            for (const compradorRef of compradorRefs) {
              const compradorSnap = await getDoc(compradorRef);
              if (compradorSnap.exists()) {
                found = true;
                break;
              }
            }
            if (found) break;
          } catch (err) {
            if (err?.code !== "permission-denied") throw err;
          }
        }
        mapa[bloco.id] = found;
      }

      setCompradorPorBloco(mapa);
    }

    checarCompras().catch((err) => {
      console.error("Erro ao checar compras dos blocos:", err);
      setCompradorPorBloco({});
    });
  }, [blocos, idsAssinantePossiveis, ownerUserId, espacoId, podeVerEspaco]);

  useEffect(() => {
    if (!currentUid || !ownerUserId || !espacoId || !podeVerEspaco) {
      setSessaoChatPorBloco({});
      return;
    }

    let cancelado = false;

    async function carregarSessoesChatComprador() {
      try {
        const pedidosDocs = [];
        for (const pedidosRef of getPedidosCollectionRefs(ownerUserId)) {
          const pedidosSnap = await getDocs(
            query(pedidosRef, where("compradorUid", "==", currentUid))
          );
          pedidosDocs.push(...pedidosSnap.docs);
          if (pedidosSnap.docs.length) break;
        }

        if (cancelado) return;

        const mapa = {};
        for (const pedidoDoc of pedidosDocs) {
          const pedido = pedidoDoc.data() || {};
          const status = String(pedido?.status || "pedido_solicitado").trim().toLowerCase();
          if (status !== "pagamento_confirmado") continue;
          if (String(pedido?.espacoId || "").trim() !== String(espacoId || "").trim()) continue;

          const blocoId = String(pedido?.blocoId || "").trim();
          const contactId = String(pedido?.sessionContactId || "").trim();
          const conversationId = String(pedido?.sessionConversationId || "principal").trim();
          if (!blocoId || !contactId) continue;

          mapa[blocoId] = {
            contactId,
            conversationId: conversationId || "principal",
          };
        }

        setSessaoChatPorBloco(mapa);
      } catch (err) {
        if (!cancelado) {
          setSessaoChatPorBloco({});
        }
        if (err?.code !== "permission-denied") {
          console.error("Erro ao carregar chat de sessao por bloco:", err);
        }
      }
    }

    carregarSessoesChatComprador();

    return () => {
      cancelado = true;
    };
  }, [currentUid, ownerUserId, espacoId, podeVerEspaco, reloadNonce]);

  useEffect(() => {
    if (!podeVerEspaco || !blocos.length) {
      setOriginaisPorBloco((prev) => (Object.keys(prev).length ? {} : prev));
      blockedOriginalPathsRef.current.clear();
      return;
    }

    let cancelado = false;

    async function carregarOriginaisAutorizadas() {
      const mapa = {};

      for (const bloco of blocos) {
        const visibilidadeBloco = bloco?.visibilidade || "publico";
        if (!currentUid && visibilidadeBloco === "publico") {
          // Visitante deslogado usa URLs publicas tokenizadas do documento.
          continue;
        }
        if (!podeVerBloco(bloco)) continue;

        const paths = normalizarListaImagens(bloco.imagensOriginaisPaths)
          .filter((path) => typeof path === "string" && path.includes("/original/"));
        if (!paths.length) continue;

        const urls = [];
        for (const path of paths) {
          if (blockedOriginalPathsRef.current.has(path)) {
            continue;
          }
          try {
            const url = await resolverUrlArquivo(path);
            urls.push(url);
          } catch (err) {
            if (err?.code === "storage/unauthorized" || err?.code === "storage/object-not-found") {
              blockedOriginalPathsRef.current.add(path);
            } else {
              console.warn(
                "Erro ao resolver imagem original do bloco:",
                bloco.id,
                err?.code,
                err?.message
              );
            }
          }
        }

        if (urls.length) {
          mapa[bloco.id] = urls;
        }
      }

      if (!cancelado) {
        setOriginaisPorBloco(mapa);
      }
    }

    carregarOriginaisAutorizadas();

    return () => {
      cancelado = true;
    };
  }, [
    blocos,
    podeVerEspaco,
    currentUid,
    podeGerenciar,
    authUid,
    isAssinante,
    compradorPorBloco,
  ]);

  useEffect(() => {
    if (!podeGerenciar || !authUid || !ownerUserId || !espacoId || !blocos.length) {
      return;
    }

    let cancelado = false;

    async function backfillUrlsPublicasOriginais() {
      for (const bloco of blocos) {
        if (cancelado) return;

        const visibilidadeBloco = bloco?.visibilidade || "publico";
        if (visibilidadeBloco !== "publico") continue;
        if (backfilledPublicUrlsRef.current.has(bloco.id)) continue;

        const existentes = normalizarListaImagens(bloco.imagensOriginaisPublicas)
          .filter(isRenderableUrl);
        if (existentes.length) {
          backfilledPublicUrlsRef.current.add(bloco.id);
          continue;
        }

        const paths = normalizarListaImagens(bloco.imagensOriginaisPaths)
          .filter((path) => typeof path === "string" && path.includes("/original/"));
        if (!paths.length) {
          backfilledPublicUrlsRef.current.add(bloco.id);
          continue;
        }

        const urlsPublicas = [];
        for (const path of paths) {
          try {
            const url = await resolverUrlArquivo(path);
            urlsPublicas.push(url);
          } catch {
            // Mantem silencioso; novo ciclo pode resolver apos refresh/login.
          }
        }

        if (!urlsPublicas.length) continue;

        try {
          const blocoRefs = bloco.__legacy
            ? [doc(db, "blocos", bloco.id)]
            : getBlocoDocRefs(ownerUserId, espacoId, bloco.id);
          for (const blocoRef of blocoRefs) {
            await updateDoc(blocoRef, {
              imagensOriginaisPublicas: urlsPublicas,
              imagens: urlsPublicas,
            });
          }

          backfilledPublicUrlsRef.current.add(bloco.id);
          if (cancelado) return;

          setBlocos((prev) =>
            prev.map((item) =>
              item.id === bloco.id
                ? {
                    ...item,
                    imagensOriginaisPublicas: urlsPublicas,
                    imagens: urlsPublicas,
                  }
                : item
            )
          );
        } catch (err) {
          if (err?.code !== "permission-denied") {
            console.warn("Falha no backfill de URLs publicas:", bloco.id, err?.message);
          }
        }
      }
    }

    backfillUrlsPublicasOriginais();

    return () => {
      cancelado = true;
    };
  }, [blocos, podeGerenciar, authUid, ownerUserId, espacoId]);

  useEffect(() => {
    // Se o contexto de acesso mudou (ex.: login do criador), limpa caches de bloqueio.
    blockedOriginalPathsRef.current.clear();
    blockedPreviewPathsRef.current.clear();
  }, [currentUid, podeGerenciar, espacoId]);

  useEffect(() => {
    if (!podeVerEspaco || !blocos.length) {
      setPreviewsPorBloco({});
      blockedPreviewPathsRef.current.clear();
      return;
    }

    let cancelado = false;

    async function carregarPreviewsPermitidas() {
      const mapa = {};

      for (const bloco of blocos) {
        const fromDoc = normalizarListaImagens(bloco.imagensPreview).filter(isRenderableUrl);
        const fromPaths = normalizarListaImagens(bloco.imagensPreviewPaths)
          .filter((path) => typeof path === "string" && path.includes("/preview/"));

        const resolved = [];
        for (const path of fromPaths) {
          if (blockedPreviewPathsRef.current.has(path)) {
            continue;
          }
          try {
            const url = await getDownloadURL(ref(storage, path));
            resolved.push(url);
          } catch (err) {
            if (err?.code === "storage/unauthorized" || err?.code === "storage/object-not-found") {
              blockedPreviewPathsRef.current.add(path);
            } else {
              console.warn(
                "Erro ao resolver preview do bloco:",
                bloco.id,
                err?.code,
                err?.message
              );
            }
          }
        }

        const unicas = [...new Set([...fromDoc, ...resolved])];
        if (unicas.length) {
          mapa[bloco.id] = unicas;
        }
      }

      if (!cancelado) {
        setPreviewsPorBloco(mapa);
      }
    }

    carregarPreviewsPermitidas();

    return () => {
      cancelado = true;
    };
  }, [blocos, podeVerEspaco, currentUid]);

  if (!espacoAtual) {
    return <p>{`${nomeEspacoSingularCapitalizado} nao encontrado`}</p>;
  }

  const resolverTemplateMensagemEspaco = (template, fallback) => {
    const base = String(template || fallback || "").trim();
    if (!base) return "Conteudo restrito.";
    return base.replaceAll("{nomeEspacoSingular}", nomeEspacoSingular);
  };

  const mensagemRestricaoEspaco = (() => {
    if (visibilidadeEspaco === "exclusivo_assinante") {
      return resolverTemplateMensagemEspaco(
        mensagemEspacoAssinanteRestrito,
        DEFAULT_SISTEMA_CONFIG.mensagemEspacoAssinanteRestrito
      );
    }
    if (visibilidadeEspaco === "privado" || visibilidadeEspaco === "publico_restritivo") {
      return resolverTemplateMensagemEspaco(
        mensagemEspacoLoginRestrito,
        DEFAULT_SISTEMA_CONFIG.mensagemEspacoLoginRestrito
      );
    }
    return "Conteudo restrito.";
  })();
  const fonteMensagemRestricaoEspaco = (() => {
    if (visibilidadeEspaco === "exclusivo_assinante") {
      return String(mensagemEspacoAssinanteRestritoFontFamily || "").trim();
    }
    if (visibilidadeEspaco === "privado" || visibilidadeEspaco === "publico_restritivo") {
      return String(mensagemEspacoLoginRestritoFontFamily || "").trim();
    }
    return "";
  })();
  const estiloMensagemRestricaoEspaco = fonteMensagemRestricaoEspaco
    ? { fontFamily: montarFontFamilyCss(fonteMensagemRestricaoEspaco) }
    : undefined;
  const tipoRestricaoEspaco =
    visibilidadeEspaco === "exclusivo_assinante" ? "assinante" : "login";
  const mostrarCtaRestricaoEspaco =
    tipoRestricaoEspaco !== "login" || exibirBotaoLoginMensagemRestricao !== false;
  const avatarMensagemRestricao = String(mensagemRestricaoAvatarUrl || "").trim();
  const conteudoEspacoBruto = String(espacoAtualEfetivo?.conteudo || "").trim();
  const conteudoEspaco =
    conteudoEspacoBruto.toLowerCase() === PLACEHOLDER_HOME_CONTENT ? "" : conteudoEspacoBruto;

  const resolverMenuBaseUsuario = () => {
    const skinMenu = String(localStorage.getItem("skinLogadoUser") || "").trim();
    if (onePagePublicaAtivaEfetiva) {
      if (isOwner) return "/menu/admin";
      if (!skinMenu) return "";
      return `/menu/${encodeURIComponent(skinMenu)}`;
    }
    if (!skinMenu) return "";
    return `/menu/${encodeURIComponent(skinMenu)}`;
  };

  const irParaAssinatura = () => {
    const menuBase = resolverMenuBaseUsuario();
    if (!menuBase) {
      alert(`Selecione uma ${nomeSkinSingular} para assinar ${nomeEspacoPlural}.`);
      return;
    }
    navigate(`${menuBase}/espacos`);
  };

  const irParaCompra = async (bloco = null) => {
    if (!mercadoPagoSistemaHabilitado && !pixManualSistemaHabilitado) {
      alert("Pagamentos desativados neste projeto.");
      return;
    }

    const menuBase = resolverMenuBaseUsuario();
    if (!currentUid) {
      alert("Voce precisa estar autenticado para solicitar desbloqueio.");
      return;
    }
    if (!menuBase) {
      alert(`Selecione uma ${nomeSkinSingular} para comprar ${nomeBlocoPlural}.`);
      return;
    }
    if (bloco?.id) {
      if (!pixManualSistemaHabilitado && mercadoPagoSistemaHabilitado) {
        const returnTo = `${window.location.pathname}${window.location.search || ""}`;
        const params = new URLSearchParams({
          comprarBloco: bloco.id,
          espacoId: espacoId || "",
          ownerUserId: ownerUserId || "",
          returnTo,
        });
        navigate(`${menuBase}?${params.toString()}`);
        return;
      }

      try {
        const solicitacao = await solicitarSolicitacaoPixManualBloco({
          ownerUserId: ownerUserId || "",
          espacoId: espacoId || "",
          blocoId: bloco.id,
        });
        if (solicitacao?.alreadyPurchased) {
          alert(solicitacao?.message || `${nomeBlocoSingularCapitalizado} ja desbloqueado.`);
          navigate(menuBase);
          return;
        }
        const ownerQuery = ownerUserId
          ? `?ownerUserId=${encodeURIComponent(String(ownerUserId))}`
          : "";
        navigate(`${menuBase}/solicitacoes${ownerQuery}`);
      } catch (err) {
        alert(err?.message || "Nao foi possivel solicitar desbloqueio.");
      }
      return;
    }
    navigate(menuBase);
  };

  const renderCtaRestricao = (tipoRestricao, bloco = null) => {
    const blocoEhLive = String(bloco?.tipo || "").trim().toLowerCase() === "live";

    if (!currentUid) {
      return <LoginButton />;
    }
    if (tipoRestricao === "assinante") {
      return (
        <button onClick={irParaAssinatura}>
          {blocoEhLive ? "Assinar para participar" : "Assinar para desbloquear"}
        </button>
      );
    }
    if (tipoRestricao === "comprador") {
      if (!mercadoPagoSistemaHabilitado && !pixManualSistemaHabilitado) {
        return <p>Pagamento indisponivel neste projeto.</p>;
      }
      const precoFormatado = formatarPreco(bloco?.precoCentavos, bloco?.moeda || "BRL");
      return (
        <button onClick={() => irParaCompra(bloco)}>
          {precoFormatado
            ? blocoEhLive
              ? `Participar por ${precoFormatado}`
              : `Desbloquear por ${precoFormatado}`
            : blocoEhLive
              ? "Participar da live"
              : "Desbloquear conteudo"}
        </button>
      );
    }
    return null;
  };

  const abrirChatSessaoBloco = (blocoId) => {
    const sessaoChat = sessaoChatPorBloco[blocoId];
    const contactId = String(sessaoChat?.contactId || "").trim();
    const conversationId = String(sessaoChat?.conversationId || "principal").trim();
    if (!contactId) return;

    const menuBase = resolverMenuBaseUsuario();
    if (!menuBase) {
      alert(`Selecione uma ${nomeSkinSingular} para acessar o chat.`);
      return;
    }

    navigate(
      `${menuBase}/contatos/${encodeURIComponent(contactId)}/chat/${encodeURIComponent(
        conversationId || "principal"
      )}`
    );
  };

  const abrirLiveBloco = async (bloco = {}) => {
    if (!livesHabilitadas) {
      alert("Lives desativadas neste projeto.");
      return;
    }

    const liveUrl = String(bloco?.liveUrl || "").trim();
    if (!liveUrl) {
      alert("Live sem URL configurada.");
      return;
    }

    const liveInicioMs = parseLiveMs(bloco?.liveInicioEmMs, bloco?.liveInicioEmIso);
    const liveFimMs = parseLiveMs(bloco?.liveFimEmMs, bloco?.liveFimEmIso);
    const agora = Date.now();
    const liveEmAndamento = (!liveInicioMs || agora >= liveInicioMs) && (!liveFimMs || agora <= liveFimMs);

    if (!liveEmAndamento) {
      alert("A live ainda nao esta em andamento.");
      return;
    }

    const contactId = montarLiveContactId({
      ownerUserId,
      espacoId,
      blocoId: bloco?.id || "",
    });
    const conversationId = "principal";
    const tituloLive = String(bloco?.titulo || bloco?.nome || bloco?.id || "Live").trim();

    setLiveModal({
      aberto: true,
      blocoId: String(bloco?.id || "").trim(),
      titulo: tituloLive || "Live",
      liveUrl,
      embedUrl: normalizarEmbedLiveUrl(liveUrl),
      contactId,
      conversationId,
    });
    setLiveChatMensagem("");
    setLiveChatErro(currentUidAutenticado ? "" : "Faça login para participar do chat da live.");

    if (!currentUidAutenticado) return;

    try {
      const participantUids = [
        String(currentUidAutenticado || "").trim(),
        String(ownerUserId || "").trim(),
      ].filter(Boolean);
      for (const contatoRef of getContatoDocRefs(contactId)) {
        const payloadContato = {
          idContato: contactId,
          tipo: "live",
          ownerUserId: ownerUserId || "",
          espacoId: espacoId || "",
          blocoId: String(bloco?.id || "").trim(),
          assunto: tituloLive || "Live",
          ultimaConversaData: serverTimestamp(),
        };
        if (participantUids.length) {
          payloadContato.participantUids = arrayUnion(...participantUids);
        }
        await setDoc(
          contatoRef,
          payloadContato,
          { merge: true }
        );
      }

      for (const conversaRef of getConversaDocRefs(contactId, conversationId)) {
        await setDoc(
          conversaRef,
          {
            idContato: contactId,
            idConversa: conversationId,
            assunto: tituloLive || "Live",
            data: serverTimestamp(),
            dataUltimaMensagem: serverTimestamp(),
            ultimaMensagem: "Live iniciada",
          },
          { merge: true }
        );
      }
    } catch (err) {
      if (err?.code === "permission-denied") {
        setLiveChatErro("Sem permissao para abrir o chat da live.");
        return;
      }
      setLiveChatErro("Falha ao preparar o chat da live.");
    }
  };

  const enviarMensagemLive = async () => {
    const texto = String(liveChatMensagem || "").trim();
    if (!texto) return;
    if (!currentUidAutenticado) {
      setLiveChatErro("Faça login para enviar mensagens na live.");
      return;
    }

    const contactId = String(liveModal?.contactId || "").trim();
    const conversationId = String(liveModal?.conversationId || "principal").trim();
    if (!contactId) return;

    try {
      const chatCollectionRef = getFirstRef(
        getChatCollectionRefs(contactId, conversationId)
      );
      if (!chatCollectionRef) {
        throw new Error("Chat da live indisponivel.");
      }
      await addDoc(
        chatCollectionRef,
        {
          mensagem: texto,
          data: serverTimestamp(),
          userRemetente: nomeRemetenteLive || currentUid,
          userUid: currentUidAutenticado,
          idConversa: conversationId,
        }
      );

      for (const conversaRef of getConversaDocRefs(contactId, conversationId)) {
        await setDoc(
          conversaRef,
          {
            idContato: contactId,
            idConversa: conversationId,
            assunto: String(liveModal?.titulo || "Live").trim() || "Live",
            dataUltimaMensagem: serverTimestamp(),
            ultimaMensagem: texto,
          },
          { merge: true }
        );
      }

      for (const contatoRef of getContatoDocRefs(contactId)) {
        const participantUids = [
          String(currentUidAutenticado || "").trim(),
          String(ownerUserId || "").trim(),
        ].filter(Boolean);
        const payloadContato = {
          idContato: contactId,
          ultimaConversaData: serverTimestamp(),
        };
        if (participantUids.length) {
          payloadContato.participantUids = arrayUnion(...participantUids);
        }
        await setDoc(
          contatoRef,
          payloadContato,
          { merge: true }
        );
      }

      setLiveChatMensagem("");
      setLiveChatErro("");
    } catch (err) {
      if (err?.code === "permission-denied") {
        setLiveChatErro("Sem permissao para enviar mensagem.");
        return;
      }
      setLiveChatErro("Falha ao enviar mensagem.");
    }
  };

  const adicionarBloco = (bloco) => {
    setBlocos((prev) => {
      const dedupe = new Map(prev.map((item) => [item.id, item]));
      dedupe.set(bloco.id, bloco);
      return [...dedupe.values()].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    });

    // Reconsulta após breve janela para pegar dados consolidados (rules/indexações).
    window.setTimeout(() => {
      setReloadNonce((n) => n + 1);
    }, 1200);
  };

  const getBlocoDocRef = (bloco) =>
    bloco.__legacy
      ? doc(db, "blocos", bloco.id)
      : getFirstRef(getBlocoDocRefs(ownerUserId, espacoId, bloco.id));

  const atualizarBloco = async (blocoId, updates = {}) => {
    if (!podeGerenciar) {
      setErroAcaoBloco(`Apenas o administrador pode editar ${nomeBlocoPlural}.`);
      return false;
    }

    const bloco = blocos.find((item) => item.id === blocoId);
    if (!bloco) return false;
    if (!ownerUserId || !espacoId) {
      setErroAcaoBloco(`Nao foi possivel atualizar: ${nomeEspacoSingular} invalido.`);
      return false;
    }

    setErroAcaoBloco("");
    setBlocoEmAtualizacaoId(blocoId);

    try {
      const removerIndices = Array.isArray(updates.removerIndices)
        ? [...new Set(updates.removerIndices.filter((item) => Number.isInteger(item) && item >= 0))]
        : [];
      const removerSet = new Set(removerIndices);
      const novasImagens = Array.isArray(updates.novasImagens)
        ? updates.novasImagens.filter(Boolean)
        : [];

      const visibilidadeFinal = updates.visibilidade || bloco.visibilidade || "publico";
      const isPublicoFinal = visibilidadeFinal === "publico";
      const precoCentavos = Object.prototype.hasOwnProperty.call(updates, "precoCentavos")
        ? updates.precoCentavos
        : bloco.precoCentavos || null;
      const moedaFinal = precoCentavos ? (updates.moeda || bloco.moeda || "BRL") : null;

      const pathsOriginaisAntigos = normalizarListaImagens(bloco.imagensOriginaisPaths);
      const pathsPreviewsAntigos = normalizarListaImagens(bloco.imagensPreviewPaths);
      const urlsPublicasAntigas = normalizarListaImagens(bloco.imagensOriginaisPublicas).filter(isRenderableUrl);
      const urlsPreviewsAntigas = normalizarListaImagens(bloco.imagensPreview).filter(isRenderableUrl);
      const legadoAntigo = normalizarListaImagens(bloco.imagens).filter(isRenderableUrl);

      const referenciasAntigas = Math.max(
        pathsOriginaisAntigos.length,
        pathsPreviewsAntigos.length,
        urlsPublicasAntigas.length,
        urlsPreviewsAntigas.length,
        legadoAntigo.length
      );

      const pathsOriginaisMantidos = [];
      const pathsPreviewsMantidos = [];
      const urlsPublicasMantidas = [];
      const urlsPreviewsMantidas = [];
      const pathsParaExcluir = [];

      for (let index = 0; index < referenciasAntigas; index += 1) {
        const originalPath = pathsOriginaisAntigos[index];
        const previewPath = pathsPreviewsAntigos[index];

        if (removerSet.has(index)) {
          if (originalPath) pathsParaExcluir.push(originalPath);
          if (previewPath) pathsParaExcluir.push(previewPath);
          continue;
        }

        if (originalPath) pathsOriginaisMantidos.push(originalPath);
        if (previewPath) pathsPreviewsMantidos.push(previewPath);
        if (urlsPublicasAntigas[index]) urlsPublicasMantidas.push(urlsPublicasAntigas[index]);
        if (urlsPreviewsAntigas[index]) urlsPreviewsMantidas.push(urlsPreviewsAntigas[index]);
      }

      const novosOriginaisPaths = [];
      const novosPreviewPaths = [];
      const novasPublicasUrls = [];
      const novasPreviewUrls = [];

      for (const arquivo of novasImagens) {
        const nomeArquivo = gerarNomeArquivoSeguro(arquivo?.name || "imagem");
        const originalPath = `users/${ownerUserId}/espacos/${espacoId}/blocos/${blocoId}/original/${nomeArquivo}`;
        const originalUpload = await subirArquivoStorage(originalPath, arquivo);
        novosOriginaisPaths.push(originalPath);

        if (isPublicoFinal) {
          if (isRenderableUrl(originalUpload?.url)) {
            novasPublicasUrls.push(originalUpload.url);
          } else {
            try {
              const urlPublica = await resolverUrlArquivo(originalPath);
              if (isRenderableUrl(urlPublica)) {
                novasPublicasUrls.push(urlPublica);
              }
            } catch (err) {
              console.warn("Falha ao obter URL publica do original:", err?.code, err?.message);
            }
          }
          continue;
        }

        const previewFile = await gerarPreviewDesfocado(arquivo);
        const previewPath = `users/${ownerUserId}/espacos/${espacoId}/blocos/${blocoId}/preview/${nomeArquivo}`;
        const previewUpload = await subirArquivoStorage(previewPath, previewFile);
        novosPreviewPaths.push(previewPath);

        if (isRenderableUrl(previewUpload?.url)) {
          novasPreviewUrls.push(previewUpload.url);
        } else {
          try {
            const previewUrl = await resolverUrlArquivo(previewPath);
            if (isRenderableUrl(previewUrl)) {
              novasPreviewUrls.push(previewUrl);
            }
          } catch (err) {
            console.warn("Falha ao obter URL de preview:", err?.code, err?.message);
          }
        }
      }

      const imagensOriginaisPaths = [...pathsOriginaisMantidos, ...novosOriginaisPaths];
      if (!imagensOriginaisPaths.length) {
        throw new Error(`O ${nomeBlocoSingular} precisa ter ao menos uma imagem.`);
      }

      let imagensPreviewPaths = [];
      let imagensOriginaisPublicas = [];
      let imagensPreview = [];
      let imagens = [];

      if (isPublicoFinal) {
        // Ao tornar publico, remove previews remotos antigos para evitar lixo no bucket.
        pathsParaExcluir.push(...pathsPreviewsMantidos);

        const urlsPublicas = [];
        for (const path of imagensOriginaisPaths) {
          try {
            const url = await resolverUrlArquivo(path);
            urlsPublicas.push(url);
          } catch (err) {
            console.warn("Falha ao resolver URL publica do original:", path, err?.code);
          }
        }

        imagensOriginaisPublicas = urlsPublicas.length
          ? urlsPublicas
          : [...urlsPublicasMantidas, ...novasPublicasUrls].filter(isRenderableUrl);
        imagensPreviewPaths = [];
        imagensPreview = [];
        imagens = imagensOriginaisPublicas;
      } else {
        imagensPreviewPaths = [...pathsPreviewsMantidos, ...novosPreviewPaths];
        imagensPreview = [...urlsPreviewsMantidas, ...novasPreviewUrls].filter(isRenderableUrl);
        imagensOriginaisPublicas = [];
        imagens = imagensPreview;
      }

      const payload = {
        visibilidade: visibilidadeFinal,
        precoCentavos: precoCentavos || null,
        moeda: moedaFinal,
        imagensOriginaisPaths,
        imagensPreviewPaths,
        imagensOriginaisPublicas,
        imagensPreview,
        imagens,
      };

      await updateDoc(getBlocoDocRef(bloco), payload);

      const pathsExclusaoUnicos = [...new Set(pathsParaExcluir)].filter(
        (path) => typeof path === "string" && path.includes("/")
      );
      for (const path of pathsExclusaoUnicos) {
        try {
          await excluirArquivoStorage(path);
        } catch (err) {
          if (err?.code !== "storage/object-not-found") {
            console.warn("Falha ao excluir imagem removida:", path, err?.message);
          }
        }
      }

      setBlocos((prev) =>
        prev.map((item) => (item.id === blocoId ? { ...item, ...payload } : item))
      );
      setOriginaisPorBloco((prev) => {
        const next = { ...prev };
        delete next[blocoId];
        return next;
      });
      setPreviewsPorBloco((prev) => {
        const next = { ...prev };
        delete next[blocoId];
        return next;
      });
      backfilledPublicUrlsRef.current.delete(blocoId);
      blockedOriginalPathsRef.current.clear();
      blockedPreviewPathsRef.current.clear();
      setReloadNonce((n) => n + 1);
      return true;
    } catch (err) {
      console.error("Erro ao atualizar bloco:", err);
      setErroAcaoBloco(err?.message || `Falha ao atualizar ${nomeBlocoSingular}.`);
      return false;
    } finally {
      setBlocoEmAtualizacaoId(null);
    }
  };

  const excluirBloco = async (blocoId) => {
    if (!podeGerenciar) {
      setErroAcaoBloco(`Apenas o administrador pode excluir ${nomeBlocoPlural}.`);
      return;
    }

    const bloco = blocos.find((item) => item.id === blocoId);
    if (!bloco) return;

    const confirmou = window.confirm(`Excluir este ${nomeBlocoSingular}?`);
    if (!confirmou) return;

    setErroAcaoBloco("");
    setBlocoEmExclusaoId(blocoId);

    try {
      const pathsOriginais = normalizarListaImagens(bloco.imagensOriginaisPaths);
      const pathsPreviews = normalizarListaImagens(bloco.imagensPreviewPaths);
      const allPaths = [...new Set([...pathsOriginais, ...pathsPreviews])]
        .filter((path) => typeof path === "string" && path.includes("/"));

      for (const path of allPaths) {
        try {
          await excluirArquivoStorage(path);
        } catch (err) {
          if (err?.code !== "storage/object-not-found") {
            console.warn("Falha ao excluir arquivo do bloco:", path, err?.message);
          }
        }
      }

      if (bloco?.tipo === "cards") {
        const cardsRefs = bloco.__legacy
          ? [collection(db, "blocos", bloco.id, "cards")]
          : getBlocoCardsCollectionRefs(ownerUserId, espacoId, bloco.id);
        for (const cardsRef of cardsRefs) {
          const cardsSnap = await getDocs(cardsRef);
          for (const cardDoc of cardsSnap.docs) {
            await deleteDoc(cardDoc.ref);
          }
        }
      }

      if (bloco.__legacy) {
        await deleteDoc(getBlocoDocRef(bloco));
      } else {
        for (const blocoRef of getBlocoDocRefs(ownerUserId, espacoId, bloco.id)) {
          await deleteDoc(blocoRef);
        }
      }

      setBlocos((prev) => prev.filter((item) => item.id !== blocoId));
      setOriginaisPorBloco((prev) => {
        const next = { ...prev };
        delete next[blocoId];
        return next;
      });
      setPreviewsPorBloco((prev) => {
        const next = { ...prev };
        delete next[blocoId];
        return next;
      });
      setCompradorPorBloco((prev) => {
        const next = { ...prev };
        delete next[blocoId];
        return next;
      });
      backfilledPublicUrlsRef.current.delete(blocoId);
      blockedOriginalPathsRef.current.clear();
      blockedPreviewPathsRef.current.clear();
    } catch (err) {
      console.error("Erro ao excluir bloco:", err);
      setErroAcaoBloco(err?.message || `Falha ao excluir ${nomeBlocoSingular}.`);
    } finally {
      setBlocoEmExclusaoId(null);
    }
  };

  return (
    <div>
      {podeGerenciar && (
        <CriadorBloco
          onCreate={adicionarBloco}
          espacoAtual={espacoAtual}
          skinIdAtual={skinIdAtual}
          podeCriarOverride={podeGerenciar}
        />
      )}

      {!!erroBlocos && <p style={{ color: "red" }}>{erroBlocos}</p>}
      {!!erroAcaoBloco && <p style={{ color: "red" }}>{erroAcaoBloco}</p>}

      {!acessoEspacoResolvido && carregamentoAcessoEspacoJSX}

      {acessoEspacoResolvido && !podeVerEspaco && (
        <div className="espaco-restricao-wrapper">
          {avatarMensagemRestricao ? (
            <img
              src={avatarMensagemRestricao}
              alt="Avatar da mensagem"
              className="espaco-restricao-avatar"
            />
          ) : null}

          <div className="espaco-restricao-balao">
            {avatarMensagemRestricao ? (
              <span aria-hidden="true" className="espaco-restricao-balao-ponteiro" />
            ) : null}

            <p className="espaco-restricao-texto" style={estiloMensagemRestricaoEspaco}>
              {mensagemRestricaoEspaco}
            </p>
            {mostrarCtaRestricaoEspaco ? renderCtaRestricao(tipoRestricaoEspaco) : null}
          </div>
        </div>
      )}

      {acessoEspacoResolvido && podeVerEspaco && !!conteudoEspaco && (
        <div
          className="espaco-conteudo-html"
          style={{ marginBottom: 20 }}
          dangerouslySetInnerHTML={{ __html: conteudoEspaco }}
        />
      )}

      {acessoEspacoResolvido &&
        podeVerEspaco &&
        blocos.map((bloco) => {
          const blocoEhCards = bloco?.tipo === "cards";
          const blocoEhLive = bloco?.tipo === "live";
          const cardsDoBloco = normalizarCardsDoBloco(bloco?.cards);
          const tituloBloco = String(bloco?.titulo || bloco?.nome || "").trim();
          const iconeBloco = String(bloco?.icone || bloco?.iconUrl || "").trim();
          const visivel = podeVerBloco(bloco);
          const bloqueado = !visivel;
          const tipoRestricao = tipoRestricaoBloco(bloco);
          const sessaoChatBloco = sessaoChatPorBloco[bloco.id] || null;
          const precoCompradorFormatado =
            tipoRestricao === "comprador" && currentUid
              ? formatarPreco(bloco?.precoCentavos, bloco?.moeda || "BRL")
              : null;
          const liveInicioMs = parseLiveMs(bloco?.liveInicioEmMs, bloco?.liveInicioEmIso);
          const liveFimMs = parseLiveMs(bloco?.liveFimEmMs, bloco?.liveFimEmIso);
          const liveAgoraMs = Date.now();
          const liveEmAndamento =
            blocoEhLive &&
            (!liveInicioMs || liveAgoraMs >= liveInicioMs) &&
            (!liveFimMs || liveAgoraMs <= liveFimMs);
          const liveAgendada = blocoEhLive && !!liveInicioMs && liveAgoraMs < liveInicioMs;
          const liveEncerrada = blocoEhLive && !!liveFimMs && liveAgoraMs > liveFimMs;
          const liveBannerUrl = String(bloco?.liveBannerUrl || "").trim();

          const previewsDoc = normalizarListaImagens(bloco.imagensPreview).filter(isRenderableUrl);
          const previewsResolvidas = Array.isArray(previewsPorBloco[bloco.id])
            ? previewsPorBloco[bloco.id]
            : [];
          const previews = [...new Set([...previewsDoc, ...previewsResolvidas])];
          const originalsAutorizadas = Array.isArray(originaisPorBloco[bloco.id])
            ? originaisPorBloco[bloco.id]
            : [];
          const originaisPublicas = normalizarListaImagens(bloco.imagensOriginaisPublicas)
            .filter(isRenderableUrl);
          const fallbackLegado = normalizarListaImagens(bloco.imagens);
          const imagensBloqueadas = previews;
          const pathsOriginaisEditor = normalizarListaImagens(bloco.imagensOriginaisPaths);
          const pathsPreviewEditor = normalizarListaImagens(bloco.imagensPreviewPaths);
          const totalImagensEditor = Math.max(
            pathsOriginaisEditor.length,
            pathsPreviewEditor.length,
            originalsAutorizadas.length,
            originaisPublicas.length,
            previews.length,
            fallbackLegado.length
          );
          const imagensEditor = Array.from({ length: totalImagensEditor }, (_, index) => ({
            index,
            originalPath: pathsOriginaisEditor[index] || null,
            previewPath: pathsPreviewEditor[index] || null,
            displayUrl:
              originalsAutorizadas[index] ||
              originaisPublicas[index] ||
              previews[index] ||
              fallbackLegado[index] ||
              null,
          })).filter((item) => item.originalPath || item.previewPath || item.displayUrl);

          const imagensParaExibir = blocoEhCards || blocoEhLive
            ? []
            : bloqueado
            ? imagensBloqueadas
            : originalsAutorizadas.length
              ? originalsAutorizadas
              : originaisPublicas.length
                ? originaisPublicas
              : previews.length
                ? previews
                : fallbackLegado;

          return (
            <Container
              key={bloco.id}
              titulo={tituloBloco}
              iconUrl={iconeBloco}
              variante="home"
              className="bloco-imagem"
            >
              {!!imagensParaExibir.length && (
                <div
                  style={{
                    filter: bloqueado ? "blur(10px)" : "none",
                    opacity: bloqueado ? 0.7 : 1,
                    transition: "filter 150ms ease",
                  }}
                >
                  {imagensParaExibir.map((url, i) => (
                    bloqueado ? (
                      <img
                        key={`${bloco.id}-${i}`}
                        src={url}
                        alt=""
                        style={{ maxWidth: "200px", margin: "4px" }}
                      />
                    ) : (
                      <button
                        key={`${bloco.id}-${i}`}
                        type="button"
                        onClick={() =>
                          abrirModalImagem({
                            url,
                            titulo: tituloBloco || `${nomeBlocoSingularCapitalizado} ${i + 1}`,
                            alt: "Imagem ampliada do bloco",
                          })
                        }
                        style={{
                          border: "none",
                          background: "transparent",
                          padding: 0,
                          margin: "4px",
                          cursor: "zoom-in",
                        }}
                        title="Clique para ampliar"
                      >
                        <img
                          src={url}
                          alt=""
                          style={{ maxWidth: "200px", display: "block" }}
                        />
                      </button>
                    )
                  ))}
                </div>
              )}

              {blocoEhLive && (
                <div style={{ marginBottom: 10 }}>
                  {!!liveBannerUrl && (
                    bloqueado ? (
                      <img
                        src={liveBannerUrl}
                        alt="Anuncio da live"
                        style={{
                          width: "min(100%, 520px)",
                          maxHeight: 240,
                          objectFit: "cover",
                          borderRadius: 8,
                          filter: "blur(10px)",
                          opacity: 0.75,
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          abrirModalImagem({
                            url: liveBannerUrl,
                            titulo: tituloBloco || "Anuncio da live",
                            alt: "Anuncio da live ampliado",
                          })
                        }
                        style={{
                          border: "none",
                          background: "transparent",
                          padding: 0,
                          cursor: "zoom-in",
                        }}
                        title="Clique para ampliar"
                      >
                        <img
                          src={liveBannerUrl}
                          alt="Anuncio da live"
                          style={{
                            width: "min(100%, 520px)",
                            maxHeight: 240,
                            objectFit: "cover",
                            borderRadius: 8,
                          }}
                        />
                      </button>
                    )
                  )}

                  <p style={{ margin: "8px 0 4px" }}>
                    <strong>Inicio:</strong> {formatarDataHoraLive(liveInicioMs)}
                  </p>
                  <p style={{ margin: "0 0 8px" }}>
                    <strong>Fim:</strong> {formatarDataHoraLive(liveFimMs)}
                  </p>

                  {!bloqueado ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {liveEmAndamento ? (
                        <button type="button" onClick={() => abrirLiveBloco(bloco)}>
                          Entrar na live
                        </button>
                      ) : liveAgendada ? (
                        <span>Live agendada.</span>
                      ) : liveEncerrada ? (
                        <span>Live encerrada.</span>
                      ) : (
                        <span>Live indisponivel no momento.</span>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {blocoEhCards && !bloqueado && !!cardsDoBloco.length && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {cardsDoBloco.map((card, cardIndex) => {
                    const imagemCardResolvida =
                      imagensCardsPorBloco?.[bloco.id]?.[card.id] || "";
                    const imagemCardFinal = isRenderableUrl(card.imagem)
                      ? card.imagem
                      : imagemCardResolvida || "/logoNeon.png";
                    return (
                    <Card
                      key={`${bloco.id}-card-${card.id || cardIndex}`}
                      id={card.id || `${bloco.id}-card-${cardIndex}`}
                      ownerUserId={ownerUserId}
                      espacoId={espacoId}
                      blocoId={bloco.id}
                      nome={card.nome || `Card ${cardIndex + 1}`}
                      nomeDescricao={card.nome || ""}
                      descricao={card.descricao || ""}
                      linkExterno={card.linkExterno || ""}
                      imagem={imagemCardFinal}
                      idNome={`${bloco.id}-card-${cardIndex}`}
                      cardDescricaoDiv="cardDescricaoDivHome"
                      cardNome="cardNomeHome"
                      cardContainerDesktop="cardContainerDesktopHome"
                      cardCabecalho="cardCabecalhoHome"
                      cardImagem="cardImagemHome"
                      cardDescricao="cardDescricaoHome"
                      imgCard="imgCardHome"
                      onImagemClick={(imagemUrl) =>
                        abrirModalImagem({
                          url: imagemUrl,
                          titulo: card.nome || tituloBloco || nomeBlocoSingularCapitalizado,
                          alt: "Imagem ampliada do card",
                        })
                      }
                    />
                    );
                  })}
                </div>
              )}

              {!!precoCompradorFormatado && (
                <p style={{ margin: "6px 0 8px" }}>
                  Valor: <strong>{precoCompradorFormatado}</strong>
                </p>
              )}

              {bloqueado && !imagensParaExibir.length && (
                <div
                  style={{
                    width: 200,
                    height: 120,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "linear-gradient(135deg, #2f2f2f, #5c5c5c)",
                    color: "#f0f0f0",
                    borderRadius: 6,
                    filter: "blur(1px)",
                  }}
                >
                  Preview protegido
                </div>
              )}

              {bloqueado && (
                <div style={{ marginTop: 8 }}>
                  <p>{`Conteudo restrito do ${nomeBlocoSingular}.`}</p>
                  {renderCtaRestricao(tipoRestricao, bloco)}
                </div>
              )}

              {!bloqueado && !blocoEhLive && sessaoChatBloco?.contactId ? (
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => abrirChatSessaoBloco(bloco.id)}>
                    Abrir chat da sessao
                  </button>
                </div>
              ) : null}

              {podeGerenciar && !blocoEhCards && !blocoEhLive && (
                <EditorBloco
                  bloco={bloco}
                  imagensEditor={imagensEditor}
                  onSalvar={(updates) => atualizarBloco(bloco.id, updates)}
                  onExcluir={() => excluirBloco(bloco.id)}
                  salvando={blocoEmAtualizacaoId === bloco.id}
                  excluindo={blocoEmExclusaoId === bloco.id}
                />
              )}

              {podeGerenciar && (blocoEhCards || blocoEhLive) && (
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={() => excluirBloco(bloco.id)}
                    disabled={blocoEmExclusaoId === bloco.id}
                    style={{ color: "red" }}
                  >
                    {blocoEmExclusaoId === bloco.id
                      ? `Excluindo ${nomeBlocoSingularCapitalizado}...`
                      : `Excluir ${nomeBlocoSingularCapitalizado}`}
                  </button>
                </div>
              )}
            </Container>
          );
        })}

      {liveModal.aberto ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLiveModal((prev) => ({ ...prev, aberto: false }))}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99998,
            background: "rgba(0,0,0,0.92)",
            display: "flex",
            alignItems: "stretch",
            justifyContent: "stretch",
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              position: "relative",
              width: "100vw",
              height: "100dvh",
              overflow: "hidden",
            }}
          >
            {liveModalEhVideoDireto ? (
              <video
                src={liveModal.liveUrl}
                controls
                autoPlay
                playsInline
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  background: "#000",
                }}
              />
            ) : (
              <iframe
                title={liveModal.titulo || "Live"}
                src={liveModal.embedUrl || liveModal.liveUrl}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  background: "#000",
                }}
              />
            )}

            <button
              type="button"
              onClick={() => setLiveModal((prev) => ({ ...prev, aberto: false }))}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                zIndex: 3,
                cursor: "pointer",
              }}
            >
              Fechar live
            </button>

            <div
              style={{
                position: "absolute",
                right: 12,
                top: typeof window !== "undefined" && window.innerWidth <= 860 ? "auto" : 12,
                bottom: 12,
                width:
                  typeof window !== "undefined" && window.innerWidth <= 860
                    ? "calc(100% - 24px)"
                    : "min(360px, 34vw)",
                height:
                  typeof window !== "undefined" && window.innerWidth <= 860
                    ? "45dvh"
                    : "calc(100% - 24px)",
                background: "rgba(0,0,0,0.58)",
                border: "1px solid rgba(255,255,255,0.26)",
                borderRadius: 10,
                backdropFilter: "blur(6px)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                zIndex: 2,
              }}
            >
              <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
                <strong style={{ color: "#fff" }}>Chat da live</strong>
              </div>

              {usuarioPodeControlarCameraLive ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "8px 10px",
                    borderBottom: "1px solid rgba(255,255,255,0.2)",
                  }}
                >
                  <span style={{ color: "#fff", fontSize: 12, opacity: 0.9 }}>
                    Camera do criador
                  </span>
                  <button type="button" onClick={alternarCameraLive}>
                    {liveCameraAtiva ? "Desligar camera" : "Ligar camera"}
                  </button>
                </div>
              ) : null}

              {liveCameraErro ? (
                <p style={{ margin: "4px 10px", color: "#ffd4d4", fontSize: 12 }}>
                  {liveCameraErro}
                </p>
              ) : null}

              {liveCameraAtiva ? (
                <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
                  <video
                    ref={(node) => {
                      liveCameraVideoRef.current = node;
                      const stream = liveCameraStreamRef.current;
                      if (!node || !stream) return;
                      try {
                        if (node.srcObject !== stream) {
                          node.srcObject = stream;
                        }
                        node.setAttribute("playsinline", "true");
                        node.setAttribute("autoplay", "true");
                        node.muted = true;
                        node.play().catch(() => {});
                      } catch {
                        // no-op
                      }
                    }}
                    autoPlay
                    muted
                    playsInline
                    style={{
                      width: "100%",
                      height: 160,
                      maxHeight: 160,
                      objectFit: "cover",
                      borderRadius: 8,
                      background: "#000",
                    }}
                  />
                </div>
              ) : null}

              {!usuarioPodeControlarCameraLive && currentUidAutenticado ? (
                <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ color: "#fff", fontSize: 12, opacity: 0.9 }}>
                      Camera ao vivo do criador
                    </span>
                    <span style={{ color: "#fff", fontSize: 11, opacity: 0.75 }}>
                      {liveCameraRemotaStatus || "Aguardando..."}
                    </span>
                  </div>

                  {liveCameraRemotaAtiva ? (
                    <video
                      ref={(node) => {
                        liveCameraRemotaVideoRef.current = node;
                        const stream = liveCameraRemotaStreamRef.current;
                        if (!node || !stream) return;
                        try {
                          if (node.srcObject !== stream) {
                            node.srcObject = stream;
                          }
                          node.setAttribute("playsinline", "true");
                          node.setAttribute("autoplay", "true");
                          node.play().catch(() => {});
                        } catch {
                          // no-op
                        }
                      }}
                      autoPlay
                      muted
                      playsInline
                      style={{
                        width: "100%",
                        height: 160,
                        maxHeight: 160,
                        objectFit: "cover",
                        borderRadius: 8,
                        background: "#000",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        minHeight: 88,
                        borderRadius: 8,
                        border: "1px dashed rgba(255,255,255,0.35)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "rgba(255,255,255,0.75)",
                        fontSize: 12,
                        textAlign: "center",
                        padding: 8,
                      }}
                    >
                      Aguardando o criador ligar a camera.
                    </div>
                  )}
                </div>
              ) : null}

              {liveCameraRemotaErro ? (
                <p style={{ margin: "4px 10px", color: "#ffd4d4", fontSize: 12 }}>
                  {liveCameraRemotaErro}
                </p>
              ) : null}

              <div
                ref={liveChatScrollRef}
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {!currentUidAutenticado ? (
                  <div style={{ color: "#fff" }}>
                    <p style={{ marginTop: 0, marginBottom: 8 }}>
                      Faça login para participar do chat.
                    </p>
                    <LoginButton />
                  </div>
                ) : liveChatMensagens.length ? (
                  liveChatMensagens.map((mensagem) => {
                    const minhaMensagem =
                      String(mensagem?.userUid || "").trim() ===
                      String(currentUidAutenticado || "").trim();
                    return (
                      <div
                        key={mensagem.id}
                        style={{
                          alignSelf: minhaMensagem ? "flex-end" : "flex-start",
                          maxWidth: "88%",
                          background: minhaMensagem
                            ? "rgba(255,255,255,0.2)"
                            : "rgba(255,255,255,0.1)",
                          color: "#fff",
                          padding: "6px 8px",
                          borderRadius: 8,
                          textAlign: "left",
                        }}
                      >
                        {!minhaMensagem ? (
                          <p style={{ margin: "0 0 4px", fontSize: 11, opacity: 0.85 }}>
                            {mensagem.userRemetente || "Usuario"}
                          </p>
                        ) : null}
                        <p style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                          {mensagem.mensagem}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <p style={{ margin: 0, color: "#fff", opacity: 0.85 }}>
                    Nenhuma mensagem ainda.
                  </p>
                )}
              </div>

              {!!liveChatErro && (
                <p style={{ margin: "4px 10px", color: "#ffd4d4", fontSize: 12 }}>{liveChatErro}</p>
              )}

              <div
                style={{
                  padding: 10,
                  borderTop: "1px solid rgba(255,255,255,0.2)",
                  display: "flex",
                  gap: 8,
                }}
              >
                <input
                  type="text"
                  value={liveChatMensagem}
                  onChange={(event) => setLiveChatMensagem(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      enviarMensagemLive();
                    }
                  }}
                  placeholder={currentUidAutenticado ? "Digite sua mensagem..." : "Faça login para enviar"}
                  disabled={!currentUidAutenticado}
                  style={{ flex: 1, minWidth: 0 }}
                />
                <button
                  type="button"
                  onClick={enviarMensagemLive}
                  disabled={!currentUidAutenticado}
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {imagemModal.aberto && imagemModal.url ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setImagemModal((prev) => ({ ...prev, aberto: false }))}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(0,0,0,0.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(96vw, 1024px)",
              maxHeight: "95vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            {!!imagemModal.titulo && (
              <p style={{ margin: 0, color: "#fff", textAlign: "center" }}>
                <strong>{imagemModal.titulo}</strong>
              </p>
            )}
            <img
              src={imagemModal.url}
              alt={imagemModal.alt}
              style={{
                width: "min(92vw, 900px)",
                height: "auto",
                maxHeight: "82vh",
                objectFit: "contain",
                border: "1px solid rgba(255,255,255,0.35)",
                background: "#fff",
              }}
            />
            <button
              type="button"
              onClick={() => setImagemModal((prev) => ({ ...prev, aberto: false }))}
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
