import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  addDoc,
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
import LiveModal from "./components/LiveModal";
import {
  LIVE_EFETIVE_TURN_URLS,
  LIVE_WEBRTC_CONFIG,
  formatarDataHoraLive,
  montarLiveContactId,
  normalizarRtcDescricao,
  normalizarEmbedLiveUrl,
  parseLiveMs,
  serializarIceCandidate,
  serializarRtcDescricao,
} from "./live/liveUtils";
import {
  enviarMensagemContatoLive,
  garantirContatoConversaLive,
} from "./live/liveContatoApi";
import {
  getChatCollectionRefs,
  getContatoDocRefs,
  getConversaDocRefs,
  getFirstRef,
  getLiveRtcCandidatesCollectionRefs,
  getLiveRtcSessionCollectionRefs,
  getLiveRtcSessionDocRefs,
} from "./live/liveRefs";
import {
  activeFirebaseProjectKey,
  auth,
  db,
  storage,
} from "../../Banco/init-firebase";
import {
  getLegacyProjectCollection,
  getProjectCollectionCandidates,
  getProjectDocCandidates,
} from "../../Banco/projectDataRefs";
import { isProjectDataNamespaced } from "../../Banco/projectDataNamespace";
import {
  excluirArquivoNoBucketCompartilhado,
  obterUrlArquivoNoBucketCompartilhado,
  uploadArquivoNoBucketCompartilhado,
  usandoBucketCompartilhadoCrossProject,
} from "../../Banco/sharedBucketApi";
import {
  DEFAULT_SISTEMA_CONFIG,
  isOneOwnerComEntradaPublica,
  obterConfigSistema,
  obterConfigSistemaCacheLocal,
  obterOwnerEmailConfigurado,
  obterOwnerUidConfigurado,
  obterRotulosBloco,
  obterRotulosEspaco,
  obterRotulosSkin,
  resolverBloqueioCompraAssinaturaPorLocalizacao,
  usuarioCorrespondeOwnerConfigurado,
} from "../Sistema/configSistema";
import { obterGeoAcessoAtual } from "../Sistema/acessoGeo";
import {
  listarAddOnsDoUsuarioProjeto,
  listarIconCollectionsNoGerenciador,
} from "../Sistema/gerenciadorProjetosApi";
import {
  buildIconSelectionValue,
  filtrarColecoesIconesPermitidas,
  parseIconSelectionValue,
} from "../Sistema/iconCollectionsUtils";
import { solicitarSolicitacaoPixManualBloco } from "../Pagamentos/mercadoPagoApi";
import QRCodeImage from "../../Funcionalidades/QRCode/QRCodeImage";
import {
  CYBERPINK_SUBTHEMES,
  getCyberpinkSubthemeIconColor,
  getCyberpinkSubthemeIconFilter,
  normalizeCyberpinkSubtheme,
} from "../Temas/cyberpink/subthemes";
import { seforAdm } from "../../Scripts/verificacoes/verificaAdm";
import { getEspacoCompleto } from "./firebaseEspacos";
import { criarQrPrintCard } from "./qrPrintsApi";

const getBlocosCollectionRefs = (ownerUserId, espacoId) =>
  getProjectCollectionCandidates(db, "users", ownerUserId, "espacos", espacoId, "blocos");
const getLegacyBlocosCollectionRef = (ownerUserId, espacoId) =>
  getLegacyProjectCollection(db, "users", ownerUserId, "espacos", espacoId, "blocos");
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
const getLegacyBlocoCardsCollectionRef = (ownerUserId, espacoId, blocoId) =>
  getLegacyProjectCollection(
    db,
    "users",
    ownerUserId,
    "espacos",
    espacoId,
    "blocos",
    blocoId,
    "cards"
  );
const getBlocoCardDocRefs = (ownerUserId, espacoId, blocoId, cardId) =>
  getProjectDocCandidates(
    db,
    "users",
    ownerUserId,
    "espacos",
    espacoId,
    "blocos",
    blocoId,
    "cards",
    cardId
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

const normalizarAddOnIds = (value) => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
};

const normalizarAddOnSubthemes = (value, validIds = []) => {
  if (!value || typeof value !== "object") return {};

  const validIdSet = new Set(
    Array.isArray(validIds)
      ? validIds.map((item) => String(item || "").trim()).filter(Boolean)
      : []
  );

  return Object.entries(value).reduce((acc, [addOnId, subtheme]) => {
    const addOnIdNormalizado = String(addOnId || "").trim();
    if (!addOnIdNormalizado) return acc;
    if (validIdSet.size && !validIdSet.has(addOnIdNormalizado)) return acc;

    const bruto = String(subtheme || "")
      .trim()
      .toLowerCase();
    if (!bruto || bruto === "space" || bruto === "default" || bruto === "padrao") {
      return acc;
    }

    acc[addOnIdNormalizado] = normalizeCyberpinkSubtheme(bruto);
    return acc;
  }, {});
};

const normalizarSubtemaAddOnOpcional = (value = "") => {
  const bruto = String(value || "").trim();
  return bruto ? normalizeCyberpinkSubtheme(bruto) : "";
};

const criarSubObjetoAddOnRef = (addOn = {}, ordem = 0, subtema = "") => {
  const addOnId = String(addOn?.id || "").trim();
  return {
    id: `addonRef_${addOnId || ordem}`,
    tipo: "addonRef",
    refId: addOnId,
    addonId: addOnId,
    ordem,
    visivel: true,
    destaque: false,
    nomeSnapshot: String(addOn?.nome || "").trim(),
    imagemSnapshot: String(addOn?.url_img || "").trim(),
    descricaoSnapshot: String(addOn?.descricao || "").trim(),
    subtema: normalizarSubtemaAddOnOpcional(subtema),
  };
};

const normalizarSubObjetosAddOns = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      const tipo = String(item?.tipo || item?.type || "").trim();
      const addonId = String(
        item?.addonId ||
          item?.addOnId ||
          item?.refId ||
          item?.id_add ||
          item?.idAddOn ||
          ""
      ).trim();

      return {
        id: String(item?.id || `addonRef_${addonId || index}`).trim(),
        tipo: tipo || "addonRef",
        refId: String(item?.refId || addonId).trim(),
        addonId,
        ordem: Number.isFinite(Number(item?.ordem)) ? Number(item.ordem) : index,
        visivel: item?.visivel !== false,
        destaque: item?.destaque === true,
        nomeSnapshot: String(item?.nomeSnapshot || item?.nome || "").trim(),
        imagemSnapshot: String(
          item?.imagemSnapshot || item?.url_img || item?.imageUrl || ""
        ).trim(),
        descricaoSnapshot: String(item?.descricaoSnapshot || item?.descricao || "").trim(),
        subtema: normalizarSubtemaAddOnOpcional(item?.subtema || item?.theme || ""),
      };
    })
    .filter((item) => item.addonId && item.visivel !== false)
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
};

const normalizarSubBlocosAddOns = (value, fallbackSubObjetos = [], options = {}) => {
  const manterVazios = options?.manterVazios === true;
  const subBlocosOrigem = Array.isArray(value) ? value : [];
  const subBlocosNormalizados = subBlocosOrigem
    .map((subBloco, index) => {
      const subObjetos = normalizarSubObjetosAddOns(
        subBloco?.subObjetos || subBloco?.subobjetos || subBloco?.addOns || []
      );
      return {
        id: String(subBloco?.id || `subbloco_${index}`).trim(),
        tipo: String(subBloco?.tipo || subBloco?.type || "addons").trim(),
        titulo: String(subBloco?.titulo || subBloco?.nome || `Subbloco ${index + 1}`).trim(),
        ordem: Number.isFinite(Number(subBloco?.ordem)) ? Number(subBloco.ordem) : index,
        layout: String(subBloco?.layout || "grid").trim(),
        subObjetos,
      };
    })
    .filter((subBloco) => manterVazios || subBloco.subObjetos.length)
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

  if (subBlocosNormalizados.length) return subBlocosNormalizados;

  const subObjetosFallback = normalizarSubObjetosAddOns(fallbackSubObjetos);
  return subObjetosFallback.length
    ? [
        {
          id: "subbloco_legacy",
          tipo: "addons",
          titulo: "Add-ons",
          ordem: 0,
          layout: "grid",
          subObjetos: subObjetosFallback,
        },
      ]
    : [];
};

const criarSubBlocoAddOns = (ordem = 0) => ({
  id: `subbloco_${Date.now()}_${ordem}`,
  tipo: "addons",
  titulo: ordem === 0 ? "Add-ons" : `Subbloco ${ordem + 1}`,
  ordem,
  layout: "grid",
  subObjetos: [],
});

const achatarSubBlocosAddOns = (subBlocos = []) =>
  normalizarSubBlocosAddOns(subBlocos)
    .flatMap((subBloco) =>
      subBloco.subObjetos.map((subObjeto) => ({
        ...subObjeto,
        subBlocoId: subBloco.id,
        subBlocoTitulo: subBloco.titulo,
      }))
    )
    .map((subObjeto, index) => ({
      ...subObjeto,
      ordem: index,
    }));

const isSvgAssetUrl = (value = "") => {
  const normalizado = String(value || "").trim().toLowerCase();
  return (
    normalizado.endsWith(".svg") ||
    normalizado.includes(".svg?") ||
    normalizado.startsWith("data:image/svg+xml")
  );
};

const normalizarCardsDoBloco = (valor) => {
  if (!Array.isArray(valor)) return [];

  return valor
    .map((card, index) => {
      const addOnIdsNormalizados = normalizarAddOnIds(
        card?.addOnIds || card?.addOnsIds || card?.addons
      );
      const possuiCampoAddOns =
        Array.isArray(card?.addOnIds) ||
        Array.isArray(card?.addOnsIds) ||
        Array.isArray(card?.addons) ||
        (card?.addOnSubthemes && typeof card.addOnSubthemes === "object");
      return {
        id: String(card?.id || `card_${index}`),
        ordem: Number.isFinite(card?.ordem) ? Number(card.ordem) : index,
        nome: String(card?.nome || "").trim(),
        descricaoExtra: String(card?.descricaoExtra || "").trim(),
        descricao: String(card?.descricao || "").trim(),
        imagem: String(card?.imagem || "").trim(),
        imagemPath: String(card?.imagemPath || "").trim(),
        linkExterno: String(card?.linkExterno || "").trim(),
        addOnIds: addOnIdsNormalizados,
        addOnSubthemes: normalizarAddOnSubthemes(
          card?.addOnSubthemes || card?.addOnThemes,
          addOnIdsNormalizados
        ),
        usaAddOnsGerenciador: possuiCampoAddOns,
      };
    })
    .filter(
      (card) =>
        card.nome ||
        card.descricaoExtra ||
        card.descricao ||
        card.imagem ||
        card.imagemPath ||
        card.linkExterno ||
        card.addOnIds.length
    )
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
};

const BLOCOS_PAGE_SIZE = 6;

const obterScoreOrdenacaoBloco = (bloco = {}) => {
  const ordem = Number(bloco?.ordem);
  if (Number.isFinite(ordem)) return ordem;
  const criadoEm =
    bloco?.criadoEm?.seconds ||
    bloco?.createdAt?.seconds ||
    bloco?.updatedAt?.seconds ||
    0;
  return Number(criadoEm) || 0;
};

const ordenarBlocosMaisRecentesPrimeiro = (lista = []) =>
  [...lista].sort((a, b) => {
    const scoreA = obterScoreOrdenacaoBloco(a);
    const scoreB = obterScoreOrdenacaoBloco(b);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return String(b?.id || "").localeCompare(String(a?.id || ""), "pt-BR");
  });

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

const encodeRouteSegment = (value = "") => encodeURIComponent(String(value || "").trim());

function CardActionIcon({ type }) {
  if (type === "eye") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path d="M3.5 16s4.8-8 12.5-8 12.5 8 12.5 8-4.8 8-12.5 8S3.5 16 3.5 16Z" />
        <circle cx="16" cy="16" r="4.2" />
      </svg>
    );
  }

  if (type === "gear") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path d="M18.8 3.5 19.7 7a10.8 10.8 0 0 1 2.2.9l3-1.8 2.4 4.1-2.8 2.3c.1.6.2 1.2.2 1.9s-.1 1.3-.2 1.9l2.8 2.3-2.4 4.1-3-1.8c-.7.4-1.4.7-2.2.9l-.9 3.5h-5.6l-.9-3.5a10.8 10.8 0 0 1-2.2-.9l-3 1.8-2.4-4.1 2.8-2.3a11 11 0 0 1-.2-1.9c0-.7.1-1.3.2-1.9L4.7 10.2l2.4-4.1 3 1.8c.7-.4 1.4-.7 2.2-.9l.9-3.5h5.6Z" />
        <circle cx="16" cy="16" r="4.6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M8 3.5h11l5 5V28H8V3.5Z" />
      <path d="M19 3.5V9h5" />
      <path d="M11 20h10M11 23h7" />
      <path d="M11 12h10v5H11z" />
    </svg>
  );
}

const criarEstadoEditorCard = (overrides = {}) => ({
  aberto: false,
  bloco: null,
  card: null,
  ehNovo: false,
  ordem: 0,
  nome: "",
  descricaoExtra: "",
  descricao: "",
  imagem: "",
  imagemOriginal: "",
  imagemPathOriginal: "",
  imagemArquivo: null,
  imagemPreviewUrl: "",
  linkExterno: "",
  addOnIds: [],
  addOnSubthemes: {},
  ...overrides,
});

const criarEstadoEditorBlocoCards = (overrides = {}) => ({
  aberto: false,
  blocoId: "",
  titulo: "",
  icone: "",
  iconeSelecao: "",
  ...overrides,
});

const criarEstadoPreviewImpressaoCard = (overrides = {}) => ({
  aberto: false,
  bloco: null,
  card: null,
  imagem: "",
  rota: "",
  url: "",
  rotaCard: "",
  urlCard: "",
  rotaQr: "",
  urlQr: "",
  printId: "",
  qrStatus: "",
  qrErro: "",
  addOns: [],
  ...overrides,
});

