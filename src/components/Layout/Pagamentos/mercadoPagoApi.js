import { httpsCallable } from "firebase/functions";
import {
  arrayUnion,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  activeFirebaseProjectKey,
  auth,
  db,
  functions,
} from "../../Banco/init-firebase";
import {
  getFirstExistingProjectDocSnapshot,
  getProjectCollectionCandidates,
  getProjectDocCandidates,
} from "../../Banco/projectDataRefs";

const callSalvarCredenciais = httpsCallable(functions, "salvarMercadoPagoCredenciais");
const callStatusCredenciais = httpsCallable(functions, "obterStatusMercadoPago");
const callDesconectarCredenciais = httpsCallable(functions, "desconectarMercadoPago");
const callCriarCheckout = httpsCallable(functions, "criarCheckoutBlocoMercadoPago");
const callConfirmarPagamento = httpsCallable(functions, "confirmarPagamentoBlocoMercadoPago");

const MAX_PIX_QRS = 20;
const MERCADO_PAGO_UNAVAILABLE_CODE = "mercado-pago/unavailable";
const PROJETOS_SEM_FUNCTIONS_MERCADO_PAGO = new Set(
  String(process.env.REACT_APP_MERCADO_PAGO_DISABLE_PROJECTS || "")
    .split(",")
    .map((item) => String(item || "").trim())
    .filter(Boolean)
);
const PROJETOS_MERCADO_PAGO_FALHA_RUNTIME = new Set();
const MERCADO_PAGO_FALHA_STORAGE_KEY = "mercadoPagoProjectsUnavailable";

function toPositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed);
}

function sanitizeString(value) {
  return String(value || "").trim();
}

function carregarProjetosMercadoPagoIndisponiveisStorage() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(MERCADO_PAGO_FALHA_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    parsed
      .map((item) => sanitizeString(item))
      .filter(Boolean)
      .forEach((item) => PROJETOS_MERCADO_PAGO_FALHA_RUNTIME.add(item));
  } catch {
    // Ignora indisponibilidade de storage.
  }
}

function salvarProjetosMercadoPagoIndisponiveisStorage() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      MERCADO_PAGO_FALHA_STORAGE_KEY,
      JSON.stringify([...PROJETOS_MERCADO_PAGO_FALHA_RUNTIME])
    );
  } catch {
    // Ignora indisponibilidade de storage.
  }
}

function getProjetoAtivoMercadoPago() {
  return sanitizeString(activeFirebaseProjectKey);
}

carregarProjetosMercadoPagoIndisponiveisStorage();

function mercadoPagoDisponivelNesteProjeto() {
  const projectKey = getProjetoAtivoMercadoPago();
  if (!projectKey) return false;
  if (PROJETOS_MERCADO_PAGO_FALHA_RUNTIME.has(projectKey)) return false;
  return !PROJETOS_SEM_FUNCTIONS_MERCADO_PAGO.has(projectKey);
}

function getMercadoPagoIndisponivelPayload(motivoCustom = "") {
  return {
    ok: false,
    conectado: false,
    disponivel: false,
    motivo:
      sanitizeString(motivoCustom) ||
      "Mercado Pago indisponivel neste projeto. Use PIX manual ou habilite Cloud Functions em um projeto com Blaze.",
  };
}

function criarErroMercadoPagoIndisponivel(motivoCustom = "") {
  const erro = new Error(getMercadoPagoIndisponivelPayload(motivoCustom).motivo);
  erro.code = MERCADO_PAGO_UNAVAILABLE_CODE;
  return erro;
}

function isMercadoPagoFunctionsIndisponivel(err) {
  const code = sanitizeString(err?.code || "").toLowerCase();
  const message = sanitizeString(err?.message || "").toLowerCase();
  const details = sanitizeString(err?.details || err?.customData?.details || "").toLowerCase();
  const texto = `${message} ${details}`.trim();

  if (code === "functions/not-found" || code === "functions/unavailable") {
    return true;
  }

  return (
    texto.includes("cors") ||
    texto.includes("preflight") ||
    texto.includes("failed to fetch") ||
    texto.includes("net::err_failed") ||
    texto.includes("network request failed")
  );
}

function marcarMercadoPagoIndisponivelNoProjetoAtual() {
  const projectKey = getProjetoAtivoMercadoPago();
  if (projectKey) {
    PROJETOS_MERCADO_PAGO_FALHA_RUNTIME.add(projectKey);
    salvarProjetosMercadoPagoIndisponiveisStorage();
  }
}

function limparMercadoPagoIndisponivelNoProjetoAtual() {
  const projectKey = getProjetoAtivoMercadoPago();
  if (projectKey && PROJETOS_MERCADO_PAGO_FALHA_RUNTIME.has(projectKey)) {
    PROJETOS_MERCADO_PAGO_FALHA_RUNTIME.delete(projectKey);
    salvarProjetosMercadoPagoIndisponiveisStorage();
  }
}

function normalizePixQr(raw, index = 0) {
  const valorCentavos = toPositiveInteger(raw?.valorCentavos);
  const imagemUrl = sanitizeString(raw?.imagemUrl);
  const imagemPath = sanitizeString(raw?.imagemPath);
  const titulo = sanitizeString(raw?.titulo);
  const id = sanitizeString(raw?.id) || `pix_qr_${Date.now()}_${index}`;

  if (valorCentavos <= 0 || !imagemUrl) return null;
  return {
    id,
    valorCentavos,
    imagemUrl,
    imagemPath: imagemPath || "",
    titulo: titulo || "",
  };
}

function normalizePixQrs(rawList = []) {
  const list = Array.isArray(rawList) ? rawList : [];
  const normalized = [];
  const byValue = new Map();

  for (let index = 0; index < list.length; index += 1) {
    const qr = normalizePixQr(list[index], index);
    if (!qr) continue;
    byValue.set(qr.valorCentavos, qr);
  }

  for (const qr of byValue.values()) {
    normalized.push(qr);
    if (normalized.length >= MAX_PIX_QRS) break;
  }

  normalized.sort((a, b) => a.valorCentavos - b.valorCentavos);
  return normalized;
}

