import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import DOMPurify from "dompurify";
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
import AddOnFichaModal from "./components/AddOnFichaModal";
import CardPrintPreviewModal from "./components/CardPrintPreviewModal";
import BlocoPublicoRenderer from "./components/BlocoPublicoRenderer";
import EditorBlocoCardsModal from "./components/EditorBlocoCardsModal";
import EditorCardModal from "./components/EditorCardModal";
import ForjaPreviewModal from "./components/ForjaPreviewModal";
import LiveModal from "./components/LiveModal";
import RestricaoEspaco from "./components/RestricaoEspaco";
import Aly137Forja from "../Modulos/ALY137/Forja/Aly137Forja";
import useAly137Forja from "../Modulos/ALY137/Forja/useAly137Forja";
import { criarCardForjadoAly137 } from "../Modulos/ALY137/Forja/aly137ForjaApi";
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
import { registrarAuditLog } from "../Sistema/auditLogsApi";
import { usuarioPodeVerAuditoriaCategoriaProjeto } from "../Sistema/modulosPermissoes";
import {
  ALY137_ATRIBUTOS,
  ALY137_PESOS_EVIDENCIA,
  calcularNivelCardAly137,
  calcularXpPorPesoAly137,
  calcularResumoAly137,
  calcularResumoAddOnsAly137DeCards,
  criarEvidenciaAly137Padrao,
  criarPayloadCardAly137,
  normalizarCardAly137,
  normalizarAtributosSelecionadosAly137,
  normalizarPesoEvidenciaAly137,
} from "../Sistema/aly137Utils";
import {
  listarAddOnsDoUsuarioProjeto,
  listarIconCollectionsNoGerenciador,
  salvarResumoAly137AddOnsUsuarioProjeto,
} from "../Sistema/gerenciadorProjetosApi";
import {
  buildIconSelectionValue,
  filtrarColecoesIconesPermitidas,
  parseIconSelectionValue,
} from "../Sistema/iconCollectionsUtils";
import { solicitarSolicitacaoPixManualBloco } from "../Pagamentos/mercadoPagoApi";
import { garantirConversaProdutoVenda } from "../Vendas/vendasApi";
import {
  normalizeCyberpinkSubtheme,
} from "../Temas/cyberpink/subthemes";
import { seforAdm } from "../../Scripts/verificacoes/verificaAdm";
import { getEspacoCompleto } from "./firebaseEspacos";
import {
  criarQrPrintCard,
  excluirQrPrintCard,
  listarLeiturasQrPrint,
  listarQrPrintsDoCard,
} from "./qrPrintsApi";
import {
  criarLinkRastreavelEspaco,
  getOrCreateNavigationId,
} from "./trackableLinksApi";

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

const VISIBILIDADES_BLOCOS_PUBLICAS = ["publico", null];
const VISIBILIDADES_BLOCOS_AUTENTICADO = [
  "publico",
  "publico_restritivo",
  "privado",
  "exclusivo_assinante",
  "exclusivo_comprador",
  "comprado",
  null,
];

const obterVisibilidadesConsultaBlocos = ({ podeGerenciar = false, autenticado = false } = {}) => {
  if (podeGerenciar) return null;
  return autenticado ? VISIBILIDADES_BLOCOS_AUTENTICADO : VISIBILIDADES_BLOCOS_PUBLICAS;
};

async function adicionarDocsBlocosPorVisibilidade(docs, blocosRef, visibilidades = []) {
  const consultas = (Array.isArray(visibilidades) ? visibilidades : []).map((visibilidade) =>
    query(blocosRef, where("visibilidade", "==", visibilidade))
  );

  const results = await Promise.allSettled(consultas.map((qRef) => getDocs(qRef)));

  for (const result of results) {
    if (result.status === "fulfilled") {
      docs.push(...result.value.docs.map((d) => ({ __legacy: false, docSnap: d })));
    } else if (
      result.reason?.code &&
      result.reason.code !== "permission-denied" &&
      result.reason.code !== "failed-precondition"
    ) {
      throw result.reason;
    }
  }
}

async function adicionarDocsLegadosPorVisibilidade(docs, blocosRef, visibilidades = []) {
  const consultas = (Array.isArray(visibilidades) ? visibilidades : []).map((visibilidade) =>
    query(blocosRef, where("visibilidade", "==", visibilidade))
  );

  for (const consulta of consultas) {
    try {
      const snap = await getDocs(consulta);
      docs.push(...snap.docs.map((d) => ({ __legacy: false, docSnap: d })));
    } catch (err) {
      if (err?.code !== "permission-denied" && err?.code !== "failed-precondition") {
        throw err;
      }
    }
  }
}

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

const resolverTipoAddOn = (item = {}) =>
  String(
    item?.tipo ||
      item?.type ||
      item?.categoria ||
      item?.grupo ||
      item?.tipoAddOn ||
      item?.categoriaAddOn ||
      "geral"
  )
    .trim()
    .toLowerCase() || "geral";

const formatarTipoAddOn = (tipo = "") => {
  const normalizado = String(tipo || "geral").trim();
  return normalizado ? capitalizar(normalizado.replace(/[-_]+/g, " ")) : "Geral";
};

const obterDescricaoPreviaCard = (card = {}) =>
  String(card?.descricaoPrevia || card?.descricao || "").trim();

const obterDescricaoCompletaCard = (card = {}) =>
  String(card?.descricaoCompleta || obterDescricaoPreviaCard(card)).trim();

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
      const descricaoPrevia = obterDescricaoPreviaCard(card);
      const descricaoCompleta = obterDescricaoCompletaCard(card);
      return {
        id: String(card?.id || `card_${index}`),
        ordem: Number.isFinite(card?.ordem) ? Number(card.ordem) : index,
        nome: String(card?.nome || "").trim(),
        descricaoExtra: String(card?.descricaoExtra || "").trim(),
        descricaoPrevia,
        descricaoCompleta,
        descricao: descricaoPrevia,
        imagem: String(card?.imagem || "").trim(),
        imagemPath: String(card?.imagemPath || "").trim(),
        linkExterno: String(card?.linkExterno || "").trim(),
        addOnIds: addOnIdsNormalizados,
        addOnSubthemes: normalizarAddOnSubthemes(
          card?.addOnSubthemes || card?.addOnThemes,
          addOnIdsNormalizados
        ),
        aly137: normalizarCardAly137(card?.aly137, addOnIdsNormalizados),
        usaAddOnsGerenciador: possuiCampoAddOns,
      };
    })
    .filter(
      (card) =>
        card.nome ||
        card.descricaoExtra ||
        card.descricaoPrevia ||
        card.descricaoCompleta ||
        card.descricao ||
        card.imagem ||
        card.imagemPath ||
        card.linkExterno ||
        card.addOnIds.length
    )
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
};

const obterKeyCardOrigemAly137 = (card = {}) =>
  String(
    card?.key ||
      card?.id ||
      `${card?.espacoId || ""}:${card?.blocoId || ""}:${card?.cardId || card?.id || ""}`
  ).trim();

const obterAddOnIdsDisponiveisCardOrigemAly137 = (card = {}) =>
  normalizarAddOnIds([
    ...(Array.isArray(card?.addOnIdsDisponiveis) ? card.addOnIdsDisponiveis : []),
    ...(Array.isArray(card?.addOnIds) ? card.addOnIds : []),
    ...Object.keys(card?.addOnsXp || {}),
  ]);

const filtrarAddOnsXpCardOrigemAly137 = (addOnsXp = {}, addOnIds = []) => {
  const ids = new Set(normalizarAddOnIds(addOnIds));
  if (!ids.size || !addOnsXp || typeof addOnsXp !== "object") return {};
  return Object.fromEntries(Object.entries(addOnsXp).filter(([addOnId]) => ids.has(addOnId)));
};

const BLOCOS_PAGE_SIZE = 6;
const ORDENACAO_BLOCOS_POSTAGEM = "postagem";
const ORDENACAO_BLOCOS_LIVRE = "livre";

const ehObjetoPlanoFirestore = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const limparUndefinedFirestore = (value) => {
  if (typeof value === "undefined") return undefined;
  if (Array.isArray(value)) {
    return value
      .map((item) => limparUndefinedFirestore(item))
      .filter((item) => typeof item !== "undefined");
  }
  if (!ehObjetoPlanoFirestore(value)) return value;

  return Object.entries(value).reduce((acc, [key, item]) => {
    const itemLimpo = limparUndefinedFirestore(item);
    if (typeof itemLimpo !== "undefined") {
      acc[key] = itemLimpo;
    }
    return acc;
  }, {});
};

const normalizarOrdenacaoBlocos = (valor = "") =>
  String(valor || "").trim() === ORDENACAO_BLOCOS_LIVRE
    ? ORDENACAO_BLOCOS_LIVRE
    : ORDENACAO_BLOCOS_POSTAGEM;

const obterMsDataBloco = (valor) => {
  if (!valor) return 0;
  if (Number.isFinite(Number(valor))) return Number(valor);
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor === "string") {
    const parsed = Date.parse(valor);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof valor?.toMillis === "function") {
    const ms = Number(valor.toMillis());
    return Number.isFinite(ms) ? ms : 0;
  }
  if (Number.isFinite(Number(valor?.seconds))) {
    return Number(valor.seconds) * 1000;
  }
  return 0;
};

const obterScorePostagemBloco = (bloco = {}) => {
  return (
    obterMsDataBloco(bloco?.criadoEm) ||
    obterMsDataBloco(bloco?.createdAt) ||
    obterMsDataBloco(bloco?.updatedAt) ||
    obterMsDataBloco(bloco?.atualizadoEm) ||
    (Number.isFinite(Number(bloco?.ordem)) ? Number(bloco.ordem) : 0)
  );
};

const ordenarBlocosMaisRecentesPrimeiro = (lista = []) =>
  [...lista].sort((a, b) => {
    const scoreA = obterScorePostagemBloco(a);
    const scoreB = obterScorePostagemBloco(b);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return String(b?.id || "").localeCompare(String(a?.id || ""), "pt-BR");
  });

const ordenarBlocosPorOrdemLivre = (lista = []) =>
  [...lista].sort((a, b) => {
    const ordemA = Number(a?.ordem);
    const ordemB = Number(b?.ordem);
    const temOrdemA = Number.isFinite(ordemA);
    const temOrdemB = Number.isFinite(ordemB);

    if (temOrdemA && temOrdemB && ordemA !== ordemB) return ordemA - ordemB;
    if (temOrdemA && !temOrdemB) return -1;
    if (!temOrdemA && temOrdemB) return 1;

    const scoreA = obterScorePostagemBloco(a);
    const scoreB = obterScorePostagemBloco(b);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return String(a?.id || "").localeCompare(String(b?.id || ""), "pt-BR");
  });

const ordenarBlocosPorModo = (lista = [], modo = ORDENACAO_BLOCOS_POSTAGEM) =>
  normalizarOrdenacaoBlocos(modo) === ORDENACAO_BLOCOS_LIVRE
    ? ordenarBlocosPorOrdemLivre(lista)
    : ordenarBlocosMaisRecentesPrimeiro(lista);

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

const getDataMs = (value = null) => {
  if (!value) return 0;
  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }
  if (Number.isFinite(Number(value?.seconds))) {
    return Number(value.seconds) * 1000;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatarDataCurta = (value = null) => {
  const ms = getDataMs(value);
  if (!ms) return "--";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString();
  }
};