const gerarIdCardTemporario = () =>
  `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const namespaceAtivoProjeto = () => isProjectDataNamespaced(activeFirebaseProjectKey);

async function carregarCardsLegadosRaiz(ownerUserId, espacoId, blocoId) {
  try {
    const cardsSnap = await getDocs(getLegacyBlocoCardsCollectionRef(ownerUserId, espacoId, blocoId));
    return cardsSnap.docs;
  } catch (err) {
    if (err?.code === "permission-denied" || err?.code === "failed-precondition") {
      return [];
    }
    throw err;
  }
}

async function migrarBlocosLegadosRaizParaNamespace(ownerUserId, espacoId, blocoDocs = []) {
  if (!namespaceAtivoProjeto() || !Array.isArray(blocoDocs) || !blocoDocs.length) {
    return false;
  }

  let migrou = false;

  for (const blocoDoc of blocoDocs) {
    const blocoId = String(blocoDoc?.id || "").trim();
    const blocoData = blocoDoc?.data?.() || {};
    if (!blocoId) continue;

    const cardsLegadosDocs = await carregarCardsLegadosRaiz(ownerUserId, espacoId, blocoId);
    const cardsLegados = normalizarCardsDoBloco(
      cardsLegadosDocs.map((cardDoc) => ({
        id: cardDoc.id,
        ...cardDoc.data(),
      }))
    );
    const cardsFinal = normalizarCardsDoBloco(
      Array.isArray(blocoData?.cards) && blocoData.cards.length ? blocoData.cards : cardsLegados
    );

    const blocoRef = getBlocoDocRefs(ownerUserId, espacoId, blocoId)[0];
    await setDoc(
      blocoRef,
      {
        ...blocoData,
        id: blocoId,
        ownerUserId: String(blocoData?.ownerUserId || ownerUserId).trim() || ownerUserId,
        espacoId: String(blocoData?.espacoId || espacoId).trim() || espacoId,
        cards: cardsFinal,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await Promise.all(
      cardsFinal.map((card) =>
        setDoc(
          getBlocoCardDocRefs(ownerUserId, espacoId, blocoId, card.id)[0],
          {
            id: card.id,
            ordem: card.ordem,
            nome: card.nome || "",
            descricaoExtra: card.descricaoExtra || "",
            descricao: card.descricao || "",
            imagem: card.imagem || "",
            imagemPath: card.imagemPath || "",
            linkExterno: card.linkExterno || "",
            blocoId,
            espacoId,
            ownerUserId,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
      )
    );

    migrou = true;
  }

  return migrou;
}

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
  const location = useLocation();
  const { skinsUsername, espacoNome } = useParams();
  const {
    espacos,
    skinIdAtual,
    user,
    oneOwnerPublicaAtiva: oneOwnerPublicaAtivaContexto = false,
  } = useOutletContext();
  const configSistemaCacheLocal = obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG;
  const [blocos, setBlocos] = useState([]);
  const [visibleBlocosCount, setVisibleBlocosCount] = useState(BLOCOS_PAGE_SIZE);
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
  const [cardEmAtualizacaoId, setCardEmAtualizacaoId] = useState(null);
  const [cardAtivoPorBloco, setCardAtivoPorBloco] = useState({});
  const [cardArrastePorBloco, setCardArrastePorBloco] = useState({});
  const [dragCardInfo, setDragCardInfo] = useState({ blocoId: "", cardId: "" });
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
  const [oneOwnerPublicaAtiva, setOneOwnerPublicaAtiva] = useState(
    isOneOwnerComEntradaPublica(configSistemaCacheLocal)
  );
  const [configSistemaAtual, setConfigSistemaAtual] = useState(
    configSistemaCacheLocal || DEFAULT_SISTEMA_CONFIG
  );
  const [iconCollectionsDisponiveis, setIconCollectionsDisponiveis] = useState([]);
  const [addOnsDisponiveisGerenciador, setAddOnsDisponiveisGerenciador] = useState([]);
  const [erroAddOnsGerenciador, setErroAddOnsGerenciador] = useState("");
  const [buscaAddOnEditor, setBuscaAddOnEditor] = useState("");
  const [ownerUidProjeto, setOwnerUidProjeto] = useState(
    String(
      obterOwnerUidConfigurado(configSistemaCacheLocal) || ""
    ).trim()
  );
  const [ownerEmailProjeto, setOwnerEmailProjeto] = useState(
    String(
      obterOwnerEmailConfigurado(configSistemaCacheLocal) || ""
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
  const [mensagemRestricaoAvatarUrl, setMensagemRestricaoAvatarUrl] = useState(
    DEFAULT_SISTEMA_CONFIG.mensagemRestricaoAvatarUrl
  );
  const [imagemModal, setImagemModal] = useState({
    aberto: false,
    url: "",
    titulo: "",
    alt: "Imagem ampliada",
  });
  const [previewImpressaoCard, setPreviewImpressaoCard] = useState(() =>
    criarEstadoPreviewImpressaoCard()
  );
  const [editorCardModal, setEditorCardModal] = useState(() => criarEstadoEditorCard());
  const [editorBlocoCardsModal, setEditorBlocoCardsModal] = useState(() =>
    criarEstadoEditorBlocoCards()
  );
  const [liveModal, setLiveModal] = useState({
    aberto: false,
    blocoId: "",
    titulo: "",
    liveUrl: "",
    embedUrl: "",
    contactId: "",
    conversationId: "principal",
    ownerUserId: "",
  });
  const [liveChatMensagens, setLiveChatMensagens] = useState([]);
  const [liveChatMensagem, setLiveChatMensagem] = useState("");
  const [liveChatErro, setLiveChatErro] = useState("");
  const [liveCameraAtiva, setLiveCameraAtiva] = useState(false);
  const [liveCameraErro, setLiveCameraErro] = useState("");
  const [liveCameraFacingMode, setLiveCameraFacingMode] = useState("user");
  const [liveCameraRotacaoGraus, setLiveCameraRotacaoGraus] = useState(0);
  const [liveCameraRemotaAtiva, setLiveCameraRemotaAtiva] = useState(false);
  const [liveCameraRemotaErro, setLiveCameraRemotaErro] = useState("");
  const [liveCameraRemotaStatus, setLiveCameraRemotaStatus] = useState("");
  const [liveCameraRemotaRotacaoGraus, setLiveCameraRemotaRotacaoGraus] = useState(0);
  const [liveViewerTentativas, setLiveViewerTentativas] = useState(0);
  const [liveCriadorCameraAtiva, setLiveCriadorCameraAtiva] = useState(false);
  const liveModalEhVideoDireto = useMemo(
    () => /\.(mp4|webm|ogg)(\?|$)/i.test(String(liveModal.liveUrl || "").trim()),
    [liveModal.liveUrl]
  );
  const blockedOriginalPathsRef = useRef(new Set());
  const blockedPreviewPathsRef = useRef(new Set());
  const backfilledPublicUrlsRef = useRef(new Set());
  const migratedAddOnBlocksRef = useRef(new Set());
  const blocosInfiniteScrollRef = useRef(null);
  const cardSwipeStateRef = useRef({});
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
  const exibirLoaderSprite = Boolean(loginLoadingSpriteUrl);
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

  const espacosLista = Array.isArray(espacos) ? espacos : [];
  const blocoEditorCardsAtual = useMemo(
    () =>
      blocos.find((item) => String(item?.id || "").trim() === editorBlocoCardsModal.blocoId) || null,
    [blocos, editorBlocoCardsModal.blocoId]
  );
  const iconCollectionsFiltradas = useMemo(
    () => filtrarColecoesIconesPermitidas(iconCollectionsDisponiveis, configSistemaAtual),
    [configSistemaAtual, iconCollectionsDisponiveis]
  );
  const addOnsDisponiveisProjeto = useMemo(() => {
    if (configSistemaAtual?.addOnsHabilitados !== true) return [];
    return addOnsDisponiveisGerenciador;
  }, [configSistemaAtual, addOnsDisponiveisGerenciador]);
  const addOnsDisponiveisProjetoPorId = useMemo(
    () =>
      addOnsDisponiveisProjeto.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [addOnsDisponiveisProjeto]
  );
  const addOnsEditorFiltrados = useMemo(() => {
    const buscaNormalizada = String(buscaAddOnEditor || "").trim().toLowerCase();
    return addOnsDisponiveisProjeto.filter((item) => {
      if (!buscaNormalizada) return true;
      return String(item?.nome || "").toLowerCase().includes(buscaNormalizada);
    });
  }, [addOnsDisponiveisProjeto, buscaAddOnEditor]);
  const addOnsProjetoHabilitados =
    configSistemaAtual?.addOnsHabilitados === true;
  const blocoAddOnsProjetoHabilitado = configSistemaAtual?.blocoAddOnsHabilitado === true;
  const projetoPossuiColecoesIcones = iconCollectionsFiltradas.length > 0;
  const cardsEditorBlocoAtual = useMemo(
    () => normalizarCardsDoBloco(blocoEditorCardsAtual?.cards),
    [blocoEditorCardsAtual]
  );
  const subBlocosAddOnsEditorBlocoAtual = useMemo(
    () => {
      const subBlocos = normalizarSubBlocosAddOns(
        blocoEditorCardsAtual?.subBlocos || blocoEditorCardsAtual?.subblocos,
        blocoEditorCardsAtual?.subObjetos || blocoEditorCardsAtual?.subobjetos,
        { manterVazios: true }
      );
      return subBlocos.length ? subBlocos : [criarSubBlocoAddOns(0)];
    },
    [blocoEditorCardsAtual]
  );
  const subObjetosAddOnsEditorBlocoAtual = useMemo(
    () => achatarSubBlocosAddOns(subBlocosAddOnsEditorBlocoAtual),
    [subBlocosAddOnsEditorBlocoAtual]
  );
  const addOnIdsEditorBlocoAtual = useMemo(
    () => normalizarAddOnIds(subObjetosAddOnsEditorBlocoAtual.map((item) => item.addonId)),
    [subObjetosAddOnsEditorBlocoAtual]
  );

  const persistedUid = localStorage.getItem("userId");
  const authUserAtual = user || auth.currentUser || null;
  const authUid = auth.currentUser?.uid || null;
  const currentUidAutenticado = user?.uid || authUid || null;
  const currentUid = user?.uid || authUid || persistedUid || null;
  const espacoAtual = espacosLista.find((e) => e.nome === espacoNome);
  const espacoId = espacoAtual?.id || espacoAtual?.id_espaco;
  const oneOwnerPublicaAtivaEfetiva = Boolean(oneOwnerPublicaAtivaContexto || oneOwnerPublicaAtiva);
  const ownerUidProjetoEfetivo = String(
    ownerUidProjeto || obterOwnerUidConfigurado(configSistemaCacheLocal) || ""
  ).trim();
  const ownerEmailProjetoEfetivo = String(
    ownerEmailProjeto || obterOwnerEmailConfigurado(configSistemaCacheLocal) || ""
  )
    .trim()
    .toLowerCase();
  const ownerProjetoConfigurado = Boolean(
    ownerUidProjetoEfetivo || ownerEmailProjetoEfetivo
  );
  const espacoAtualEfetivo =
    espacoDetalheAtual &&
    String(espacoDetalheAtual.id || espacoDetalheAtual.id_espaco) === String(espacoId || "")
      ? { ...espacoAtual, ...espacoDetalheAtual }
      : espacoAtual;
  const usuarioEhOwnerProjeto = Boolean(
    currentUid &&
      (
        usuarioCorrespondeOwnerConfigurado(configSistemaCacheLocal, {
          uid: currentUid,
          email: authUserAtual?.email,
        }) ||
        (!ownerProjetoConfigurado && authUserAtual && seforAdm(authUserAtual))
      )
  );
  const ownerUserId =
    espacoAtualEfetivo?.ownerUserId ||
    espacosLista[0]?.ownerUserId ||
    (
      oneOwnerPublicaAtivaEfetiva
        ? ownerUidProjetoEfetivo || (usuarioEhOwnerProjeto ? currentUid : null)
        : null
    );
  const ownerUserIdLiveEfetivo = String(
    ownerUserId || (oneOwnerPublicaAtivaEfetiva ? ownerUidProjetoEfetivo : "") || ""
  ).trim();
  const ownerUserIdLiveFallback = String(
    ownerUserIdLiveEfetivo || ownerUidProjetoEfetivo || ""
  ).trim();
  const isOwner = !!currentUid && ownerUserId === currentUid;
  const isCoCriador =
    !!currentUid &&
    Array.isArray(espacoAtualEfetivo?.coCriadoresUids) &&
    espacoAtualEfetivo.coCriadoresUids.includes(currentUid);
  const podeGerenciarPadrao = isOwner || isCoCriador;
  const podeGerenciar = oneOwnerPublicaAtivaEfetiva
    ? usuarioEhOwnerProjeto
    : (podeGerenciarPadrao || usuarioEhOwnerProjeto);
  const visibilidadeEspaco = espacoAtualEfetivo?.visibilidade || "publico";
  const visitanteOneOwnerPublico =
    oneOwnerPublicaAtivaEfetiva && !currentUid && !podeGerenciar;
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
        usuarioEhOwnerProjeto
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

  const normalizarRotacaoCameraLive = (valor) => {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return 0;
    const normalizado = ((Math.round(numero / 90) * 90) % 360 + 360) % 360;
    return normalizado;
  };

  const atualizarStatusCameraLive = async (
    cameraAtiva = false,
    {
      facingMode = liveCameraFacingMode,
      rotationDeg = liveCameraRotacaoGraus,
    } = {}
  ) => {
    const contactId = String(liveModal.contactId || "").trim();
    const conversationId = String(liveModal.conversationId || "principal").trim();
    if (!usuarioPodeControlarCameraLive || !contactId || !conversationId) return;

    const ownerUidLive = String(
      currentUidAutenticado || liveModal.ownerUserId || ownerUserIdLiveFallback || ""
    ).trim();
    const facingModeNormalizado =
      String(facingMode || "").trim().toLowerCase() === "environment" ? "environment" : "user";
    const rotationDegNormalizada = normalizarRotacaoCameraLive(rotationDeg);
    try {
      for (const conversaRef of getConversaDocRefs(db, contactId, conversationId)) {
        await setDoc(
          conversaRef,
          {
            liveCameraAtiva: Boolean(cameraAtiva),
            liveCameraOwnerUid: ownerUidLive || null,
            liveCameraFacingMode: facingModeNormalizado,
            liveCameraRotationDeg: rotationDegNormalizada,
            liveCameraAtualizadoEm: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch {
      // Nao interrompe fluxo de camera por falha de status.
    }
  };

  const pararStreamLocalLive = (stream = liveCameraStreamRef.current) => {
    if (stream?.getTracks) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignora falhas ao encerrar track.
        }
      });
    }
  };

  const substituirTrackCameraNosPeersHost = async (streamLocal) => {
    const novaTrack = streamLocal?.getVideoTracks?.()?.[0] || null;
    if (!novaTrack) return;

    const promessas = [];
    for (const peerContexto of liveRtcHostPeersRef.current.values()) {
      const peer = peerContexto?.pc;
      if (!peer?.getSenders) continue;
      const senderVideo = peer
        .getSenders()
        .find((sender) => String(sender?.track?.kind || "").trim().toLowerCase() === "video");
      if (!senderVideo?.replaceTrack) continue;
      promessas.push(
        senderVideo.replaceTrack(novaTrack).catch(() => {})
      );
    }

    if (promessas.length) {
      await Promise.all(promessas);
    }
  };

  const solicitarStreamCameraLive = async (
    facingModeDesejado = liveCameraFacingMode,
    { genericFallback = true } = {}
  ) => {
    const facingModeNormalizado =
      String(facingModeDesejado || "").trim().toLowerCase() === "environment"
        ? "environment"
        : "user";
    const tentativas = [
      {
        video: {
          facingMode: { exact: facingModeNormalizado },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      {
        video: {
          facingMode: { ideal: facingModeNormalizado },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
    ];

    if (genericFallback) {
      tentativas.push({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    }

    let ultimoErro = null;
    for (const constraints of tentativas) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (erroCamera) {
        ultimoErro = erroCamera;
      }
    }

    throw ultimoErro || new Error("Nao foi possivel acessar a camera.");
  };

  const aplicarStreamLocalLive = async (
    stream,
    { facingMode = liveCameraFacingMode } = {}
  ) => {
    const streamAnterior = liveCameraStreamRef.current;
    liveCameraStreamRef.current = stream;

    if (liveCameraVideoRef.current) {
      liveCameraVideoRef.current.srcObject = stream;
      liveCameraVideoRef.current.setAttribute("playsinline", "true");
      liveCameraVideoRef.current.setAttribute("autoplay", "true");
      liveCameraVideoRef.current.muted = true;
      await liveCameraVideoRef.current.play().catch(() => {});
    }

    await substituirTrackCameraNosPeersHost(stream);
    if (streamAnterior && streamAnterior !== stream) {
      pararStreamLocalLive(streamAnterior);
    }

    setLiveCameraFacingMode(
      String(facingMode || "").trim().toLowerCase() === "environment" ? "environment" : "user"
    );
    setLiveCameraAtiva(true);
    setLiveCameraErro("");
  };

  const desligarCameraLive = (limparErro = false) => {
    encerrarHostRtcLive();
    const streamAtual = liveCameraStreamRef.current;
    pararStreamLocalLive(streamAtual);
    liveCameraStreamRef.current = null;

    if (liveCameraVideoRef.current) {
      try {
        liveCameraVideoRef.current.srcObject = null;
      } catch {
        // fallback no-op
      }
    }

    setLiveCameraAtiva(false);
    if (usuarioPodeControlarCameraLive) {
      void atualizarStatusCameraLive(false);
    }
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
      const stream = await solicitarStreamCameraLive(liveCameraFacingMode, {
        genericFallback: true,
      });
      const tracksVideo = stream?.getVideoTracks?.() || [];
      if (!tracksVideo.length) {
        throw new Error("Nenhuma trilha de video foi disponibilizada.");
      }

      await aplicarStreamLocalLive(stream, { facingMode: liveCameraFacingMode });
      void atualizarStatusCameraLive(true, {
        facingMode: liveCameraFacingMode,
        rotationDeg: liveCameraRotacaoGraus,
      });
    } catch (erroCamera) {
      setLiveCameraAtiva(false);
      setLiveCameraErro("Nao foi possivel acessar a camera.");
    }
  };

  const alternarFonteCameraLive = async () => {
    if (!usuarioPodeControlarCameraLive) return;

    const proximoFacingMode =
      String(liveCameraFacingMode || "").trim().toLowerCase() === "environment"
        ? "user"
        : "environment";

    if (!liveCameraAtiva) {
      setLiveCameraFacingMode(proximoFacingMode);
      setLiveCameraErro("");
      return;
    }

    const streamAtual = liveCameraStreamRef.current;
    if (streamAtual) {
      pararStreamLocalLive(streamAtual);
      liveCameraStreamRef.current = null;
      if (liveCameraVideoRef.current) {
        try {
          liveCameraVideoRef.current.srcObject = null;
        } catch {
          // no-op
        }
      }
    }

    try {
      const stream = await solicitarStreamCameraLive(proximoFacingMode, {
        genericFallback: false,
      });
      const tracksVideo = stream?.getVideoTracks?.() || [];
      if (!tracksVideo.length) {
        throw new Error("Nenhuma trilha de video foi disponibilizada.");
      }

      await aplicarStreamLocalLive(stream, { facingMode: proximoFacingMode });
      void atualizarStatusCameraLive(true, {
        facingMode: proximoFacingMode,
        rotationDeg: liveCameraRotacaoGraus,
      });
    } catch {
      let streamRecuperado = null;

      try {
        streamRecuperado = await solicitarStreamCameraLive(liveCameraFacingMode, {
          genericFallback: true,
        });
      } catch {
        streamRecuperado = null;
      }

      if (streamRecuperado) {
        await aplicarStreamLocalLive(streamRecuperado, {
          facingMode: liveCameraFacingMode,
        });
        void atualizarStatusCameraLive(true, {
          facingMode: liveCameraFacingMode,
          rotationDeg: liveCameraRotacaoGraus,
        });
      } else {
        setLiveCameraAtiva(false);
      }

      setLiveCameraErro(
        proximoFacingMode === "environment"
          ? "Nao foi possivel acessar a camera traseira neste dispositivo."
          : "Nao foi possivel acessar a camera frontal neste dispositivo."
      );
    }
  };

  const girarCameraLive = () => {
    if (!usuarioPodeControlarCameraLive) return;

    const proximaRotacao = normalizarRotacaoCameraLive(liveCameraRotacaoGraus + 90);
    setLiveCameraRotacaoGraus(proximaRotacao);
    if (liveCameraAtiva) {
      void atualizarStatusCameraLive(true, {
        facingMode: liveCameraFacingMode,
        rotationDeg: proximaRotacao,
      });
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

  const fecharEditorCard = useCallback(() => {
    setBuscaAddOnEditor("");
    setEditorCardModal((prev) => {
      const previewAnterior = String(prev?.imagemPreviewUrl || "").trim();
      if (previewAnterior.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(previewAnterior);
        } catch {
          // Ignora falhas ao revogar preview temporaria.
        }
      }
      return criarEstadoEditorCard();
    });
  }, []);

  const abrirEditorCardDoBloco = useCallback((bloco, card = {}) => {
    setErroAcaoBloco("");
    setEditorCardModal((prev) => {
      const previewAnterior = String(prev?.imagemPreviewUrl || "").trim();
      if (previewAnterior.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(previewAnterior);
        } catch {
          // no-op
        }
      }

      return criarEstadoEditorCard({
        aberto: true,
        bloco,
        card,
        ehNovo: Boolean(card?.__novo),
        ordem: Number.isFinite(card?.ordem) ? Number(card.ordem) : 0,
        nome: String(card?.nome || "").trim(),
        descricaoExtra: String(card?.descricaoExtra || "").trim(),
        descricao: String(card?.descricao || "").trim(),
        imagem: String(card?.imagem || "").trim(),
        imagemOriginal: String(card?.imagem || "").trim(),
        imagemPathOriginal: String(card?.imagemPath || "").trim(),
        linkExterno: String(card?.linkExterno || "").trim(),
        addOnIds: normalizarAddOnIds(card?.addOnIds),
        addOnSubthemes: normalizarAddOnSubthemes(card?.addOnSubthemes, card?.addOnIds),
      });
    });
    setBuscaAddOnEditor("");
  }, []);

  const montarRotaCardDoBloco = useCallback(
    (bloco = {}, card = {}) => {
      const blocoIdRota = encodeRouteSegment(bloco?.id || "");
      const cardIdRota = encodeRouteSegment(card?.id || "");
      const espacoNomeRota = encodeRouteSegment(espacoNome || "");
      const skinsUsernameRota = encodeRouteSegment(skinsUsername || "");

      if (!blocoIdRota || !cardIdRota || !espacoNomeRota) return "";
      if (oneOwnerPublicaAtivaEfetiva) {
        return `/${espacoNomeRota}/card/${blocoIdRota}/${cardIdRota}`;
      }
      if (!skinsUsernameRota) return "";
      return `/${skinsUsernameRota}/${espacoNomeRota}/card/${blocoIdRota}/${cardIdRota}`;
    },
    [espacoNome, oneOwnerPublicaAtivaEfetiva, skinsUsername]
  );

  const montarUrlAbsolutaCard = useCallback((rota = "") => {
    const rotaNormalizada = String(rota || "").trim();
    if (!rotaNormalizada) return "";
    try {
      return new URL(rotaNormalizada, window.location.origin).href;
    } catch {
      return rotaNormalizada;
    }
  }, []);

  const abrirPreviewImpressaoCard = useCallback(
    async ({ bloco = null, card = null, imagem = "", addOns = [], rota = "" } = {}) => {
      if (!card) return;
      const rotaCard = String(rota || montarRotaCardDoBloco(bloco, card)).trim();
      const urlCard = montarUrlAbsolutaCard(rotaCard);
      const blocoIdAtual = String(bloco?.id || "").trim();
      const cardIdAtual = String(card?.id || "").trim();
      const podeCriarQrRastreavel = Boolean(
        podeGerenciar &&
          ownerUserId &&
          espacoId &&
          blocoIdAtual &&
          cardIdAtual &&
          rotaCard &&
          urlCard
      );

      setPreviewImpressaoCard(
        criarEstadoPreviewImpressaoCard({
          aberto: true,
          bloco,
          card,
          imagem,
          addOns,
          rota: rotaCard,
          url: urlCard,
          rotaCard,
          urlCard,
          qrStatus: podeCriarQrRastreavel ? "gerando" : "direto",
        })
      );

      if (!podeCriarQrRastreavel) return;

      try {
        const qrPrint = await criarQrPrintCard({
          ownerUserId,
          espacoId,
          espacoNome,
          skinsUsername,
          oneOwnerPublicaAtiva: oneOwnerPublicaAtivaEfetiva,
          bloco,
          card,
          rotaCard,
          urlCard,
        });

        setPreviewImpressaoCard((prev) => {
          const mesmoCard =
            prev?.aberto &&
            String(prev?.card?.id || "") === cardIdAtual &&
            String(prev?.bloco?.id || "") === blocoIdAtual;
          if (!mesmoCard) return prev;

          return {
            ...prev,
            rotaQr: qrPrint.rotaQr || "",
            urlQr: qrPrint.urlQr || "",
            printId: qrPrint.printId || "",
            url: qrPrint.urlQr || prev.url,
            qrStatus: qrPrint.printId ? "rastreavel" : "direto",
            qrErro: "",
          };
        });
      } catch (error) {
        console.error("Erro ao criar QR rastreavel do card:", error);
        setPreviewImpressaoCard((prev) => {
          const mesmoCard =
            prev?.aberto &&
            String(prev?.card?.id || "") === cardIdAtual &&
            String(prev?.bloco?.id || "") === blocoIdAtual;
          if (!mesmoCard) return prev;

          return {
            ...prev,
            qrStatus: "direto",
            qrErro: "Nao foi possivel criar QR rastreavel. Usando rota direta do card.",
            url: prev.urlCard || prev.url,
          };
        });
      }
    },
    [
      espacoId,
      espacoNome,
      montarRotaCardDoBloco,
      montarUrlAbsolutaCard,
      oneOwnerPublicaAtivaEfetiva,
      ownerUserId,
      podeGerenciar,
      skinsUsername,
    ]
  );

  const fecharPreviewImpressaoCard = useCallback(() => {
    setPreviewImpressaoCard(criarEstadoPreviewImpressaoCard());
  }, []);

  const abrirEditorBlocoCards = useCallback((bloco = null) => {
    setErroAcaoBloco("");
    setBuscaAddOnEditor("");
    setEditorBlocoCardsModal(
      criarEstadoEditorBlocoCards({
        aberto: true,
        blocoId: String(bloco?.id || "").trim(),
        titulo: String(bloco?.titulo || bloco?.nome || "").trim(),
        icone: String(bloco?.icone || bloco?.iconUrl || "").trim(),
        iconeSelecao: buildIconSelectionValue(bloco),
      })
    );
  }, []);

  const fecharEditorBlocoCards = useCallback(() => {
    setEditorBlocoCardsModal(criarEstadoEditorBlocoCards());
  }, []);

  const selecionarCardDoBloco = useCallback((blocoId, indice) => {
    setCardAtivoPorBloco((prev) => ({
      ...prev,
      [blocoId]: Math.max(0, Number(indice) || 0),
    }));
  }, []);

  const iniciarArrasteCardDoBloco = useCallback((blocoId, clientX) => {
    if (!blocoId) return;

    cardSwipeStateRef.current[blocoId] = {
      startX: Number(clientX) || 0,
      deltaX: 0,
      dragging: true,
    };

    setCardArrastePorBloco((prev) => ({
      ...prev,
      [blocoId]: {
        deltaX: 0,
        dragging: true,
      },
    }));
  }, []);

  const atualizarArrasteCardDoBloco = useCallback((blocoId, clientX) => {
    const estadoAtual = cardSwipeStateRef.current?.[blocoId];
    if (!estadoAtual?.dragging) return;

    const deltaXBruto = (Number(clientX) || 0) - (Number(estadoAtual.startX) || 0);
    const deltaXLimitado = Math.max(Math.min(deltaXBruto, 140), -140);

    cardSwipeStateRef.current[blocoId] = {
      ...estadoAtual,
      deltaX: deltaXLimitado,
      dragging: true,
    };

    setCardArrastePorBloco((prev) => ({
      ...prev,
      [blocoId]: {
        deltaX: deltaXLimitado,
        dragging: true,
      },
    }));
  }, []);

  const finalizarArrasteCardDoBloco = useCallback(
    (blocoId, indiceAtual, totalCards) => {
      const estadoAtual = cardSwipeStateRef.current?.[blocoId];
      if (!estadoAtual?.dragging) return;

      const deltaXFinal = Number(estadoAtual.deltaX) || 0;
      const limiarTroca = 60;

      delete cardSwipeStateRef.current[blocoId];
      setCardArrastePorBloco((prev) => ({
        ...prev,
        [blocoId]: {
          deltaX: 0,
          dragging: false,
        },
      }));

      if (!Number.isFinite(totalCards) || totalCards <= 1) return;

      if (deltaXFinal <= -limiarTroca && indiceAtual < totalCards - 1) {
        selecionarCardDoBloco(blocoId, indiceAtual + 1);
        return;
      }

      if (deltaXFinal >= limiarTroca && indiceAtual > 0) {
        selecionarCardDoBloco(blocoId, indiceAtual - 1);
      }
    },
    [selecionarCardDoBloco]
  );

  const reordenarCardsDoBloco = useCallback(
    async (bloco, origemIndex, destinoIndex) => {
      if (!bloco?.id) return false;
      if (!podeGerenciar) return false;

      const cardsAtuais = normalizarCardsDoBloco(bloco?.cards);
      const origemSegura = Number(origemIndex);
      const destinoSeguro = Number(destinoIndex);

      if (
        !Number.isInteger(origemSegura) ||
        !Number.isInteger(destinoSeguro) ||
        origemSegura < 0 ||
        destinoSeguro < 0 ||
        origemSegura >= cardsAtuais.length ||
        destinoSeguro >= cardsAtuais.length ||
        origemSegura === destinoSeguro
      ) {
        return false;
      }

      const cardsReordenados = [...cardsAtuais];
      const [cardMovido] = cardsReordenados.splice(origemSegura, 1);
      cardsReordenados.splice(destinoSeguro, 0, cardMovido);

      setErroAcaoBloco("");
      setBlocoEmAtualizacaoId(bloco.id);

      try {
        await persistirCardsDoBloco(bloco, cardsReordenados);
        setCardAtivoPorBloco((prev) => ({
          ...prev,
          [bloco.id]: destinoSeguro,
        }));
        return true;
      } catch (err) {
        console.error("Erro ao reordenar cards do bloco:", err);
        setErroAcaoBloco(err?.message || "Falha ao reordenar cards do bloco.");
        return false;
      } finally {
        setBlocoEmAtualizacaoId(null);
      }
    },
    [podeGerenciar]
  );

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
    if (!previewImpressaoCard.aberto) return undefined;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        fecharPreviewImpressaoCard();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [fecharPreviewImpressaoCard, previewImpressaoCard.aberto]);

  useEffect(() => {
    if (!editorCardModal.aberto) return undefined;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        fecharEditorCard();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [editorCardModal.aberto, fecharEditorCard]);

  useEffect(() => {
    if (!editorBlocoCardsModal.aberto) return undefined;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        fecharEditorBlocoCards();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [editorBlocoCardsModal.aberto, fecharEditorBlocoCards]);

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
    setLiveViewerTentativas(0);
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
    const ownerUidLiveHost = String(
      liveModal.ownerUserId || ownerUserIdLiveFallback || ownerUidAtual || ""
    ).trim();
    const sessaoRtcRef = getFirstRef(
      getLiveRtcSessionCollectionRefs(db, contactId, conversationId)
    );

    if (typeof RTCPeerConnection !== "function") return undefined;
    if (!sessaoRtcRef || !liveCameraStreamRef.current) return undefined;

    void garantirContatoConversaLive({
      db,
      currentUidAutenticado,
      contactId,
      conversationId,
      tituloLive: String(liveModal?.titulo || "Live").trim() || "Live",
      blocoId: String(liveModal?.blocoId || "").trim(),
      ownerUserId: ownerUidLiveHost,
      espacoId,
    }).catch(() => {});

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
          const offer = normalizarRtcDescricao(dadosSessao?.offer);
          const statusSessao = String(dadosSessao?.status || "").trim().toLowerCase();
          const sessionToken = String(dadosSessao?.sessionToken || "").trim();
          if (statusSessao && statusSessao !== "offer") return;
          if (!offer || typeof offer !== "object") return;
          if (!String(offer?.type || "").trim() || !String(offer?.sdp || "").trim()) {
            const sessionDocRefs = getLiveRtcSessionDocRefs(
              db,
              contactId,
              conversationId,
              viewerUid
            );
            sessionDocRefs.forEach((sessionDocRef) => {
              setDoc(
                sessionDocRef,
                {
                  hostUid: ownerUidAtual,
                  status: "host_invalid_offer",
                  hostErrorAt: serverTimestamp(),
                  hostErrorCode: "invalid-offer",
                },
                { merge: true }
              ).catch(() => {});
            });
            return;
          }
          const offerSerializado = JSON.stringify(offer);

          const peerExistente = liveRtcHostPeersRef.current.get(viewerUid);
          if (peerExistente) {
            const tokenAnterior = String(peerExistente.sessionToken || "").trim();
            if (
              peerExistente.offerSerializado === offerSerializado &&
              tokenAnterior === sessionToken
            ) {
              return;
            }
            encerrarPeerRtcHost(viewerUid);
          }

          const peer = new RTCPeerConnection(LIVE_WEBRTC_CONFIG);
          const viewerCandidateIds = new Set();
          const unsubscribers = [];
          const pendingViewerCandidates = [];
          let hostRemoteDescriptionReady = false;
          let hostTracksAdicionadas = false;

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
              db,
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
              db,
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
            db,
            contactId,
            conversationId,
            viewerUid
          );
          const registrarStatusHostRtc = async (
            status,
            {
              hostStage = "",
              hostErrorCode = "",
              hostErrorMessage = "",
              answer = null,
            } = {}
          ) => {
            const payloadBase = {
              hostUid: ownerUidAtual,
              status,
              sessionToken: sessionToken || null,
            };
            if (hostStage) payloadBase.hostStage = hostStage;
            if (status === "processing") {
              payloadBase.hostProcessingAt = serverTimestamp();
            }
            if (status === "host_error") {
              payloadBase.hostErrorAt = serverTimestamp();
            }
            if (hostErrorCode) payloadBase.hostErrorCode = hostErrorCode;
            if (hostErrorMessage) {
              payloadBase.hostErrorMessage = hostErrorMessage.slice(0, 500);
            }
            if (answer) {
              payloadBase.answer = answer;
              payloadBase.answerAt = serverTimestamp();
            }
            for (const sessionDocRef of sessionDocRefs) {
              await setDoc(
                sessionDocRef,
                payloadBase,
                { merge: true }
              );
            }
          };

          Promise.resolve()
            .then(async () => {
              await registrarStatusHostRtc("processing", {
                hostStage: "set-remote-description",
              });

              try {
                await peer.setRemoteDescription(offer);
              } catch (erroStage) {
                erroStage.__hostRtcCode = "set-remote-description";
                erroStage.__hostRtcStage = "set-remote-description";
                await registrarStatusHostRtc("host_error", {
                  hostStage: "set-remote-description",
                  hostErrorCode: "set-remote-description",
                  hostErrorMessage: String(erroStage?.message || erroStage || ""),
                });
                throw erroStage;
              }
              hostRemoteDescriptionReady = true;

              if (!hostTracksAdicionadas) {
                try {
                  const streamAtualHost = liveCameraStreamRef.current;
                  if (!streamAtualHost) {
                    throw new Error("Stream local indisponivel para responder a live.");
                  }
                  streamAtualHost.getTracks().forEach((track) => {
                    peer.addTrack(track, streamAtualHost);
                  });
                } catch (erroStage) {
                  erroStage.__hostRtcCode = "add-local-tracks";
                  erroStage.__hostRtcStage = "add-local-tracks";
                  await registrarStatusHostRtc("host_error", {
                    hostStage: "add-local-tracks",
                    hostErrorCode: "add-local-tracks",
                    hostErrorMessage: String(erroStage?.message || erroStage || ""),
                  });
                  throw erroStage;
                }
                hostTracksAdicionadas = true;
              }

              while (pendingViewerCandidates.length) {
                const queuedCandidate = pendingViewerCandidates.shift();
                if (!queuedCandidate) continue;
                try {
                  await peer.addIceCandidate(new RTCIceCandidate(queuedCandidate));
                } catch {
                  // ICE ruim nao deve derrubar a sessao inteira.
                }
              }

              await registrarStatusHostRtc("processing", {
                hostStage: "create-answer",
              });

              let answer = null;
              try {
                answer = await peer.createAnswer();
              } catch (erroStage) {
                erroStage.__hostRtcCode = "create-answer";
                erroStage.__hostRtcStage = "create-answer";
                await registrarStatusHostRtc("host_error", {
                  hostStage: "create-answer",
                  hostErrorCode: "create-answer",
                  hostErrorMessage: String(erroStage?.message || erroStage || ""),
                });
                throw erroStage;
              }

              try {
                await peer.setLocalDescription(answer);
              } catch (erroStage) {
                erroStage.__hostRtcCode = "set-local-description";
                erroStage.__hostRtcStage = "set-local-description";
                await registrarStatusHostRtc("host_error", {
                  hostStage: "set-local-description",
                  hostErrorCode: "set-local-description",
                  hostErrorMessage: String(erroStage?.message || erroStage || ""),
                });
                throw erroStage;
              }

              const answerSerializada = serializarRtcDescricao(peer.localDescription || answer);
              if (!answerSerializada?.type || !answerSerializada?.sdp) {
                await registrarStatusHostRtc("host_error", {
                  hostStage: "serialize-answer",
                  hostErrorCode: "serialize-answer",
                  hostErrorMessage: "Resposta WebRTC invalida apos setLocalDescription.",
                });
                const erroStage = new Error("Resposta WebRTC invalida apos setLocalDescription.");
                erroStage.__hostRtcCode = "serialize-answer";
                erroStage.__hostRtcStage = "serialize-answer";
                throw erroStage;
              }

              await registrarStatusHostRtc("answered", {
                hostStage: "answered",
                answer: answerSerializada,
              });
            })
            .catch(async (erroHost) => {
              const erroHostCode =
                String(erroHost?.__hostRtcCode || erroHost?.code || "").trim().toLowerCase() ||
                "host-error";
              const erroHostMessage = String(erroHost?.message || "").trim();
              console.error("Falha host WebRTC:", erroHost);
              await registrarStatusHostRtc("host_error", {
                hostStage:
                  String(erroHost?.__hostRtcStage || "").trim() ||
                  (hostRemoteDescriptionReady ? "create-answer" : "set-remote-description"),
                hostErrorCode: erroHostCode,
                hostErrorMessage: erroHostMessage,
              }).catch(() => {});
              encerrarPeerRtcHost(viewerUid);
            });
        });
      },
      (erroRoom) => {
        const code = String(erroRoom?.code || "").trim().toLowerCase();
        if (code === "permission-denied") {
          setLiveCameraErro("Sem permissao para responder camera ao vivo.");
          return;
        }
        setLiveCameraErro("Falha ao sincronizar solicitacoes de camera ao vivo.");
      }
    );

    liveRtcHostRoomUnsubRef.current = unsubscribeRoom;

    return () => {
      encerrarHostRtcLive();
    };
  }, [
    liveModal.aberto,
    liveModal.contactId,
    liveModal.conversationId,
    liveModal.ownerUserId,
    liveModal.titulo,
    liveModal.blocoId,
    usuarioPodeControlarCameraLive,
    liveCameraAtiva,
    currentUidAutenticado,
    ownerUserIdLiveFallback,
  ]);

  useEffect(() => {
    if (!liveModal.aberto || !liveModal.contactId || !liveModal.conversationId) {
      setLiveCriadorCameraAtiva(false);
      setLiveCameraRemotaRotacaoGraus(0);
      return undefined;
    }

    const contactId = String(liveModal.contactId || "").trim();
    const conversationId = String(liveModal.conversationId || "principal").trim();
    const conversaRef = getFirstRef(getConversaDocRefs(db, contactId, conversationId));
    if (!conversaRef) {
      setLiveCriadorCameraAtiva(false);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      conversaRef,
      (snap) => {
        const data = snap.data() || {};
        setLiveCriadorCameraAtiva(Boolean(data.liveCameraAtiva));
        setLiveCameraRemotaRotacaoGraus(
          normalizarRotacaoCameraLive(data.liveCameraRotationDeg)
        );
      },
      () => {}
    );

    return () => {
      unsubscribe();
    };
  }, [liveModal.aberto, liveModal.contactId, liveModal.conversationId]);

  useEffect(() => {
    const deveConectarViewer =
      liveModal.aberto &&
      !usuarioPodeControlarCameraLive &&
      currentUidAutenticado &&
      liveModal.contactId &&
      liveModal.conversationId;

    if (!deveConectarViewer) {
      encerrarViewerRtcLive(true);
      if (liveModal.aberto && !usuarioPodeControlarCameraLive && currentUidAutenticado) {
        setLiveCameraRemotaStatus(
          liveCriadorCameraAtiva
            ? "Conectando camera do criador..."
            : "Aguardando camera do criador..."
        );
      }
      return undefined;
    }

    const contactId = String(liveModal.contactId || "").trim();
    const conversationId = String(liveModal.conversationId || "principal").trim();
    const viewerUid = String(currentUidAutenticado || "").trim();
    const sessaoRef = getFirstRef(
      getLiveRtcSessionDocRefs(db, contactId, conversationId, viewerUid)
    );
    const hostCandidatesRef = getFirstRef(
      getLiveRtcCandidatesCollectionRefs(
        db,
        contactId,
        conversationId,
        viewerUid,
        "hostCandidates"
      )
    );
    const viewerCandidatesRefs = getLiveRtcCandidatesCollectionRefs(
      db,
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
    setLiveCameraRemotaStatus(
      liveCriadorCameraAtiva
        ? "Conectando camera do criador..."
        : "Aguardando resposta da camera do criador..."
    );

    const peer = new RTCPeerConnection(LIVE_WEBRTC_CONFIG);
    liveRtcViewerPeerRef.current = peer;
    let watchdogId = null;
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
      if (watchdogId) {
        clearTimeout(watchdogId);
        watchdogId = null;
      }
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
      if (estado === "connecting") {
        setLiveCameraRemotaStatus("Conectando camera do criador...");
        return;
      }
      if (estado === "connected") {
        if (watchdogId) {
          clearTimeout(watchdogId);
          watchdogId = null;
        }
        setLiveCameraRemotaStatus("Camera do criador conectada.");
        return;
      }
      if (estado === "failed" || estado === "disconnected") {
        setLiveCameraRemotaStatus("Conexao da camera interrompida.");
      }
    };

    peer.oniceconnectionstatechange = () => {
      const iceEstado = String(peer.iceConnectionState || "").toLowerCase();
      if (iceEstado === "checking") {
        setLiveCameraRemotaStatus("Negociando conexao da camera...");
        return;
      }
      if (iceEstado === "connected" || iceEstado === "completed") {
        if (watchdogId) {
          clearTimeout(watchdogId);
          watchdogId = null;
        }
        setLiveCameraRemotaStatus("Camera do criador conectada.");
        return;
      }
      if (iceEstado === "failed") {
        setLiveCameraRemotaStatus(
          LIVE_EFETIVE_TURN_URLS.length
            ? "Falha na conexao da camera."
            : "Falha na conexao da camera (configure TURN para redes diferentes)."
        );
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
        const answer = normalizarRtcDescricao(dadosSessao?.answer);
        const answerSessionToken = String(dadosSessao?.sessionToken || "").trim();
        if (answerSessionToken && answerSessionToken !== sessionToken) return;
        if (!answer || respostaAplicada) return;

        try {
          await peer.setRemoteDescription(answer);
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

    if (typeof window !== "undefined") {
      watchdogId = window.setTimeout(() => {
        if (liveCameraRemotaStreamRef.current) return;
        if (liveViewerTentativas >= 2) {
          setLiveCameraRemotaStatus("Falha ao conectar camera do criador.");
          setLiveCameraRemotaErro("Nao foi possivel conectar a camera ao vivo.");
          return;
        }
        setLiveCameraRemotaStatus("Tentando reconectar camera do criador...");
        setLiveViewerTentativas((valorAtual) => valorAtual + 1);
      }, 12000);
    }

    Promise.resolve()
      .then(async () => {
        await garantirContatoConversaLive({
          db,
          currentUidAutenticado,
          contactId,
          conversationId,
          tituloLive: String(liveModal?.titulo || "Live").trim() || "Live",
          blocoId: String(liveModal?.blocoId || "").trim(),
          ownerUserId: String(liveModal?.ownerUserId || ownerUserIdLiveFallback || "").trim(),
          espacoId,
        });

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
            offer: serializarRtcDescricao(peer.localDescription || offer),
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
      if (watchdogId) {
        clearTimeout(watchdogId);
      }
      encerrarViewerRtcLive(true);
    };
  }, [
    liveModal.aberto,
    liveModal.contactId,
    liveModal.conversationId,
    usuarioPodeControlarCameraLive,
    currentUidAutenticado,
    liveViewerTentativas,
    ownerUserIdLiveFallback,
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
      getChatCollectionRefs(db, liveModal.contactId, liveModal.conversationId)
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
  const mensagemRestricaoVisivel = acessoEspacoResolvido && !podeVerEspaco;

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    document.body.classList.toggle(
      "cyberpink-restriction-message-visible",
      mensagemRestricaoVisivel
    );

    return () => {
      document.body.classList.remove("cyberpink-restriction-message-visible");
    };
  }, [mensagemRestricaoVisivel]);

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
    if (usandoBucketCompartilhadoCrossProject()) {
      return obterUrlArquivoNoBucketCompartilhado({ user, path });
    }
    return getDownloadURL(ref(storage, path));
  };

  const subirArquivoStorage = async (path, arquivo) => {
    if (usandoBucketCompartilhadoCrossProject()) {
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
    if (usandoBucketCompartilhadoCrossProject()) {
      await excluirArquivoNoBucketCompartilhado({ user, path });
      return;
    }
    await deleteObject(ref(storage, path));
  };

  const selecionarArquivoImagem = () =>
    new Promise((resolve) => {
      if (typeof document === "undefined") {
        resolve(null);
        return;
      }

      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.style.display = "none";

      input.onchange = () => {
        const arquivo = input.files?.[0] || null;
        input.remove();
        resolve(arquivo);
      };

      input.oncancel = () => {
        input.remove();
        resolve(null);
      };

      document.body.appendChild(input);
      input.click();
    });

  useEffect(() => {
    let ativo = true;

    async function carregarConfigSistema() {
      try {
        const config = await obterConfigSistema();
        if (!ativo) return;
        setConfigSistemaAtual(config || DEFAULT_SISTEMA_CONFIG);
        setMercadoPagoSistemaHabilitado(config?.mercadoPagoHabilitado !== false);
        setPixManualSistemaHabilitado(config?.pixManualHabilitado !== false);
        setLivesHabilitadas(config?.livesHabilitadas === true);
        setOneOwnerPublicaAtiva(
          isOneOwnerComEntradaPublica(config)
        );
        setOwnerUidProjeto(String(config?.ownerUid || config?.adminUid || "").trim());
        setOwnerEmailProjeto(
          String(config?.ownerEmail || config?.adminEmail || "")
            .trim()
            .toLowerCase()
        );
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
        setMensagemRestricaoAvatarUrl(
          String(
            config?.mensagemRestricaoAvatarUrl ||
              DEFAULT_SISTEMA_CONFIG.mensagemRestricaoAvatarUrl
          )
        );
      } catch {
        if (!ativo) return;
        const configFallback = obterConfigSistemaCacheLocal() || configSistemaCacheLocal;
        setConfigSistemaAtual(configFallback || DEFAULT_SISTEMA_CONFIG);
        setMercadoPagoSistemaHabilitado(configFallback?.mercadoPagoHabilitado !== false);
        setPixManualSistemaHabilitado(configFallback?.pixManualHabilitado !== false);
        setLivesHabilitadas(configFallback?.livesHabilitadas === true);
        setOneOwnerPublicaAtiva(
          isOneOwnerComEntradaPublica(configFallback)
        );
        setOwnerUidProjeto(
          String(obterOwnerUidConfigurado(configFallback) || "").trim()
        );
        setOwnerEmailProjeto(
          String(obterOwnerEmailConfigurado(configFallback) || "")
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
    let ativo = true;

    async function carregarColecoesIcones() {
      try {
        const colecoes = await listarIconCollectionsNoGerenciador();
        if (!ativo) return;
        setIconCollectionsDisponiveis(Array.isArray(colecoes) ? colecoes : []);
      } catch {
        if (!ativo) return;
        setIconCollectionsDisponiveis([]);
      }
    }

    carregarColecoesIcones();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    let ativo = true;

    async function carregarAddOnsUsuarioProjeto() {
      if (!ownerUserId || configSistemaAtual?.addOnsHabilitados !== true) {
        setAddOnsDisponiveisGerenciador([]);
        setErroAddOnsGerenciador("");
        return;
      }

      try {
        const lista = await listarAddOnsDoUsuarioProjeto({
          ownerUserId,
          onlyActive: true,
        });
        if (!ativo) return;
        setAddOnsDisponiveisGerenciador(Array.isArray(lista) ? lista : []);
        setErroAddOnsGerenciador("");
      } catch (error) {
        if (!ativo) return;
        setAddOnsDisponiveisGerenciador([]);
        setErroAddOnsGerenciador(error?.message || "Falha ao carregar add-ons.");
      }
    }

    void carregarAddOnsUsuarioProjeto();

    return () => {
      ativo = false;
    };
  }, [configSistemaAtual?.addOnsHabilitados, ownerUserId]);

  useEffect(() => {
    carregarGoogleFontsNoDocumento(googleFontsUrlsProjeto);
  }, [googleFontsUrlsProjeto]);

  const blocosVisiveis = useMemo(
    () => blocos.slice(0, visibleBlocosCount),
    [blocos, visibleBlocosCount]
  );

  useEffect(() => {
    setVisibleBlocosCount(BLOCOS_PAGE_SIZE);
  }, [espacoId, ownerUserId, blocos.length]);

  useEffect(() => {
    if (blocos.length <= visibleBlocosCount) return undefined;

    const alvo = blocosInfiniteScrollRef.current;
    if (!alvo || typeof IntersectionObserver === "undefined") return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const primeiraEntrada = entries[0];
        if (!primeiraEntrada?.isIntersecting) return;
        setVisibleBlocosCount((prev) => Math.min(prev + BLOCOS_PAGE_SIZE, blocos.length));
      },
      {
        rootMargin: "220px 0px",
        threshold: 0.1,
      }
    );

    observer.observe(alvo);
    return () => observer.disconnect();
  }, [blocos.length, visibleBlocosCount]);

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

        if (visitanteOneOwnerPublico) {
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
          if (namespaceAtivoProjeto()) {
            const legacyRootRef = getLegacyBlocosCollectionRef(ownerUserId, espacoId);
            const consultasLegadas = visitanteOneOwnerPublico
              ? [
                  query(legacyRootRef, where("visibilidade", "==", "publico")),
                  query(legacyRootRef, where("visibilidade", "==", null)),
                ]
              : [
                  query(legacyRootRef, where("visibilidade", "==", "publico")),
                  query(legacyRootRef, where("visibilidade", "==", "publico_restritivo")),
                  query(legacyRootRef, where("visibilidade", "==", "privado")),
                  query(legacyRootRef, where("visibilidade", "==", "exclusivo_assinante")),
                  query(legacyRootRef, where("visibilidade", "==", "exclusivo_comprador")),
                  query(legacyRootRef, where("visibilidade", "==", "comprado")),
                  query(legacyRootRef, where("visibilidade", "==", null)),
                ];

            for (const consultaLegada of consultasLegadas) {
              try {
                const legacyRootSnap = await getDocs(consultaLegada);
                if (legacyRootSnap.docs.length) {
                  await migrarBlocosLegadosRaizParaNamespace(
                    ownerUserId,
                    espacoId,
                    legacyRootSnap.docs
                  );
                  docs.push(
                    ...legacyRootSnap.docs.map((d) => ({ __legacy: false, docSnap: d }))
                  );
                  break;
                }
              } catch (legacyRootErr) {
                if (
                  legacyRootErr?.code !== "permission-denied" &&
                  legacyRootErr?.code !== "failed-precondition"
                ) {
                  throw legacyRootErr;
                }
              }
            }
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
            subObjetos: normalizarSubObjetosAddOns(
              blocoData?.subObjetos || blocoData?.subobjetos
            ),
          });
        }

        const lista = ordenarBlocosMaisRecentesPrimeiro([...dedupe.values()]);
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
          if (!cardsDocs.length && !bloco?.__legacy && namespaceAtivoProjeto()) {
            const legacyRootCards = await carregarCardsLegadosRaiz(
              ownerUserId,
              espacoId,
              bloco.id
            );
            if (legacyRootCards.length) {
              await migrarBlocosLegadosRaizParaNamespace(ownerUserId, espacoId, [
                {
                  id: bloco.id,
                  data: () => ({
                    ...bloco,
                    id: bloco.id,
                  }),
                },
              ]);
              cardsDocs.push(...legacyRootCards);
            }
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
            const url = await resolverUrlArquivo(path);
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

  if (!Array.isArray(espacos)) {
    return carregamentoAcessoEspacoJSX;
  }

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
  const avatarMensagemRestricao = String(mensagemRestricaoAvatarUrl || "").trim();
  const conteudoEspacoBruto = String(espacoAtualEfetivo?.conteudo || "").trim();
  const conteudoEspaco =
    conteudoEspacoBruto.toLowerCase() === PLACEHOLDER_HOME_CONTENT ? "" : conteudoEspacoBruto;

  const resolverMenuBaseUsuario = () => {
    const skinMenu = String(localStorage.getItem("skinLogadoUser") || "").trim();
    if (oneOwnerPublicaAtivaEfetiva) {
      if (isOwner) return "/menu/owner";
      if (!skinMenu) return "";
      return `/menu/${encodeURIComponent(skinMenu)}`;
    }
    if (!skinMenu) return "";
    return `/menu/${encodeURIComponent(skinMenu)}`;
  };

  const irParaAssinatura = () => {
    void (async () => {
      const geoAtual = await obterGeoAcessoAtual();
      const bloqueio = resolverBloqueioCompraAssinaturaPorLocalizacao(
        configSistemaAtual || configSistemaCacheLocal,
        geoAtual || {}
      );
      if (bloqueio?.bloqueado) {
        alert(
          `Compra/assinatura bloqueada para sua localizacao (${bloqueio.valorAtual || bloqueio.valor}).`
        );
        return;
      }

      const menuBase = resolverMenuBaseUsuario();
      if (!menuBase) {
        alert(`Selecione uma ${nomeSkinSingular} para assinar ${nomeEspacoPlural}.`);
        return;
      }
      navigate(`${menuBase}/espacos`);
    })();
  };

  const irParaCompra = async (bloco = null) => {
    if (!mercadoPagoSistemaHabilitado && !pixManualSistemaHabilitado) {
      alert("Pagamentos desativados neste projeto.");
      return;
    }

    const geoAtual = await obterGeoAcessoAtual();
    const bloqueio = resolverBloqueioCompraAssinaturaPorLocalizacao(
      configSistemaAtual || configSistemaCacheLocal,
      geoAtual || {}
    );
    if (bloqueio?.bloqueado) {
      alert(
        `Compra/assinatura bloqueada para sua localizacao (${bloqueio.valorAtual || bloqueio.valor}).`
      );
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

    const ownerUidLive = String(
      bloco?.ownerUserId ||
        bloco?.criadoPor ||
        ownerUserIdLiveFallback ||
        (usuarioEhOwnerProjeto ? currentUidAutenticado : "") ||
        ""
    ).trim();
    const contactId = montarLiveContactId({
      ownerUserId: ownerUidLive,
      espacoId,
      blocoId: bloco?.id || "",
    });
    const conversationId = "principal";
    const tituloLive = String(bloco?.titulo || bloco?.nome || bloco?.id || "Live").trim();
    const proximoLiveModal = {
      aberto: true,
      blocoId: String(bloco?.id || "").trim(),
      titulo: tituloLive || "Live",
      liveUrl,
      embedUrl: normalizarEmbedLiveUrl(liveUrl),
      contactId,
      conversationId,
      ownerUserId: ownerUidLive,
    };

    setLiveModal(proximoLiveModal);
    setLiveChatMensagem("");
    setLiveChatErro(currentUidAutenticado ? "" : "Faca login para participar do chat da live.");

    if (currentUidAutenticado) {
      try {
        await garantirContatoConversaLive({
          db,
          currentUidAutenticado,
          contactId,
          conversationId,
          tituloLive,
          blocoId: String(bloco?.id || "").trim(),
          ownerUserId: ownerUidLive,
          espacoId,
        });
        setLiveChatErro("");
      } catch (err) {
        if (err?.code === "permission-denied") {
          setLiveChatErro("Sem permissao para abrir o chat da live.");
          return;
        }
        setLiveChatErro("Falha ao preparar o chat da live.");
        return;
      }
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
      await enviarMensagemContatoLive({
        db,
        contactId,
        conversationId,
        mensagem: texto,
        tituloLive: String(liveModal?.titulo || "Live").trim() || "Live",
        userUid: currentUidAutenticado,
        userRemetente: nomeRemetenteLive || currentUid,
        ownerUserId: String(liveModal?.ownerUserId || ownerUserIdLiveFallback || "").trim(),
      });

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
      return ordenarBlocosMaisRecentesPrimeiro([...dedupe.values()]);
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

  const getBlocoCardDocRef = (bloco, cardId) =>
    bloco.__legacy
      ? doc(db, "blocos", bloco.id, "cards", cardId)
      : getFirstRef(getBlocoCardDocRefs(ownerUserId, espacoId, bloco.id, cardId));

  const persistirCardsDoBloco = useCallback(
    async (bloco, cardsOrigem = []) => {
      if (!bloco?.id) {
        throw new Error("Bloco invalido para persistir cards.");
      }

      const blocoRef = getBlocoDocRef(bloco);
      if (!blocoRef) {
        throw new Error("Nao foi possivel localizar o bloco para persistir cards.");
      }

      const cardsAtualizados = normalizarCardsDoBloco(cardsOrigem).map((card, index) => ({
        ...card,
        ordem: index,
      }));

      await updateDoc(blocoRef, {
        cards: cardsAtualizados,
        updatedAt: serverTimestamp(),
      });

      await Promise.all(
        cardsAtualizados.map((card) => {
          const cardRef = getBlocoCardDocRef(bloco, card.id);
          if (!cardRef) return Promise.resolve();
          return setDoc(
            cardRef,
            {
              id: card.id,
              ordem: card.ordem,
              nome: card.nome || "",
              descricaoExtra: card.descricaoExtra || "",
              descricao: card.descricao || "",
              imagem: card.imagem || "",
              imagemPath: card.imagemPath || "",
              linkExterno: card.linkExterno || "",
              addOnIds: normalizarAddOnIds(card.addOnIds),
              addOnSubthemes: normalizarAddOnSubthemes(card.addOnSubthemes, card.addOnIds),
              blocoId: bloco.id,
              espacoId,
              ownerUserId,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        })
      );

      setBlocos((prev) =>
        ordenarBlocosMaisRecentesPrimeiro(
          prev.map((item) => (item.id === bloco.id ? { ...item, cards: cardsAtualizados } : item))
        )
      );

      setImagensCardsPorBloco((prev) => {
        const blocoAtual = {};
        cardsAtualizados.forEach((card) => {
          if (isRenderableUrl(card?.imagem)) {
            blocoAtual[card.id] = card.imagem;
          }
        });
        return {
          ...prev,
          [bloco.id]: blocoAtual,
        };
      });

      return cardsAtualizados;
    },
    [espacoId, ownerUserId]
  );

  const persistirSubBlocosAddOnsDoBloco = useCallback(
    async (bloco, subBlocosOrigem = []) => {
      if (!bloco?.id) {
        throw new Error("Bloco invalido para persistir add-ons.");
      }

      const blocoRef = getBlocoDocRef(bloco);
      if (!blocoRef) {
        throw new Error("Nao foi possivel localizar o bloco para persistir add-ons.");
      }

      const subBlocosAtualizados = normalizarSubBlocosAddOns(
        subBlocosOrigem,
        [],
        { manterVazios: true }
      ).map((subBloco, subBlocoIndex) => ({
          ...subBloco,
          ordem: subBlocoIndex,
          subObjetos: normalizarSubObjetosAddOns(subBloco.subObjetos).map(
            (subObjeto, subObjetoIndex) => ({
              ...subObjeto,
              ordem: subObjetoIndex,
              subBlocoId: subBloco.id,
              subBlocoTitulo: subBloco.titulo,
            })
          ),
        }));
      const subObjetosAtualizados = achatarSubBlocosAddOns(subBlocosAtualizados);

      setErroAcaoBloco("");
      setBlocoEmAtualizacaoId(bloco.id);

      try {
        await updateDoc(blocoRef, {
          estruturaAddOns: "subblocos_v1",
          subBlocos: subBlocosAtualizados,
          subObjetos: subObjetosAtualizados,
          configAddOns: {
            ...(bloco?.configAddOns || {}),
            layout: "subblocos",
            itemLayout: "grid",
          },
          updatedAt: serverTimestamp(),
        });

        setBlocos((prev) =>
          ordenarBlocosMaisRecentesPrimeiro(
            prev.map((item) =>
              item.id === bloco.id
                ? {
                    ...item,
                    estruturaAddOns: "subblocos_v1",
                    subBlocos: subBlocosAtualizados,
                    subObjetos: subObjetosAtualizados,
                    configAddOns: {
                      ...(item?.configAddOns || {}),
                      layout: "subblocos",
                      itemLayout: "grid",
                    },
                  }
                : item
            )
          )
        );

        return subBlocosAtualizados;
      } catch (err) {
        console.error("Erro ao persistir subblocos de add-ons:", err);
        setErroAcaoBloco(err?.message || "Falha ao salvar subblocos de add-ons.");
        throw err;
      } finally {
        setBlocoEmAtualizacaoId(null);
      }
    },
    [espacoId, ownerUserId]
  );

  useEffect(() => {
    if (
      !podeGerenciar ||
      !editorBlocoCardsModal.aberto ||
      blocoEditorCardsAtual?.tipo !== "addons"
    ) {
      return;
    }

    const blocoId = String(blocoEditorCardsAtual?.id || "").trim();
    if (!blocoId || migratedAddOnBlocksRef.current.has(blocoId)) return;

    const possuiSubBlocos =
      Array.isArray(blocoEditorCardsAtual?.subBlocos) ||
      Array.isArray(blocoEditorCardsAtual?.subblocos);
    if (possuiSubBlocos) return;

    const subObjetosLegados = normalizarSubObjetosAddOns(
      blocoEditorCardsAtual?.subObjetos || blocoEditorCardsAtual?.subobjetos
    );
    if (!subObjetosLegados.length) return;

    migratedAddOnBlocksRef.current.add(blocoId);
    void persistirSubBlocosAddOnsDoBloco(blocoEditorCardsAtual, [
      {
        ...criarSubBlocoAddOns(0),
        id: "subbloco_legacy",
        titulo: "Add-ons",
        subObjetos: subObjetosLegados,
      },
    ]);
  }, [
    blocoEditorCardsAtual,
    editorBlocoCardsModal.aberto,
    persistirSubBlocosAddOnsDoBloco,
    podeGerenciar,
  ]);

  const atualizarMetadadosBloco = useCallback(
    async (blocoId, updates = {}) => {
      if (!podeGerenciar) {
        setErroAcaoBloco(`Apenas o owner pode editar ${nomeBlocoPlural}.`);
        return false;
      }

      const bloco = blocos.find((item) => item.id === blocoId);
      if (!bloco?.id) return false;

      const blocoRef = getBlocoDocRef(bloco);
      if (!blocoRef) {
        setErroAcaoBloco("Nao foi possivel localizar o bloco para edicao.");
        return false;
      }

      const titulo = String(updates?.titulo || "").trim();
      const icone = String(updates?.icone || updates?.iconUrl || "").trim();
      const iconCollectionId = String(updates?.iconCollectionId || "").trim();
      const iconId = String(updates?.iconId || "").trim();
      const iconLabel = String(updates?.iconLabel || "").trim();
      const payload = {
        titulo,
        icone,
        iconUrl: icone,
        iconCollectionId,
        iconId,
        iconLabel,
        updatedAt: serverTimestamp(),
      };

      setErroAcaoBloco("");
      setBlocoEmAtualizacaoId(blocoId);

      try {
        await updateDoc(blocoRef, payload);
        setBlocos((prev) =>
          ordenarBlocosMaisRecentesPrimeiro(
            prev.map((item) => (item.id === blocoId ? { ...item, ...payload } : item))
          )
        );
        return true;
      } catch (err) {
        console.error("Erro ao atualizar metadados do bloco:", err);
        setErroAcaoBloco(err?.message || `Falha ao atualizar ${nomeBlocoSingular}.`);
        return false;
      } finally {
        setBlocoEmAtualizacaoId(null);
      }
    },
    [blocos, nomeBlocoPlural, nomeBlocoSingular, podeGerenciar]
  );

  const atualizarBloco = async (blocoId, updates = {}) => {
    if (!podeGerenciar) {
      setErroAcaoBloco(`Apenas o owner pode editar ${nomeBlocoPlural}.`);
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
      const tituloFinal = Object.prototype.hasOwnProperty.call(updates, "titulo")
        ? String(updates?.titulo || "").trim()
        : String(bloco?.titulo || bloco?.nome || "").trim();
      const iconeFinal =
        Object.prototype.hasOwnProperty.call(updates, "icone") ||
        Object.prototype.hasOwnProperty.call(updates, "iconUrl")
          ? String(updates?.icone || updates?.iconUrl || "").trim()
          : String(bloco?.icone || bloco?.iconUrl || "").trim();
      const iconCollectionIdFinal = Object.prototype.hasOwnProperty.call(updates, "iconCollectionId")
        ? String(updates?.iconCollectionId || "").trim()
        : String(bloco?.iconCollectionId || "").trim();
      const iconIdFinal = Object.prototype.hasOwnProperty.call(updates, "iconId")
        ? String(updates?.iconId || "").trim()
        : String(bloco?.iconId || "").trim();
      const iconLabelFinal = Object.prototype.hasOwnProperty.call(updates, "iconLabel")
        ? String(updates?.iconLabel || "").trim()
        : String(bloco?.iconLabel || "").trim();

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
        titulo: tituloFinal,
        icone: iconeFinal,
        iconUrl: iconeFinal,
        iconCollectionId: iconCollectionIdFinal,
        iconId: iconIdFinal,
        iconLabel: iconLabelFinal,
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
        ordenarBlocosMaisRecentesPrimeiro(
          prev.map((item) => (item.id === blocoId ? { ...item, ...payload } : item))
        )
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

  const salvarEdicaoCardDoBloco = async () => {
    const bloco = editorCardModal?.bloco;
    const card = editorCardModal?.card || {};
    if (!podeGerenciar) {
      setErroAcaoBloco(`Apenas o owner pode editar ${nomeBlocoSingular}.`);
      return false;
    }

    if (!bloco?.id || !card?.id) return false;

    const cardKey = `${bloco.id}:${card.id}`;
    const nomeNovo = String(editorCardModal?.nome || "").trim();
    const descricaoExtraNova = String(editorCardModal?.descricaoExtra || "").trim();
    const descricaoNova = String(editorCardModal?.descricao || "").trim();
    const ordemNova = Number.isFinite(editorCardModal?.ordem)
      ? Number(editorCardModal.ordem)
      : normalizarCardsDoBloco(bloco?.cards).length;
    const imagemAtual = String(editorCardModal?.imagemOriginal || "").trim();
    const imagemPathAtual = String(editorCardModal?.imagemPathOriginal || "").trim();
    const linkNovo = String(editorCardModal?.linkExterno || "").trim();
    const addOnIdsNovos = normalizarAddOnIds(editorCardModal?.addOnIds);
    const addOnSubthemesNovos = normalizarAddOnSubthemes(
      editorCardModal?.addOnSubthemes,
      addOnIdsNovos
    );
    const ehNovoCard = Boolean(editorCardModal?.ehNovo);

    const cardRef = getBlocoCardDocRef(bloco, card.id);
    if (!cardRef) {
      setErroAcaoBloco("Nao foi possivel localizar o card para edicao.");
      return false;
    }

    setErroAcaoBloco("");
    setCardEmAtualizacaoId(cardKey);

    try {
      let imagemFinal = imagemAtual;
      let imagemPathFinal = imagemPathAtual;
      const pathsParaExcluir = [];

      if (editorCardModal?.imagemArquivo instanceof File) {
        const arquivo = editorCardModal.imagemArquivo;
        const nomeArquivo = gerarNomeArquivoSeguro(arquivo?.name || `${card.id}.jpg`);
        const novoPath = `users/${ownerUserId}/espacos/${espacoId}/blocos/${bloco.id}/cards/${card.id}/${nomeArquivo}`;
        const upload = await subirArquivoStorage(novoPath, arquivo);
        imagemFinal = String(upload?.url || "").trim();

        if (!imagemFinal) {
          try {
            imagemFinal = await resolverUrlArquivo(novoPath);
          } catch (err) {
            console.warn("Falha ao resolver URL da nova imagem do card:", err?.code, err?.message);
          }
        }

        if (!imagemFinal) {
          throw new Error("Falha ao carregar a nova imagem do card.");
        }

        imagemPathFinal = novoPath;
        if (imagemPathAtual && imagemPathAtual !== novoPath) {
          pathsParaExcluir.push(imagemPathAtual);
        }
      } else if (!String(editorCardModal?.imagem || "").trim()) {
        imagemFinal = "";
        imagemPathFinal = "";
        if (imagemPathAtual) {
          pathsParaExcluir.push(imagemPathAtual);
        }
      } else {
        imagemFinal = String(editorCardModal?.imagem || "").trim();
        if (imagemFinal !== imagemAtual && imagemPathAtual) {
          pathsParaExcluir.push(imagemPathAtual);
          imagemPathFinal = "";
        }
      }

      const payload = {
        id: String(card?.id || "").trim(),
        ordem: ordemNova,
        nome: String(nomeNovo || "").trim(),
        descricaoExtra: String(descricaoExtraNova || "").trim(),
        descricao: String(descricaoNova || "").trim(),
        imagem: imagemFinal,
        imagemPath: imagemPathFinal,
        linkExterno: String(linkNovo || "").trim(),
        addOnIds: addOnIdsNovos,
        addOnSubthemes: addOnSubthemesNovos,
        usaAddOnsGerenciador: true,
      };

      const cardsAtualizadosOrigem = normalizarCardsDoBloco(
        ehNovoCard
          ? [...(Array.isArray(bloco?.cards) ? bloco.cards : []), payload]
          : (Array.isArray(bloco?.cards) ? bloco.cards : []).map((cardItem) =>
              String(cardItem?.id || "") === String(card.id) ? { ...cardItem, ...payload } : cardItem
            )
      );

      if (ehNovoCard) {
        await setDoc(cardRef, {
          ...payload,
          blocoId: bloco.id,
          espacoId,
          ownerUserId,
          criadoEm: serverTimestamp(),
        });
      } else {
        await updateDoc(cardRef, {
          ...payload,
          updatedAt: serverTimestamp(),
        });
      }

      const cardsPersistidos = await persistirCardsDoBloco(bloco, cardsAtualizadosOrigem);
      if (Array.isArray(cardsPersistidos) && cardsPersistidos.length) {
        const indiceSelecionado = cardsPersistidos.findIndex(
          (item) => String(item?.id || "") === String(payload.id || "")
        );
        if (indiceSelecionado >= 0) {
          setCardAtivoPorBloco((prev) => ({
            ...prev,
            [bloco.id]: indiceSelecionado,
          }));
        }
      }

      const pathsExclusaoUnicos = [...new Set(pathsParaExcluir)].filter(
        (path) => typeof path === "string" && path.includes("/")
      );
      for (const path of pathsExclusaoUnicos) {
        try {
          await excluirArquivoStorage(path);
        } catch (err) {
          if (err?.code !== "storage/object-not-found") {
            console.warn("Falha ao excluir imagem antiga do card:", path, err?.message);
          }
        }
      }

      fecharEditorCard();

      return true;
    } catch (err) {
      console.error("Erro ao editar card:", err);
      setErroAcaoBloco(err?.message || "Falha ao editar card.");
      return false;
    } finally {
      setCardEmAtualizacaoId(null);
    }
  };

  const excluirCardDoBloco = async () => {
    const bloco = editorCardModal?.bloco;
    const card = editorCardModal?.card || {};
    const ehNovoCard = Boolean(editorCardModal?.ehNovo);

    if (!podeGerenciar) {
      setErroAcaoBloco(`Apenas o owner pode editar ${nomeBlocoSingular}.`);
      return false;
    }

    if (!bloco?.id || !card?.id) return false;

    const confirmou =
      typeof window === "undefined"
        ? true
        : window.confirm(
            ehNovoCard
              ? "Descartar este card novo?"
              : "Excluir este card? Essa acao nao pode ser desfeita."
          );
    if (!confirmou) return false;

    const cardKey = `${bloco.id}:${card.id}`;
    const imagemPathAtual = String(editorCardModal?.imagemPathOriginal || "").trim();
    const cardsRestantes = normalizarCardsDoBloco(
      (Array.isArray(bloco?.cards) ? bloco.cards : []).filter(
        (cardItem) => String(cardItem?.id || "") !== String(card.id)
      )
    );

    setErroAcaoBloco("");
    setCardEmAtualizacaoId(cardKey);

    try {
      if (!ehNovoCard) {
        const cardRef = getBlocoCardDocRef(bloco, card.id);
        if (cardRef) {
          await deleteDoc(cardRef);
        }
      }

      await persistirCardsDoBloco(bloco, cardsRestantes);

      setCardAtivoPorBloco((prev) => {
        const next = { ...prev };
        if (!cardsRestantes.length) {
          delete next[bloco.id];
          return next;
        }

        const indiceAtual = Number.isFinite(prev?.[bloco.id]) ? Number(prev[bloco.id]) : 0;
        next[bloco.id] = Math.min(indiceAtual, cardsRestantes.length - 1);
        return next;
      });

      if (imagemPathAtual) {
        try {
          await excluirArquivoStorage(imagemPathAtual);
        } catch (err) {
          if (err?.code !== "storage/object-not-found") {
            console.warn("Falha ao excluir imagem do card removido:", imagemPathAtual, err?.message);
          }
        }
      }

      fecharEditorCard();
      return true;
    } catch (err) {
      console.error("Erro ao excluir card do bloco:", err);
      setErroAcaoBloco(err?.message || "Falha ao excluir card.");
      return false;
    } finally {
      setCardEmAtualizacaoId(null);
    }
  };

  const excluirBloco = async (blocoId) => {
    if (!podeGerenciar) {
      setErroAcaoBloco(`Apenas o owner pode excluir ${nomeBlocoPlural}.`);
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

            <div className="espaco-restricao-conteudo">
              <span aria-hidden="true" className="espaco-restricao-aviso-icon" />
              <p className="espaco-restricao-texto" style={estiloMensagemRestricaoEspaco}>
                {mensagemRestricaoEspaco}
              </p>
            </div>
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
        blocosVisiveis.map((bloco, blocoIndex) => {
          const blocoEhCards = bloco?.tipo === "cards";
          const blocoEhLive = bloco?.tipo === "live";
          const blocoEhAddOns = bloco?.tipo === "addons";
          const cardsDoBloco = normalizarCardsDoBloco(bloco?.cards);
          const subBlocosAddOnsDoBloco = normalizarSubBlocosAddOns(
            bloco?.subBlocos || bloco?.subblocos,
            bloco?.subObjetos || bloco?.subobjetos
          );
          const addOnsPorSubBloco = subBlocosAddOnsDoBloco
            .map((subBloco) => ({
              ...subBloco,
              addOns: subBloco.subObjetos
                .map((subObjeto) => {
                  const addOnAtual = addOnsDisponiveisProjetoPorId[subObjeto.addonId] || {};
                  return {
                    ...subObjeto,
                    nome:
                      String(addOnAtual?.nome || "").trim() ||
                      subObjeto.nomeSnapshot ||
                      "Add-on",
                    descricao:
                      String(addOnAtual?.descricao || "").trim() ||
                      subObjeto.descricaoSnapshot ||
                      "",
                    url_img:
                      String(addOnAtual?.url_img || "").trim() ||
                      subObjeto.imagemSnapshot ||
                      "",
                  };
                })
                .filter((item) => item.nome || item.url_img),
            }))
            .filter((subBloco) => subBloco.addOns.length);
          const indiceCardAtivoBruto = Number(cardAtivoPorBloco?.[bloco.id] || 0);
          const indiceCardAtivo = cardsDoBloco.length
            ? Math.min(Math.max(indiceCardAtivoBruto, 0), cardsDoBloco.length - 1)
            : 0;
          const cardAtivo = cardsDoBloco[indiceCardAtivo] || null;
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

          const imagensParaExibir = blocoEhCards || blocoEhLive || blocoEhAddOns
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
              style={
                !podeGerenciar && blocoIndex === 0
                  ? { marginTop: tituloBloco || iconeBloco ? 96 : 64 }
                  : undefined
              }
              className={`bloco-imagem${
                !podeGerenciar && blocoIndex === 0
                  ? " bloco-imagem--first-without-creator"
                  : ""
              }`}
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
                        className="image-zoom-trigger"
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
                        className="image-zoom-trigger"
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
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void abrirLiveBloco(bloco);
                          }}
                        >
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
                <div style={{ display: "grid", gap: 12, justifyItems: "center" }}>
                  {cardAtivo ? (
                    <div style={{ display: "grid", gap: 8, justifyItems: "center", width: "100%" }}>
                      {(() => {
                        const cardKey = `${bloco.id}:${cardAtivo.id || indiceCardAtivo}`;
                        const imagemCardResolvida =
                          imagensCardsPorBloco?.[bloco.id]?.[cardAtivo.id] || "";
                        const imagemCardFinal = isRenderableUrl(cardAtivo.imagem)
                          ? cardAtivo.imagem
                          : imagemCardResolvida || "/logoNeon.png";
                        const addOnsCardAtivo = normalizarAddOnIds(cardAtivo.addOnIds)
                          .map((addOnId) => addOnsDisponiveisProjetoPorId[addOnId])
                          .filter(Boolean);
                        const rotaCardAtivo = montarRotaCardDoBloco(bloco, cardAtivo);
                        const estadoArrasteAtual = cardArrastePorBloco?.[bloco.id] || {};
                        const deslocamentoArraste = Number(estadoArrasteAtual.deltaX) || 0;
                        const arrasteAtivo = Boolean(estadoArrasteAtual.dragging);
                        return (
                          <>
                            <div
                              className="cards-bloco-viewer"
                              style={{
                                position: "relative",
                                width: "100%",
                                maxWidth: 367,
                                minHeight: 445,
                                margin: "0 auto 18px",
                                padding: "0 46px",
                                boxSizing: "border-box",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "flex-start",
                              }}
                            >
                              {cardsDoBloco.length > 1 ? (
                                <button
                                  type="button"
                                  className="cards-bloco-nav cards-bloco-nav--prev"
                                  onClick={() =>
                                    selecionarCardDoBloco(bloco.id, indiceCardAtivo - 1)
                                  }
                                  disabled={indiceCardAtivo <= 0}
                                  aria-label="Mostrar card anterior"
                                >
                                  {"<<"}
                                </button>
                              ) : null}

                              <div
                                className="cards-bloco-stage"
                                style={{
                                  width: "100%",
                                  display: "flex",
                                  justifyContent: "center",
                                  touchAction: "pan-y",
                                  userSelect: "none",
                                  cursor: cardsDoBloco.length > 1
                                    ? arrasteAtivo
                                      ? "grabbing"
                                      : "grab"
                                    : "default",
                                }}
                                onPointerDown={(event) => {
                                  if (cardsDoBloco.length <= 1) return;
                                  if (event.pointerType === "mouse" && event.button !== 0) return;
                                  event.currentTarget.setPointerCapture?.(event.pointerId);
                                  iniciarArrasteCardDoBloco(bloco.id, event.clientX);
                                }}
                                onPointerMove={(event) => {
                                  if (cardsDoBloco.length <= 1) return;
                                  atualizarArrasteCardDoBloco(bloco.id, event.clientX);
                                }}
                                onPointerUp={(event) => {
                                  if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
                                    event.currentTarget.releasePointerCapture(event.pointerId);
                                  }
                                  finalizarArrasteCardDoBloco(
                                    bloco.id,
                                    indiceCardAtivo,
                                    cardsDoBloco.length
                                  );
                                }}
                                onPointerCancel={(event) => {
                                  if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
                                    event.currentTarget.releasePointerCapture(event.pointerId);
                                  }
                                  finalizarArrasteCardDoBloco(
                                    bloco.id,
                                    indiceCardAtivo,
                                    cardsDoBloco.length
                                  );
                                }}
                              >
                                <div
                                  key={cardKey}
                                  className="cards-bloco-card-shell"
                                  style={{
                                    transform: `translateX(${deslocamentoArraste}px)`,
                                    transition: arrasteAtivo ? "none" : "transform 220ms ease",
                                    willChange: "transform",
                                  }}
                                >
                                  <Card
                                    id={cardAtivo.id || `${bloco.id}-card-${indiceCardAtivo}`}
                                    ownerUserId={ownerUserId}
                                    espacoId={espacoId}
                                    blocoId={bloco.id}
                                    addOnIds={normalizarAddOnIds(cardAtivo.addOnIds)}
                                    addOnSubthemes={normalizarAddOnSubthemes(
                                      cardAtivo.addOnSubthemes,
                                      cardAtivo.addOnIds
                                    )}
                                    usaAddOnsGerenciador={cardAtivo?.usaAddOnsGerenciador === true}
                                    addOns={addOnsCardAtivo}
                                    nome={cardAtivo.nome || `Card ${indiceCardAtivo + 1}`}
                                    descricaoExtra={cardAtivo.descricaoExtra || ""}
                                    nomeDescricao={cardAtivo.nome || ""}
                                    descricao={cardAtivo.descricao || ""}
                                    linkExterno={cardAtivo.linkExterno || ""}
                                    imagem={imagemCardFinal}
                                    idNome={`${bloco.id}-card-${indiceCardAtivo}`}
                                    cardDescricaoDiv="cardDescricaoDiv"
                                    cardNome="cardNome"
                                    cardContainerDesktop="cardContainerDesktop"
                                    cardCabecalho="cardCabecalho"
                                    cardImagem="cardImagem"
                                    cardDescricao="cardDescricao"
                                    imgCard="imgCard"
                                    onImagemClick={(imagemUrl) =>
                                      abrirModalImagem({
                                        url: imagemUrl,
                                        titulo:
                                          cardAtivo.nome || tituloBloco || nomeBlocoSingularCapitalizado,
                                        alt: "Imagem ampliada do card",
                                      })
                                    }
                                  />
                                </div>
                              </div>

                              <div className="cards-bloco-actions" aria-label="Acoes do card">
                                <button
                                  type="button"
                                  className="cards-bloco-action-button"
                                  onClick={() => {
                                    if (rotaCardAtivo) navigate(rotaCardAtivo);
                                  }}
                                  disabled={!rotaCardAtivo}
                                  title="Ver card ampliado"
                                  aria-label="Ver card ampliado"
                                >
                                  <CardActionIcon type="eye" />
                                </button>

                                {podeGerenciar ? (
                                  <button
                                    type="button"
                                    className="cards-bloco-action-button"
                                    onClick={() => {
                                      abrirEditorCardDoBloco(bloco, cardAtivo);
                                    }}
                                    disabled={
                                      cardEmAtualizacaoId ===
                                      `${bloco.id}:${cardAtivo.id || indiceCardAtivo}`
                                    }
                                    title="Editar card"
                                    aria-label="Editar card"
                                  >
                                    <CardActionIcon type="gear" />
                                  </button>
                                ) : null}

                                <button
                                  type="button"
                                  className="cards-bloco-action-button"
                                  onClick={() =>
                                    abrirPreviewImpressaoCard({
                                      bloco,
                                      card: cardAtivo,
                                      imagem: imagemCardFinal,
                                      addOns: addOnsCardAtivo,
                                      rota: rotaCardAtivo,
                                    })
                                  }
                                  title="Gerar visualizacao de impressao"
                                  aria-label="Gerar visualizacao de impressao"
                                >
                                  <CardActionIcon type="print" />
                                </button>
                              </div>

                              {cardsDoBloco.length > 1 ? (
                                <button
                                  type="button"
                                  className="cards-bloco-nav cards-bloco-nav--next"
                                  onClick={() =>
                                    selecionarCardDoBloco(bloco.id, indiceCardAtivo + 1)
                                  }
                                  disabled={indiceCardAtivo >= cardsDoBloco.length - 1}
                                  aria-label="Mostrar proximo card"
                                >
                                  {">>"}
                                </button>
                              ) : null}
                            </div>
                          </>
                        );
                      })()}

                      {cardsDoBloco.length > 1 ? (
                        <div className="cards-bloco-count">
                          <span className="cards-bloco-count-text">
                            {`Card ${indiceCardAtivo + 1} de ${cardsDoBloco.length}`}
                          </span>
                        </div>
                      ) : null}

                      {cardsDoBloco.length > 1 ? (
                        <div className="cards-bloco-thumbs">
                          {cardsDoBloco.map((card, cardIndex) => {
                            const imagemCardResolvida =
                              imagensCardsPorBloco?.[bloco.id]?.[card.id] || "";
                            const imagemCardFinal = isRenderableUrl(card.imagem)
                              ? card.imagem
                              : imagemCardResolvida || "/logoNeon.png";
                            const ativo = cardIndex === indiceCardAtivo;
                            return (
                              <div
                                key={`${bloco.id}-thumb-${card.id || cardIndex}`}
                                className={`cards-bloco-thumb-slot${ativo ? " is-active" : ""}`}
                              >
                                <button
                                  type="button"
                                  className={`cards-bloco-thumb${ativo ? " is-active" : ""}`}
                                  onClick={() => selecionarCardDoBloco(bloco.id, cardIndex)}
                                  title={card.nome || `Card ${cardIndex + 1}`}
                                >
                                  <span className="cards-bloco-thumb-inner">
                                    <span className="cards-bloco-thumb-header">
                                      <span className="cards-bloco-thumb-title">
                                        {card.nome || `Card ${cardIndex + 1}`}
                                      </span>
                                    </span>
                                    <span className="cards-bloco-thumb-media">
                                      <img
                                        src={imagemCardFinal}
                                        alt=""
                                        className="cards-bloco-thumb-image"
                                      />
                                    </span>
                                  </span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}

              {blocoEhAddOns && !bloqueado && (
                <div className="addons-bloco-subblocos" aria-label="Add-ons do bloco">
                  {addOnsPorSubBloco.length ? (
                    addOnsPorSubBloco.map((subBloco) => (
                      <section key={`${bloco.id}-${subBloco.id}`} className="addons-bloco-subbloco">
                        {subBloco.titulo ? (
                          <h4 className="addons-bloco-subbloco-title">{subBloco.titulo}</h4>
                        ) : null}
                        <div
                          className="addons-bloco-carousel"
                          role="region"
                          aria-label={`Carrossel de add-ons: ${subBloco.titulo || "Subbloco"}`}
                        >
                          <div className="addons-bloco-track">
                            {subBloco.addOns.map((addOn) => {
                              const addOnId = String(addOn?.addonId || addOn?.id || "").trim();
                              const addOnUrl = String(addOn?.url_img || "").trim();
                              const subthemeKey = normalizarSubtemaAddOnOpcional(addOn?.subtema);
                              const podeColorir = Boolean(subthemeKey) && isSvgAssetUrl(addOnUrl);
                              const iconColor = getCyberpinkSubthemeIconColor(subthemeKey);
                              const label = String(addOn?.nome || "Add-on").trim() || "Add-on";

                              return (
                                <div
                                  key={`${bloco.id}-${subBloco.id}-addon-${addOnId}`}
                                  className={`addons-bloco-item${
                                    addOn?.destaque ? " addons-bloco-item--destaque" : ""
                                  }`}
                                  title={addOn?.descricao || label}
                                >
                                  <svg
                                    className="addons-bloco-chip-corner addons-bloco-chip-corner--tl"
                                    viewBox="0 0 10 10"
                                    aria-hidden="true"
                                    focusable="false"
                                  >
                                    <path d="M10 0 L0 10" />
                                  </svg>
                                  <svg
                                    className="addons-bloco-chip-corner addons-bloco-chip-corner--tr"
                                    viewBox="0 0 10 10"
                                    aria-hidden="true"
                                    focusable="false"
                                  >
                                    <path d="M0 0 L10 10" />
                                  </svg>
                                  <svg
                                    className="addons-bloco-chip-corner addons-bloco-chip-corner--bl"
                                    viewBox="0 0 10 10"
                                    aria-hidden="true"
                                    focusable="false"
                                  >
                                    <path d="M0 0 L10 10" />
                                  </svg>
                                  <svg
                                    className="addons-bloco-chip-corner addons-bloco-chip-corner--br"
                                    viewBox="0 0 10 10"
                                    aria-hidden="true"
                                    focusable="false"
                                  >
                                    <path d="M10 0 L0 10" />
                                  </svg>
                                  <span className="addons-bloco-chip-pins addons-bloco-chip-pins--top" aria-hidden="true" />
                                  <span className="addons-bloco-chip-pins addons-bloco-chip-pins--bottom" aria-hidden="true" />
                                  <span className="addons-bloco-icon">
                                    {addOnUrl ? (
                                      <img
                                        src={addOnUrl}
                                        alt={label}
                                        className={
                                          podeColorir
                                            ? "addons-bloco-icon-img is-tinted"
                                            : "addons-bloco-icon-img"
                                        }
                                        style={
                                          podeColorir
                                            ? {
                                                filter: `${getCyberpinkSubthemeIconFilter(
                                                  subthemeKey
                                                )} drop-shadow(0 0 2px ${iconColor}) drop-shadow(0 0 6px ${iconColor})`,
                                              }
                                            : undefined
                                        }
                                      />
                                    ) : (
                                      <span className="addons-bloco-icon-fallback">
                                        {label.slice(0, 2).toUpperCase()}
                                      </span>
                                    )}
                                  </span>
                                  <span className="addons-bloco-name">{label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </section>
                    ))
                  ) : (
                    <p style={{ margin: 0, opacity: 0.76 }}>
                      Nenhum add-on configurado neste bloco.
                    </p>
                  )}
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

              {podeGerenciar && !blocoEhCards && !blocoEhLive && !blocoEhAddOns && (
                <EditorBloco
                  bloco={bloco}
                  imagensEditor={imagensEditor}
                  onSalvar={(updates) => atualizarBloco(bloco.id, updates)}
                  onExcluir={() => excluirBloco(bloco.id)}
                  salvando={blocoEmAtualizacaoId === bloco.id}
                  excluindo={blocoEmExclusaoId === bloco.id}
                />
              )}

              {podeGerenciar && (blocoEhCards || blocoEhLive || blocoEhAddOns) && (
                <div className="bloco-acoes">
                  <button
                    type="button"
                    onClick={() => abrirEditorBlocoCards(bloco)}
                  >
                    Editar bloco
                  </button>
                </div>
              )}
            </Container>
          );
        })}

      {acessoEspacoResolvido &&
        podeVerEspaco &&
        blocosVisiveis.length < blocos.length ? (
          <div
            ref={blocosInfiniteScrollRef}
            style={{
              width: "100%",
              minHeight: 48,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.7,
            }}
          >
            Carregando mais blocos...
          </div>
        ) : null}

      <LiveModal
        aberto={liveModal.aberto}
        onClose={() => {
          setLiveModal((prev) => ({ ...prev, aberto: false }));
        }}
        ehVideoDireto={liveModalEhVideoDireto}
        titulo={liveModal.titulo || "Live"}
        liveUrl={liveModal.liveUrl}
        embedUrl={liveModal.embedUrl}
        usuarioPodeControlarCameraLive={usuarioPodeControlarCameraLive}
        alternarCameraLive={alternarCameraLive}
        alternarFonteCameraLive={alternarFonteCameraLive}
        girarCameraLive={girarCameraLive}
        liveCameraAtiva={liveCameraAtiva}
        liveCameraFacingMode={liveCameraFacingMode}
        liveCameraRotacaoGraus={liveCameraRotacaoGraus}
        liveCameraErro={liveCameraErro}
        liveCameraVideoRef={liveCameraVideoRef}
        liveCameraStream={liveCameraStreamRef.current}
        currentUidAutenticado={currentUidAutenticado}
        liveCameraRemotaStatus={liveCameraRemotaStatus}
        liveCameraRemotaAtiva={liveCameraRemotaAtiva}
        liveCameraRemotaRotacaoGraus={liveCameraRemotaRotacaoGraus}
        liveCameraRemotaVideoRef={liveCameraRemotaVideoRef}
        liveCameraRemotaStream={liveCameraRemotaStreamRef.current}
        liveCriadorCameraAtiva={liveCriadorCameraAtiva}
        liveCameraRemotaErro={liveCameraRemotaErro}
        liveChatScrollRef={liveChatScrollRef}
        liveChatMensagens={liveChatMensagens}
        liveChatErro={liveChatErro}
        liveChatMensagem={liveChatMensagem}
        setLiveChatMensagem={setLiveChatMensagem}
        enviarMensagemLive={enviarMensagemLive}
      />

      {editorBlocoCardsModal.aberto && blocoEditorCardsAtual ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99997,
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="menuContentArea"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(96vw, 760px)",
              maxHeight: "92vh",
              overflowY: "auto",
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(10, 6, 22, 0.96)",
              padding: 18,
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <strong>Editar bloco</strong>
                <p style={{ margin: "4px 0 0", opacity: 0.72, fontSize: 12 }}>
                  {blocoEditorCardsAtual?.tipo === "addons"
                    ? "Gerencie os subobjetos de add-ons deste bloco."
                    : blocoEditorCardsAtual?.tipo === "cards"
                      ? "Gerencie os cards deste bloco e adicione novos itens."
                      : "Ajuste as configuracoes deste bloco."}
                </p>
              </div>
              <button type="button" onClick={fecharEditorBlocoCards}>
                Fechar
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              {blocoEditorCardsAtual?.tipo === "cards" ? (
                <>
                  <span style={{ fontSize: 12, opacity: 0.78 }}>
                    {`Cards no bloco: ${cardsEditorBlocoAtual.length}`}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      abrirEditorCardDoBloco(blocoEditorCardsAtual, {
                        id: gerarIdCardTemporario(),
                        ordem: cardsEditorBlocoAtual.length,
                        __novo: true,
                        nome: "",
                        descricaoExtra: "",
                        descricao: "",
                        imagem: "",
                        imagemPath: "",
                        linkExterno: "",
                      })
                    }
                  >
                    Adicionar card
                  </button>
                </>
              ) : blocoEditorCardsAtual?.tipo === "addons" ? (
                <span style={{ fontSize: 12, opacity: 0.78 }}>
                  {`Add-ons no bloco: ${subObjetosAddOnsEditorBlocoAtual.length}`}
                </span>
              ) : (
                <span style={{ fontSize: 12, opacity: 0.78 }}>
                  Ajuste o cabecalho deste bloco.
                </span>
              )}
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Titulo do bloco</span>
                <input
                  type="text"
                  value={editorBlocoCardsModal.titulo}
                  onChange={(event) =>
                    setEditorBlocoCardsModal((prev) => ({
                      ...prev,
                      titulo: event.target.value,
                    }))
                  }
                  placeholder="Opcional"
                  disabled={blocoEmAtualizacaoId === blocoEditorCardsAtual.id}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Icone do bloco</span>
                {projetoPossuiColecoesIcones ? (
                  <select
                    value={editorBlocoCardsModal.iconeSelecao}
                    onChange={(event) => {
                      const valor = event.target.value;
                      const iconPayload = parseIconSelectionValue(valor, iconCollectionsFiltradas);
                      setEditorBlocoCardsModal((prev) => ({
                        ...prev,
                        iconeSelecao: valor,
                        icone: iconPayload.iconUrl,
                      }));
                    }}
                    disabled={blocoEmAtualizacaoId === blocoEditorCardsAtual.id}
                  >
                    <option value="">Sem icone</option>
                    {iconCollectionsFiltradas.map((colecao) => (
                      <optgroup key={colecao.id} label={colecao.nome}>
                        {(colecao.icons || []).map((icon) => (
                          <option key={icon.id} value={`${colecao.id}::${icon.id}`}>
                            {icon.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                ) : (
                  <p style={{ margin: 0, fontSize: 12, opacity: 0.72 }}>
                    Nenhuma colecao de icones permitida para este projeto/tema.
                  </p>
                )}
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => {
                    const iconPayload = projetoPossuiColecoesIcones
                      ? parseIconSelectionValue(
                          editorBlocoCardsModal.iconeSelecao,
                          iconCollectionsFiltradas
                        )
                      : {
                          iconCollectionId: String(blocoEditorCardsAtual?.iconCollectionId || "").trim(),
                          iconId: String(blocoEditorCardsAtual?.iconId || "").trim(),
                          iconUrl: String(blocoEditorCardsAtual?.icone || blocoEditorCardsAtual?.iconUrl || "").trim(),
                          iconLabel: String(blocoEditorCardsAtual?.iconLabel || "").trim(),
                        };
                    atualizarMetadadosBloco(blocoEditorCardsAtual.id, {
                      titulo: editorBlocoCardsModal.titulo,
                      icone: iconPayload.iconUrl,
                      iconUrl: iconPayload.iconUrl,
                      iconCollectionId: iconPayload.iconCollectionId,
                      iconId: iconPayload.iconId,
                      iconLabel: iconPayload.iconLabel,
                    });
                  }}
                  disabled={blocoEmAtualizacaoId === blocoEditorCardsAtual.id}
                >
                  {blocoEmAtualizacaoId === blocoEditorCardsAtual.id
                    ? "Salvando bloco..."
                    : "Salvar cabecalho"}
                </button>
              </div>
            </div>

            {blocoEditorCardsAtual?.tipo === "cards" ? (
              <div style={{ display: "grid", gap: 10 }}>
                {cardsEditorBlocoAtual.length ? (
                <>
                  <p style={{ margin: 0, fontSize: 12, opacity: 0.72 }}>
                    Arraste as miniaturas para reordenar os cards do bloco.
                  </p>
                  {cardsEditorBlocoAtual.map((card, index) => {
                  const imagemCardResolvida =
                    imagensCardsPorBloco?.[blocoEditorCardsAtual.id]?.[card.id] || "";
                  const imagemCardFinal = isRenderableUrl(card.imagem)
                    ? card.imagem
                    : imagemCardResolvida || "/logoNeon.png";
                  return (
                    <div
                      key={`editor-bloco-card-${card.id || index}`}
                      draggable={blocoEmAtualizacaoId !== blocoEditorCardsAtual.id}
                      onDragStart={() =>
                        setDragCardInfo({
                          blocoId: blocoEditorCardsAtual.id,
                          cardId: String(card.id || ""),
                        })
                      }
                      onDragEnd={() => setDragCardInfo({ blocoId: "", cardId: "" })}
                      onDragOver={(event) => {
                        event.preventDefault();
                      }}
                      onDrop={async (event) => {
                        event.preventDefault();
                        const origemIndex = cardsEditorBlocoAtual.findIndex(
                          (item) =>
                            String(item?.id || "") === String(dragCardInfo?.cardId || "")
                        );
                        if (
                          dragCardInfo?.blocoId !== blocoEditorCardsAtual.id ||
                          origemIndex < 0
                        ) {
                          return;
                        }
                        await reordenarCardsDoBloco(blocoEditorCardsAtual, origemIndex, index);
                        setDragCardInfo({ blocoId: "", cardId: "" });
                      }}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "64px minmax(0, 1fr) auto",
                        gap: 10,
                        alignItems: "center",
                        border:
                          dragCardInfo?.blocoId === blocoEditorCardsAtual.id &&
                          dragCardInfo?.cardId === String(card.id || "")
                            ? "1px solid rgba(255,255,255,0.5)"
                            : "1px solid rgba(255,255,255,0.1)",
                        padding: 10,
                        background: "rgba(255,255,255,0.03)",
                        cursor: "grab",
                        opacity:
                          dragCardInfo?.blocoId === blocoEditorCardsAtual.id &&
                          dragCardInfo?.cardId === String(card.id || "")
                            ? 0.72
                            : 1,
                      }}
                    >
                      <img
                        src={imagemCardFinal}
                        alt=""
                        style={{
                          width: 64,
                          height: 64,
                          objectFit: "cover",
                          border: "1px solid rgba(255,255,255,0.16)",
                          background: "rgba(0,0,0,0.25)",
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {card.nome || `Card ${index + 1}`}
                        </strong>
                        <p style={{ margin: "4px 0 0", fontSize: 11, opacity: 0.56 }}>
                          {`Posicao ${index + 1}`}
                        </p>
                        {!!card.descricaoExtra && (
                          <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.78 }}>
                            {card.descricaoExtra}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => abrirEditorCardDoBloco(blocoEditorCardsAtual, card)}
                        disabled={cardEmAtualizacaoId === `${blocoEditorCardsAtual.id}:${card.id}`}
                      >
                        {cardEmAtualizacaoId === `${blocoEditorCardsAtual.id}:${card.id}`
                          ? "Salvando..."
                          : "Editar"}
                      </button>
                    </div>
                  );
                })}
                </>
              ) : (
                <p style={{ margin: 0, opacity: 0.76 }}>
                  Nenhum card cadastrado ainda.
                </p>
                )}
              </div>
            ) : null}

            {blocoEditorCardsAtual?.tipo === "addons" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <strong>Subblocos de add-ons</strong>
                <input
                  type="search"
                  value={buscaAddOnEditor}
                  onChange={(event) => setBuscaAddOnEditor(event.target.value)}
                  placeholder="Pesquisar add-on por nome"
                  disabled={blocoEmAtualizacaoId === blocoEditorCardsAtual.id}
                />
                {subBlocosAddOnsEditorBlocoAtual.length ? (
                  subBlocosAddOnsEditorBlocoAtual.map((subBloco, subBlocoIndex) => {
                    const bloqueadoEditor = blocoEmAtualizacaoId === blocoEditorCardsAtual.id;
                    const subObjetosSubBloco = normalizarSubObjetosAddOns(subBloco.subObjetos);

                    return (
                      <section
                        key={subBloco.id}
                        style={{
                          border: "1px solid rgba(255,255,255,0.12)",
                          borderRadius: 8,
                          padding: 10,
                          display: "grid",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 1fr) auto",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <input
                            type="text"
                            defaultValue={subBloco.titulo}
                            placeholder={`Nome do subbloco ${subBlocoIndex + 1}`}
                            disabled={bloqueadoEditor}
                            onBlur={(event) => {
                              const titulo = String(event.target.value || "").trim();
                              if (titulo === subBloco.titulo) return;
                              const proximosSubBlocos = subBlocosAddOnsEditorBlocoAtual.map(
                                (item, index) =>
                                  index === subBlocoIndex
                                    ? {
                                        ...item,
                                        titulo: titulo || `Subbloco ${subBlocoIndex + 1}`,
                                      }
                                    : item
                              );
                              void persistirSubBlocosAddOnsDoBloco(
                                blocoEditorCardsAtual,
                                proximosSubBlocos
                              );
                            }}
                          />
                          {subBlocosAddOnsEditorBlocoAtual.length > 1 ? (
                            <button
                              type="button"
                              disabled={bloqueadoEditor}
                              onClick={() => {
                                const proximosSubBlocos = subBlocosAddOnsEditorBlocoAtual.filter(
                                  (_, index) => index !== subBlocoIndex
                                );
                                void persistirSubBlocosAddOnsDoBloco(
                                  blocoEditorCardsAtual,
                                  proximosSubBlocos
                                );
                              }}
                              style={{ color: "#ff5aa5" }}
                            >
                              Remover
                            </button>
                          ) : null}
                        </div>

                        <div
                          style={{
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 8,
                            padding: 10,
                            maxHeight: 320,
                            overflowY: "auto",
                            display: "grid",
                            gap: 8,
                          }}
                        >
                          {!addOnsProjetoHabilitados ? (
                            <p style={{ margin: 0, opacity: 0.76 }}>
                              A base de add-ons esta desativada neste projeto.
                            </p>
                          ) : !blocoAddOnsProjetoHabilitado ? (
                            <p style={{ margin: 0, opacity: 0.76 }}>
                              Blocos do tipo Add-ons estao desativados neste projeto.
                            </p>
                          ) : erroAddOnsGerenciador ? (
                            <p style={{ margin: 0, color: "#ff9db0" }}>{erroAddOnsGerenciador}</p>
                          ) : !addOnsDisponiveisProjeto.length ? (
                            <p style={{ margin: 0, opacity: 0.76 }}>
                              Nenhum add-on criado para este usuario/projeto.
                            </p>
                          ) : !addOnsEditorFiltrados.length ? (
                            <p style={{ margin: 0, opacity: 0.76 }}>
                              Nenhum add-on encontrado para este filtro.
                            </p>
                          ) : (
                            addOnsEditorFiltrados.map((item) => {
                              const addOnId = String(item?.id || "").trim();
                              const subObjetoAtual = subObjetosSubBloco.find(
                                (subObjeto) => String(subObjeto?.addonId || "") === addOnId
                              );
                              const marcado = Boolean(subObjetoAtual);
                              const subtemaSelecionado =
                                normalizarSubtemaAddOnOpcional(subObjetoAtual?.subtema) || "";
                              const addOnEhSvg = isSvgAssetUrl(item?.url_img);

                              return (
                                <label
                                  key={`${subBloco.id}-${addOnId}`}
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "20px 38px minmax(0, 1fr)",
                                    gap: 10,
                                    alignItems: "center",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={marcado}
                                    disabled={bloqueadoEditor}
                                    onChange={() => {
                                      const proximosSubBlocos = subBlocosAddOnsEditorBlocoAtual.map(
                                        (itemSubBloco, index) => {
                                          if (index !== subBlocoIndex) return itemSubBloco;
                                          const atuais = normalizarSubObjetosAddOns(
                                            itemSubBloco.subObjetos
                                          );
                                          const proximosSubObjetos = marcado
                                            ? atuais.filter(
                                                (subObjeto) =>
                                                  String(subObjeto?.addonId || "") !== addOnId
                                              )
                                            : [
                                                ...atuais,
                                                criarSubObjetoAddOnRef(item, atuais.length),
                                              ];
                                          return {
                                            ...itemSubBloco,
                                            subObjetos: proximosSubObjetos,
                                          };
                                        }
                                      );

                                      void persistirSubBlocosAddOnsDoBloco(
                                        blocoEditorCardsAtual,
                                        proximosSubBlocos
                                      );
                                    }}
                                  />
                                  <span
                                    style={{
                                      width: 38,
                                      height: 38,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      border: "1px solid rgba(255,255,255,0.12)",
                                      borderRadius: 8,
                                      overflow: "hidden",
                                      background: "rgba(255,255,255,0.04)",
                                    }}
                                  >
                                    {item?.url_img ? (
                                      <img
                                        src={item.url_img}
                                        alt={item.nome || "Add-on"}
                                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                                      />
                                    ) : null}
                                  </span>
                                  <span style={{ minWidth: 0 }}>
                                    <strong>{item.nome}</strong>
                                    {item?.descricao ? (
                                      <span style={{ display: "block", fontSize: 12, opacity: 0.74 }}>
                                        {item.descricao}
                                      </span>
                                    ) : null}
                                    {marcado && addOnEhSvg ? (
                                      <span style={{ display: "grid", gap: 4, marginTop: 8 }}>
                                        <span style={{ fontSize: 11, opacity: 0.72 }}>
                                          Subtema do SVG neste subbloco
                                        </span>
                                        <select
                                          value={subtemaSelecionado}
                                          disabled={bloqueadoEditor}
                                          onChange={(event) => {
                                            const proximoValor = normalizarSubtemaAddOnOpcional(
                                              event.target.value
                                            );
                                            const proximosSubBlocos =
                                              subBlocosAddOnsEditorBlocoAtual.map(
                                                (itemSubBloco, index) => {
                                                  if (index !== subBlocoIndex) return itemSubBloco;
                                                  return {
                                                    ...itemSubBloco,
                                                    subObjetos: normalizarSubObjetosAddOns(
                                                      itemSubBloco.subObjetos
                                                    ).map((subObjeto) =>
                                                      String(subObjeto?.addonId || "") === addOnId
                                                        ? {
                                                            ...subObjeto,
                                                            subtema: proximoValor,
                                                          }
                                                        : subObjeto
                                                    ),
                                                  };
                                                }
                                              );

                                            void persistirSubBlocosAddOnsDoBloco(
                                              blocoEditorCardsAtual,
                                              proximosSubBlocos
                                            );
                                          }}
                                        >
                                          <option value="">Padrao do espaco</option>
                                          {CYBERPINK_SUBTHEMES.map((subtema) => (
                                            <option key={subtema.value} value={subtema.value}>
                                              {`Subtema: ${subtema.label}`}
                                            </option>
                                          ))}
                                        </select>
                                      </span>
                                    ) : null}
                                    {marcado && !addOnEhSvg ? (
                                      <span style={{ display: "block", fontSize: 11, opacity: 0.58, marginTop: 8 }}>
                                        Cor dinamica disponivel apenas para add-ons em SVG.
                                      </span>
                                    ) : null}
                                  </span>
                                </label>
                              );
                            })
                          )}
                        </div>

                        <span className="bloco-addons-editor__summary" style={{ fontSize: 12 }}>
                          {`${subObjetosSubBloco.length} subobjeto(s) neste subbloco.`}
                        </span>
                      </section>
                    );
                  })
                ) : (
                  <p style={{ margin: 0, opacity: 0.76 }}>Nenhum subbloco criado.</p>
                )}
                <button
                  type="button"
                  disabled={blocoEmAtualizacaoId === blocoEditorCardsAtual.id}
                  onClick={() => {
                    const atuais = subBlocosAddOnsEditorBlocoAtual.length
                      ? subBlocosAddOnsEditorBlocoAtual
                      : [criarSubBlocoAddOns(0)];
                    void persistirSubBlocosAddOnsDoBloco(blocoEditorCardsAtual, [
                      ...atuais,
                      criarSubBlocoAddOns(atuais.length),
                    ]);
                  }}
                >
                  Adicionar subbloco
                </button>
                <span className="bloco-addons-editor__summary" style={{ fontSize: 12 }}>
                  {`${addOnIdsEditorBlocoAtual.length} subobjeto(s) selecionado(s).`}
                </span>
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 12 }}>
              <button
                type="button"
                onClick={() => excluirBloco(blocoEditorCardsAtual.id)}
                disabled={blocoEmExclusaoId === blocoEditorCardsAtual.id}
                style={{ color: "#ff5aa5" }}
              >
                {blocoEmExclusaoId === blocoEditorCardsAtual.id
                  ? `Excluindo ${nomeBlocoSingularCapitalizado}...`
                  : `Excluir ${nomeBlocoSingularCapitalizado}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editorCardModal.aberto ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={fecharEditorCard}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99998,
            background: "rgba(0, 0, 0, 0.82)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="menuContentArea"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(96vw, 720px)",
              maxHeight: "92vh",
              overflowY: "auto",
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(10, 6, 22, 0.96)",
              padding: 18,
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <strong>Editar card</strong>
                <p style={{ margin: "4px 0 0", opacity: 0.72, fontSize: 12 }}>
                  Ajuste titulo, descricao, imagem e link do card.
                </p>
              </div>
              <button
                type="button"
                className="card-editor-modal__close"
                onClick={fecharEditorCard}
                aria-label="Fechar editor de card"
                title="Fechar"
              >
                <span className="card-editor-modal__close-icon" aria-hidden="true" />
              </button>
            </div>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Titulo</span>
              <input
                type="text"
                value={editorCardModal.nome}
                onChange={(event) =>
                  setEditorCardModal((prev) => ({
                    ...prev,
                    nome: event.target.value,
                  }))
                }
                placeholder="Titulo do card"
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Descricao extra do titulo</span>
              <input
                type="text"
                value={editorCardModal.descricaoExtra}
                onChange={(event) =>
                  setEditorCardModal((prev) => ({
                    ...prev,
                    descricaoExtra: event.target.value,
                  }))
                }
                placeholder="Ex.: 22.000 instalacoes"
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Descricao</span>
              <textarea
                value={editorCardModal.descricao}
                onChange={(event) =>
                  setEditorCardModal((prev) => ({
                    ...prev,
                    descricao: event.target.value,
                  }))
                }
                placeholder="Descricao do card"
                rows={6}
              />
            </label>

            <div style={{ display: "grid", gap: 8 }}>
              <strong>Add-ons do card</strong>
              <input
                type="search"
                value={buscaAddOnEditor}
                onChange={(event) => setBuscaAddOnEditor(event.target.value)}
                placeholder="Pesquisar add-on por nome"
              />
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8,
                  padding: 10,
                  maxHeight: 220,
                  overflowY: "auto",
                  display: "grid",
                  gap: 8,
                }}
              >
                {!addOnsProjetoHabilitados ? (
                  <p style={{ margin: 0, opacity: 0.76 }}>
                    A base de add-ons esta desativada neste projeto.
                  </p>
                ) : erroAddOnsGerenciador ? (
                  <p style={{ margin: 0, color: "#ff9db0" }}>{erroAddOnsGerenciador}</p>
                ) : !addOnsDisponiveisProjeto.length ? (
                  <p style={{ margin: 0, opacity: 0.76 }}>
                    Nenhum add-on criado para este usuario/projeto.
                  </p>
                ) : !addOnsEditorFiltrados.length ? (
                  <p style={{ margin: 0, opacity: 0.76 }}>
                    Nenhum add-on encontrado para este filtro.
                  </p>
                ) : (
                  addOnsEditorFiltrados.map((item) => {
                    const marcado = normalizarAddOnIds(editorCardModal.addOnIds).includes(item.id);
                    const subtemaSelecionado =
                      normalizarAddOnSubthemes(editorCardModal.addOnSubthemes, [item.id])[item.id] ||
                      "";
                    const addOnEhSvg = isSvgAssetUrl(item?.url_img);
                    return (
                      <label
                        key={item.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "20px 34px minmax(0, 1fr)",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() =>
                            setEditorCardModal((prev) => {
                              const atuais = normalizarAddOnIds(prev?.addOnIds);
                              const addOnSubthemesAtuais = normalizarAddOnSubthemes(
                                prev?.addOnSubthemes,
                                atuais
                              );
                              const estaMarcado = atuais.includes(item.id);
                              const proximosIds = estaMarcado
                                ? atuais.filter((id) => id !== item.id)
                                : [...atuais, item.id];
                              const proximosSubtemas = estaMarcado
                                ? Object.fromEntries(
                                    Object.entries(addOnSubthemesAtuais).filter(
                                      ([addOnId]) => addOnId !== item.id
                                    )
                                  )
                                : addOnSubthemesAtuais;
                              return {
                                ...prev,
                                addOnIds: proximosIds,
                                addOnSubthemes: proximosSubtemas,
                              };
                            })
                          }
                        />
                        <span
                          style={{
                            width: 34,
                            height: 34,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 8,
                            overflow: "hidden",
                            background: "rgba(255,255,255,0.04)",
                          }}
                        >
                          {item?.url_img ? (
                            <img
                              src={item.url_img}
                              alt={item.nome || "Add-on"}
                              style={{ width: "100%", height: "100%", objectFit: "contain" }}
                            />
                          ) : null}
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <strong>{item.nome}</strong>
                          {item?.descricao ? (
                            <span style={{ display: "block", fontSize: 12, opacity: 0.74 }}>
                              {item.descricao}
                            </span>
                          ) : null}
                          {marcado && addOnEhSvg ? (
                            <span style={{ display: "grid", gap: 4, marginTop: 8 }}>
                              <span style={{ fontSize: 11, opacity: 0.72 }}>
                                Cor do SVG no card
                              </span>
                              <select
                                value={subtemaSelecionado}
                                onChange={(event) => {
                                  const proximoValor = String(event.target.value || "").trim();
                                  setEditorCardModal((prev) => {
                                    const mapaAtual = normalizarAddOnSubthemes(
                                      prev?.addOnSubthemes,
                                      prev?.addOnIds
                                    );

                                    if (!proximoValor) {
                                      const { [item.id]: _omitido, ...restante } = mapaAtual;
                                      return {
                                        ...prev,
                                        addOnSubthemes: restante,
                                      };
                                    }

                                    return {
                                      ...prev,
                                      addOnSubthemes: {
                                        ...mapaAtual,
                                        [item.id]: normalizeCyberpinkSubtheme(proximoValor),
                                      },
                                    };
                                  });
                                }}
                              >
                                <option value="">Padrao do espaco</option>
                                {CYBERPINK_SUBTHEMES.map((subtema) => (
                                  <option key={subtema.value} value={subtema.value}>
                                    {`Subtema: ${subtema.label}`}
                                  </option>
                                ))}
                              </select>
                              <span style={{ fontSize: 11, opacity: 0.62 }}>
                                Escolha um subtema para tingir este SVG no card.
                              </span>
                            </span>
                          ) : null}
                          {marcado && !addOnEhSvg ? (
                            <span style={{ display: "block", fontSize: 11, opacity: 0.58, marginTop: 8 }}>
                              Cor dinamica disponivel apenas para add-ons em SVG.
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              <span style={{ fontSize: 12, opacity: 0.78 }}>
                {`${normalizarAddOnIds(editorCardModal.addOnIds).length} add-on(s) selecionado(s).`}
              </span>
            </div>

            <label style={{ display: "grid", gap: 6 }}>
              <span>URL da imagem</span>
              <input
                type="text"
                value={editorCardModal.imagem}
                onChange={(event) =>
                  setEditorCardModal((prev) => {
                    const previewAnterior = String(prev?.imagemPreviewUrl || "").trim();
                    if (previewAnterior.startsWith("blob:")) {
                      try {
                        URL.revokeObjectURL(previewAnterior);
                      } catch {
                        // no-op
                      }
                    }
                    return {
                      ...prev,
                      imagem: event.target.value,
                      imagemArquivo: null,
                      imagemPreviewUrl: "",
                    };
                  })
                }
                placeholder="https://..."
              />
            </label>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                onClick={async () => {
                  const arquivo = await selecionarArquivoImagem();
                  if (!arquivo) return;
                  const previewUrl = URL.createObjectURL(arquivo);
                  setEditorCardModal((prev) => {
                    const previewAnterior = String(prev?.imagemPreviewUrl || "").trim();
                    if (previewAnterior.startsWith("blob:")) {
                      try {
                        URL.revokeObjectURL(previewAnterior);
                      } catch {
                        // no-op
                      }
                    }
                    return {
                      ...prev,
                      imagemArquivo: arquivo,
                      imagemPreviewUrl: previewUrl,
                    };
                  });
                }}
              >
                Escolher arquivo
              </button>

              <button
                type="button"
                onClick={() =>
                  setEditorCardModal((prev) => {
                    const previewAnterior = String(prev?.imagemPreviewUrl || "").trim();
                    if (previewAnterior.startsWith("blob:")) {
                      try {
                        URL.revokeObjectURL(previewAnterior);
                      } catch {
                        // no-op
                      }
                    }
                    return {
                      ...prev,
                      imagem: "",
                      imagemArquivo: null,
                      imagemPreviewUrl: "",
                    };
                  })
                }
              >
                Remover imagem
              </button>

              {editorCardModal.imagemArquivo ? (
                <span style={{ fontSize: 12, opacity: 0.78 }}>
                  {`Arquivo: ${editorCardModal.imagemArquivo.name}`}
                </span>
              ) : null}
            </div>

            {(editorCardModal.imagemPreviewUrl || editorCardModal.imagem) ? (
              <div style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.78 }}>Preview da imagem</span>
                <img
                  src={editorCardModal.imagemPreviewUrl || editorCardModal.imagem}
                  alt="Preview do card"
                  style={{
                    width: "min(100%, 260px)",
                    aspectRatio: "1 / 1",
                    objectFit: "cover",
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(255,255,255,0.04)",
                  }}
                />
              </div>
            ) : null}

            <label style={{ display: "grid", gap: 6 }}>
              <span>Link externo</span>
              <input
                type="text"
                value={editorCardModal.linkExterno}
                onChange={(event) =>
                  setEditorCardModal((prev) => ({
                    ...prev,
                    linkExterno: event.target.value,
                  }))
                }
                placeholder="https://..."
              />
            </label>

            {!!erroAcaoBloco && (
              <p style={{ margin: 0, color: "#ff8fb8" }}>{erroAcaoBloco}</p>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    void excluirCardDoBloco();
                  }}
                  disabled={
                    cardEmAtualizacaoId ===
                    `${editorCardModal?.bloco?.id || ""}:${editorCardModal?.card?.id || ""}`
                  }
                  style={{
                    borderColor: "rgba(255, 120, 176, 0.42)",
                    color: "#ff9bc9",
                  }}
                >
                  {editorCardModal?.ehNovo ? "Descartar card" : "Excluir card"}
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button type="button" onClick={fecharEditorCard}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  void salvarEdicaoCardDoBloco();
                }}
                disabled={
                  cardEmAtualizacaoId ===
                  `${editorCardModal?.bloco?.id || ""}:${editorCardModal?.card?.id || ""}`
                }
              >
                {cardEmAtualizacaoId ===
                `${editorCardModal?.bloco?.id || ""}:${editorCardModal?.card?.id || ""}`
                  ? "Salvando card..."
                  : "Salvar card"}
              </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {previewImpressaoCard.aberto && previewImpressaoCard.card ? (
        <div
          role="dialog"
          aria-modal="true"
          className="card-print-preview-modal"
          onClick={fecharPreviewImpressaoCard}
        >
          <div
            className="card-print-preview-modal__content"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="card-print-preview-modal__header">
              <div>
                <strong>Versao para impressao</strong>
                <p>
                  Frente com titulo fixo e verso solido com QR para a rota unica do card.
                </p>
              </div>
              <button
                type="button"
                className="card-print-preview-modal__close"
                onClick={fecharPreviewImpressaoCard}
                aria-label="Fechar visualizacao de impressao"
                title="Fechar"
              >
                <span className="card-print-preview-modal__close-icon" aria-hidden="true" />
              </button>
            </div>

            <div className="card-print-preview-modal__grid">
              <section className="card-print-preview-modal__section">
                <h3>Frente</h3>
                <div className="card-print-preview-front">
                  <Card
                    id={previewImpressaoCard.card.id}
                    ownerUserId={ownerUserId}
                    espacoId={espacoId}
                    blocoId={previewImpressaoCard.bloco?.id || ""}
                    addOnIds={normalizarAddOnIds(previewImpressaoCard.card.addOnIds)}
                    addOnSubthemes={normalizarAddOnSubthemes(
                      previewImpressaoCard.card.addOnSubthemes,
                      previewImpressaoCard.card.addOnIds
                    )}
                    usaAddOnsGerenciador={
                      previewImpressaoCard.card?.usaAddOnsGerenciador === true
                    }
                    addOns={previewImpressaoCard.addOns}
                    nome={previewImpressaoCard.card.nome || "Card"}
                    descricaoExtra=""
                    nomeDescricao={previewImpressaoCard.card.nome || ""}
                    descricao={previewImpressaoCard.card.descricao || ""}
                    linkExterno={previewImpressaoCard.card.linkExterno || ""}
                    imagem={previewImpressaoCard.imagem || "/logoNeon.png"}
                    idNome={`card-print-front-${previewImpressaoCard.card.id}`}
                    cardDescricaoDiv="cardDescricaoDiv"
                    cardNome="cardNome"
                    cardContainerDesktop="cardContainerDesktop"
                    cardCabecalho="cardCabecalho"
                    cardImagem="cardImagem"
                    cardDescricao="cardDescricao"
                    imgCard="imgCard"
                  />
                </div>
              </section>

              <section className="card-print-preview-modal__section">
                <h3>Verso</h3>
                <div className="card-print-preview-back">
                  <span className="card-print-preview-back__circuit-map" aria-hidden="true" />
                  <div className="card-print-preview-back__qr">
                    <QRCodeImage
                      value={previewImpressaoCard.urlQr || previewImpressaoCard.url}
                      size={116}
                      alt="QR code rastreavel da rota unica do card"
                      className="card-print-preview-back__qr-image"
                      color="var(--cyberpink-subtheme-card-surface-shadow)"
                      bgColor="var(--cyberpink-subtheme-text)"
                    />
                  </div>
                  <span className="card-print-preview-back__track-label">
                    {previewImpressaoCard.qrStatus === "gerando"
                      ? "Gerando QR rastreavel..."
                      : previewImpressaoCard.printId
                        ? `QR rastreavel ${previewImpressaoCard.printId}`
                        : "QR direto do card"}
                  </span>
                </div>
              </section>
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