function findPixQrByValue(qrs = [], valorCentavos = 0) {
  const target = toPositiveInteger(valorCentavos);
  if (target <= 0) return null;
  return qrs.find((item) => toPositiveInteger(item?.valorCentavos) === target) || null;
}

function getFirstRef(refs = []) {
  return Array.isArray(refs) && refs.length ? refs[0] : null;
}

async function setDocOnCandidates(refs = [], payload = {}, options = { merge: true }) {
  for (const refItem of refs) {
    await setDoc(refItem, payload, options);
  }
}

function getPixManualRefs(uid) {
  return getProjectDocCandidates(db, "users", sanitizeString(uid), "integracoes", "pixManual");
}

function getSolicitacaoRefs(ownerUid, solicitacaoId) {
  // A colecao permanece "pedidos" por compatibilidade com dados e rules existentes.
  return getProjectDocCandidates(
    db,
    "users",
    sanitizeString(ownerUid),
    "pedidos",
    sanitizeString(solicitacaoId)
  );
}

function getSkinsRefs(uid) {
  return getProjectCollectionCandidates(db, "users", sanitizeString(uid), "skins");
}

function getSkinRefs(uid, skinId) {
  return getProjectDocCandidates(db, "users", sanitizeString(uid), "skins", sanitizeString(skinId));
}

function getBlocoRefs(ownerUserId, espacoId, blocoId) {
  return getProjectDocCandidates(
    db,
    "users",
    sanitizeString(ownerUserId),
    "espacos",
    sanitizeString(espacoId),
    "blocos",
    sanitizeString(blocoId)
  );
}

function getCompradorRefs(ownerUserId, espacoId, blocoId, compradorId) {
  return getProjectDocCandidates(
    db,
    "users",
    sanitizeString(ownerUserId),
    "espacos",
    sanitizeString(espacoId),
    "blocos",
    sanitizeString(blocoId),
    "compradores",
    sanitizeString(compradorId)
  );
}

function getPedidosRefs(uid) {
  return getProjectCollectionCandidates(db, "users", sanitizeString(uid), "pedidos");
}

function getContatoRefs(idContato) {
  return getProjectDocCandidates(db, "contatos", sanitizeString(idContato));
}

function getConversaRefs(idContato, idConversa) {
  return getProjectDocCandidates(
    db,
    "contatos",
    sanitizeString(idContato),
    "conversas",
    sanitizeString(idConversa)
  );
}

function getChatRefs(idContato, idConversa, idChat) {
  return getProjectDocCandidates(
    db,
    "contatos",
    sanitizeString(idContato),
    "conversas",
    sanitizeString(idConversa),
    "chat",
    sanitizeString(idChat)
  );
}

function buildSolicitacaoId(blocoId, compradorUid) {
  return `${sanitizeString(blocoId)}__${sanitizeString(compradorUid)}`;
}

function sanitizeDocId(value = "") {
  return sanitizeString(value).replace(/[^\w.-]/g, "_");
}