const normalizarTextoBusca = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

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

  if (type === "audit") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path d="M7 4.5h18v23H7v-23Z" />
        <path d="M11 10h10M11 15h10M11 20h6" />
        <path d="M21 21.5 25.5 26" />
        <circle cx="20" cy="20" r="4" />
      </svg>
    );
  }

  if (type === "copy") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path d="M11 9.5h13.5v17H11v-17Z" />
        <path d="M7.5 22.5v-17H21" />
        <path d="M15 15h5.5M15 19h5.5" />
      </svg>
    );
  }

  if (type === "share") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <circle cx="8" cy="16" r="3.5" />
        <circle cx="22" cy="8" r="3.5" />
        <circle cx="22" cy="24" r="3.5" />
        <path d="M11.2 14.4 18.8 9.6M11.2 17.6l7.6 4.8" />
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
  descricaoPrevia: "",
  descricaoCompleta: "",
  descricao: "",
  imagem: "",
  imagemOriginal: "",
  imagemPathOriginal: "",
  imagemArquivo: null,
  imagemPreviewUrl: "",
  iconeSvg: "",
  linkExterno: "",
  addOnIds: [],
  addOnSubthemes: {},
  aly137Evidencias: [],
  aly137CardsOrigemIds: [],
  aly137CardsOrigemAddOnIds: {},
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
  criandoQr: false,
  descricaoRegistro: "",
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
      limparUndefinedFirestore({
        ...blocoData,
        id: blocoId,
        ownerUserId: String(blocoData?.ownerUserId || ownerUserId).trim() || ownerUserId,
        espacoId: String(blocoData?.espacoId || espacoId).trim() || espacoId,
        cards: cardsFinal,
        updatedAt: serverTimestamp(),
      }),
      { merge: true }
    );

    await Promise.all(
      cardsFinal.map((card) =>
        setDoc(
          getBlocoCardDocRefs(ownerUserId, espacoId, blocoId, card.id)[0],
          limparUndefinedFirestore({
            id: card.id,
            ordem: card.ordem,
            nome: card.nome || "",
            descricaoExtra: card.descricaoExtra || "",
            descricaoPrevia: card.descricaoPrevia || "",
            descricaoCompleta: card.descricaoCompleta || "",
            descricao: card.descricaoPrevia || card.descricao || "",
            imagem: card.imagem || "",
            imagemPath: card.imagemPath || "",
            linkExterno: card.linkExterno || "",
            blocoId,
            espacoId,
            ownerUserId,
            updatedAt: serverTimestamp(),
          }),
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
  const [cardsFragmentosSkin, setCardsFragmentosSkin] = useState([]);
  const [cardsFragmentosSkinLoading, setCardsFragmentosSkinLoading] = useState(false);
  const [erroCardsFragmentosSkin, setErroCardsFragmentosSkin] = useState("");
  const [buscaAddOnEditor, setBuscaAddOnEditor] = useState("");
  const [filtroTipoAddOnEditor, setFiltroTipoAddOnEditor] = useState("");
  const [buscaConteudoEspaco, setBuscaConteudoEspaco] = useState("");
  const [buscaConteudoAuditada, setBuscaConteudoAuditada] = useState("");
  const [compartilhandoRastreavelId, setCompartilhandoRastreavelId] = useState("");
  const [editorCardAba, setEditorCardAba] = useState("conteudo");
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
  const [addOnFichaModal, setAddOnFichaModal] = useState({
    aberto: false,
    addOn: null,
  });
  const [forjaPreviewModal, setForjaPreviewModal] = useState({
    aberto: false,
  });
  const [previewImpressaoCard, setPreviewImpressaoCard] = useState(() =>
    criarEstadoPreviewImpressaoCard()
  );
  const [previewImpressaoPopup, setPreviewImpressaoPopup] = useState({
    aberto: false,
    printId: "",
  });
  const [qrPrintsHistorico, setQrPrintsHistorico] = useState({
    loading: false,
    erro: "",
    itens: [],
  });
  const [qrPrintExcluindoId, setQrPrintExcluindoId] = useState("");
  const [qrPrintLeituras, setQrPrintLeituras] = useState({});
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
  const espacoAtual = espacosLista.find((e) => e.nome === espacoNome);
  const espacoId = espacoAtual?.id || espacoAtual?.id_espaco;
  const modoOrdenacaoBlocosEspaco = normalizarOrdenacaoBlocos(espacoAtual?.ordenacaoBlocos);
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
  const tiposAddOnsEditor = useMemo(
    () =>
      Array.from(new Set(addOnsDisponiveisProjeto.map((item) => resolverTipoAddOn(item))))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [addOnsDisponiveisProjeto]
  );
  const addOnsEditorFiltrados = useMemo(() => {
    const buscaNormalizada = String(buscaAddOnEditor || "").trim().toLowerCase();
    const tipoNormalizado = String(filtroTipoAddOnEditor || "").trim().toLowerCase();
    return addOnsDisponiveisProjeto.filter((item) => {
      const tipoItem = resolverTipoAddOn(item);
      const passaTipo = !tipoNormalizado || tipoItem === tipoNormalizado;
      if (!passaTipo) return false;
      if (!buscaNormalizada) return true;
      return [
        item?.nome,
        item?.descricao,
        item?.categoria,
        item?.grupo,
        tipoItem,
      ]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(buscaNormalizada));
    });
  }, [addOnsDisponiveisProjeto, buscaAddOnEditor, filtroTipoAddOnEditor]);
  const cardsFragmentosEspacoAtual = useMemo(
    () =>
      (Array.isArray(blocos) ? blocos : []).flatMap((bloco) => {
        const blocoId = String(bloco?.id || "").trim();
        const blocoTitulo = String(bloco?.titulo || bloco?.nome || blocoId || "Bloco").trim();
        return normalizarCardsDoBloco(bloco?.cards).map((card) => ({
          ...card,
          key: `${espacoId || "espaco"}:${blocoId}:${card.id}`,
          id: `${espacoId || "espaco"}:${blocoId}:${card.id}`,
          cardId: card.id,
          blocoId,
          blocoTitulo,
          espacoId: String(espacoId || "").trim(),
          espacoNome: String(espacoNome || "").trim(),
          espacoSubtema: normalizeCyberpinkSubtheme(espacoAtual?.subtema),
        }));
      }),
    [blocos, espacoAtual?.subtema, espacoId, espacoNome]
  );
  const cardsFragmentosSkinCombinados = useMemo(() => {
    const mapa = new Map();
    [...cardsFragmentosEspacoAtual, ...(Array.isArray(cardsFragmentosSkin) ? cardsFragmentosSkin : [])].forEach(
      (card) => {
        const key = String(card?.key || `${card?.espacoId || ""}:${card?.blocoId || ""}:${card?.cardId || card?.id || ""}`).trim();
        if (!key || mapa.has(key)) return;
        mapa.set(key, card);
      }
    );
    return Array.from(mapa.values());
  }, [cardsFragmentosEspacoAtual, cardsFragmentosSkin]);
  const cardsAly137Espaco = useMemo(
    () =>
      (Array.isArray(blocos) ? blocos : []).flatMap((bloco) => {
        const blocoId = String(bloco?.id || "").trim();
        const blocoTitulo = String(bloco?.titulo || bloco?.nome || blocoId || "Bloco").trim();
        return normalizarCardsDoBloco(bloco?.cards).map((card) => ({
          ...card,
          blocoId,
          blocoTitulo,
        }));
      }),
    [blocos]
  );
  const blocosCardsDisponiveisForja = useMemo(
    () =>
      (Array.isArray(blocos) ? blocos : [])
        .filter((bloco) => String(bloco?.tipo || "").trim() === "cards")
        .map((bloco) => ({
          ...bloco,
          titulo: String(bloco?.titulo || bloco?.nome || bloco?.id || "Bloco de cards").trim(),
        })),
    [blocos]
  );
  const aly137ResumoAddOnsPorId = useMemo(
    () =>
      calcularResumoAddOnsAly137DeCards({
        cards: cardsAly137Espaco,
        addOns: addOnsDisponiveisProjeto,
      }),
    [addOnsDisponiveisProjeto, cardsAly137Espaco]
  );
  const imagemPreviewEditorCard = useMemo(
    () =>
      String(
        editorCardModal.imagemPreviewUrl ||
          editorCardModal.imagem ||
          editorCardModal.imagemOriginal ||
          ""
      ).trim() || "/logoNeon.png",
    [editorCardModal.imagem, editorCardModal.imagemOriginal, editorCardModal.imagemPreviewUrl]
  );
  const aly137Habilitado = configSistemaAtual?.aly137Habilitado === true;
  const cardsDisponiveisForjaEditor = useMemo(() => {
    const blocoAtualId = String(editorCardModal?.bloco?.id || "").trim();
    const cardAtualId = String(editorCardModal?.card?.id || "").trim();
    const espacoAtualId = String(espacoId || "").trim();
    return cardsFragmentosSkinCombinados
      .map((card) => ({
        ...card,
        key: String(card?.key || `${card?.espacoId || ""}:${card?.blocoId || ""}:${card?.cardId || card?.id || ""}`).trim(),
        id: String(card?.key || `${card?.espacoId || ""}:${card?.blocoId || ""}:${card?.cardId || card?.id || ""}`).trim(),
        cardId: String(card?.cardId || card?.id || "").trim(),
        nome: card?.nome || "Card",
        descricao: card?.descricaoPrevia || card?.descricao || card?.descricaoExtra || "",
        descricaoPrevia: card?.descricaoPrevia || card?.descricao || "",
        descricaoCompleta: card?.descricaoCompleta || card?.descricaoPrevia || card?.descricao || "",
        imagem: card?.imagem || "",
        xpTotal: Number(card?.aly137?.xpTotal || 0),
        nivel: Number(card?.aly137?.nivel || 0),
        atributos: card?.aly137?.atributos || {},
        espacoSubtema: normalizeCyberpinkSubtheme(card?.espacoSubtema),
        addOnIds: normalizarAddOnIds(card?.addOnIds),
        addOnIdsDisponiveis: obterAddOnIdsDisponiveisCardOrigemAly137({
          ...card,
          addOnsXp: card?.aly137?.addOnsXp || card?.addOnsXp || {},
        }),
        addOnSubthemes: normalizarAddOnSubthemes(card?.addOnSubthemes, card?.addOnIds),
        addOnsXp: card?.aly137?.addOnsXp || {},
      }))
      .filter(
        (item) =>
          item.cardId &&
          !(
            String(item.espacoId || "") === espacoAtualId &&
            item.blocoId === blocoAtualId &&
            item.cardId === cardAtualId
          )
      );
  }, [
    cardsFragmentosSkinCombinados,
    editorCardModal?.bloco?.id,
    editorCardModal?.card?.id,
    espacoId,
  ]);
  const cardsRelacionaveisEditorFiltrados = useMemo(() => {
    if (!aly137Habilitado) return [];
    const buscaNormalizada = String(buscaAddOnEditor || "").trim().toLowerCase();
    const filtroNormalizado = String(filtroTipoAddOnEditor || "").trim().toLowerCase();
    if (filtroNormalizado && filtroNormalizado !== "__card__") return [];
    return cardsDisponiveisForjaEditor.filter((card) => {
      if (!buscaNormalizada) return true;
      return [
        card?.nome,
        card?.descricao,
        card?.blocoTitulo,
        "card",
      ]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(buscaNormalizada));
    });
  }, [aly137Habilitado, buscaAddOnEditor, cardsDisponiveisForjaEditor, filtroTipoAddOnEditor]);
  const cardsOrigemSelecionadosEditor = useMemo(() => {
    const selecionados = new Set(
      Array.isArray(editorCardModal?.aly137CardsOrigemIds)
        ? editorCardModal.aly137CardsOrigemIds.map((item) => String(item || "").trim()).filter(Boolean)
        : []
    );
    const mapaRelacionados =
      editorCardModal?.aly137CardsOrigemAddOnIds &&
      typeof editorCardModal.aly137CardsOrigemAddOnIds === "object"
        ? editorCardModal.aly137CardsOrigemAddOnIds
        : {};

    return cardsDisponiveisForjaEditor
      .filter((card) => selecionados.has(card.key))
      .map((card) => {
        const addOnIdsDisponiveis = obterAddOnIdsDisponiveisCardOrigemAly137(card);
        const temConfig = Object.prototype.hasOwnProperty.call(mapaRelacionados, card.key);
        const addOnIdsRelacionados = temConfig
          ? normalizarAddOnIds(mapaRelacionados[card.key]).filter((addOnId) =>
              addOnIdsDisponiveis.includes(addOnId)
            )
          : addOnIdsDisponiveis;
        return {
          ...card,
          iconeSvg: String(card?.iconeSvg || card?.iconeAddOnSvg || "").trim(),
          addOnIdsDisponiveis,
          addOnIdsRelacionados,
          addOnIds: addOnIdsRelacionados,
          addOnsXp: filtrarAddOnsXpCardOrigemAly137(card?.addOnsXp, addOnIdsRelacionados),
        };
      });
  }, [
    cardsDisponiveisForjaEditor,
    editorCardModal?.aly137CardsOrigemAddOnIds,
    editorCardModal?.aly137CardsOrigemIds,
  ]);
  const addOnIdsHerdadosForjaEditor = useMemo(
    () =>
      normalizarAddOnIds(
        cardsOrigemSelecionadosEditor.flatMap((card) => [
          ...(Array.isArray(card?.addOnIds) ? card.addOnIds : []),
          ...Object.keys(card?.addOnsXp || {}),
        ])
      ),
    [cardsOrigemSelecionadosEditor]
  );
  const addOnSubthemesHerdadosForjaEditor = useMemo(
    () =>
      cardsOrigemSelecionadosEditor.reduce((acc, card) => {
        const addOnIdsCard = normalizarAddOnIds(card?.addOnIdsRelacionados || card?.addOnIds);
        const subthemesCard = normalizarAddOnSubthemes(card?.addOnSubthemes, addOnIdsCard);
        addOnIdsCard.forEach((addOnId) => {
          if (subthemesCard[addOnId] && !acc[addOnId]) {
            acc[addOnId] = subthemesCard[addOnId];
          }
        });
        return acc;
      }, {}),
    [cardsOrigemSelecionadosEditor]
  );
  const addOnIdsEfetivosEditorCard = useMemo(
    () =>
      normalizarAddOnIds([
        ...normalizarAddOnIds(editorCardModal?.addOnIds),
        ...addOnIdsHerdadosForjaEditor,
      ]),
    [addOnIdsHerdadosForjaEditor, editorCardModal?.addOnIds]
  );
  const addOnSubthemesEfetivosEditorCard = useMemo(
    () =>
      normalizarAddOnSubthemes(
        {
          ...addOnSubthemesHerdadosForjaEditor,
          ...(editorCardModal?.addOnSubthemes && typeof editorCardModal.addOnSubthemes === "object"
            ? editorCardModal.addOnSubthemes
            : {}),
        },
        addOnIdsEfetivosEditorCard
      ),
    [
      addOnIdsEfetivosEditorCard,
      addOnSubthemesHerdadosForjaEditor,
      editorCardModal?.addOnSubthemes,
    ]
  );
  const addOnsEfetivosEditorCard = useMemo(
    () =>
      addOnIdsEfetivosEditorCard
        .map((addOnId) => addOnsDisponiveisProjetoPorId[addOnId])
        .filter(Boolean),
    [addOnIdsEfetivosEditorCard, addOnsDisponiveisProjetoPorId]
  );
  const resumoAly137EditorCard = useMemo(
    () =>
      calcularResumoAly137({
        evidencias: editorCardModal?.aly137Evidencias,
        cardsOrigem: cardsOrigemSelecionadosEditor,
        validAddOnIds: addOnIdsEfetivosEditorCard,
      }),
    [
      addOnIdsEfetivosEditorCard,
      cardsOrigemSelecionadosEditor,
      editorCardModal?.aly137Evidencias,
    ]
  );
  const retornarDaForjaParaMenu = useCallback(
    (returnTo = "") => {
      const destino = String(returnTo || "").trim();
      if (destino) navigate(destino, { replace: true });
    },
    [navigate]
  );

  const {
    modal: forjaInventarioModal,
    setModal: setForjaInventarioModal,
    cardsSelecionados: cardsForjaInventarioSelecionados,
    addOnIdsDiretos: addOnIdsDiretosForjaInventario,
    addOnIdsEfetivos: addOnIdsEfetivosForjaInventario,
    addOnsDiretos: addOnsDiretosForjaInventario,
    resumo: resumoForjaInventario,
    cardsInventarioFiltrados: cardsInventarioForjaFiltrados,
    addOnsInventarioFiltrados: addOnsInventarioForjaFiltrados,
    adicionarCard: adicionarCardAoInventarioForja,
    removerCard: removerCardDoInventarioForja,
    alternarAddOnCard: alternarAddOnCardInventarioForja,
    alternarAddOnDireto: alternarAddOnDiretoInventarioForja,
    abrir: abrirForjaInventario,
    fechar: fecharForjaInventario,
    resetar: resetarForjaInventario,
    iniciarArraste: iniciarArrasteForjaInventario,
    finalizarArraste: finalizarArrasteForjaInventario,
    soltarMaterial: soltarMaterialNaForjaInventario,
  } = useAly137Forja({
    cardsDisponiveis: cardsDisponiveisForjaEditor,
    addOnsDisponiveis: addOnsDisponiveisProjeto,
    addOnsPorId: addOnsDisponiveisProjetoPorId,
    blocosDestino: blocosCardsDisponiveisForja,
    resolverTipoAddOn,
    onReturn: retornarDaForjaParaMenu,
  });
  const conclusaoNivelAly137EditorCard = useMemo(() => {
    const progresso = resumoAly137EditorCard?.progressoNivel || {};
    const xpAtual = Number(resumoAly137EditorCard?.xpTotal || 0);
    const xpAlvo = Number(progresso?.xpProximoNivel || 0);
    const nivelAtual = Number(progresso?.nivel || resumoAly137EditorCard?.nivel || 0);
    const conclusaoEtapa = nivelAtual <= 0 ? "formacao" : "nivel";
    const nivelAlvo = xpAlvo ? (nivelAtual <= 0 ? 1 : nivelAtual) : 0;
    const xpFaltante = xpAlvo ? Math.max(0, Math.round(xpAlvo - xpAtual)) : 0;
    const evidencias = Array.isArray(editorCardModal?.aly137Evidencias)
      ? editorCardModal.aly137Evidencias
      : [];
    const jaConcluiuNivel = evidencias.some((evidencia) => {
      const tipo = String(evidencia?.tipo || "").trim();
      const alvo = Number(evidencia?.nivelAlvo || 0);
      const etapa = String(evidencia?.conclusaoEtapa || "").trim();
      return tipo === "conclusao_nivel" && alvo === nivelAlvo && etapa === conclusaoEtapa;
    });

    return {
      disponivel: Boolean(xpAlvo && xpFaltante > 0 && !jaConcluiuNivel),
      jaConcluiuNivel,
      nivelAtual,
      nivelAlvo,
      conclusaoEtapa,
      xpAtual,
      xpAlvo,
      xpFaltante,
      labelBotao: nivelAtual <= 0 ? "Concluir formacao" : `Concluir nivel ${nivelAtual}`,
    };
  }, [
    editorCardModal?.aly137Evidencias,
    resumoAly137EditorCard?.nivel,
    resumoAly137EditorCard?.progressoNivel,
    resumoAly137EditorCard?.xpTotal,
  ]);
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
  const buscaConteudoUrl = useMemo(() => {
    const params = new URLSearchParams(location.search || "");
    return params.get("busca") || "";
  }, [location.search]);
  const authUserAtual = user || auth.currentUser || null;
  const authUid = auth.currentUser?.uid || null;
  const currentUidAutenticado = user?.uid || authUid || null;
  const currentUid = user?.uid || authUid || persistedUid || null;
  const oneOwnerPublicaAtivaEfetiva = Boolean(oneOwnerPublicaAtivaContexto || oneOwnerPublicaAtiva);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    const espacoSegmento = encodeRouteSegment(espacoNome || "");
    const skinSegmento = encodeRouteSegment(skinsUsername || "");
    const pathEspaco = oneOwnerPublicaAtivaEfetiva
      ? espacoSegmento
        ? `/${espacoSegmento}`
        : ""
      : skinSegmento && espacoSegmento
        ? `/${skinSegmento}/${espacoSegmento}`
        : "";

    if (!pathEspaco) return;
    localStorage.setItem("aly137ForjaLastSpacePath", pathEspaco);
    localStorage.setItem("aly137ForjaLastSpaceName", String(espacoNome || "").trim());
  }, [espacoNome, oneOwnerPublicaAtivaEfetiva, skinsUsername]);

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
  const podeVerAuditoriaConteudo = false;
  const podeVerAuditoriaRastreaveis = usuarioPodeVerAuditoriaCategoriaProjeto(
    {
      configSistema: configSistemaAtual || configSistemaCacheLocal,
      usuarioUid: currentUidAutenticado || currentUid || "",
      usuarioEmail: authUserAtual?.email || "",
      recursoOwnerUid: ownerUserId || "",
      coCriadoresUids: espacoAtualEfetivo?.coCriadoresUids || [],
    },
    "rastreaveis"
  );
  const abrirAuditoriaEntidade = useCallback(
    ({ entityType = "", entityId = "" } = {}) => {
      const tipo = String(entityType || "").trim();
      const id = String(entityId || "").trim();
      if (!tipo || !id) return;

      const projectSystemKey = String(
        configSistemaAtual?.projectSystemKey || activeFirebaseProjectKey || ""
      )
        .trim()
        .toLowerCase();
      const params = new URLSearchParams({
        entityType: tipo,
        entityId: id,
      });
      if (projectSystemKey) params.set("projectSystemKey", projectSystemKey);
      const skinMenu = String(
        localStorage.getItem("skinLogadoUser") || skinsUsername || ""
      ).trim();
      const menuBase =
        oneOwnerPublicaAtivaEfetiva && (isOwner || usuarioEhOwnerProjeto)
          ? "/menu/owner"
          : skinMenu
            ? `/menu/${encodeRouteSegment(skinMenu)}`
            : "/menu/gerenciador";
      navigate(`${menuBase}/auditoria?${params.toString()}`);
    },
    [
      configSistemaAtual?.projectSystemKey,
      isOwner,
      navigate,
      oneOwnerPublicaAtivaEfetiva,
      skinsUsername,
      usuarioEhOwnerProjeto,
    ]
  );
  const visibilidadeEspaco = espacoAtualEfetivo?.visibilidade || "publico";
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

  const abrirFichaAddOn = useCallback(
    (addOn = {}) => {
      const addOnId = String(addOn?.id || addOn?.addonId || "").trim();
      if (!addOnId) return;
      setAddOnFichaModal({
        aberto: true,
        addOn: {
          ...addOn,
          id: addOnId,
          aly137Resumo:
            aly137ResumoAddOnsPorId[addOnId] ||
            addOn?.aly137Resumo ||
            null,
        },
      });
    },
    [aly137ResumoAddOnsPorId]
  );

  const abrirFichaCardFragmento = useCallback(
    (cardOrigem = {}) => {
      const cardOrigemId = String(cardOrigem?.cardId || cardOrigem?.id || "").trim();
      const blocoOrigemId = String(cardOrigem?.blocoId || "").trim();
      const espacoOrigemNome = String(cardOrigem?.espacoNome || espacoNome || "").trim();
      const cardOrigemRota =
        cardOrigemId && blocoOrigemId && espacoOrigemNome
          ? oneOwnerPublicaAtivaEfetiva
            ? `/${encodeRouteSegment(espacoOrigemNome)}/card/${encodeRouteSegment(blocoOrigemId)}/${encodeRouteSegment(cardOrigemId)}`
            : skinsUsername
              ? `/${encodeRouteSegment(skinsUsername)}/${encodeRouteSegment(espacoOrigemNome)}/card/${encodeRouteSegment(blocoOrigemId)}/${encodeRouteSegment(cardOrigemId)}`
              : ""
          : "";
      const xpTotal = Number(cardOrigem?.xpTotal || 0);
      const progressoNivel = calcularNivelCardAly137(xpTotal);
      const addOnIdsCard = normalizarAddOnIds([
        ...(Array.isArray(cardOrigem?.addOnIdsRelacionados)
          ? cardOrigem.addOnIdsRelacionados
          : Array.isArray(cardOrigem?.addOnIds)
            ? cardOrigem.addOnIds
            : []),
        ...Object.keys(cardOrigem?.addOnsXp || {}),
      ]);
      const addOnsHerdados = addOnIdsCard
        .map((addOnId) => addOnsDisponiveisProjetoPorId[addOnId])
        .filter(Boolean);

      setAddOnFichaModal({
        aberto: true,
        addOn: {
          id: cardOrigemId || `card-fragmento-${Date.now()}`,
          tipoFicha: "cardFragmento",
          nome: String(cardOrigem?.nome || "Card relacionado").trim(),
          descricao: String(
            cardOrigem?.descricaoPrevia || cardOrigem?.descricao || ""
          ).trim(),
          descricaoPrevia: String(
            cardOrigem?.descricaoPrevia || cardOrigem?.descricao || ""
          ).trim(),
          descricaoCompleta: String(
            cardOrigem?.descricaoCompleta ||
              cardOrigem?.descricaoPrevia ||
              cardOrigem?.descricao ||
              ""
          ).trim(),
          imagem: String(cardOrigem?.imagem || "").trim(),
          espacoNome: espacoOrigemNome,
          blocoTitulo: String(cardOrigem?.blocoTitulo || "").trim(),
          cardPreview: {
            cardId: cardOrigemId,
            blocoId: blocoOrigemId,
            nome: String(cardOrigem?.nome || "Card relacionado").trim(),
            descricao: String(cardOrigem?.descricao || "").trim(),
            imagem: String(cardOrigem?.imagem || "").trim(),
            rota: cardOrigemRota,
          },
          subtema: normalizeCyberpinkSubtheme(cardOrigem?.espacoSubtema || espacoAtualEfetivo?.subtema),
          aly137Resumo: {
            xpTotal,
            percentual: progressoNivel.percentual || 0,
            nivelLabel: progressoNivel.label,
            atributos: cardOrigem?.atributos || {},
            addOnsHerdados,
            totalAddOnsDisponiveis: normalizarAddOnIds(cardOrigem?.addOnIdsDisponiveis).length || addOnsHerdados.length,
          },
        },
      });
    },
    [
      addOnsDisponiveisProjetoPorId,
      espacoAtualEfetivo?.subtema,
      espacoNome,
      oneOwnerPublicaAtivaEfetiva,
      skinsUsername,
    ]
  );

  const fecharFichaAddOn = useCallback(() => {
    setAddOnFichaModal({ aberto: false, addOn: null });
  }, []);

  const fecharEditorCard = useCallback(() => {
    setBuscaAddOnEditor("");
    setFiltroTipoAddOnEditor("");
    setEditorCardAba("conteudo");
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
    setEditorCardAba("conteudo");
    setFiltroTipoAddOnEditor("");
    setEditorCardModal((prev) => {
      const previewAnterior = String(prev?.imagemPreviewUrl || "").trim();
      if (previewAnterior.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(previewAnterior);
        } catch {
          // no-op
        }
      }

      const addOnIdsNormalizados = normalizarAddOnIds(card?.addOnIds);
      const aly137Normalizado = normalizarCardAly137(card?.aly137, addOnIdsNormalizados);
      const cardsOrigemKeys = aly137Normalizado.cardsOrigem.map((item) => {
        const keySalva = obterKeyCardOrigemAly137(item);
        if (keySalva.includes(":")) return keySalva;
        return String(`${item.espacoId || espacoId || ""}:${item.blocoId || bloco?.id || ""}:${item.cardId || item.id || ""}`);
      });
      const cardsOrigemAddOnIds = aly137Normalizado.cardsOrigem.reduce((acc, item) => {
        const keySalva = obterKeyCardOrigemAly137(item);
        const key = keySalva.includes(":")
          ? keySalva
          : String(`${item.espacoId || espacoId || ""}:${item.blocoId || bloco?.id || ""}:${item.cardId || item.id || ""}`);
        if (!key) return acc;
        acc[key] = normalizarAddOnIds(item.addOnIdsRelacionados || item.addOnIds);
        return acc;
      }, {});
      const descricaoPrevia = obterDescricaoPreviaCard(card);
      const descricaoCompleta = obterDescricaoCompletaCard(card);
      return criarEstadoEditorCard({
        aberto: true,
        bloco,
        card,
        ehNovo: Boolean(card?.__novo),
        ordem: Number.isFinite(card?.ordem) ? Number(card.ordem) : 0,
        nome: String(card?.nome || "").trim(),
        descricaoExtra: String(card?.descricaoExtra || "").trim(),
        descricaoPrevia,
        descricaoCompleta,
        descricao: descricaoPrevia,
        imagem: String(card?.imagem || "").trim(),
        imagemOriginal: String(card?.imagem || "").trim(),
        imagemPathOriginal: String(card?.imagemPath || "").trim(),
        iconeSvg: String(card?.iconeSvg || card?.iconeAddOnSvg || "").trim(),
        linkExterno: String(card?.linkExterno || "").trim(),
        addOnIds: addOnIdsNormalizados,
        addOnSubthemes: normalizarAddOnSubthemes(card?.addOnSubthemes, addOnIdsNormalizados),
        aly137Evidencias: aly137Normalizado.evidencias,
        aly137CardsOrigemIds: cardsOrigemKeys,
        aly137CardsOrigemAddOnIds: cardsOrigemAddOnIds,
      });
    });
    setBuscaAddOnEditor("");
  }, [espacoId]);

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

  const montarRotaEspacoAtual = useCallback(() => {
    const espacoNomeRota = encodeRouteSegment(espacoNome || "");
    const skinsUsernameRota = encodeRouteSegment(skinsUsername || "");
    if (!espacoNomeRota) return "";
    if (oneOwnerPublicaAtivaEfetiva) return `/${espacoNomeRota}`;
    if (!skinsUsernameRota) return "";
    return `/${skinsUsernameRota}/${espacoNomeRota}`;
  }, [espacoNome, oneOwnerPublicaAtivaEfetiva, skinsUsername]);

  const compartilharUrl = useCallback(async ({ url = "", title = "", text = "" } = {}) => {
    const urlNormalizada = String(url || "").trim();
    if (!urlNormalizada) return false;

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: title || document.title || "Compartilhar",
          text,
          url: urlNormalizada,
        });
        return true;
      } catch (error) {
        if (error?.name === "AbortError") return false;
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(urlNormalizada);
      alert("Link copiado para a area de transferencia.");
      return true;
    }

    if (typeof window !== "undefined") {
      window.prompt("Copie o link:", urlNormalizada);
      return true;
    }

    return false;
  }, []);

  const registrarCompartilhamentoAuditado = useCallback(
    (payload = {}) => {
      void registrarAuditLog(payload).catch((error) => {
        console.warn("Falha ao auditar compartilhamento:", error?.message || error);
      });
    },
    []
  );

  const criarCompartilhamentoRastreavel = useCallback(
    async ({
      destinoUrl = "",
      destinoTipo = "espaco",
      bloco = null,
      card = null,
      descricao = "",
      criadoVia = "compartilhamento_site",
    } = {}) => {
      const destinoUrlNormalizada = String(destinoUrl || "").trim();
      const navigationId = getOrCreateNavigationId();
      if (!destinoUrlNormalizada) {
        return {
          urlRastreavel: "",
          destinoUrl: "",
          trackingId: "",
          rastreavel: false,
          navigationId,
        };
      }

      try {
        const link = await criarLinkRastreavelEspaco({
          ownerUserId,
          espacoId,
          espacoNome,
          skinsUsername,
          destinoUrl: destinoUrlNormalizada,
          destinoTipo,
          targetType: destinoTipo,
          blocoId: bloco?.id || "",
          cardId: card?.id || "",
          descricao,
          origemPlanejada: descricao,
          permissaoCriarLinks: configSistemaAtual?.rastreabilidadeCriarLinksPermissao || "",
          permissaoHistoricoLinks: configSistemaAtual?.rastreabilidadeHistoricoLinksPermissao || "",
          criadoVia,
        });

        return {
          ...link,
          urlRastreavel: link?.urlRastreavel || destinoUrlNormalizada,
          rastreavel: Boolean(link?.trackingId),
          navigationId,
        };
      } catch (error) {
        console.warn("Falha ao criar link rastreavel de compartilhamento:", error?.message || error);
        return {
          urlRastreavel: destinoUrlNormalizada,
          destinoUrl: destinoUrlNormalizada,
          trackingId: "",
          rastreavel: false,
          navigationId,
          erro: error?.message || "Falha ao criar link rastreavel.",
        };
      }
    },
    [
      configSistemaAtual?.rastreabilidadeCriarLinksPermissao,
      configSistemaAtual?.rastreabilidadeHistoricoLinksPermissao,
      espacoId,
      espacoNome,
      ownerUserId,
      skinsUsername,
    ]
  );

  const compartilharCardRastreavel = useCallback(
    async ({ bloco = null, card = null, rota = "" } = {}) => {
      if (!card) return;
      const cardId = String(card?.id || "").trim();
      const rotaCard = String(rota || montarRotaCardDoBloco(bloco, card)).trim();
      const destinoUrl = montarUrlAbsolutaCard(rotaCard);
      const idAcao = `card:${bloco?.id || ""}:${cardId || card?.nome || ""}`;
      if (!destinoUrl || compartilhandoRastreavelId) return;

      setCompartilhandoRastreavelId(idAcao);
      try {
        const link = await criarCompartilhamentoRastreavel({
          destinoUrl,
          destinoTipo: "card",
          bloco,
          card,
          descricao: `Compartilhamento do card ${card?.nome || ""}`.trim(),
          criadoVia: "compartilhamento_card_site",
        });

        const compartilhado = await compartilharUrl({
          url: link.urlRastreavel || destinoUrl,
          title: card?.nome || "Card",
          text: card?.descricaoExtra || card?.descricaoPrevia || card?.descricao || "Acesse este card.",
        });

        if (compartilhado) {
          registrarCompartilhamentoAuditado({
            action: "compartilhou_card",
            entityType: "card",
            entityId: cardId || `${bloco?.id || "bloco"}-card`,
            ownerUserId,
            espacoId,
            espacoNome,
            blocoId: bloco?.id || "",
            cardId,
            source: "card_compartilhar",
            metadata: {
              auditCategory: "rastreaveis",
              navigationId: link.navigationId,
              trackingId: link.trackingId || null,
              linkRastreavel: link.rastreavel === true,
              destinoUrl,
              urlCompartilhada: link.urlRastreavel || destinoUrl,
              autenticado: Boolean(currentUidAutenticado),
            },
          });
        }
      } finally {
        setCompartilhandoRastreavelId("");
      }
    },
    [
      compartilhandoRastreavelId,
      criarCompartilhamentoRastreavel,
      currentUidAutenticado,
      espacoId,
      espacoNome,
      montarRotaCardDoBloco,
      montarUrlAbsolutaCard,
      ownerUserId,
      registrarCompartilhamentoAuditado,
      compartilharUrl,
    ]
  );

  const abrirPreviewImpressaoCard = useCallback(
    ({ bloco = null, card = null, imagem = "", addOns = [], rota = "" } = {}) => {
      if (!card) return;
      const rotaCard = String(rota || montarRotaCardDoBloco(bloco, card)).trim();
      const urlCard = montarUrlAbsolutaCard(rotaCard);

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
          qrStatus: "direto",
          qrErro: "",
          criandoQr: false,
          descricaoRegistro: "",
        })
      );
    },
    [montarRotaCardDoBloco, montarUrlAbsolutaCard]
  );

  const moverAddOnEditorCard = useCallback((addOnId = "", direcao = 0) => {
    const addOnIdNormalizado = String(addOnId || "").trim();
    const deslocamento = Number(direcao) || 0;
    if (!addOnIdNormalizado || !deslocamento) return;

    setEditorCardModal((prev) => {
      const ids = normalizarAddOnIds(prev?.addOnIds);
      const indiceAtual = ids.indexOf(addOnIdNormalizado);
      const proximoIndice = indiceAtual + deslocamento;
      if (indiceAtual < 0 || proximoIndice < 0 || proximoIndice >= ids.length) return prev;

      const proximosIds = [...ids];
      const itemMovido = proximosIds[indiceAtual];
      proximosIds[indiceAtual] = proximosIds[proximoIndice];
      proximosIds[proximoIndice] = itemMovido;
      return {
        ...prev,
        addOnIds: proximosIds,
      };
    });
  }, []);

  const duplicarCardDoBloco = useCallback(
    (bloco = null, card = {}) => {
      if (!podeGerenciar || !bloco?.id || !card) return;

      const cardsDoBloco = normalizarCardsDoBloco(bloco?.cards);
      const novoId = gerarIdCardTemporario();
      abrirEditorCardDoBloco(bloco, {
        ...card,
        id: novoId,
        __novo: true,
        ordem: cardsDoBloco.length,
        nome: `${String(card?.nome || "Card").trim() || "Card"} copia`,
        imagemPath: "",
      });
    },
    [abrirEditorCardDoBloco, podeGerenciar]
  );

  const adicionarEvidenciaAly137Editor = useCallback(() => {
    setEditorCardModal((prev) => {
      const addOnIdsValidos = normalizarAddOnIds(prev?.addOnIds);
      return {
        ...prev,
        aly137Evidencias: [
          ...(Array.isArray(prev?.aly137Evidencias) ? prev.aly137Evidencias : []),
          criarEvidenciaAly137Padrao(addOnIdsValidos),
        ],
      };
    });
  }, []);

  const adicionarConclusaoNivelAly137Editor = useCallback(() => {
    if (!conclusaoNivelAly137EditorCard.disponivel) return;
    const agoraIso = new Date().toISOString();
    const nivelAlvo = conclusaoNivelAly137EditorCard.nivelAlvo;
    const conclusaoEtapa = conclusaoNivelAly137EditorCard.conclusaoEtapa;
    const xpFaltante = conclusaoNivelAly137EditorCard.xpFaltante;
    const xpAlvo = conclusaoNivelAly137EditorCard.xpAlvo;
    const xpAtual = conclusaoNivelAly137EditorCard.xpAtual;

    setEditorCardModal((prev) => {
      const evidenciasAtuais = Array.isArray(prev?.aly137Evidencias) ? prev.aly137Evidencias : [];
      const jaExiste = evidenciasAtuais.some(
        (evidencia) =>
          String(evidencia?.tipo || "").trim() === "conclusao_nivel" &&
          Number(evidencia?.nivelAlvo || 0) === nivelAlvo &&
          String(evidencia?.conclusaoEtapa || "").trim() === conclusaoEtapa
      );
      if (jaExiste) return prev;

      return {
        ...prev,
        aly137Evidencias: [
          ...evidenciasAtuais,
          {
            id: `conclusao_${conclusaoEtapa}_${nivelAlvo}_${Date.now()}`,
            tipo: "conclusao_nivel",
            titulo:
              conclusaoEtapa === "formacao"
                ? "Conclusao da formacao do card"
                : `Conclusao do nivel ${nivelAlvo}`,
            descricao: `Evidencia de fechamento automatico: +${xpFaltante} XP para alcancar ${xpAlvo} XP.`,
            peso: "pequeno",
            xpManual: xpFaltante,
            xpCalculadoAutomaticamente: true,
            conclusaoEtapa,
            nivelAlvo,
            xpAlvo,
            xpAntesConclusao: xpAtual,
            atributoPrincipal: "",
            atributosSelecionados: [],
            atributosPesos: {},
            atributos: {},
            addOnIds: [],
            criadoEm: agoraIso,
            atualizadoEm: agoraIso,
          },
        ],
      };
    });
  }, [conclusaoNivelAly137EditorCard]);

  const atualizarEvidenciaAly137Editor = useCallback((evidenciaId = "", changes = {}) => {
    const idNormalizado = String(evidenciaId || "").trim();
    if (!idNormalizado) return;
    setEditorCardModal((prev) => {
      const addOnIdsValidos = normalizarAddOnIds(prev?.addOnIds);
      return {
        ...prev,
        aly137Evidencias: (Array.isArray(prev?.aly137Evidencias) ? prev.aly137Evidencias : []).map(
          (evidencia, index) =>
            String(evidencia?.id || "") === idNormalizado
              ? {
                  ...evidencia,
                  ...changes,
                  addOnIds: normalizarAddOnIds(changes?.addOnIds || evidencia?.addOnIds).filter((addOnId) =>
                    addOnIdsValidos.includes(addOnId)
                  ),
                  atualizadoEm: new Date().toISOString(),
                }
              : evidencia
        ),
      };
    });
  }, []);

  const removerEvidenciaAly137Editor = useCallback((evidenciaId = "") => {
    const idNormalizado = String(evidenciaId || "").trim();
    if (!idNormalizado) return;
    setEditorCardModal((prev) => ({
      ...prev,
      aly137Evidencias: (Array.isArray(prev?.aly137Evidencias) ? prev.aly137Evidencias : []).filter(
        (evidencia) => String(evidencia?.id || "") !== idNormalizado
      ),
    }));
  }, []);

  const alternarAddOnEvidenciaAly137Editor = useCallback((evidenciaId = "", addOnId = "") => {
    const idNormalizado = String(evidenciaId || "").trim();
    const addOnNormalizado = String(addOnId || "").trim();
    if (!idNormalizado || !addOnNormalizado) return;

    setEditorCardModal((prev) => ({
      ...prev,
      aly137Evidencias: (Array.isArray(prev?.aly137Evidencias) ? prev.aly137Evidencias : []).map((evidencia) => {
        if (String(evidencia?.id || "") !== idNormalizado) return evidencia;
        const atuais = normalizarAddOnIds(evidencia?.addOnIds);
        const proximos = atuais.includes(addOnNormalizado)
          ? atuais.filter((id) => id !== addOnNormalizado)
          : [...atuais, addOnNormalizado];
        return {
          ...evidencia,
          addOnIds: proximos,
          atualizadoEm: new Date().toISOString(),
        };
      }),
    }));
  }, []);

  const alternarAtributoEvidenciaAly137Editor = useCallback((evidenciaId = "", atributoKey = "") => {
    const idNormalizado = String(evidenciaId || "").trim();
    const atributoNormalizado = String(atributoKey || "").trim().toLowerCase();
    if (!idNormalizado || !atributoNormalizado) return;

    setEditorCardModal((prev) => ({
      ...prev,
      aly137Evidencias: (Array.isArray(prev?.aly137Evidencias) ? prev.aly137Evidencias : []).map((evidencia) => {
        if (String(evidencia?.id || "") !== idNormalizado) return evidencia;
        const selecionadosSalvos = normalizarAtributosSelecionadosAly137(evidencia?.atributosSelecionados);
        const selecionadosLegados = normalizarAtributosSelecionadosAly137(
          evidencia?.atributoPrincipal ? [evidencia.atributoPrincipal] : []
        );
        const selecionadosPorValor = normalizarAtributosSelecionadosAly137(
          Object.entries(evidencia?.atributos || {})
            .filter(([, valor]) => Number(valor) > 0)
            .map(([atributo]) => atributo)
        );
        const atuais = selecionadosSalvos.length
          ? selecionadosSalvos
          : selecionadosLegados.length
            ? selecionadosLegados
            : selecionadosPorValor;
        const proximos = atuais.includes(atributoNormalizado)
          ? atuais.filter((item) => item !== atributoNormalizado)
          : [...atuais, atributoNormalizado];
        const pesosAtuais =
          evidencia?.atributosPesos && typeof evidencia.atributosPesos === "object"
            ? evidencia.atributosPesos
            : {};
        const atributosPesos = proximos.reduce((acc, atributo) => {
          acc[atributo] = normalizarPesoEvidenciaAly137(
            pesosAtuais[atributo] || evidencia?.peso || "pequeno"
          );
          return acc;
        }, {});
        const atributos = proximos.reduce((acc, atributo) => {
          acc[atributo] = calcularXpPorPesoAly137(atributosPesos[atributo]);
          return acc;
        }, {});

        return {
          ...evidencia,
          atributoPrincipal: proximos[0] || "",
          atributosSelecionados: proximos,
          atributosPesos,
          atributos,
          atualizadoEm: new Date().toISOString(),
        };
      }),
    }));
  }, []);

  const atualizarPesoAtributoEvidenciaAly137Editor = useCallback(
    (evidenciaId = "", atributoKey = "", peso = "pequeno") => {
      const idNormalizado = String(evidenciaId || "").trim();
      const atributoNormalizado = String(atributoKey || "").trim().toLowerCase();
      if (!idNormalizado || !atributoNormalizado) return;

      setEditorCardModal((prev) => ({
        ...prev,
        aly137Evidencias: (Array.isArray(prev?.aly137Evidencias) ? prev.aly137Evidencias : []).map((evidencia) => {
          if (String(evidencia?.id || "") !== idNormalizado) return evidencia;
          const selecionados = normalizarAtributosSelecionadosAly137(
            evidencia?.atributosSelecionados ||
              (evidencia?.atributoPrincipal ? [evidencia.atributoPrincipal] : [])
          );
          const atributosSelecionados = selecionados.includes(atributoNormalizado)
            ? selecionados
            : [...selecionados, atributoNormalizado];
          const atributosPesos = {
            ...(evidencia?.atributosPesos && typeof evidencia.atributosPesos === "object"
              ? evidencia.atributosPesos
              : {}),
            [atributoNormalizado]: normalizarPesoEvidenciaAly137(peso),
          };
          const atributos = atributosSelecionados.reduce((acc, atributo) => {
            acc[atributo] = calcularXpPorPesoAly137(atributosPesos[atributo] || evidencia?.peso);
            return acc;
          }, {});

          return {
            ...evidencia,
            atributoPrincipal: atributosSelecionados[0] || "",
            atributosSelecionados,
            atributosPesos,
            atributos,
            atualizadoEm: new Date().toISOString(),
          };
        }),
      }));
    },
    []
  );

  const alternarCardOrigemForjaEditor = useCallback((cardKey = "") => {
    const keyNormalizada = String(cardKey || "").trim();
    if (!keyNormalizada) return;
    setEditorCardModal((prev) => {
      const atuais = Array.isArray(prev?.aly137CardsOrigemIds)
        ? prev.aly137CardsOrigemIds.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
      const mapaAtual =
        prev?.aly137CardsOrigemAddOnIds && typeof prev.aly137CardsOrigemAddOnIds === "object"
          ? prev.aly137CardsOrigemAddOnIds
          : {};
      const estaMarcado = atuais.includes(keyNormalizada);
      const proximos = estaMarcado
        ? atuais.filter((item) => item !== keyNormalizada)
        : [...atuais, keyNormalizada];
      const { [keyNormalizada]: _removido, ...mapaSemCard } = mapaAtual;
      const cardOrigem = cardsDisponiveisForjaEditor.find((item) => item.key === keyNormalizada);
      const addOnIdsDisponiveis = obterAddOnIdsDisponiveisCardOrigemAly137(cardOrigem);
      return {
        ...prev,
        aly137CardsOrigemIds: proximos,
        aly137CardsOrigemAddOnIds: estaMarcado
          ? mapaSemCard
          : {
              ...mapaAtual,
              [keyNormalizada]: addOnIdsDisponiveis,
            },
      };
    });
  }, [cardsDisponiveisForjaEditor]);

  const alternarAddOnCardOrigemForjaEditor = useCallback((cardKey = "", addOnId = "") => {
    const keyNormalizada = String(cardKey || "").trim();
    const addOnNormalizado = String(addOnId || "").trim();
    if (!keyNormalizada || !addOnNormalizado) return;

    setEditorCardModal((prev) => {
      const selecionados = Array.isArray(prev?.aly137CardsOrigemIds)
        ? prev.aly137CardsOrigemIds.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
      if (!selecionados.includes(keyNormalizada)) return prev;

      const cardOrigem = cardsDisponiveisForjaEditor.find((item) => item.key === keyNormalizada);
      const addOnIdsDisponiveis = obterAddOnIdsDisponiveisCardOrigemAly137(cardOrigem);
      if (!addOnIdsDisponiveis.includes(addOnNormalizado)) return prev;

      const mapaAtual =
        prev?.aly137CardsOrigemAddOnIds && typeof prev.aly137CardsOrigemAddOnIds === "object"
          ? prev.aly137CardsOrigemAddOnIds
          : {};
      const temConfig = Object.prototype.hasOwnProperty.call(mapaAtual, keyNormalizada);
      const atuais = temConfig ? normalizarAddOnIds(mapaAtual[keyNormalizada]) : addOnIdsDisponiveis;
      const proximos = atuais.includes(addOnNormalizado)
        ? atuais.filter((item) => item !== addOnNormalizado)
        : [...atuais, addOnNormalizado];

      return {
        ...prev,
        aly137CardsOrigemAddOnIds: {
          ...mapaAtual,
          [keyNormalizada]: proximos.filter((item) => addOnIdsDisponiveis.includes(item)),
        },
      };
    });
  }, [cardsDisponiveisForjaEditor]);

  const prepararForjaNovoCardEditor = useCallback(() => {
    setEditorCardModal((prev) => {
      if (!prev?.aberto || !prev?.bloco) return prev;
      const cardsDoBloco = normalizarCardsDoBloco(prev.bloco?.cards);
      const origemAtualKey = prev?.card?.id && !prev?.ehNovo
        ? `${espacoId || ""}:${prev.bloco.id}:${prev.card.id}`
        : "";
      const origemAtual = origemAtualKey ? [origemAtualKey] : [];
      const origemSelecionada = Array.isArray(prev?.aly137CardsOrigemIds) ? prev.aly137CardsOrigemIds : [];
      const addOnIdsCardAtual = normalizarAddOnIds(prev?.card?.addOnIds);
      const addOnIdsOrigemAtual = normalizarAddOnIds([
        ...normalizarAddOnIds(prev?.addOnIds),
        ...addOnIdsCardAtual,
        ...Object.keys(prev?.card?.aly137?.addOnsXp || {}),
      ]);
      const addOnSubthemesCardAtual = normalizarAddOnSubthemes(
        prev?.card?.addOnSubthemes,
        addOnIdsCardAtual
      );
      const mapaCardsOrigemAddOnsAtual =
        prev?.aly137CardsOrigemAddOnIds && typeof prev.aly137CardsOrigemAddOnIds === "object"
          ? prev.aly137CardsOrigemAddOnIds
          : {};
      const addOnIdsForjados = normalizarAddOnIds([
        ...normalizarAddOnIds(prev?.addOnIds),
        ...addOnIdsCardAtual,
        ...addOnIdsHerdadosForjaEditor,
      ]);
      return {
        ...prev,
        card: {
          ...(prev.card || {}),
          id: gerarIdCardTemporario(),
          __novo: true,
        },
        ehNovo: true,
        ordem: cardsDoBloco.length,
        nome: `${String(prev?.nome || "Card").trim() || "Card"} / forja`,
        imagemPathOriginal: "",
        addOnIds: addOnIdsForjados,
        addOnSubthemes: normalizarAddOnSubthemes(
          {
            ...addOnSubthemesCardAtual,
            ...addOnSubthemesHerdadosForjaEditor,
            ...(prev?.addOnSubthemes && typeof prev.addOnSubthemes === "object" ? prev.addOnSubthemes : {}),
          },
          addOnIdsForjados
        ),
        aly137CardsOrigemIds: Array.from(new Set([...origemAtual, ...origemSelecionada])),
        aly137CardsOrigemAddOnIds: {
          ...(origemAtualKey ? { [origemAtualKey]: addOnIdsOrigemAtual } : {}),
          ...mapaCardsOrigemAddOnsAtual,
        },
      };
    });
    setEditorCardAba("aly137");
  }, [addOnIdsHerdadosForjaEditor, addOnSubthemesHerdadosForjaEditor, espacoId]);

  const abrirForjaPreviewEditor = useCallback(() => {
    setForjaPreviewModal({ aberto: true });
  }, []);

  const fecharForjaPreviewEditor = useCallback(() => {
    setForjaPreviewModal({ aberto: false });
  }, []);

  const confirmarForjaNovoCardEditor = useCallback(() => {
    prepararForjaNovoCardEditor();
    setForjaPreviewModal({ aberto: false });
  }, [prepararForjaNovoCardEditor]);

  const criarCardDaForjaInventario = useCallback(async () => {
    setForjaInventarioModal((prev) => ({ ...prev, criando: true, erro: "" }));
    try {
      await criarCardForjadoAly137({
        podeGerenciar,
        blocosDestino: blocosCardsDisponiveisForja,
        modal: forjaInventarioModal,
        cardsSelecionados: cardsForjaInventarioSelecionados,
        addOnIdsDiretos: addOnIdsDiretosForjaInventario,
        addOnIdsEfetivos: addOnIdsEfetivosForjaInventario,
        addOnsDisponiveis: addOnsDisponiveisProjeto,
        aly137Habilitado,
        blocos,
        normalizarCardsDoBloco,
        gerarIdCard: gerarIdCardTemporario,
        getBlocoCardDocRef,
        persistirCardsDoBloco,
        espacoId,
        ownerUserId,
        currentUidAutenticado,
        projectId: String(configSistemaAtual?.projectSystemKey || activeFirebaseProjectKey || "").trim(),
        user,
      });
      resetarForjaInventario();
    } catch (err) {
      setForjaInventarioModal((prev) => ({
        ...prev,
        criando: false,
        erro: err?.message || "Falha ao criar card forjado.",
      }));
    }
  }, [
    addOnIdsDiretosForjaInventario,
    addOnIdsEfetivosForjaInventario,
    addOnsDisponiveisProjeto,
    aly137Habilitado,
    blocos,
    blocosCardsDisponiveisForja,
    cardsForjaInventarioSelecionados,
    configSistemaAtual?.projectSystemKey,
    currentUidAutenticado,
    espacoId,
    forjaInventarioModal,
    ownerUserId,
    podeGerenciar,
    resetarForjaInventario,
    user,
  ]);

  const carregarHistoricoQrPrintsCard = useCallback(
    async ({ bloco = null, card = null } = {}) => {
      const blocoIdAtual = String(bloco?.id || "").trim();
      const cardIdAtual = String(card?.id || "").trim();
      if (!ownerUserId || !espacoId || !blocoIdAtual || !cardIdAtual) {
        setQrPrintsHistorico({ loading: false, erro: "", itens: [] });
        return;
      }

      setQrPrintsHistorico((prev) => ({ ...prev, loading: true, erro: "" }));
      try {
        const itens = await listarQrPrintsDoCard({
          ownerUserId,
          espacoId,
          blocoId: blocoIdAtual,
          cardId: cardIdAtual,
        });
        setQrPrintsHistorico({ loading: false, erro: "", itens });
      } catch (error) {
        setQrPrintsHistorico({
          loading: false,
          erro:
            error?.code === "permission-denied"
              ? "Sem permissao para carregar o historico deste QR."
              : error?.message || "Falha ao carregar historico do QR.",
          itens: [],
        });
      }
    },
    [espacoId, ownerUserId]
  );

  const criarQrRastreavelPreviewImpressao = useCallback(async () => {
    const blocoAtual = previewImpressaoCard?.bloco || null;
    const cardAtual = previewImpressaoCard?.card || null;
    const blocoIdAtual = String(blocoAtual?.id || "").trim();
    const cardIdAtual = String(cardAtual?.id || "").trim();
    const rotaCard = String(previewImpressaoCard?.rotaCard || previewImpressaoCard?.rota || "").trim();
    const urlCard = String(previewImpressaoCard?.urlCard || previewImpressaoCard?.url || "").trim();

    const podeCriarQrRastreavel = Boolean(
      podeGerenciar &&
        ownerUserId &&
        espacoId &&
        blocoIdAtual &&
        cardIdAtual &&
        rotaCard &&
        urlCard
    );

    if (!podeCriarQrRastreavel || previewImpressaoCard?.criandoQr) {
      return;
    }

    setPreviewImpressaoCard((prev) => ({
      ...prev,
      criandoQr: true,
      qrStatus: "gerando",
      qrErro: "",
    }));

    try {
      const qrPrint = await criarQrPrintCard({
        ownerUserId,
        espacoId,
        espacoNome,
        skinsUsername,
        oneOwnerPublicaAtiva: oneOwnerPublicaAtivaEfetiva,
        bloco: blocoAtual,
        card: cardAtual,
        rotaCard,
        urlCard,
        descricaoRegistro: previewImpressaoCard?.descricaoRegistro || "",
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
          url: qrPrint.urlQr || prev.urlCard || prev.url,
          qrStatus: qrPrint.printId ? "rastreavel" : "direto",
          qrErro: "",
          criandoQr: false,
          descricaoRegistro: "",
        };
      });
    } catch (error) {
      console.error("Erro ao criar QR rastreavel do card:", error);
      setPreviewImpressaoCard((prev) => ({
        ...prev,
        criandoQr: false,
        qrStatus: prev?.printId ? "rastreavel" : "direto",
        qrErro:
          error?.code === "permission-denied"
            ? "Sem permissao para criar QR rastreavel deste card."
            : error?.message || "Nao foi possivel criar QR rastreavel.",
      }));
    }
  }, [
    espacoId,
    espacoNome,
    oneOwnerPublicaAtivaEfetiva,
    ownerUserId,
    podeGerenciar,
    previewImpressaoCard,
    skinsUsername,
  ]);

  const alternarLeiturasQrPrint = useCallback(
    async (printId = "") => {
      const printIdNormalizado = String(printId || "").trim();
      if (!printIdNormalizado) return;

      const existente = qrPrintLeituras[printIdNormalizado];
      if (existente?.aberto) {
        setQrPrintLeituras((prev) => ({
          ...prev,
          [printIdNormalizado]: {
            ...prev[printIdNormalizado],
            aberto: false,
          },
        }));
        return;
      }

      if (Array.isArray(existente?.itens)) {
        setQrPrintLeituras((prev) => ({
          ...prev,
          [printIdNormalizado]: {
            ...prev[printIdNormalizado],
            aberto: true,
          },
        }));
        return;
      }

      setQrPrintLeituras((prev) => ({
        ...prev,
        [printIdNormalizado]: {
          aberto: true,
          loading: true,
          erro: "",
          itens: [],
        },
      }));

      try {
        const leituras = await listarLeiturasQrPrint(printIdNormalizado);
        setQrPrintLeituras((prev) => ({
          ...prev,
          [printIdNormalizado]: {
            aberto: true,
            loading: false,
            erro: "",
            itens: leituras,
          },
        }));
      } catch (error) {
        setQrPrintLeituras((prev) => ({
          ...prev,
          [printIdNormalizado]: {
            aberto: true,
            loading: false,
            erro:
              error?.code === "permission-denied"
                ? "Sem permissao para carregar as leituras deste QR."
                : error?.message || "Falha ao carregar leituras.",
            itens: [],
          },
        }));
      }
    },
    [qrPrintLeituras]
  );

  const abrirVisualizacaoImpressaoQr = useCallback((printId = "") => {
    const printIdNormalizado = String(printId || "").trim();
    if (!printIdNormalizado) return;
    setPreviewImpressaoPopup({
      aberto: true,
      printId: printIdNormalizado,
    });
  }, []);

  const fecharVisualizacaoImpressaoQr = useCallback(() => {
    setPreviewImpressaoPopup({
      aberto: false,
      printId: "",
    });
  }, []);

  const excluirQrRastreavelPreviewImpressao = useCallback(
    async (printId = "") => {
      const printIdNormalizado = String(printId || "").trim();
      if (!printIdNormalizado || qrPrintExcluindoId) return;

      const confirmado =
        typeof window === "undefined" ||
        window.confirm(
          "Excluir este card rastreavel? O QR sera desativado e deixara de aparecer na lista."
        );
      if (!confirmado) return;

      setQrPrintExcluindoId(printIdNormalizado);
      setQrPrintsHistorico((prev) => ({ ...prev, erro: "" }));

      try {
        await excluirQrPrintCard(printIdNormalizado);

        setQrPrintsHistorico((prev) => ({
          ...prev,
          itens: (Array.isArray(prev.itens) ? prev.itens : []).filter(
            (item) =>
              String(item?.id || item?.printId || "").trim() !== printIdNormalizado
          ),
        }));

        setQrPrintLeituras((prev) => {
          const next = { ...prev };
          delete next[printIdNormalizado];
          return next;
        });

        if (String(previewImpressaoPopup?.printId || "").trim() === printIdNormalizado) {
          fecharVisualizacaoImpressaoQr();
        }

        setPreviewImpressaoCard((prev) => {
          if (String(prev?.printId || "").trim() !== printIdNormalizado) return prev;
          return {
            ...prev,
            printId: "",
            rotaQr: "",
            urlQr: "",
            url: prev?.urlCard || prev?.url || "",
            qrStatus: "direto",
          };
        });
      } catch (error) {
        console.error("Erro ao excluir QR rastreavel do card:", error);
        setQrPrintsHistorico((prev) => ({
          ...prev,
          erro:
            error?.code === "permission-denied"
              ? "Sem permissao para excluir este card rastreavel."
              : error?.message || "Falha ao excluir card rastreavel.",
        }));
      } finally {
        setQrPrintExcluindoId("");
      }
    },
    [fecharVisualizacaoImpressaoQr, previewImpressaoPopup?.printId, qrPrintExcluindoId]
  );

  useEffect(() => {
    if (!previewImpressaoCard.aberto || !previewImpressaoCard.card) {
      setQrPrintsHistorico({ loading: false, erro: "", itens: [] });
      setQrPrintLeituras({});
      return;
    }

    if (!podeGerenciar) {
      setQrPrintsHistorico({ loading: false, erro: "", itens: [] });
      return;
    }

    carregarHistoricoQrPrintsCard({
      bloco: previewImpressaoCard.bloco,
      card: previewImpressaoCard.card,
    });
  }, [
    carregarHistoricoQrPrintsCard,
    podeGerenciar,
    previewImpressaoCard.aberto,
    previewImpressaoCard.bloco,
    previewImpressaoCard.card,
    previewImpressaoCard.printId,
  ]);

  const qrPrintSelecionadoParaImpressao = useMemo(
    () =>
      (Array.isArray(qrPrintsHistorico.itens) ? qrPrintsHistorico.itens : []).find(
        (item) =>
          String(item?.id || "").trim() === String(previewImpressaoPopup?.printId || "").trim()
      ) || null,
    [previewImpressaoPopup?.printId, qrPrintsHistorico.itens]
  );

  const fecharPreviewImpressaoCard = useCallback(() => {
    setPreviewImpressaoCard(criarEstadoPreviewImpressaoCard());
    setPreviewImpressaoPopup({
      aberto: false,
      printId: "",
    });
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
        setLiveChatErro("FaÃ§a login para participar do chat da live.");
      } else {
        setLiveChatErro("");
      }
      return undefined;
    }
    if (!currentUidAutenticado) {
      setLiveChatMensagens([]);
      setLiveChatErro("FaÃ§a login para participar do chat da live.");
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

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    if (params.get("forja") !== "1") return;
    if (!aly137Habilitado || forjaInventarioModal?.aberto) return;
    if (!acessoEspacoResolvido || !podeVerEspaco) return;

    const returnTo = String(params.get("returnTo") || "").trim();
    abrirForjaInventario({ returnTo });
    params.delete("forja");
    params.delete("returnTo");
    const queryRestante = params.toString();
    navigate(`${location.pathname}${queryRestante ? `?${queryRestante}` : ""}`, {
      replace: true,
    });
  }, [
    acessoEspacoResolvido,
    abrirForjaInventario,
    aly137Habilitado,
    forjaInventarioModal?.aberto,
    location.pathname,
    location.search,
    navigate,
    podeVerEspaco,
  ]);

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
    let ativo = true;

    async function carregarCardsFragmentosDaSkin() {
      if (!(editorCardModal?.aberto || forjaInventarioModal?.aberto) || !aly137Habilitado || !ownerUserId) {
        setCardsFragmentosSkin([]);
        setCardsFragmentosSkinLoading(false);
        setErroCardsFragmentosSkin("");
        return;
      }

      const skinIdNormalizado = String(skinIdAtual || "").trim();
      const espacoAtualId = String(espacoId || "").trim();
      const espacosRelacionados = (Array.isArray(espacosLista) ? espacosLista : [])
        .filter((espaco) => {
          const id = String(espaco?.id || espaco?.id_espaco || "").trim();
          if (!id || id === espacoAtualId) return false;
          if (!skinIdNormalizado) return true;
          const skinOwner = String(espaco?.skinOwner || espaco?.id_skin || "").trim();
          const relacionadas = Array.isArray(espaco?.skins_relacionadas)
            ? espaco.skins_relacionadas.map((item) => String(item || "").trim())
            : [];
          return skinOwner === skinIdNormalizado || relacionadas.includes(skinIdNormalizado);
        });

      if (!espacosRelacionados.length) {
        setCardsFragmentosSkin([]);
        setCardsFragmentosSkinLoading(false);
        setErroCardsFragmentosSkin("");
        return;
      }

      setCardsFragmentosSkinLoading(true);
      setErroCardsFragmentosSkin("");

      try {
        const cardsColetados = [];

        for (const espaco of espacosRelacionados) {
          if (!ativo) return;
          const espacoRelacionadoId = String(espaco?.id || espaco?.id_espaco || "").trim();
          if (!espacoRelacionadoId) continue;
          const espacoRelacionadoNome = String(espaco?.nome || espaco?.titulo || espacoRelacionadoId).trim();
          const espacoRelacionadoSubtema = normalizeCyberpinkSubtheme(espaco?.subtema);

          let blocosSnapshot = null;
          const blocosRefs = getBlocosCollectionRefs(ownerUserId, espacoRelacionadoId);
          for (const blocosRef of blocosRefs) {
            try {
              const snap = await getDocs(blocosRef);
              if (!blocosSnapshot || !snap.empty) {
                blocosSnapshot = snap;
              }
              if (!snap.empty) break;
            } catch (err) {
              if (err?.code !== "permission-denied") throw err;
            }
          }

          if (!blocosSnapshot?.empty && blocosSnapshot?.docs?.length) {
            const blocosDaSkin = blocosSnapshot.docs
              .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) }))
              .sort((a, b) => (Number(a?.ordem) || 0) - (Number(b?.ordem) || 0));

            for (const bloco of blocosDaSkin) {
              if (!ativo) return;
              const blocoId = String(bloco?.id || "").trim();
              if (!blocoId) continue;
              let cardsDoBloco = normalizarCardsDoBloco(bloco?.cards);

              if (!cardsDoBloco.length) {
                let cardsSnapshot = null;
                const cardsRefs = getBlocoCardsCollectionRefs(ownerUserId, espacoRelacionadoId, blocoId);
                for (const cardsRef of cardsRefs) {
                  try {
                    const snap = await getDocs(cardsRef);
                    if (!cardsSnapshot || !snap.empty) {
                      cardsSnapshot = snap;
                    }
                    if (!snap.empty) break;
                  } catch (err) {
                    if (err?.code !== "permission-denied") throw err;
                  }
                }

                if (!cardsSnapshot?.empty && cardsSnapshot?.docs?.length) {
                  cardsDoBloco = normalizarCardsDoBloco(
                    cardsSnapshot.docs.map((docSnap) => ({
                      id: docSnap.id,
                      ...(docSnap.data() || {}),
                    }))
                  );
                }
              }

              const blocoTitulo = String(bloco?.titulo || bloco?.nome || blocoId || "Bloco").trim();
              cardsDoBloco.forEach((card) => {
                cardsColetados.push({
                  ...card,
                  key: `${espacoRelacionadoId}:${blocoId}:${card.id}`,
                  id: `${espacoRelacionadoId}:${blocoId}:${card.id}`,
                  cardId: card.id,
                  blocoId,
                  blocoTitulo,
                  espacoId: espacoRelacionadoId,
                  espacoNome: espacoRelacionadoNome,
                  espacoSubtema: espacoRelacionadoSubtema,
                });
              });
            }
          }
        }

        if (!ativo) return;
        setCardsFragmentosSkin(cardsColetados);
        setErroCardsFragmentosSkin("");
      } catch (error) {
        if (!ativo) return;
        setCardsFragmentosSkin([]);
        setErroCardsFragmentosSkin(error?.message || "Falha ao carregar cards da skin.");
      } finally {
        if (ativo) {
          setCardsFragmentosSkinLoading(false);
        }
      }
    }

    void carregarCardsFragmentosDaSkin();

    return () => {
      ativo = false;
    };
  }, [
    aly137Habilitado,
    editorCardModal?.aberto,
    espacoId,
    espacosLista,
    forjaInventarioModal?.aberto,
    ownerUserId,
    skinIdAtual,
  ]);

  useEffect(() => {
    carregarGoogleFontsNoDocumento(googleFontsUrlsProjeto);
  }, [googleFontsUrlsProjeto]);

  const blocosVisiveis = useMemo(
    () => blocos.slice(0, visibleBlocosCount),
    [blocos, visibleBlocosCount]
  );
  const termoBuscaConteudo = normalizarTextoBusca(buscaConteudoEspaco);
  const blocosFiltradosPorBusca = useMemo(() => {
    if (!termoBuscaConteudo || !podeVerEspaco) return [];

    return blocos
      .filter((bloco) => podeVerBloco(bloco))
      .filter((bloco) => {
        const cardsTexto = normalizarCardsDoBloco(bloco?.cards)
          .flatMap((card) => [
            card.nome,
            card.descricaoExtra,
            card.descricaoPrevia,
            card.descricaoCompleta,
            card.descricao,
            card.linkExterno,
          ]);
        const subBlocosTexto = normalizarSubBlocosAddOns(
          bloco?.subBlocos || bloco?.subblocos,
          bloco?.subObjetos || bloco?.subobjetos
        )
          .flatMap((subBloco) => [
            subBloco.titulo,
            ...subBloco.subObjetos.flatMap((subObjeto) => [
              subObjeto.nomeSnapshot,
              subObjeto.descricaoSnapshot,
              subObjeto.addonId,
            ]),
          ]);
        const textoBusca = normalizarTextoBusca(
          [
            bloco?.titulo,
            bloco?.nome,
            bloco?.tipo,
            bloco?.descricao,
            bloco?.conteudo,
            bloco?.visibilidade,
            ...cardsTexto,
            ...subBlocosTexto,
          ].join(" ")
        );
        return textoBusca.includes(termoBuscaConteudo);
      });
  }, [
    blocos,
    compradorPorBloco,
    currentUid,
    isAssinante,
    podeGerenciar,
    podeVerEspaco,
    termoBuscaConteudo,
  ]);
  const blocosParaRenderizar = termoBuscaConteudo ? blocosFiltradosPorBusca : blocosVisiveis;

  const executarBuscaConteudo = useCallback(
    (event = null) => {
      if (event?.preventDefault) event.preventDefault();
      const termoOriginal = String(buscaConteudoEspaco || "").trim();
      const termoNormalizado = normalizarTextoBusca(termoOriginal);
      setBuscaConteudoAuditada(termoNormalizado);
      if (!termoNormalizado) return;

      const navigationId = getOrCreateNavigationId();
      void registrarAuditLog({
        action: "pesquisou_conteudo",
        entityType: "siteSearch",
        entityId: `${espacoId || "espaco"}:${Date.now()}`,
        ownerUserId,
        espacoId,
        espacoNome,
        source: "espaco_busca",
        metadata: {
          auditCategory: "conteudo",
          navigationId,
          termo: termoOriginal,
          termoNormalizado,
          totalResultados: blocosFiltradosPorBusca.length,
          autenticado: Boolean(currentUidAutenticado),
          privacidadeAplicada: true,
        },
      }).catch((error) => {
        console.warn("Falha ao auditar busca do espaco:", error?.message || error);
      });
    },
    [
      blocosFiltradosPorBusca.length,
      buscaConteudoEspaco,
      currentUidAutenticado,
      espacoId,
      espacoNome,
      ownerUserId,
    ]
  );

  useEffect(() => {
    setBuscaConteudoEspaco(buscaConteudoUrl);
    setBuscaConteudoAuditada("");
  }, [buscaConteudoUrl, espacoId]);

  useEffect(() => {
    if (!acessoEspacoResolvido || !podeVerEspaco || !termoBuscaConteudo) return;
    if (buscaConteudoAuditada === termoBuscaConteudo) return;
    executarBuscaConteudo();
  }, [
    acessoEspacoResolvido,
    buscaConteudoAuditada,
    executarBuscaConteudo,
    podeVerEspaco,
    termoBuscaConteudo,
  ]);

  useEffect(() => {
    setVisibleBlocosCount(BLOCOS_PAGE_SIZE);
  }, [espacoId, ownerUserId, blocos.length]);

  useEffect(() => {
    if (termoBuscaConteudo) return undefined;
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
  }, [blocos.length, termoBuscaConteudo, visibleBlocosCount]);

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
        const visibilidadesConsulta = obterVisibilidadesConsultaBlocos({
          podeGerenciar,
          autenticado: Boolean(currentUidAutenticado),
        });
        const consultaColecaoCompletaPermitida = !visibilidadesConsulta;

        for (const blocosRef of blocosRefs) {
          if (consultaColecaoCompletaPermitida) {
            try {
              const snap = await getDocs(blocosRef);
              docs.push(...snap.docs.map((d) => ({ __legacy: false, docSnap: d })));
            } catch (allErr) {
              if (allErr?.code !== "permission-denied") throw allErr;
              await adicionarDocsBlocosPorVisibilidade(
                docs,
                blocosRef,
                VISIBILIDADES_BLOCOS_AUTENTICADO
              );
            }
          } else {
            await adicionarDocsBlocosPorVisibilidade(docs, blocosRef, visibilidadesConsulta);

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
          }

          if (docs.length) break;
        }

        if (!docs.length) {
          if (namespaceAtivoProjeto()) {
            const legacyRootRef = getLegacyBlocosCollectionRef(ownerUserId, espacoId);

            if (consultaColecaoCompletaPermitida) {
              try {
                const legacyRootSnap = await getDocs(legacyRootRef);
                if (legacyRootSnap.docs.length) {
                  await migrarBlocosLegadosRaizParaNamespace(
                    ownerUserId,
                    espacoId,
                    legacyRootSnap.docs
                  );
                  docs.push(
                    ...legacyRootSnap.docs.map((d) => ({ __legacy: false, docSnap: d }))
                  );
                }
              } catch (legacyRootErr) {
                if (legacyRootErr?.code !== "permission-denied") {
                  throw legacyRootErr;
                }
                await adicionarDocsLegadosPorVisibilidade(
                  docs,
                  legacyRootRef,
                  VISIBILIDADES_BLOCOS_AUTENTICADO
                );
              }
            } else {
              await adicionarDocsLegadosPorVisibilidade(
                docs,
                legacyRootRef,
                visibilidadesConsulta
              );
            }

            if (docs.length) {
              try {
                await migrarBlocosLegadosRaizParaNamespace(
                  ownerUserId,
                  espacoId,
                  docs.map((item) => item.docSnap)
                );
              } catch (migracaoErr) {
                if (
                  migracaoErr?.code !== "permission-denied" &&
                  migracaoErr?.code !== "failed-precondition"
                ) {
                  throw migracaoErr;
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

        const lista = ordenarBlocosPorModo([...dedupe.values()], modoOrdenacaoBlocosEspaco);
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
    currentUidAutenticado,
    modoOrdenacaoBlocosEspaco,
    podeGerenciar,
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
    conteudoEspacoBruto.toLowerCase() === PLACEHOLDER_HOME_CONTENT ? "" : DOMPurify.sanitize(conteudoEspacoBruto);

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

  const abrirChatProdutoVenda = async ({ bloco = {}, produto = {} } = {}) => {
    if (configSistemaAtual?.chatHabilitado === false) {
      return { ok: false, message: "Chat desativado neste projeto." };
    }

    if (!currentUidAutenticado) {
      return { ok: false, message: "Faca login para tirar duvidas sobre este produto." };
    }

    const menuBase = resolverMenuBaseUsuario();
    if (!menuBase) {
      return { ok: false, message: `Selecione uma ${nomeSkinSingular} para acessar o chat.` };
    }

    const resultado = await garantirConversaProdutoVenda({
      ownerUserId: ownerUserId || bloco?.ownerUserId || bloco?.criadoPor || "",
      clienteUid: currentUidAutenticado,
      clienteNome: authUserAtual?.displayName || "",
      clienteEmail: authUserAtual?.email || "",
      clienteSkin: localStorage.getItem("skinLogadoUser") || "",
      produto,
      bloco,
      espacoId,
      mensagemInicial: `Ola, tenho uma duvida sobre ${produto?.nome || "este produto"}.`,
    });

    const contactId = String(resultado?.contactId || "").trim();
    const conversationId = String(resultado?.conversationId || "principal").trim();
    if (!contactId) {
      return { ok: false, message: "Nao foi possivel abrir a conversa." };
    }

    navigate(
      `${menuBase}/contatos/${encodeURIComponent(contactId)}/chat/${encodeURIComponent(
        conversationId || "principal"
      )}`
    );

    return { ok: true };
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
      setLiveChatErro("FaÃ§a login para enviar mensagens na live.");
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
      return ordenarBlocosPorModo([...dedupe.values()], modoOrdenacaoBlocosEspaco);
    });

    // Reconsulta apÃ³s breve janela para pegar dados consolidados (rules/indexaÃ§Ãµes).
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

      await updateDoc(blocoRef, limparUndefinedFirestore({
        cards: cardsAtualizados,
        updatedAt: serverTimestamp(),
      }));

      await Promise.all(
        cardsAtualizados.map((card) => {
          const cardRef = getBlocoCardDocRef(bloco, card.id);
          if (!cardRef) return Promise.resolve();
          return setDoc(
            cardRef,
            limparUndefinedFirestore({
              id: card.id,
              ordem: card.ordem,
              nome: card.nome || "",
              descricaoExtra: card.descricaoExtra || "",
              descricaoPrevia: card.descricaoPrevia || "",
              descricaoCompleta: card.descricaoCompleta || card.descricaoPrevia || "",
              descricao: card.descricaoPrevia || card.descricao || "",
              imagem: card.imagem || "",
              imagemPath: card.imagemPath || "",
              linkExterno: card.linkExterno || "",
              addOnIds: normalizarAddOnIds(card.addOnIds),
              addOnSubthemes: normalizarAddOnSubthemes(card.addOnSubthemes, card.addOnIds),
              blocoId: bloco.id,
              espacoId,
              ownerUserId,
              updatedAt: serverTimestamp(),
            }),
            { merge: true }
          );
        })
      );

      setBlocos((prev) =>
        ordenarBlocosPorModo(
          prev.map((item) => (item.id === bloco.id ? { ...item, cards: cardsAtualizados } : item)),
          modoOrdenacaoBlocosEspaco
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
    [espacoId, modoOrdenacaoBlocosEspaco, ownerUserId]
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
        await updateDoc(blocoRef, limparUndefinedFirestore({
          estruturaAddOns: "subblocos_v1",
          subBlocos: subBlocosAtualizados,
          subObjetos: subObjetosAtualizados,
          configAddOns: {
            ...(bloco?.configAddOns || {}),
            layout: "subblocos",
            itemLayout: "grid",
          },
          updatedAt: serverTimestamp(),
        }));

        setBlocos((prev) =>
          ordenarBlocosPorModo(
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
            ),
            modoOrdenacaoBlocosEspaco
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
    [espacoId, modoOrdenacaoBlocosEspaco, ownerUserId]
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
        const payloadFirestore = limparUndefinedFirestore(payload);
        await updateDoc(blocoRef, payloadFirestore);
        setBlocos((prev) =>
          ordenarBlocosPorModo(
            prev.map((item) => (item.id === blocoId ? { ...item, ...payloadFirestore } : item)),
            modoOrdenacaoBlocosEspaco
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
    [blocos, modoOrdenacaoBlocosEspaco, nomeBlocoPlural, nomeBlocoSingular, podeGerenciar]
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

      const payloadFirestore = limparUndefinedFirestore(payload);
      await updateDoc(getBlocoDocRef(bloco), payloadFirestore);

      await registrarAuditLog({
        action: "editou_bloco",
        entityType: "bloco",
        entityId: blocoId,
        ownerUserId,
        espacoId,
        espacoNome,
        blocoId,
        source: "espaco_editor",
        snapshotAntes: bloco,
        snapshotDepois: {
          ...bloco,
          ...payloadFirestore,
        },
      });

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
        ordenarBlocosPorModo(
          prev.map((item) => (item.id === blocoId ? { ...item, ...payload } : item)),
          modoOrdenacaoBlocosEspaco
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
    const descricaoPreviaNova = String(
      editorCardModal?.descricaoPrevia || editorCardModal?.descricao || ""
    ).trim();
    const descricaoCompletaInformada = String(editorCardModal?.descricaoCompleta || "").trim();
    const descricaoCompletaNova = descricaoCompletaInformada
      ? descricaoCompletaInformada.includes(descricaoPreviaNova)
        ? descricaoCompletaInformada
        : [descricaoPreviaNova, descricaoCompletaInformada].filter(Boolean).join("\n\n")
      : descricaoPreviaNova;
    const ordemNova = Number.isFinite(editorCardModal?.ordem)
      ? Number(editorCardModal.ordem)
      : normalizarCardsDoBloco(bloco?.cards).length;
    const imagemAtual = String(editorCardModal?.imagemOriginal || "").trim();
    const imagemPathAtual = String(editorCardModal?.imagemPathOriginal || "").trim();
    const iconeSvgNovo = String(editorCardModal?.iconeSvg || "").trim();
    const linkNovo = String(editorCardModal?.linkExterno || "").trim();
    const addOnIdsNovos = normalizarAddOnIds(addOnIdsEfetivosEditorCard);
    const addOnSubthemesNovos = normalizarAddOnSubthemes(
      addOnSubthemesEfetivosEditorCard,
      addOnIdsNovos
    );
    const aly137Payload = aly137Habilitado
      ? criarPayloadCardAly137({
          evidencias: editorCardModal?.aly137Evidencias,
          cardsOrigem: cardsOrigemSelecionadosEditor,
          validAddOnIds: addOnIdsNovos,
        })
      : card?.aly137?.ativo
        ? card.aly137
        : null;
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
        descricaoPrevia: descricaoPreviaNova,
        descricaoCompleta: descricaoCompletaNova,
        descricao: descricaoPreviaNova,
        imagem: imagemFinal,
        imagemPath: imagemPathFinal,
        iconeSvg: iconeSvgNovo,
        linkExterno: String(linkNovo || "").trim(),
        addOnIds: addOnIdsNovos,
        addOnSubthemes: addOnSubthemesNovos,
        usaAddOnsGerenciador: true,
      };
      if (aly137Payload) {
        payload.aly137 = aly137Payload;
      }
      const payloadFirestore = limparUndefinedFirestore(payload);

      const cardsAtualizadosOrigem = normalizarCardsDoBloco(
        ehNovoCard
          ? [...(Array.isArray(bloco?.cards) ? bloco.cards : []), payloadFirestore]
          : (Array.isArray(bloco?.cards) ? bloco.cards : []).map((cardItem) =>
              String(cardItem?.id || "") === String(card.id) ? { ...cardItem, ...payloadFirestore } : cardItem
            )
      );

      if (ehNovoCard) {
        await setDoc(cardRef, limparUndefinedFirestore({
          ...payloadFirestore,
          blocoId: bloco.id,
          espacoId,
          ownerUserId,
          criadoEm: serverTimestamp(),
        }));
      } else {
        await updateDoc(cardRef, limparUndefinedFirestore({
          ...payloadFirestore,
          updatedAt: serverTimestamp(),
        }));
      }

      const cardsPersistidos = await persistirCardsDoBloco(bloco, cardsAtualizadosOrigem);
      if (aly137Habilitado && ownerUserId) {
        const blocosParaResumoAly137 = (Array.isArray(blocos) ? blocos : []).map((item) =>
          String(item?.id || "") === String(bloco.id)
            ? { ...item, cards: cardsPersistidos }
            : item
        );
        const cardsParaResumoAly137 = blocosParaResumoAly137.flatMap((item) => {
          const blocoResumoId = String(item?.id || "").trim();
          const blocoResumoTitulo = String(item?.titulo || item?.nome || blocoResumoId || "Bloco").trim();
          return normalizarCardsDoBloco(item?.cards).map((cardResumo) => ({
            ...cardResumo,
            blocoId: blocoResumoId,
            blocoTitulo: blocoResumoTitulo,
          }));
        });
        const resumosAddOnsAly137 = calcularResumoAddOnsAly137DeCards({
          cards: cardsParaResumoAly137,
          addOns: addOnsDisponiveisProjeto,
        });

        try {
          await salvarResumoAly137AddOnsUsuarioProjeto({
            ownerUserId,
            resumos: resumosAddOnsAly137,
            atualizadoPorUid: currentUidAutenticado,
          });
          setAddOnsDisponiveisGerenciador((prev) =>
            (Array.isArray(prev) ? prev : []).map((addOn) => {
              const addOnId = String(addOn?.id || "").trim();
              return {
                ...addOn,
                aly137Resumo: resumosAddOnsAly137[addOnId] || addOn?.aly137Resumo || null,
              };
            })
          );
        } catch (err) {
          console.warn("Falha ao sincronizar XP dos add-ons ALY-137:", err?.message || err);
        }
      }
      const actionAuditoriaCard =
        ehNovoCard && aly137Payload?.cardsOrigem?.length
          ? "forjou_card"
          : ehNovoCard
            ? "criou_card"
            : "editou_card";

      await registrarAuditLog({
        action: actionAuditoriaCard,
        entityType: "card",
        entityId: payload.id,
        ownerUserId,
        espacoId,
        espacoNome,
        blocoId: bloco.id,
        cardId: payload.id,
        source: "espaco_editor",
        snapshotAntes: ehNovoCard ? null : card,
        snapshotDepois: {
          ...payload,
          blocoId: bloco.id,
          espacoId,
          ownerUserId,
        },
        metadata: aly137Payload
          ? {
              aly137: {
                xpTotal: aly137Payload.xpTotal,
                nivel: aly137Payload.nivel,
                xpEvidencias: aly137Payload.xpEvidencias,
                xpCardsOrigem: aly137Payload.xpCardsOrigem,
                totalEvidencias: aly137Payload.evidencias?.length || 0,
                totalCardsOrigem: aly137Payload.cardsOrigem?.length || 0,
              },
            }
          : null,
      });
      if (aly137Payload) {
        const evidenciasAntes = Array.isArray(card?.aly137?.evidencias)
          ? card.aly137.evidencias
          : [];
        const evidenciasDepois = Array.isArray(aly137Payload?.evidencias)
          ? aly137Payload.evidencias
          : [];
        const mudouEvidencias =
          JSON.stringify(evidenciasAntes) !== JSON.stringify(evidenciasDepois);

        if (mudouEvidencias) {
          await registrarAuditLog({
            action: ehNovoCard ? "criou_evidencias_card" : "editou_evidencias_card",
            entityType: "card",
            entityId: payload.id,
            ownerUserId,
            espacoId,
            espacoNome,
            blocoId: bloco.id,
            cardId: payload.id,
            source: "aly137_editor",
            snapshotAntes: {
              evidencias: evidenciasAntes,
            },
            snapshotDepois: {
              evidencias: evidenciasDepois,
              xpTotal: aly137Payload.xpTotal,
              atributos: aly137Payload.atributos,
            },
            metadata: {
              auditCategory: "conteudo",
              aly137: true,
              totalEvidenciasAntes: evidenciasAntes.length,
              totalEvidenciasDepois: evidenciasDepois.length,
            },
          });
        }
      }
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

  const excluirQrPrintsDoCardOrigem = async ({ bloco = null, card = null, motivo = "card_removido" } = {}) => {
    const blocoIdAtual = String(bloco?.id || "").trim();
    const cardIdAtual = String(card?.id || "").trim();
    if (!ownerUserId || !espacoId || !blocoIdAtual || !cardIdAtual) return;

    try {
      const prints = await listarQrPrintsDoCard({
        ownerUserId,
        espacoId,
        blocoId: blocoIdAtual,
        cardId: cardIdAtual,
        limite: 100,
      });

      await Promise.all(
        prints
          .map((print) => String(print?.printId || print?.id || "").trim())
          .filter(Boolean)
          .map((printId) => excluirQrPrintCard(printId, { motivo }))
      );
    } catch (err) {
      console.warn("Falha ao desativar QR prints relacionados ao card removido:", err?.message);
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
      await excluirQrPrintsDoCardOrigem({
        bloco,
        card,
        motivo: "card_removido",
      });

      await registrarAuditLog({
        action: ehNovoCard ? "descartou_card_novo" : "excluiu_card",
        entityType: "card",
        entityId: String(card.id),
        ownerUserId,
        espacoId,
        espacoNome,
        blocoId: bloco.id,
        cardId: card.id,
        motivo: ehNovoCard ? "descarte_editor" : "exclusao_manual",
        source: "espaco_editor",
        snapshotAntes: {
          ...card,
          imagemPath: imagemPathAtual || card?.imagemPath || null,
        },
        metadata: {
          cardsRestantes: cardsRestantes.length,
        },
      });

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
        const cardsDoBloco = normalizarCardsDoBloco(bloco?.cards);
        for (const cardItem of cardsDoBloco) {
          await excluirQrPrintsDoCardOrigem({
            bloco,
            card: cardItem,
            motivo: "bloco_removido",
          });
        }

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

      await registrarAuditLog({
        action: "excluiu_bloco",
        entityType: "bloco",
        entityId: bloco.id,
        ownerUserId,
        espacoId,
        espacoNome,
        blocoId: bloco.id,
        motivo: "exclusao_manual",
        source: "espaco_editor",
        snapshotAntes: bloco,
        metadata: {
          totalArquivosRemovidos: allPaths.length,
          totalCardsRemovidos: bloco?.tipo === "cards" ? normalizarCardsDoBloco(bloco?.cards).length : 0,
          legacy: Boolean(bloco.__legacy),
        },
      });

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
        <>
          <CriadorBloco
            onCreate={adicionarBloco}
            espacoAtual={espacoAtual}
            skinIdAtual={skinIdAtual}
            podeCriarOverride={podeGerenciar}
          />
        </>
      )}

      {!!erroBlocos && <p style={{ color: "red" }}>{erroBlocos}</p>}
      {!!erroAcaoBloco && <p style={{ color: "red" }}>{erroAcaoBloco}</p>}

      {!acessoEspacoResolvido && carregamentoAcessoEspacoJSX}

      <RestricaoEspaco
        visivel={acessoEspacoResolvido && !podeVerEspaco}
        avatarUrl={avatarMensagemRestricao}
        mensagem={mensagemRestricaoEspaco}
        estiloMensagem={estiloMensagemRestricaoEspaco}
      />

      {acessoEspacoResolvido && podeVerEspaco && !!conteudoEspaco && (
        <div
          className="espaco-conteudo-html"
          style={{ marginBottom: 20 }}
          dangerouslySetInnerHTML={{ __html: conteudoEspaco }}
        />
      )}

      {acessoEspacoResolvido && podeVerEspaco && termoBuscaConteudo ? (
        <p className="espaco-site-search__summary">
          {`${blocosFiltradosPorBusca.length} resultado(s) visivel(is) para "${buscaConteudoEspaco.trim()}".`}
          {buscaConteudoAuditada === termoBuscaConteudo ? " Busca auditada." : ""}
        </p>
      ) : null}

      {acessoEspacoResolvido &&
        podeVerEspaco &&
        blocosParaRenderizar.map((bloco, blocoIndex) => {
          const blocoEhCards = bloco?.tipo === "cards";
          const blocoEhLive = bloco?.tipo === "live";
          const blocoEhAddOns = bloco?.tipo === "addons";
          const blocoEhVenda = bloco?.tipo === "venda";
          const cardsDoBloco = normalizarCardsDoBloco(bloco?.cards);
          const produtosVenda = Array.isArray(bloco?.produtosVenda)
            ? bloco.produtosVenda
            : Array.isArray(bloco?.produtos)
              ? bloco.produtos
              : [];
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
                  const addOnId = String(subObjeto.addonId || addOnAtual?.id || "").trim();
                  return {
                    ...subObjeto,
                    id: addOnId,
                    addonId: addOnId,
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
                    aly137Resumo:
                      aly137ResumoAddOnsPorId[addOnId] ||
                      addOnAtual?.aly137Resumo ||
                      null,
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

          const imagensParaExibir = blocoEhCards || blocoEhLive || blocoEhAddOns || blocoEhVenda
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
            <BlocoPublicoRenderer
              key={`${bloco.id || "bloco"}-${blocoIndex}`}
              bloco={bloco}
              blocoIndex={blocoIndex}
              tituloBloco={tituloBloco}
              iconeBloco={iconeBloco}
              podeGerenciar={podeGerenciar}
              bloqueado={bloqueado}
              imagensParaExibir={imagensParaExibir}
              abrirModalImagem={abrirModalImagem}
              nomeBlocoSingularCapitalizado={nomeBlocoSingularCapitalizado}
              blocoEhLive={blocoEhLive}
              liveBannerUrl={liveBannerUrl}
              liveInicioMs={liveInicioMs}
              liveFimMs={liveFimMs}
              liveEmAndamento={liveEmAndamento}
              liveAgendada={liveAgendada}
              liveEncerrada={liveEncerrada}
              abrirLiveBloco={abrirLiveBloco}
              blocoEhCards={blocoEhCards}
              cardsDoBloco={cardsDoBloco}
              cardAtivo={cardAtivo}
              indiceCardAtivo={indiceCardAtivo}
              imagensCardsPorBloco={imagensCardsPorBloco}
              isRenderableUrl={isRenderableUrl}
              selecionarCardDoBloco={selecionarCardDoBloco}
              iniciarArrasteCardDoBloco={iniciarArrasteCardDoBloco}
              atualizarArrasteCardDoBloco={atualizarArrasteCardDoBloco}
              finalizarArrasteCardDoBloco={finalizarArrasteCardDoBloco}
              cardArrastePorBloco={cardArrastePorBloco}
              addOnsDisponiveisProjetoPorId={addOnsDisponiveisProjetoPorId}
              normalizarAddOnIds={normalizarAddOnIds}
              normalizarAddOnSubthemes={normalizarAddOnSubthemes}
              montarRotaCardDoBloco={montarRotaCardDoBloco}
              abrirFichaAddOn={abrirFichaAddOn}
              abrirFichaCardFragmento={abrirFichaCardFragmento}
              navigate={navigate}
              abrirEditorBlocoCards={abrirEditorBlocoCards}
              abrirEditorCardDoBloco={abrirEditorCardDoBloco}
              podeVerAuditoriaConteudo={podeVerAuditoriaConteudo}
              abrirAuditoriaEntidade={abrirAuditoriaEntidade}
              podeVerAuditoriaRastreaveis={podeVerAuditoriaRastreaveis}
              abrirPreviewImpressaoCard={abrirPreviewImpressaoCard}
              currentUid={currentUid}
              tipoRestricao={tipoRestricao}
              sessaoChatBloco={sessaoChatBloco}
              abrirChatSessaoBloco={abrirChatSessaoBloco}
              renderCtaRestricao={renderCtaRestricao}
              nomeBlocoSingular={nomeBlocoSingular}
              precoCompradorFormatado={precoCompradorFormatado}
              blocoEhAddOns={blocoEhAddOns}
              blocoEhVenda={blocoEhVenda}
              produtosVenda={produtosVenda}
              ownerUserId={ownerUserId}
              currentUidAutenticado={currentUidAutenticado}
              authUserAtual={authUserAtual}
              abrirChatProdutoVenda={abrirChatProdutoVenda}
              addOnsPorSubBloco={addOnsPorSubBloco}
              normalizarSubtemaAddOnOpcional={normalizarSubtemaAddOnOpcional}
              isSvgAssetUrl={isSvgAssetUrl}
              aly137ResumoAddOnsPorId={aly137ResumoAddOnsPorId}
              excluirBloco={excluirBloco}
              atualizarBloco={atualizarBloco}
              blocoEmAtualizacaoId={blocoEmAtualizacaoId}
              blocoEmExclusaoId={blocoEmExclusaoId}
              imagensEditor={imagensEditor}
              espacoId={espacoId}
            />
          );
        })}

      {acessoEspacoResolvido &&
        podeVerEspaco &&
        !termoBuscaConteudo &&
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
      <Aly137Forja
        modal={forjaInventarioModal}
        setModal={setForjaInventarioModal}
        onClose={fecharForjaInventario}
        blocosDestino={blocosCardsDisponiveisForja}
        cardsInventario={cardsInventarioForjaFiltrados}
        addOnsInventario={addOnsInventarioForjaFiltrados}
        cardsFragmentosSkinLoading={cardsFragmentosSkinLoading}
        addOnIdsDiretos={addOnIdsDiretosForjaInventario}
        cardsSelecionados={cardsForjaInventarioSelecionados}
        addOnsDiretos={addOnsDiretosForjaInventario}
        addOnsPorId={addOnsDisponiveisProjetoPorId}
        resumo={resumoForjaInventario}
        onAdicionarCard={adicionarCardAoInventarioForja}
        onRemoverCard={removerCardDoInventarioForja}
        onAlternarAddOnCard={alternarAddOnCardInventarioForja}
        onAlternarAddOnDireto={alternarAddOnDiretoInventarioForja}
        onDragStartMaterial={iniciarArrasteForjaInventario}
        onDragEndMaterial={finalizarArrasteForjaInventario}
        onDropMaterial={soltarMaterialNaForjaInventario}
        onCriarCard={criarCardDaForjaInventario}
      />
      <EditorBlocoCardsModal
        editorBlocoCardsModal={editorBlocoCardsModal}
        blocoEditorCardsAtual={blocoEditorCardsAtual}
        fecharEditorBlocoCards={fecharEditorBlocoCards}
        cardsEditorBlocoAtual={cardsEditorBlocoAtual}
        abrirEditorCardDoBloco={abrirEditorCardDoBloco}
        gerarIdCardTemporario={gerarIdCardTemporario}
        subObjetosAddOnsEditorBlocoAtual={subObjetosAddOnsEditorBlocoAtual}
        setEditorBlocoCardsModal={setEditorBlocoCardsModal}
        blocoEmAtualizacaoId={blocoEmAtualizacaoId}
        projetoPossuiColecoesIcones={projetoPossuiColecoesIcones}
        parseIconSelectionValue={parseIconSelectionValue}
        iconCollectionsFiltradas={iconCollectionsFiltradas}
        atualizarMetadadosBloco={atualizarMetadadosBloco}
        imagensCardsPorBloco={imagensCardsPorBloco}
        isRenderableUrl={isRenderableUrl}
        setDragCardInfo={setDragCardInfo}
        dragCardInfo={dragCardInfo}
        reordenarCardsDoBloco={reordenarCardsDoBloco}
        cardEmAtualizacaoId={cardEmAtualizacaoId}
        buscaAddOnEditor={buscaAddOnEditor}
        setBuscaAddOnEditor={setBuscaAddOnEditor}
        subBlocosAddOnsEditorBlocoAtual={subBlocosAddOnsEditorBlocoAtual}
        normalizarSubObjetosAddOns={normalizarSubObjetosAddOns}
        persistirSubBlocosAddOnsDoBloco={persistirSubBlocosAddOnsDoBloco}
        addOnsProjetoHabilitados={addOnsProjetoHabilitados}
        blocoAddOnsProjetoHabilitado={blocoAddOnsProjetoHabilitado}
        erroAddOnsGerenciador={erroAddOnsGerenciador}
        addOnsDisponiveisProjeto={addOnsDisponiveisProjeto}
        addOnsEditorFiltrados={addOnsEditorFiltrados}
        normalizarSubtemaAddOnOpcional={normalizarSubtemaAddOnOpcional}
        isSvgAssetUrl={isSvgAssetUrl}
        criarSubObjetoAddOnRef={criarSubObjetoAddOnRef}
        criarSubBlocoAddOns={criarSubBlocoAddOns}
        addOnIdsEditorBlocoAtual={addOnIdsEditorBlocoAtual}
        excluirBloco={excluirBloco}
        blocoEmExclusaoId={blocoEmExclusaoId}
        nomeBlocoSingularCapitalizado={nomeBlocoSingularCapitalizado}
      />
        <EditorCardModal
          editorCardModal={editorCardModal}
          editorCardAba={editorCardAba}
        setEditorCardAba={setEditorCardAba}
        setEditorCardModal={setEditorCardModal}
        fecharEditorCard={fecharEditorCard}
        aly137Habilitado={aly137Habilitado}
        selecionarArquivoImagem={selecionarArquivoImagem}
        imagemPreviewEditorCard={imagemPreviewEditorCard}
        addOnIdsEfetivosEditorCard={addOnIdsEfetivosEditorCard}
        cardsOrigemSelecionadosEditor={cardsOrigemSelecionadosEditor}
        isSvgAssetUrl={isSvgAssetUrl}
        normalizarAddOnSubthemes={normalizarAddOnSubthemes}
          addOnSubthemesEfetivosEditorCard={addOnSubthemesEfetivosEditorCard}
          addOnIdsHerdadosForjaEditor={addOnIdsHerdadosForjaEditor}
        formatarTipoAddOn={formatarTipoAddOn}
        resolverTipoAddOn={resolverTipoAddOn}
        moverAddOnEditorCard={moverAddOnEditorCard}
        normalizarAddOnIds={normalizarAddOnIds}
        obterAddOnIdsDisponiveisCardOrigemAly137={obterAddOnIdsDisponiveisCardOrigemAly137}
        addOnsDisponiveisProjetoPorId={addOnsDisponiveisProjetoPorId}
        alternarCardOrigemForjaEditor={alternarCardOrigemForjaEditor}
        alternarAddOnCardOrigemForjaEditor={alternarAddOnCardOrigemForjaEditor}
        buscaAddOnEditor={buscaAddOnEditor}
        setBuscaAddOnEditor={setBuscaAddOnEditor}
        filtroTipoAddOnEditor={filtroTipoAddOnEditor}
        setFiltroTipoAddOnEditor={setFiltroTipoAddOnEditor}
        tiposAddOnsEditor={tiposAddOnsEditor}
        addOnsProjetoHabilitados={addOnsProjetoHabilitados}
        erroAddOnsGerenciador={erroAddOnsGerenciador}
        addOnsDisponiveisProjeto={addOnsDisponiveisProjeto}
        addOnsEditorFiltrados={addOnsEditorFiltrados}
        cardsFragmentosSkinLoading={cardsFragmentosSkinLoading}
        erroCardsFragmentosSkin={erroCardsFragmentosSkin}
        cardsDisponiveisForjaEditor={cardsDisponiveisForjaEditor}
        cardsRelacionaveisEditorFiltrados={cardsRelacionaveisEditorFiltrados}
        resumoAly137EditorCard={resumoAly137EditorCard}
        adicionarEvidenciaAly137Editor={adicionarEvidenciaAly137Editor}
        adicionarConclusaoNivelAly137Editor={adicionarConclusaoNivelAly137Editor}
        conclusaoNivelAly137EditorCard={conclusaoNivelAly137EditorCard}
        removerEvidenciaAly137Editor={removerEvidenciaAly137Editor}
        atualizarEvidenciaAly137Editor={atualizarEvidenciaAly137Editor}
        alternarAtributoEvidenciaAly137Editor={alternarAtributoEvidenciaAly137Editor}
        atualizarPesoAtributoEvidenciaAly137Editor={atualizarPesoAtributoEvidenciaAly137Editor}
        addOnsEfetivosEditorCard={addOnsEfetivosEditorCard}
        alternarAddOnEvidenciaAly137Editor={alternarAddOnEvidenciaAly137Editor}
        abrirForjaPreviewEditor={abrirForjaPreviewEditor}
        montarRotaCardDoBloco={montarRotaCardDoBloco}
        montarUrlAbsolutaCard={montarUrlAbsolutaCard}
        navigate={navigate}
        podeVerAuditoriaConteudo={podeVerAuditoriaConteudo}
        abrirAuditoriaEntidade={abrirAuditoriaEntidade}
        podeVerAuditoriaRastreaveis={podeVerAuditoriaRastreaveis}
        abrirPreviewImpressaoCard={abrirPreviewImpressaoCard}
        erroAcaoBloco={erroAcaoBloco}
        ownerUserId={ownerUserId}
        espacoId={espacoId}
        abrirFichaAddOn={abrirFichaAddOn}
        abrirFichaCardFragmento={abrirFichaCardFragmento}
        espacoAtualEfetivo={espacoAtualEfetivo}
        excluirCardDoBloco={excluirCardDoBloco}
        cardEmAtualizacaoId={cardEmAtualizacaoId}
        salvarEdicaoCardDoBloco={salvarEdicaoCardDoBloco}
      />
      <AddOnFichaModal
        modal={addOnFichaModal}
        onClose={fecharFichaAddOn}
        resolverTipoAddOn={resolverTipoAddOn}
        formatarTipoAddOn={formatarTipoAddOn}
        onNavigateCard={(rota) => navigate(rota)}
      />
      <ForjaPreviewModal
        aberto={forjaPreviewModal.aberto}
        resumo={resumoAly137EditorCard}
        cardsOrigem={cardsOrigemSelecionadosEditor}
        addOnsEfetivos={addOnsEfetivosEditorCard}
        addOnIdsHerdados={addOnIdsHerdadosForjaEditor}
        onClose={fecharForjaPreviewEditor}
        onConfirm={confirmarForjaNovoCardEditor}
      />
      <CardPrintPreviewModal
        previewImpressaoCard={previewImpressaoCard}
        previewImpressaoPopup={previewImpressaoPopup}
        qrPrintsHistorico={qrPrintsHistorico}
        qrPrintLeituras={qrPrintLeituras}
        qrPrintExcluindoId={qrPrintExcluindoId}
        qrPrintSelecionadoParaImpressao={qrPrintSelecionadoParaImpressao}
        podeGerenciar={podeGerenciar}
        ownerUserId={ownerUserId}
        espacoId={espacoId}
        cyberpinkSubtheme={normalizeCyberpinkSubtheme(espacoAtualEfetivo?.subtema)}
        onCloseHistory={fecharPreviewImpressaoCard}
        onRefreshHistory={carregarHistoricoQrPrintsCard}
        onDescricaoRegistroChange={(descricaoRegistro) =>
          setPreviewImpressaoCard((prev) => ({ ...prev, descricaoRegistro }))
        }
        onCreateQr={() => {
          void criarQrRastreavelPreviewImpressao();
        }}
        onOpenPrint={abrirVisualizacaoImpressaoQr}
        onToggleReadings={alternarLeiturasQrPrint}
        onDeleteQr={excluirQrRastreavelPreviewImpressao}
        onClosePrint={fecharVisualizacaoImpressaoQr}
        onAddOnClick={abrirFichaAddOn}
        onCardFragmentClick={abrirFichaCardFragmento}
        formatarDataCurta={formatarDataCurta}
        normalizarAddOnIds={normalizarAddOnIds}
        normalizarAddOnSubthemes={normalizarAddOnSubthemes}
      />

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