function sanitizeLiveToken(value = "") {
  return sanitizeString(value).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function parseLiveMs(valueMs = null, valueIso = "") {
  const ms = Number(valueMs);
  if (Number.isFinite(ms) && ms > 0) return ms;
  const fromIso = Date.parse(sanitizeString(valueIso));
  return Number.isFinite(fromIso) ? fromIso : null;
}

function extrairMiniaturaBloco(blocoData = {}) {
  const cards = Array.isArray(blocoData?.cards) ? blocoData.cards : [];
  const imagensPreview = Array.isArray(blocoData?.imagensPreview)
    ? blocoData.imagensPreview
    : [];
  const imagensOriginaisPublicas = Array.isArray(blocoData?.imagensOriginaisPublicas)
    ? blocoData.imagensOriginaisPublicas
    : [];
  const imagensLegadas = Array.isArray(blocoData?.imagens) ? blocoData.imagens : [];
  const imagensOriginaisPaths = Array.isArray(blocoData?.imagensOriginaisPaths)
    ? blocoData.imagensOriginaisPaths
    : [];

  const cardComImagem = cards.find((card) => sanitizeString(card?.imagem));
  const miniaturaUrl =
    sanitizeString(cardComImagem?.imagem) ||
    sanitizeString(imagensPreview[0]) ||
    sanitizeString(imagensOriginaisPublicas[0]) ||
    sanitizeString(imagensLegadas[0]);
  const originalUrl =
    sanitizeString(imagensOriginaisPublicas[0]) ||
    sanitizeString(cardComImagem?.imagem) ||
    "";
  const originalPath =
    sanitizeString(imagensOriginaisPaths[0]) ||
    sanitizeString(cardComImagem?.imagemPath) ||
    "";

  const titulo =
    sanitizeString(cardComImagem?.nome) ||
    sanitizeString(blocoData?.titulo) ||
    sanitizeString(blocoData?.nome);

  return {
    url: miniaturaUrl || "",
    miniaturaUrl: miniaturaUrl || "",
    originalUrl: originalUrl || "",
    originalPath: originalPath || "",
    titulo: titulo || "",
  };
}

async function carregarUsernamePrincipal(userUid, preferredSkinId = "") {
  const uid = sanitizeString(userUid);
  if (!uid) return "";

  const preferredId = sanitizeString(preferredSkinId);
  if (preferredId) {
    try {
      for (const preferredRef of getSkinRefs(uid, preferredId)) {
        const preferredSnap = await getDoc(preferredRef);
        if (preferredSnap.exists()) {
          const preferredUsername = sanitizeString(preferredSnap.data()?.username);
          if (preferredUsername) return preferredUsername;
        }
      }
    } catch {
      // Ignora indisponibilidade de permissao e tenta fallback.
    }
  }

  for (const skinsRef of getSkinsRefs(uid)) {
    try {
      const mainSnap = await getDocs(query(skinsRef, where("is_main", "==", true), limit(1)));
      if (!mainSnap.empty) {
        const mainUsername = sanitizeString(mainSnap.docs[0].data()?.username);
        if (mainUsername) return mainUsername;
      }
    } catch {
      // Ignora indisponibilidade de permissao e tenta fallback.
    }
  }

  for (const skinsRef of getSkinsRefs(uid)) {
    try {
      const firstSnap = await getDocs(query(skinsRef, limit(1)));
      if (!firstSnap.empty) {
        return sanitizeString(firstSnap.docs[0].data()?.username);
      }
    } catch {
      return "";
    }
  }

  return "";
}

async function getBuyerContext(compradorUid) {
  const buyerUserSnap = await getFirstExistingProjectDocSnapshot(db, "users", compradorUid);
  return {
    skinAtivaId: sanitizeString(buyerUserSnap?.data?.()?.skinAtivaId),
  };
}

async function buyerAlreadyHasAccess({
  ownerUserId,
  espacoId,
  blocoId,
  compradorUid,
  skinAtivaId = "",
}) {
  for (const compradorUidRef of getCompradorRefs(ownerUserId, espacoId, blocoId, compradorUid)) {
    const compradorUidSnap = await getDoc(compradorUidRef);
    if (compradorUidSnap.exists()) return true;
  }

  if (!skinAtivaId) return false;
  try {
    for (const compradorSkinRef of getCompradorRefs(
      ownerUserId,
      espacoId,
      blocoId,
      skinAtivaId
    )) {
      const compradorSkinSnap = await getDoc(compradorSkinRef);
      if (compradorSkinSnap.exists()) return true;
    }
    return false;
  } catch (err) {
    // Em alguns fluxos oneowner, skinAtivaId pode nao ser uma skin propria do comprador.
    // Nesses casos, a leitura pode ser negada pelas rules e devemos tratar como "nao comprado".
    if (String(err?.code || "") === "permission-denied") {
      return false;
    }
    throw err;
  }
}

async function carregarBlocoCompravel(ownerUserId, espacoId, blocoId) {
  const blocoRef = getFirstRef(getBlocoRefs(ownerUserId, espacoId, blocoId));
  const blocoSnap = await getFirstExistingProjectDocSnapshot(
    db,
    "users",
    ownerUserId,
    "espacos",
    espacoId,
    "blocos",
    blocoId
  );
  if (!blocoSnap?.exists?.()) {
    throw new Error("Bloco nao encontrado.");
  }

  const blocoData = blocoSnap.data() || {};
  const visibilidade = sanitizeString(blocoData?.visibilidade).toLowerCase();
  const precoCentavos = toPositiveInteger(blocoData?.precoCentavos);
  const moeda = sanitizeString(blocoData?.moeda || "BRL").toUpperCase() || "BRL";
  const requerCompra = visibilidade === "exclusivo_comprador" || visibilidade === "comprado";
  const miniatura = extrairMiniaturaBloco(blocoData);

  if (!requerCompra || precoCentavos <= 0) {
    throw new Error("Esse bloco nao esta configurado para compra por PIX.");
  }

  return {
    ref: blocoRef,
    data: blocoData,
    tipo: sanitizeString(blocoData?.tipo).toLowerCase() || "imagem",
    visibilidade,
    precoCentavos,
    moeda,
    miniaturaUrl: miniatura.miniaturaUrl || miniatura.url,
    originalUrl: miniatura.originalUrl || miniatura.url,
    originalPath: miniatura.originalPath || "",
    miniaturaTitulo: miniatura.titulo,
    liveInicioEmMs: parseLiveMs(blocoData?.liveInicioEmMs, blocoData?.liveInicioEmIso),
    liveFimEmMs: parseLiveMs(blocoData?.liveFimEmMs, blocoData?.liveFimEmIso),
    liveInicioEmIso: sanitizeString(blocoData?.liveInicioEmIso) || "",
    liveFimEmIso: sanitizeString(blocoData?.liveFimEmIso) || "",
  };
}

async function carregarPixManualOwner(ownerUserId) {
  const pixSnap = await getFirstExistingProjectDocSnapshot(
    db,
    "users",
    ownerUserId,
    "integracoes",
    "pixManual"
  );
  const pixData = pixSnap?.exists?.() ? pixSnap.data() : {};
  const enabled = Boolean(pixData?.enabled);
  const chavePix = sanitizeString(pixData?.chavePix);
  const qrs = normalizePixQrs(pixData?.qrs);

  return {
    enabled,
    chavePix,
    nomeRecebedor: sanitizeString(pixData?.nomeRecebedor),
    cidadeRecebedor: sanitizeString(pixData?.cidadeRecebedor),
    instrucoes: sanitizeString(pixData?.instrucoes),
    pixCopiaECola: sanitizeString(pixData?.pixCopiaECola),
    qrs,
  };
}

export async function salvarMercadoPagoCredenciais({ accessToken, publicKey = "" }) {
  if (!mercadoPagoDisponivelNesteProjeto()) {
    throw criarErroMercadoPagoIndisponivel();
  }
  try {
    const response = await callSalvarCredenciais({ accessToken, publicKey });
    limparMercadoPagoIndisponivelNoProjetoAtual();
    return response?.data || { ok: false };
  } catch (err) {
    if (isMercadoPagoFunctionsIndisponivel(err)) {
      marcarMercadoPagoIndisponivelNoProjetoAtual();
      throw criarErroMercadoPagoIndisponivel(
        "Cloud Functions do Mercado Pago indisponiveis neste projeto. Use PIX manual ou faca deploy das Functions."
      );
    }
    throw err;
  }
}

export async function obterStatusMercadoPago() {
  if (!mercadoPagoDisponivelNesteProjeto()) {
    return getMercadoPagoIndisponivelPayload();
  }
  try {
    const response = await callStatusCredenciais({});
    limparMercadoPagoIndisponivelNoProjetoAtual();
    return response?.data || { conectado: false };
  } catch (err) {
    if (isMercadoPagoFunctionsIndisponivel(err)) {
      marcarMercadoPagoIndisponivelNoProjetoAtual();
      return getMercadoPagoIndisponivelPayload(
        "Cloud Functions do Mercado Pago indisponiveis neste projeto (CORS/deploy). Use PIX manual ou faca deploy das Functions."
      );
    }
    throw err;
  }
}

export async function desconectarMercadoPago() {
  if (!mercadoPagoDisponivelNesteProjeto()) {
    throw criarErroMercadoPagoIndisponivel();
  }
  try {
    const response = await callDesconectarCredenciais({});
    limparMercadoPagoIndisponivelNoProjetoAtual();
    return response?.data || { ok: true, conectado: false };
  } catch (err) {
    if (isMercadoPagoFunctionsIndisponivel(err)) {
      marcarMercadoPagoIndisponivelNoProjetoAtual();
      throw criarErroMercadoPagoIndisponivel(
        "Cloud Functions do Mercado Pago indisponiveis neste projeto. Use PIX manual ou faca deploy das Functions."
      );
    }
    throw err;
  }
}

export async function criarCheckoutBlocoMercadoPago({
  ownerUserId,
  espacoId,
  blocoId,
  skinUsername,
  returnTo = "",
  baseUrl,
}) {
  if (!mercadoPagoDisponivelNesteProjeto()) {
    throw criarErroMercadoPagoIndisponivel();
  }
  try {
    const response = await callCriarCheckout({
      ownerUserId,
      espacoId,
      blocoId,
      skinUsername,
      returnTo,
      baseUrl,
    });
    limparMercadoPagoIndisponivelNoProjetoAtual();
    return response?.data || {};
  } catch (err) {
    if (isMercadoPagoFunctionsIndisponivel(err)) {
      marcarMercadoPagoIndisponivelNoProjetoAtual();
      throw criarErroMercadoPagoIndisponivel(
        "Checkout Mercado Pago indisponivel neste projeto. Use PIX manual ou faca deploy das Functions."
      );
    }
    throw err;
  }
}

export async function confirmarPagamentoBlocoMercadoPago({
  ownerUserId,
  espacoId,
  blocoId,
  paymentId,
}) {
  if (!mercadoPagoDisponivelNesteProjeto()) {
    throw criarErroMercadoPagoIndisponivel();
  }
  try {
    const response = await callConfirmarPagamento({
      ownerUserId,
      espacoId,
      blocoId,
      paymentId,
    });
    limparMercadoPagoIndisponivelNoProjetoAtual();
    return response?.data || {};
  } catch (err) {
    if (isMercadoPagoFunctionsIndisponivel(err)) {
      marcarMercadoPagoIndisponivelNoProjetoAtual();
      throw criarErroMercadoPagoIndisponivel(
        "Confirmacao Mercado Pago indisponivel neste projeto. Use PIX manual ou faca deploy das Functions."
      );
    }
    throw err;
  }
}

export async function salvarPixManualConfig({
  enabled = false,
  chavePix = "",
  nomeRecebedor = "",
  cidadeRecebedor = "",
  instrucoes = "",
  pixCopiaECola = "",
  qrs = [],
}) {
  const uid = sanitizeString(auth?.currentUser?.uid);
  if (!uid) {
    throw new Error("Usuario nao autenticado para salvar PIX manual.");
  }

  const chavePixLimpa = sanitizeString(chavePix);
  if (enabled && !chavePixLimpa) {
    throw new Error("Informe a chave PIX para ativar pagamento manual.");
  }

  const qrsNormalizados = normalizePixQrs(qrs);

  await setDocOnCandidates(
    getPixManualRefs(uid),
    {
      enabled: Boolean(enabled),
      chavePix: chavePixLimpa || null,
      nomeRecebedor: sanitizeString(nomeRecebedor) || null,
      cidadeRecebedor: sanitizeString(cidadeRecebedor) || null,
      instrucoes: sanitizeString(instrucoes) || null,
      pixCopiaECola: sanitizeString(pixCopiaECola) || null,
      qrs: qrsNormalizados,
      updatedAt: serverTimestamp(),
      connectedAt: enabled ? serverTimestamp() : null,
    },
    { merge: true }
  );

  return {
    ok: true,
    enabled: Boolean(enabled),
    conectado: Boolean(enabled && chavePixLimpa),
    qrs: qrsNormalizados,
    maxQrs: MAX_PIX_QRS,
  };
}

export async function obterStatusPixManual() {
  const uid = sanitizeString(auth?.currentUser?.uid);
  if (!uid) {
    return { conectado: false, enabled: false, qrs: [], maxQrs: MAX_PIX_QRS };
  }

  const pix = await carregarPixManualOwner(uid);
  return {
    conectado: Boolean(pix.enabled && pix.chavePix),
    enabled: pix.enabled,
    chavePix: pix.chavePix,
    nomeRecebedor: pix.nomeRecebedor,
    cidadeRecebedor: pix.cidadeRecebedor,
    instrucoes: pix.instrucoes,
    pixCopiaECola: pix.pixCopiaECola,
    qrs: pix.qrs,
    maxQrs: MAX_PIX_QRS,
  };
}

export async function obterCheckoutPixManualBloco({ ownerUserId, espacoId, blocoId }) {
  const compradorUid = sanitizeString(auth?.currentUser?.uid);
  if (!compradorUid) {
    throw new Error("Usuario precisa estar autenticado para comprar.");
  }

  const ownerUid = sanitizeString(ownerUserId);
  const espaco = sanitizeString(espacoId);
  const bloco = sanitizeString(blocoId);
  if (!ownerUid || !espaco || !bloco) {
    throw new Error("Parametros obrigatorios ausentes para checkout PIX manual.");
  }
  if (ownerUid === compradorUid) {
    throw new Error("O criador nao pode comprar o proprio bloco.");
  }

  const blocoInfo = await carregarBlocoCompravel(ownerUid, espaco, bloco);
  const buyerContext = await getBuyerContext(compradorUid);
  const alreadyPurchased = await buyerAlreadyHasAccess({
    ownerUserId: ownerUid,
    espacoId: espaco,
    blocoId: bloco,
    compradorUid,
    skinAtivaId: buyerContext.skinAtivaId,
  });
  if (alreadyPurchased) {
    return {
      ok: true,
      alreadyPurchased: true,
      message: "Esse bloco ja esta liberado para este comprador.",
    };
  }

  const pix = await carregarPixManualOwner(ownerUid);
  if (!pix.enabled || !pix.chavePix) {
    throw new Error("Pagamento manual por PIX indisponivel para este criador.");
  }

  const qrSelecionado = findPixQrByValue(pix.qrs, blocoInfo.precoCentavos);
  if (!qrSelecionado) {
    throw new Error("Nao existe QR configurado para este valor no PIX manual.");
  }

  return {
    ok: true,
    alreadyPurchased: false,
    bloco: {
      blocoId: bloco,
      espacoId: espaco,
      ownerUserId: ownerUid,
      precoCentavos: blocoInfo.precoCentavos,
      moeda: blocoInfo.moeda,
    },
    pagamento: {
      tipo: "pix_manual",
      chavePix: pix.chavePix,
      nomeRecebedor: pix.nomeRecebedor,
      cidadeRecebedor: pix.cidadeRecebedor,
      instrucoes: pix.instrucoes,
      pixCopiaECola: pix.pixCopiaECola,
      qrSelecionado,
    },
  };
}

export async function solicitarSolicitacaoPixManualBloco({
  ownerUserId,
  espacoId,
  blocoId,
  observacaoComprador = "",
}) {
  const compradorUid = sanitizeString(auth?.currentUser?.uid);
  if (!compradorUid) {
    throw new Error("Usuario precisa estar autenticado para solicitar a solicitacao.");
  }

  const ownerUid = sanitizeString(ownerUserId);
  const espaco = sanitizeString(espacoId);
  const bloco = sanitizeString(blocoId);
  if (!ownerUid || !espaco || !bloco) {
    throw new Error("Parametros obrigatorios ausentes para criar solicitacao.");
  }
  if (ownerUid === compradorUid) {
    throw new Error("O criador nao pode solicitar desbloqueio do proprio bloco.");
  }

  const blocoInfo = await carregarBlocoCompravel(ownerUid, espaco, bloco);
  const buyerContext = await getBuyerContext(compradorUid);
  const alreadyPurchased = await buyerAlreadyHasAccess({
    ownerUserId: ownerUid,
    espacoId: espaco,
    blocoId: bloco,
    compradorUid,
    skinAtivaId: buyerContext.skinAtivaId,
  });
  if (alreadyPurchased) {
    return {
      ok: true,
      alreadyPurchased: true,
      message: "Esse bloco ja esta liberado para este comprador.",
    };
  }

  const pix = await carregarPixManualOwner(ownerUid);
  const qrSelecionado = findPixQrByValue(pix.qrs, blocoInfo.precoCentavos);
  if (!pix.enabled || !pix.chavePix || !qrSelecionado) {
    throw new Error("PIX manual indisponivel para este bloco no momento.");
  }

  const [compradorUsername, ownerUsername] = await Promise.all([
    carregarUsernamePrincipal(compradorUid, buyerContext.skinAtivaId || ""),
    carregarUsernamePrincipal(ownerUid, ""),
  ]);

  const solicitacaoId = buildSolicitacaoId(bloco, compradorUid);
  const solicitacaoRefs = getSolicitacaoRefs(ownerUid, solicitacaoId);
  const solicitacaoRef = getFirstRef(solicitacaoRefs);
  const compradorAtual = auth.currentUser;
  const payloadSolicitacao = {
    solicitacaoId,
    pedidoId: solicitacaoId,
    ownerUserId: ownerUid,
    espacoId: espaco,
    blocoId: bloco,
    compradorUid,
    compradorSkinId: buyerContext.skinAtivaId || null,
    compradorEmail: sanitizeString(compradorAtual?.email) || null,
    compradorNome: sanitizeString(compradorAtual?.displayName) || null,
    compradorUsername: compradorUsername || null,
    ownerUsername: ownerUsername || null,
    observacaoComprador: sanitizeString(observacaoComprador) || null,
    blocoTipo: blocoInfo.tipo || "imagem",
    blocoLiveInicioEmMs: blocoInfo.liveInicioEmMs || null,
    blocoLiveFimEmMs: blocoInfo.liveFimEmMs || null,
    blocoLiveInicioEmIso: blocoInfo.liveInicioEmIso || null,
    blocoLiveFimEmIso: blocoInfo.liveFimEmIso || null,
    precoCentavos: blocoInfo.precoCentavos,
    moeda: blocoInfo.moeda,
    blocoMiniaturaUrl: blocoInfo.miniaturaUrl || null,
    blocoMiniaturaTitulo: blocoInfo.miniaturaTitulo || null,
    blocoOriginalUrl: blocoInfo.originalUrl || null,
    blocoOriginalPath: blocoInfo.originalPath || null,
    blocoOriginalTitulo: blocoInfo.miniaturaTitulo || null,
    qrSelecionado,
    status: "pedido_solicitado",
    atualizadoEm: serverTimestamp(),
    criadoEm: serverTimestamp(),
    confirmadoEm: null,
    confirmadoPorUid: null,
  };
  try {
    await setDocOnCandidates(solicitacaoRefs, payloadSolicitacao, { merge: true });
  } catch (err) {
    if (String(err?.code || "") !== "permission-denied") {
      throw err;
    }

    // Se a escrita falhou por permissao, pode ser que a solicitacao ja exista
    // (update bloqueado para comprador). Nessa situacao, retornamos a solicitacao existente.
    for (const refItem of solicitacaoRefs) {
      const pedidoExistenteSnap = await getDoc(refItem).catch(() => null);
      if (pedidoExistenteSnap?.exists?.()) {
        const pedidoExistente = pedidoExistenteSnap.data() || {};
        const mesmoComprador = sanitizeString(pedidoExistente?.compradorUid) === compradorUid;
        const mesmoOwner = sanitizeString(pedidoExistente?.ownerUserId) === ownerUid;
        if (mesmoComprador && mesmoOwner) {
          return {
            ok: true,
            alreadyPurchased: false,
            alreadyRequested: true,
            solicitacaoId,
            pedidoId: solicitacaoId,
            status: sanitizeString(pedidoExistente?.status) || "pedido_solicitado",
          };
        }
      }
    }

    throw err;
  }

  return {
    ok: true,
    alreadyPurchased: false,
    solicitacaoId,
    pedidoId: solicitacaoId,
    status: "pedido_solicitado",
  };
}

export async function listarSolicitacoesPixManual({ ownerUserId = "" } = {}) {
  const currentUid = sanitizeString(auth?.currentUser?.uid);
  if (!currentUid) {
    throw new Error("Usuario nao autenticado.");
  }

  const ownerUid = sanitizeString(ownerUserId);
  const parseDocs = (docs = []) =>
    docs.map((item) => {
      const data = item.data() || {};
      const criadoEm = data?.criadoEm?.toMillis ? data.criadoEm.toMillis() : 0;
      const atualizadoEm = data?.atualizadoEm?.toMillis ? data.atualizadoEm.toMillis() : 0;
      const solicitacaoId = sanitizeString(
        data?.solicitacaoId || data?.pedidoId || item.id
      );
      return {
        id: item.id,
        ...data,
        solicitacaoId,
        pedidoId: sanitizeString(data?.pedidoId || solicitacaoId),
        __createdAtMs: criadoEm,
        __updatedAtMs: atualizadoEm,
      };
    });

  const solicitacoes = [];
  const appendSolicitacoesFromCollections = async (collections = [], filtroCompradorUid = "") => {
    for (const pedidosRef of collections) {
      const snap = filtroCompradorUid
        ? await getDocs(query(pedidosRef, where("compradorUid", "==", filtroCompradorUid)))
        : await getDocs(pedidosRef);
      solicitacoes.push(...parseDocs(snap.docs));
    }
  };

  if (ownerUid) {
    const isOwnerView = ownerUid === currentUid;
    const colecoesPedido = isOwnerView ? getPedidosRefs(currentUid) : getPedidosRefs(ownerUid);
    await appendSolicitacoesFromCollections(
      colecoesPedido,
      isOwnerView ? "" : currentUid
    );
  } else {
    await appendSolicitacoesFromCollections(getPedidosRefs(currentUid));

    const ownerCandidates = Array.from(
      new Set(
        [currentUid]
          .filter(Boolean)
          .map((value) => sanitizeString(value))
      )
    );
    for (const ownerCandidate of ownerCandidates) {
      await appendSolicitacoesFromCollections(
        getPedidosRefs(ownerCandidate),
        currentUid
      );
    }
  }

  const dedupe = new Map();
  for (const solicitacao of solicitacoes) {
    const key = `${sanitizeString(solicitacao?.ownerUserId)}::${sanitizeString(
      solicitacao?.solicitacaoId || solicitacao?.pedidoId || solicitacao?.id
    )}`;
    dedupe.set(key, solicitacao);
  }

  const merged = [...dedupe.values()].map((item) => {
    return {
      ...item,
      __isOwner: sanitizeString(item?.ownerUserId) === currentUid,
    };
  });

  merged.sort(
    (a, b) => (b.__updatedAtMs || b.__createdAtMs || 0) - (a.__updatedAtMs || a.__createdAtMs || 0)
  );
  return merged;
}

function montarSessaoChatContext({
  ownerUid = "",
  compradorUid = "",
  solicitacaoId = "",
  blocoId = "",
  espacoId = "",
  ownerUsername = "",
  compradorUsername = "",
} = {}) {
  const ownerUidNorm = sanitizeString(ownerUid);
  const compradorUidNorm = sanitizeString(compradorUid);
  const solicitacaoIdNorm = sanitizeString(solicitacaoId);
  const ownerUsernameNorm = sanitizeString(ownerUsername) || `owner_${ownerUidNorm.slice(0, 8)}`;
  const compradorUsernameNorm =
    sanitizeString(compradorUsername) || `cliente_${compradorUidNorm.slice(0, 8)}`;

  const contactKey = sanitizeDocId(`${ownerUidNorm}__${compradorUidNorm}`);
  const idContato = `sessao_${contactKey}`;
  const idConversa = "principal";
  const idChat = sanitizeDocId(`sistema_confirmacao_${solicitacaoIdNorm}`) || "sistema_confirmacao";

  const contatoRefs = getContatoRefs(idContato);
  const conversaRefs = getConversaRefs(idContato, idConversa);
  const chatRefs = getChatRefs(idContato, idConversa, idChat);

  return {
    idContato,
    idConversa,
    contatoRefs,
    conversaRefs,
    chatRefs,
    contatoPayload: {
      idContato,
      conversaId: idConversa,
      skinRemetente: ownerUsernameNorm,
      skinDestinatario: compradorUsernameNorm,
      ownerUserId: ownerUidNorm,
      compradorUid: compradorUidNorm,
      participantUids: [ownerUidNorm, compradorUidNorm].filter(Boolean),
      ultimaConversaData: serverTimestamp(),
      origem: "sessao_pix_manual",
    },
    conversaPayload: {
      assunto: "SESSAO CONFIRMADA",
      idContato,
      idConversa,
      ownerUserId: ownerUidNorm,
      compradorUid: compradorUidNorm,
      solicitacaoId: solicitacaoIdNorm,
      espacoId: sanitizeString(espacoId),
      blocoId: sanitizeString(blocoId),
      ultimaMensagem: "Sessao confirmada.",
      dataUltimaMensagem: serverTimestamp(),
      data: serverTimestamp(),
      origem: "sessao_pix_manual",
    },
    chatPayload: {
      idConversa,
      idChat,
      userRemetente: ownerUsernameNorm,
      mensagem: "Sessao confirmada.",
      data: serverTimestamp(),
      origem: "sistema",
    },
  };
}

function montarSessaoChatLiveContext({
  ownerUid = "",
  compradorUid = "",
  espacoId = "",
  blocoId = "",
  ownerUsername = "",
} = {}) {
  const ownerUidNorm = sanitizeString(ownerUid);
  const compradorUidNorm = sanitizeString(compradorUid);
  const espacoIdNorm = sanitizeString(espacoId);
  const blocoIdNorm = sanitizeString(blocoId);
  const ownerUsernameNorm = sanitizeString(ownerUsername) || `owner_${ownerUidNorm.slice(0, 8)}`;

  const idContato = `live_${sanitizeLiveToken(ownerUidNorm)}_${sanitizeLiveToken(
    espacoIdNorm
  )}_${sanitizeLiveToken(blocoIdNorm)}`.slice(0, 180);
  const idConversa = "principal";

  const contatoRefs = getContatoRefs(idContato);
  const conversaRefs = getConversaRefs(idContato, idConversa);
  const participantUids = [ownerUidNorm, compradorUidNorm].filter(Boolean);
  const contatoPayload = {
    idContato,
    conversaId: idConversa,
    skinRemetente: ownerUsernameNorm,
    skinDestinatario: "participantes_live",
    ownerUserId: ownerUidNorm,
    espacoId: espacoIdNorm,
    blocoId: blocoIdNorm,
    ultimaConversaData: serverTimestamp(),
    origem: "live_grupo_pix_manual",
    tipo: "live",
  };
  if (participantUids.length) {
    contatoPayload.participantUids = arrayUnion(...participantUids);
  }

  return {
    idContato,
    idConversa,
    contatoRefs,
    conversaRefs,
    contatoPayload,
    conversaPayload: {
      assunto: "CHAT DA LIVE",
      idContato,
      idConversa,
      ownerUserId: ownerUidNorm,
      espacoId: espacoIdNorm,
      blocoId: blocoIdNorm,
      ultimaMensagem: "Acesso confirmado para a live.",
      dataUltimaMensagem: serverTimestamp(),
      data: serverTimestamp(),
      origem: "live_grupo_pix_manual",
      tipo: "live",
    },
  };
}

export async function confirmarSolicitacaoPixManual({
  ownerUserId = "",
  solicitacaoId = "",
}) {
  const currentUid = sanitizeString(auth?.currentUser?.uid);
  if (!currentUid) {
    throw new Error("Usuario nao autenticado.");
  }

  const ownerUid = sanitizeString(ownerUserId) || currentUid;
  if (ownerUid !== currentUid) {
    throw new Error("Apenas o owner pode confirmar solicitações.");
  }

  const idSolicitacaoNormalizado = sanitizeString(solicitacaoId);
  const pedidoRefs = getSolicitacaoRefs(ownerUid, idSolicitacaoNormalizado);
  let pedidoSnap = null;
  for (const pedidoRefItem of pedidoRefs) {
    const snapAtual = await getDoc(pedidoRefItem).catch(() => null);
    if (snapAtual?.exists?.()) {
      pedidoSnap = snapAtual;
      break;
    }
  }
  if (!pedidoSnap?.exists?.()) {
    throw new Error("Solicitacao nao encontrada.");
  }

  const pedido = pedidoSnap.data() || {};
  if (sanitizeString(pedido?.status) === "pagamento_confirmado") {
    return { ok: true, alreadyConfirmed: true };
  }

  const blocoId = sanitizeString(pedido?.blocoId);
  const espacoId = sanitizeString(pedido?.espacoId);
  const compradorUid = sanitizeString(pedido?.compradorUid);
  const compradorSkinId = sanitizeString(pedido?.compradorSkinId);
  let blocoTipo = sanitizeString(pedido?.blocoTipo).toLowerCase();
  let blocoLiveInicioEmMs = parseLiveMs(
    pedido?.blocoLiveInicioEmMs,
    pedido?.blocoLiveInicioEmIso
  );
  let blocoLiveFimEmMs = parseLiveMs(pedido?.blocoLiveFimEmMs, pedido?.blocoLiveFimEmIso);
  let blocoLiveInicioEmIso = sanitizeString(pedido?.blocoLiveInicioEmIso) || "";
  let blocoLiveFimEmIso = sanitizeString(pedido?.blocoLiveFimEmIso) || "";

  if (!blocoId || !espacoId || !compradorUid) {
    throw new Error("Solicitacao invalida para confirmacao.");
  }

  let blocoMiniaturaUrl = sanitizeString(pedido?.blocoMiniaturaUrl);
  let blocoOriginalUrl = sanitizeString(pedido?.blocoOriginalUrl);
  let blocoOriginalPath = sanitizeString(pedido?.blocoOriginalPath);
  try {
    const blocoSnap = await getFirstExistingProjectDocSnapshot(
      db,
      "users",
      ownerUid,
      "espacos",
      espacoId,
      "blocos",
      blocoId
    );
    if (blocoSnap?.exists?.()) {
      const blocoAtual = blocoSnap.data() || {};
      const miniaturaAtual = extrairMiniaturaBloco(blocoAtual);
      blocoMiniaturaUrl = sanitizeString(
        blocoMiniaturaUrl || miniaturaAtual.miniaturaUrl || miniaturaAtual.url
      );
      blocoOriginalPath = sanitizeString(blocoOriginalPath || miniaturaAtual.originalPath);
      const originalAtual = sanitizeString(miniaturaAtual.originalUrl);
      if (
        (!blocoOriginalUrl || blocoOriginalUrl === blocoMiniaturaUrl) &&
        originalAtual &&
        originalAtual !== blocoMiniaturaUrl
      ) {
        blocoOriginalUrl = originalAtual;
      }
      if (!blocoTipo) {
        blocoTipo = sanitizeString(blocoAtual?.tipo).toLowerCase() || "imagem";
      }
      if (!blocoLiveInicioEmMs) {
        blocoLiveInicioEmMs = parseLiveMs(blocoAtual?.liveInicioEmMs, blocoAtual?.liveInicioEmIso);
      }
      if (!blocoLiveFimEmMs) {
        blocoLiveFimEmMs = parseLiveMs(blocoAtual?.liveFimEmMs, blocoAtual?.liveFimEmIso);
      }
      if (!blocoLiveInicioEmIso) {
        blocoLiveInicioEmIso = sanitizeString(blocoAtual?.liveInicioEmIso) || "";
      }
      if (!blocoLiveFimEmIso) {
        blocoLiveFimEmIso = sanitizeString(blocoAtual?.liveFimEmIso) || "";
      }
    }
  } catch {
    // Mantem os dados ja persistidos na solicitacao em caso de falha de leitura.
  }

  const contextoSessaoChat = blocoTipo === "live"
    ? montarSessaoChatLiveContext({
        ownerUid,
        compradorUid,
        espacoId,
        blocoId,
        ownerUsername: sanitizeString(pedido?.ownerUsername),
      })
    : montarSessaoChatContext({
    ownerUid,
    compradorUid,
    solicitacaoId: idSolicitacaoNormalizado,
    blocoId,
    espacoId,
    ownerUsername: sanitizeString(pedido?.ownerUsername),
    compradorUsername: sanitizeString(pedido?.compradorUsername || pedido?.compradorNome),
  });

  const compradorRefs = getCompradorRefs(ownerUid, espacoId, blocoId, compradorUid);

  const batch = writeBatch(db);
  for (const compradorRef of compradorRefs) {
    batch.set(
      compradorRef,
      {
        liberadoPorPedidoId: idSolicitacaoNormalizado,
        liberadoEm: serverTimestamp(),
        confirmadoPorUid: currentUid,
        compradorUid,
        espacoId,
        blocoId,
      },
      { merge: true }
    );
  }

  if (compradorSkinId) {
    for (const compradorSkinRef of getCompradorRefs(
      ownerUid,
      espacoId,
      blocoId,
      compradorSkinId
    )) {
      batch.set(
        compradorSkinRef,
        {
          liberadoPorPedidoId: idSolicitacaoNormalizado,
          liberadoEm: serverTimestamp(),
          confirmadoPorUid: currentUid,
          compradorUid,
          compradorSkinId,
          espacoId,
          blocoId,
        },
        { merge: true }
      );
    }
  }

  for (const contatoRef of contextoSessaoChat.contatoRefs || []) {
    batch.set(contatoRef, contextoSessaoChat.contatoPayload, { merge: true });
  }
  for (const conversaRef of contextoSessaoChat.conversaRefs || []) {
    batch.set(conversaRef, contextoSessaoChat.conversaPayload, { merge: true });
  }
  if (contextoSessaoChat.chatRefs?.length && contextoSessaoChat.chatPayload) {
    for (const chatRef of contextoSessaoChat.chatRefs) {
      batch.set(chatRef, contextoSessaoChat.chatPayload, { merge: true });
    }
  }

  for (const pedidoRef of pedidoRefs) {
    batch.set(
      pedidoRef,
      {
        status: "pagamento_confirmado",
        confirmadoEm: serverTimestamp(),
        confirmadoPorUid: currentUid,
        atualizadoEm: serverTimestamp(),
        sessionStatus: "confirmada",
        sessionCriadaEm: serverTimestamp(),
        sessionContactId: contextoSessaoChat.idContato,
        sessionConversationId: contextoSessaoChat.idConversa,
        blocoTipo: blocoTipo || "imagem",
        blocoLiveInicioEmMs: blocoLiveInicioEmMs || null,
        blocoLiveFimEmMs: blocoLiveFimEmMs || null,
        blocoLiveInicioEmIso: blocoLiveInicioEmIso || null,
        blocoLiveFimEmIso: blocoLiveFimEmIso || null,
        blocoMiniaturaUrl: blocoMiniaturaUrl || null,
        blocoOriginalUrl: blocoOriginalUrl || null,
        blocoOriginalPath: blocoOriginalPath || null,
      },
      { merge: true }
    );
  }

  await batch.commit();
  return {
    ok: true,
    alreadyConfirmed: false,
    sessionStatus: "confirmada",
    sessionContactId: contextoSessaoChat.idContato,
    sessionConversationId: contextoSessaoChat.idConversa,
  };
}

export async function solicitarPedidoPixManualBloco(payload = {}) {
  return solicitarSolicitacaoPixManualBloco(payload);
}

export async function listarPedidosPixManual(payload = {}) {
  return listarSolicitacoesPixManual(payload);
}

export async function confirmarPedidoPixManual({
  ownerUserId = "",
  pedidoId = "",
} = {}) {
  return confirmarSolicitacaoPixManual({
    ownerUserId,
    solicitacaoId: pedidoId,
  });
}
