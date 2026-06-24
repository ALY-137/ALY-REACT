import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

import {
  atualizarStatusLinkRastreavelNoGerenciador,
  atualizarStatusQrPrintNoGerenciador,
  criarLinkRastreavelNoGerenciador,
  isManagerQuotaExceededError,
  listarAcessosNoGerenciador,
  listarAcessosLinksRastreaveisNoGerenciador,
  listarLinksRastreaveisNoGerenciador,
  listarLeiturasQrPrintsNoGerenciador,
  listarQrPrintsNoGerenciador,
  marcarAcessosComoLidosNoGerenciador,
  obterConfigAcessosNoGerenciador,
  listarProjetosNoGerenciador,
  removerAcessosNoGerenciador,
  salvarConfigAcessosNoGerenciador,
} from "../../../Sistema/gerenciadorSistemasApi";
import { obterManagerProjectLabel } from "../../../Sistema/configSistema";
import {
  criarQrPrintCard,
} from "../../../Espacos/qrPrintsApi";
import { usuarioPodeRemoverRegistrosAuditaveisProjeto } from "../../../Sistema/modulosPermissoes";
import { useAuth } from "../../../../../hooks/auth/useAuth";
import { seforAdm } from "../../../../Scripts/verificacoes/verificaAdm";
import "./acessos.css";

const GROUP_PAGE_SIZE = 12;
const ACCESS_GROUP_PREVIEW_SIZE = 3;
const ACCESS_QUERY_LIMIT = 100;
const TRACKING_PANEL_TABS = [
  { id: "geral", label: "Visao geral" },
  { id: "links", label: "Links" },
  { id: "cards", label: "Cards QR" },
  { id: "mapa", label: "Mapa" },
  { id: "eventos", label: "Eventos" },
];
const TRACKING_WORLD_REGIONS = [
  {
    key: "america_norte",
    label: "America do Norte",
    shortLabel: "AN",
    path: "M56 78 L96 54 L150 48 L202 58 L240 76 L274 108 L282 142 L252 166 L214 174 L186 164 L158 186 L126 176 L112 150 L86 132 L66 104 Z M176 190 L218 194 L252 214 L292 226 L326 258 L312 274 L276 248 L240 236 L210 216 L176 208 Z M326 44 L384 38 L438 64 L420 88 L360 96 L318 72 Z",
    pulseX: 180,
    pulseY: 104,
    labelX: 108,
    labelY: 206,
  },
  {
    key: "america_sul",
    label: "America do Sul",
    shortLabel: "AS",
    path: "M262 210 L296 220 L324 250 L332 286 L316 324 L294 356 L270 398 L250 382 L232 334 L224 288 L238 244 Z M300 254 L330 272 L340 302 L320 306 L300 282 Z",
    pulseX: 284,
    pulseY: 286,
    labelX: 204,
    labelY: 386,
  },
  {
    key: "europa",
    label: "Europa",
    shortLabel: "EU",
    path: "M410 92 L448 76 L492 82 L524 104 L508 126 L468 126 L446 138 L418 122 Z M454 54 L492 44 L522 66 L510 80 L472 74 Z M388 104 L410 98 L418 114 L398 122 Z",
    pulseX: 472,
    pulseY: 104,
    labelX: 410,
    labelY: 56,
  },
  {
    key: "africa",
    label: "Africa",
    shortLabel: "AF",
    path: "M466 132 L510 130 L544 158 L572 204 L552 244 L538 288 L510 326 L484 318 L462 276 L444 238 L446 182 Z M552 306 L566 330 L548 354 L538 326 Z",
    pulseX: 504,
    pulseY: 224,
    labelX: 454,
    labelY: 358,
  },
  {
    key: "asia",
    label: "Asia",
    shortLabel: "AI",
    path: "M520 82 L586 62 L678 56 L752 72 L816 98 L846 132 L838 170 L800 198 L748 212 L700 204 L652 204 L610 192 L574 168 L548 146 L520 118 Z M618 198 L648 220 L658 252 L642 266 L620 230 Z M692 208 L728 224 L738 260 L706 254 Z M770 214 L806 230 L812 254 L786 260 L768 238 Z M836 154 L872 166 L878 184 L852 190 Z M804 86 L842 88 L860 106 L826 116 Z",
    pulseX: 690,
    pulseY: 130,
    labelX: 672,
    labelY: 248,
  },
  {
    key: "oceania",
    label: "Oceania",
    shortLabel: "OC",
    path: "M752 262 L792 244 L836 250 L872 276 L858 304 L820 322 L780 318 L746 292 Z M884 320 L910 338 L904 354 L878 336 Z M724 240 L760 236 L772 252 L742 258 Z",
    pulseX: 812,
    pulseY: 286,
    labelX: 756,
    labelY: 358,
  },
  {
    key: "antartica",
    label: "Antartica",
    shortLabel: "AT",
    path: "M96 384 L198 366 L322 374 L438 366 L558 362 L676 368 L782 352 L872 360 L922 376 L820 392 L692 386 L592 394 L462 398 L336 390 L218 404 L132 398 Z",
    pulseX: 520,
    pulseY: 382,
    labelX: 470,
    labelY: 414,
  },
];

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeLookupText(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function resolveFirstText(...candidates) {
  for (const candidate of candidates) {
    const value = normalizeText(candidate);
    if (value) return value;
  }

  return "";
}

function resolveGeoText(...candidates) {
  const value = resolveFirstText(...candidates);
  if (value) return value;
  return "--";
}

function joinUnique(values = []) {
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))].join(", ") || "--";
}

function resolveOrigemAcesso(acesso) {
  const hostname = normalizeText(acesso?.hostname).toLowerCase();
  if (!hostname) return "";
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  ) {
    return "localhost";
  }
  return "dominio";
}

function resolveTipoUsuario(acesso) {
  const perfil = normalizeText(acesso?.perfilAcesso).toLowerCase();
  return perfil === "owner" ? "owner" : "viewer";
}

function resolveAccessNavigationId(acesso) {
  return normalizeText(
    acesso?.navigationId || acesso?.visitorHash || acesso?.hash || acesso?.navegacaoHash
  );
}

function resolveAccessIp(acesso) {
  return resolveFirstText(acesso?.ip, acesso?.geo?.ip);
}

function resolveAccessProjectKey(acesso) {
  return normalizeText(acesso?.projectSystemKey || acesso?.runtimeProjectKey).toLowerCase();
}

function resolveTrackableLinkProjectKey(link) {
  return normalizeText(link?.projectSystemKey || link?.runtimeProjectKey).toLowerCase();
}

function resolveTrackableLinkStatus(link = {}) {
  const status = normalizeText(link?.status).toLowerCase();
  const statusExcluido = isDeletedStatusValue(status);
  if (link?.excluido === true || link?.removido === true || link?.deletado === true || link?.ativo === false || statusExcluido) {
    if (status === "pausado" || status === "inativo") return "Pausado";
    if (link?.excluido !== true && !statusExcluido) return "Pausado";
    return "Excluido";
  }
  if (status === "pausado" || status === "inativo") return "Pausado";
  return "Ativo";
}

function isDeletedStatusValue(status = "") {
  return [
    "excluido",
    "excluida",
    "excluído",
    "excluída",
    "deletado",
    "deletada",
    "deleted",
    "removido",
    "removida",
  ].includes(normalizeText(status).toLowerCase());
}

function isTrackableLinkDeleted(link = {}) {
  const status = normalizeText(link?.status).toLowerCase();
  return link?.excluido === true || link?.removido === true || link?.deletado === true || isDeletedStatusValue(status);
}

function isTrackableLinkVisible(link = {}) {
  return !isTrackableLinkDeleted(link);
}

function resolveTrackableLinkId(link = {}) {
  return normalizeText(link?.trackingId || link?.id);
}

function resolveTrackableSpaceLabel(link = {}) {
  return (
    normalizeText(link?.espacoNome) ||
    normalizeText(link?.skinsUsername) ||
    normalizeText(link?.espacoId) ||
    "--"
  );
}

function hasQrPrintSourceIdentity(print = {}) {
  return Boolean(
    normalizeText(print?.ownerUserId) &&
      normalizeText(print?.espacoId) &&
      normalizeText(print?.blocoId) &&
      normalizeText(print?.cardId)
  );
}

function resolveQrPrintStatus(print = {}) {
  const status = normalizeText(print?.status).toLowerCase();
  if (
    print?.excluido === true ||
    print?.removido === true ||
    print?.deletado === true ||
    print?.sourceCardExists === false ||
    print?.sourceCardMissing === true ||
    print?.sourceCardChecked !== true ||
    !hasQrPrintSourceIdentity(print) ||
    print?.ativo === false ||
    isDeletedStatusValue(status)
  ) {
    return "Excluido";
  }
  return "Ativo";
}

function isQrPrintDeleted(print = {}) {
  const status = normalizeText(print?.status).toLowerCase();
  return (
    print?.excluido === true ||
    print?.removido === true ||
    print?.deletado === true ||
    print?.sourceCardExists === false ||
    print?.sourceCardMissing === true ||
    print?.sourceCardChecked !== true ||
    !hasQrPrintSourceIdentity(print) ||
    print?.ativo === false ||
    isDeletedStatusValue(status)
  );
}

function isQrPrintVisible(print = {}) {
  return !isQrPrintDeleted(print);
}

function resolveQrPrintId(print = {}) {
  return normalizeText(print?.printId || print?.id);
}

function resolveQrPrintSpaceLabel(print = {}) {
  return (
    normalizeText(print?.espacoNome) ||
    normalizeText(print?.skinsUsername) ||
    normalizeText(print?.espacoId) ||
    "--"
  );
}

function normalizeIpBloqueio(value) {
  return normalizeText(value).replace(/^::ffff:/, "").toLowerCase();
}

function normalizeUsuarioBloqueio(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  return normalized.includes("@") ? normalized.toLowerCase() : normalized;
}

function normalizarIpsBloqueados(value = []) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((item) => normalizeIpBloqueio(item)).filter(Boolean))
  );
}

function normalizarUsuariosBloqueados(value = []) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((item) => normalizeUsuarioBloqueio(item)).filter(Boolean))
  );
}

function resolveAccessUserLabel(acesso) {
  return (
    normalizeText(acesso?.displayName || acesso?.email || acesso?.uid) ||
    "Visitante"
  );
}

function resolveAccessUserIdentifiers(acesso) {
  return normalizarUsuariosBloqueados([acesso?.uid, acesso?.email]);
}

function isAccessRecordBlockedOrHidden(acesso = {}) {
  const status = normalizeText(acesso?.status || acesso?.estado).toLowerCase();
  return (
    acesso?.registroBloqueado === true ||
    acesso?.bloqueado === true ||
    acesso?.registroOculto === true ||
    acesso?.oculto === true ||
    acesso?.ocultado === true ||
    acesso?.ocultadoNaVisualizacao === true ||
    acesso?.arquivado === true ||
    acesso?.removido === true ||
    acesso?.excluido === true ||
    acesso?.deletado === true ||
    [
      "bloqueado",
      "blocked",
      "oculto",
      "ocultado",
      "hidden",
      "arquivado",
      "archived",
      "removido",
      "excluido",
      "deletado",
      "deleted",
    ].includes(status)
  );
}

function isAccessRecordBlockedByConfig(
  acesso = {},
  ipsBloqueadosSet = new Set(),
  usuariosBloqueadosSet = new Set()
) {
  const ipNormalizado = normalizeIpBloqueio(resolveAccessIp(acesso));
  const usuarios = resolveAccessUserIdentifiers(acesso);
  return (
    Boolean(ipNormalizado && ipsBloqueadosSet.has(ipNormalizado)) ||
    usuarios.some((usuario) => usuariosBloqueadosSet.has(usuario))
  );
}

function isAccessRecordHiddenFromMainView(
  acesso = {},
  ipsBloqueadosSet = new Set(),
  usuariosBloqueadosSet = new Set()
) {
  return (
    isAccessRecordBlockedOrHidden(acesso) ||
    isAccessRecordBlockedByConfig(acesso, ipsBloqueadosSet, usuariosBloqueadosSet)
  );
}

function isAccessRead(acesso = {}) {
  return acesso?.visto === true || acesso?.lido === true || acesso?.statusLeitura === "lido";
}

function formatarUsuarioBloqueio(usuario = "") {
  const normalized = normalizeUsuarioBloqueio(usuario);
  if (!normalized) return "usuario";
  return normalized.includes("@") ? `email ${normalized}` : `uid ${normalized}`;
}

function resolveAccessGeoInfo(acesso = {}) {
  const geo = acesso?.geo && typeof acesso.geo === "object" ? acesso.geo : {};

  return {
    country: resolveFirstText(acesso?.country, acesso?.pais, geo?.country, geo?.pais),
    region: resolveFirstText(acesso?.region, acesso?.regiao, geo?.region, geo?.regiao),
    city: resolveFirstText(acesso?.city, acesso?.cidade, geo?.city, geo?.cidade),
    uf: resolveFirstText(acesso?.uf, acesso?.regionCode, geo?.uf, geo?.regionCode),
    org: resolveFirstText(acesso?.org, geo?.org),
    cep: resolveFirstText(acesso?.cep, geo?.cep),
    source: resolveFirstText(acesso?.geoSource, geo?.source, geo?._geoSource),
    error: resolveFirstText(acesso?.geoError, geo?.error, geo?._geoError),
    latitude: Number.isFinite(Number(acesso?.latitude))
      ? Number(acesso.latitude)
      : (Number.isFinite(Number(geo?.latitude)) ? Number(geo.latitude) : null),
    longitude: Number.isFinite(Number(acesso?.longitude))
      ? Number(acesso.longitude)
      : (Number.isFinite(Number(geo?.longitude)) ? Number(geo.longitude) : null),
  };
}

function formatarData(value) {
  const timestampMs = resolveDataTimestampMs(value);
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return "--";
  return new Date(timestampMs).toLocaleString("pt-BR");
}

function formatarDuracaoMs(value) {
  const durationMs = Number(value);
  if (!Number.isFinite(durationMs) || durationMs < 0) return "--";
  if (durationMs < 1000) return `${Math.round(durationMs)} ms`;

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) return `${seconds}s`;
  if (minutes < 60) return `${minutes}min ${seconds}s`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}min`;
}

function formatarTopLista(items = [], emptyLabel = "--", maxItems = 3) {
  const values = (Array.isArray(items) ? items : []).filter(Boolean).slice(0, maxItems);
  if (!values.length) return emptyLabel;
  return values.join(" | ");
}

function buildTrackingLocationLabel(cityValue = "", countryValue = "") {
  return [cityValue, countryValue].filter((item) => item && item !== "--").join(", ");
}

function resolveTrackingContinent(item = {}) {
  const geoInfo = resolveAccessGeoInfo(item);
  const latitude = geoInfo.latitude;
  const longitude = geoInfo.longitude;

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    if (latitude >= 7 && longitude >= -170 && longitude <= -50) return "america_norte";
    if (latitude <= 15 && latitude >= -60 && longitude >= -92 && longitude <= -30) {
      return "america_sul";
    }
    if (latitude >= 35 && latitude <= 72 && longitude >= -25 && longitude <= 60) return "europa";
    if (latitude >= -35 && latitude <= 38 && longitude >= -20 && longitude <= 55) return "africa";
    if (latitude >= -50 && latitude <= 10 && longitude >= 110 && longitude <= 180) {
      return "oceania";
    }
    if (latitude >= -10 && latitude <= 80 && longitude >= 25 && longitude <= 180) return "asia";
  }

  const country = normalizeLookupText(geoInfo.country);
  if (!country || country === "--") return "";

  if (
    [
      "brasil",
      "brazil",
      "argentina",
      "chile",
      "peru",
      "colombia",
      "colombia",
      "uruguay",
      "paraguay",
      "paraguai",
      "bolivia",
      "equador",
      "ecuador",
      "venezuela",
      "guyana",
      "suriname",
    ].includes(country)
  ) {
    return "america_sul";
  }

  if (
    [
      "united states",
      "estados unidos",
      "usa",
      "canada",
      "mexico",
      "costa rica",
      "guatemala",
      "panama",
      "jamaica",
    ].includes(country)
  ) {
    return "america_norte";
  }

  if (
    [
      "portugal",
      "spain",
      "espanha",
      "france",
      "franca",
      "germany",
      "alemanha",
      "italy",
      "italia",
      "united kingdom",
      "reino unido",
      "netherlands",
      "holanda",
      "belgium",
      "belgica",
      "switzerland",
      "suica",
      "poland",
      "polonia",
      "sweden",
      "suecia",
      "norway",
      "noruega",
      "ukraine",
      "ucrania",
      "romania",
      "greece",
      "grecia",
    ].includes(country)
  ) {
    return "europa";
  }

  if (
    [
      "angola",
      "mozambique",
      "mocambique",
      "south africa",
      "africa do sul",
      "nigeria",
      "egypt",
      "egito",
      "morocco",
      "marrocos",
      "kenya",
      "ethiopia",
      "etioopia",
      "ghana",
      "tunisia",
      "tunisia",
      "algeria",
      "argelia",
    ].includes(country)
  ) {
    return "africa";
  }

  if (
    [
      "china",
      "japan",
      "japao",
      "india",
      "south korea",
      "coreia do sul",
      "north korea",
      "coreia do norte",
      "singapore",
      "indonesia",
      "indonesia",
      "thailand",
      "tailandia",
      "philippines",
      "filipinas",
      "vietnam",
      "pakistan",
      "turkey",
      "turquia",
      "saudi arabia",
      "arabia saudita",
      "israel",
      "united arab emirates",
      "emirados arabes unidos",
    ].includes(country)
  ) {
    return "asia";
  }

  if (
    [
      "australia",
      "new zealand",
      "nova zelandia",
      "fiji",
      "papua new guinea",
      "papua-nova guine",
    ].includes(country)
  ) {
    return "oceania";
  }

  return "";
}

function formatarDiaPainel(value) {
  const timestampMs = resolveDataTimestampMs(value);
  if (!Number.isFinite(timestampMs)) return "--";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(timestampMs));
}

function formatarDiaPainelCompleto(value) {
  const timestampMs = resolveDataTimestampMs(value);
  if (!Number.isFinite(timestampMs)) return "--";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(timestampMs));
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  if (!text) return "";
  if (/[;"\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildAbsolutePanelUrl(route = "") {
  const normalizedRoute = normalizeText(route);
  if (!normalizedRoute || typeof window === "undefined") return normalizedRoute;
  try {
    return new URL(normalizedRoute, window.location.origin).href;
  } catch {
    return normalizedRoute;
  }
}

function buildAbsoluteUrlFromBase(baseUrl = "", route = "") {
  const normalizedRoute = normalizeText(route);
  if (!normalizedRoute) return "";
  const normalizedBase = normalizeText(baseUrl).replace(/\/+$/, "");
  if (!normalizedBase) return buildAbsolutePanelUrl(normalizedRoute);
  try {
    return new URL(normalizedRoute, normalizedBase).href;
  } catch {
    return normalizedRoute;
  }
}

function resolveProjetoOwnerUid(projeto = {}) {
  return normalizeText(
    projeto?.ownerUid ||
      projeto?.adminUid ||
      projeto?.projectOwnerUid ||
      projeto?.configSistema?.ownerUid ||
      projeto?.configSistema?.adminUid ||
      projeto?.configSistema?.projectOwnerUid
  );
}

function resolveProjetoConfigSistema(projeto = {}) {
  const configSistema =
    projeto?.configSistema && typeof projeto.configSistema === "object"
      ? projeto.configSistema
      : {};
  return {
    ...projeto,
    ...configSistema,
  };
}

function resolveRecursoOwnerUid(item = {}) {
  const raw = item?.raw && typeof item.raw === "object" ? item.raw : {};
  return normalizeText(
    item?.ownerUserId ||
      item?.ownerUid ||
      item?.projectOwnerUid ||
      item?.uidOwner ||
      item?.uid ||
      raw?.ownerUserId ||
      raw?.ownerUid ||
      raw?.projectOwnerUid ||
      raw?.uidOwner
  );
}

function resolveCoCriadoresUids(item = {}) {
  const raw = item?.raw && typeof item.raw === "object" ? item.raw : {};
  const candidates = [
    item?.coCriadoresUids,
    item?.coCriadores,
    raw?.coCriadoresUids,
    raw?.coCriadores,
  ];
  return candidates
    .flatMap((candidate) => (Array.isArray(candidate) ? candidate : []))
    .map((value) => normalizeText(typeof value === "string" ? value : value?.uid))
    .filter(Boolean);
}

function resolveProjetoBaseUrl(projeto = {}) {
  const domains = Array.isArray(projeto?.domains) ? projeto.domains : [];
  const firstDomain = domains.map((item) => normalizeText(item)).find(Boolean);
  if (firstDomain) {
    return /^https?:\/\//i.test(firstDomain) ? firstDomain : `https://${firstDomain}`;
  }
  const projectId = normalizeText(
    projeto?.firebaseProjectId || projeto?.firebaseRuntimeConfig?.projectId
  );
  return projectId ? `https://${projectId}.vercel.app` : "";
}

function resolveHistoricoNavigationId(item = {}) {
  return normalizeText(item?.navigationId || item?.visitorHash || item?.hash || item?.navegacaoHash);
}

function buildHistoricoLocalizacao(item = {}) {
  const city = resolveGeoText(item?.city, item?.cidade);
  const country = resolveGeoText(item?.country, item?.pais);
  return buildTrackingLocationLabel(city, country) || "--";
}

function criarEstadoDetalheRastreavel() {
  return {
    aberto: false,
    item: null,
    eventos: [],
    loading: false,
    erro: "",
    mensagem: "",
    filtroDataInicio: "",
    filtroDataFim: "",
    agruparPorNavigationId: true,
    acaoEmAndamento: "",
  };
}

function resolveDataTimestampMs(value) {
  if (!value) return NaN;
  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }
  if (typeof value?.seconds === "number") {
    return new Date(value.seconds * 1000).getTime();
  }
  if (typeof value?._seconds === "number") {
    return new Date(value._seconds * 1000).getTime();
  }
  const timestampMs =
    value instanceof Date
      ? value.getTime()
      : (typeof value === "number" && Number.isFinite(value) ? value : new Date(value).getTime());
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return NaN;
  return timestampMs;
}

function ListaAcessos({ modo = "acessos" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const modoNormalizado = normalizeText(modo).toLowerCase();
  const exibirSomenteRastreabilidade = modoNormalizado === "rastreabilidade";
  const exibirAcessosOperacionais = !exibirSomenteRastreabilidade;
  const exibirPainelRastreabilidade = exibirSomenteRastreabilidade;
  const managerProjectLabel = obterManagerProjectLabel();
  const usuarioEhAdminGerenciador = Boolean(user && seforAdm(user));
  const mountedRef = useRef(true);
  const [acessos, setAcessos] = useState([]);
  const [acessosLinksRastreaveis, setAcessosLinksRastreaveis] = useState([]);
  const [linksRastreaveis, setLinksRastreaveis] = useState([]);
  const [qrPrintsRastreaveis, setQrPrintsRastreaveis] = useState([]);
  const [leiturasQrPrints, setLeiturasQrPrints] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [filtroProjeto, setFiltroProjeto] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState("");
  const [filtroTipoUsuario, setFiltroTipoUsuario] = useState("");
  const [filtroNavigationId, setFiltroNavigationId] = useState("");
  const [filtroIp, setFiltroIp] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroStatusLeitura, setFiltroStatusLeitura] = useState("");
  const [mostrarRegistrosBloqueados, setMostrarRegistrosBloqueados] = useState(false);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [gruposExpandidos, setGruposExpandidos] = useState({});
  const [marcandoLido, setMarcandoLido] = useState(false);
  const [removendoAcessoId, setRemovendoAcessoId] = useState("");
  const [mensagemLeitura, setMensagemLeitura] = useState("");
  const [ipsBloqueadosRegistro, setIpsBloqueadosRegistro] = useState([]);
  const [ipBloqueioInput, setIpBloqueioInput] = useState("");
  const [salvandoBloqueioIp, setSalvandoBloqueioIp] = useState(false);
  const [erroBloqueioIp, setErroBloqueioIp] = useState("");
  const [mensagemBloqueioIp, setMensagemBloqueioIp] = useState("");
  const [usuariosBloqueadosRegistro, setUsuariosBloqueadosRegistro] = useState([]);
  const [usuarioBloqueioInput, setUsuarioBloqueioInput] = useState("");
  const [salvandoBloqueioUsuario, setSalvandoBloqueioUsuario] = useState(false);
  const [erroBloqueioUsuario, setErroBloqueioUsuario] = useState("");
  const [mensagemBloqueioUsuario, setMensagemBloqueioUsuario] = useState("");
  const [carregandoPainelRastreavel, setCarregandoPainelRastreavel] = useState(false);
  const [erroPainelRastreavel, setErroPainelRastreavel] = useState("");
  const [filtroPainelTipo, setFiltroPainelTipo] = useState("");
  const [filtroPainelEspaco, setFiltroPainelEspaco] = useState("");
  const [filtroPainelOrigem, setFiltroPainelOrigem] = useState("");
  const [filtroPainelLocal, setFiltroPainelLocal] = useState("");
  const [abaPainelRastreavel, setAbaPainelRastreavel] = useState("geral");
  const [novoLinkRastreavel, setNovoLinkRastreavel] = useState({
    projectSystemKey: "",
    ownerUserId: "",
    espacoId: "",
    espacoNome: "",
    skinsUsername: "",
    baseUrl: "",
    destinoUrl: "",
    origemPlanejada: "",
  });
  const [salvandoLinkRastreavel, setSalvandoLinkRastreavel] = useState(false);
  const [acaoLinkRastreavelId, setAcaoLinkRastreavelId] = useState("");
  const [mensagemLinkRastreavel, setMensagemLinkRastreavel] = useState("");
  const [erroLinkRastreavel, setErroLinkRastreavel] = useState("");
  const [detalheRastreavel, setDetalheRastreavel] = useState(criarEstadoDetalheRastreavel);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  useEffect(() => {
    let ativo = true;

    listarProjetosNoGerenciador()
      .then((lista) => {
        if (!ativo) return;
        setProjetos(Array.isArray(lista) ? lista : []);
      })
      .catch((error) => {
        console.error("Erro ao carregar projetos para acessos:", error);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const carregarConfigBloqueioAcessos = useCallback(async () => {
    try {
      const configAcessos = await obterConfigAcessosNoGerenciador();
      if (!mountedRef.current) return;
      setIpsBloqueadosRegistro(
        normalizarIpsBloqueados(configAcessos?.ipsBloqueadosRegistro)
      );
      setUsuariosBloqueadosRegistro(
        normalizarUsuariosBloqueados(configAcessos?.usuariosBloqueadosRegistro)
      );
      setErroBloqueioIp("");
      setErroBloqueioUsuario("");
    } catch (error) {
      if (!mountedRef.current) return;
      console.error("Erro ao carregar bloqueios de IP:", error);
      setErroBloqueioIp("Nao foi possivel carregar os IPs bloqueados.");
      setErroBloqueioUsuario("Nao foi possivel carregar os usuarios bloqueados.");
    }
  }, []);

  useEffect(() => {
    void carregarConfigBloqueioAcessos();
  }, [carregarConfigBloqueioAcessos]);

  const salvarIpsBloqueados = useCallback(async (ipsProximos = [], mensagemSucesso = "") => {
    const ipsNormalizados = normalizarIpsBloqueados(ipsProximos);
    const usuariosNormalizados = normalizarUsuariosBloqueados(usuariosBloqueadosRegistro);
    setSalvandoBloqueioIp(true);
    setErroBloqueioIp("");
    setMensagemBloqueioIp("");

    try {
      const resultado = await salvarConfigAcessosNoGerenciador({
        ipsBloqueadosRegistro: ipsNormalizados,
        usuariosBloqueadosRegistro: usuariosNormalizados,
      });
      if (!mountedRef.current) return;
      setIpsBloqueadosRegistro(
        normalizarIpsBloqueados(resultado?.ipsBloqueadosRegistro || ipsNormalizados)
      );
      setUsuariosBloqueadosRegistro(
        normalizarUsuariosBloqueados(
          resultado?.usuariosBloqueadosRegistro || usuariosNormalizados
        )
      );
      setMensagemBloqueioIp(mensagemSucesso || "Bloqueios de IP atualizados.");
    } catch (error) {
      if (!mountedRef.current) return;
      console.error("Erro ao salvar bloqueios de IP:", error);
      setErroBloqueioIp("Nao foi possivel salvar os IPs bloqueados.");
    } finally {
      if (mountedRef.current) {
        setSalvandoBloqueioIp(false);
      }
    }
  }, [usuariosBloqueadosRegistro]);

  const salvarUsuariosBloqueados = useCallback(
    async (usuariosProximos = [], mensagemSucesso = "") => {
      const usuariosNormalizados = normalizarUsuariosBloqueados(usuariosProximos);
      const ipsNormalizados = normalizarIpsBloqueados(ipsBloqueadosRegistro);
      setSalvandoBloqueioUsuario(true);
      setErroBloqueioUsuario("");
      setMensagemBloqueioUsuario("");

      try {
        const resultado = await salvarConfigAcessosNoGerenciador({
          ipsBloqueadosRegistro: ipsNormalizados,
          usuariosBloqueadosRegistro: usuariosNormalizados,
        });
        if (!mountedRef.current) return;
        setIpsBloqueadosRegistro(
          normalizarIpsBloqueados(resultado?.ipsBloqueadosRegistro || ipsNormalizados)
        );
        setUsuariosBloqueadosRegistro(
          normalizarUsuariosBloqueados(
            resultado?.usuariosBloqueadosRegistro || usuariosNormalizados
          )
        );
        setMensagemBloqueioUsuario(
          mensagemSucesso || "Bloqueios de usuario atualizados."
        );
      } catch (error) {
        if (!mountedRef.current) return;
        console.error("Erro ao salvar bloqueios de usuario:", error);
        setErroBloqueioUsuario("Nao foi possivel salvar os usuarios bloqueados.");
      } finally {
        if (mountedRef.current) {
          setSalvandoBloqueioUsuario(false);
        }
      }
    },
    [ipsBloqueadosRegistro]
  );

  const adicionarIpBloqueado = useCallback(
    (ip) => {
      const ipNormalizado = normalizeIpBloqueio(ip);
      if (!ipNormalizado) {
        setErroBloqueioIp("Informe um IP para bloquear.");
        return;
      }

      const proximos = normalizarIpsBloqueados([...ipsBloqueadosRegistro, ipNormalizado]);
      setIpBloqueioInput("");
      void salvarIpsBloqueados(
        proximos,
        `Registro de acessos bloqueado para o IP ${ipNormalizado}.`
      );
    },
    [ipsBloqueadosRegistro, salvarIpsBloqueados]
  );

  const adicionarUsuarioBloqueado = useCallback(
    (usuario) => {
      const usuarioNormalizado = normalizeUsuarioBloqueio(usuario);
      if (!usuarioNormalizado) {
        setErroBloqueioUsuario("Informe um UID ou email para bloquear.");
        return;
      }

      const proximos = normalizarUsuariosBloqueados([
        ...usuariosBloqueadosRegistro,
        usuarioNormalizado,
      ]);
      setUsuarioBloqueioInput("");
      void salvarUsuariosBloqueados(
        proximos,
        `Registro de acessos bloqueado para ${formatarUsuarioBloqueio(
          usuarioNormalizado
        )}.`
      );
    },
    [salvarUsuariosBloqueados, usuariosBloqueadosRegistro]
  );

  const removerUsuarioBloqueado = useCallback(
    (usuario) => {
      const usuarioNormalizado = normalizeUsuarioBloqueio(usuario);
      if (!usuarioNormalizado) return;
      const proximos = usuariosBloqueadosRegistro.filter(
        (item) => item !== usuarioNormalizado
      );
      void salvarUsuariosBloqueados(
        proximos,
        `Registro de acessos liberado para ${formatarUsuarioBloqueio(
          usuarioNormalizado
        )}.`
      );
    },
    [salvarUsuariosBloqueados, usuariosBloqueadosRegistro]
  );

  const removerIpBloqueado = useCallback(
    (ip) => {
      const ipNormalizado = normalizeIpBloqueio(ip);
      if (!ipNormalizado) return;
      const proximos = ipsBloqueadosRegistro.filter((item) => item !== ipNormalizado);
      void salvarIpsBloqueados(
        proximos,
        `Registro de acessos liberado para o IP ${ipNormalizado}.`
      );
    },
    [ipsBloqueadosRegistro, salvarIpsBloqueados]
  );

  const carregarAcessos = useCallback(async () => {
    setCarregando(true);

    try {
      const lista = await listarAcessosNoGerenciador({
        limit: ACCESS_QUERY_LIMIT,
        projectSystemKey: filtroProjeto,
        startDate: filtroDataInicio,
        endDate: filtroDataFim,
      });
      if (!mountedRef.current) return;
      setErro("");
      setAcessos(Array.isArray(lista) ? lista : []);
      setGruposExpandidos({});
      setUltimaAtualizacao(Date.now());
    } catch (error) {
      if (!mountedRef.current) return;
      console.error("Erro ao carregar acessos do gerenciador:", error);
      setErro(
        isManagerQuotaExceededError(error)
          ? "A cota do Firestore foi temporariamente esgotada. Aguarde a renovacao da cota e tente novamente."
          : "Nao foi possivel carregar os acessos."
      );
      setAcessos([]);
    } finally {
      if (mountedRef.current) {
        setCarregando(false);
      }
    }
  }, [filtroDataFim, filtroDataInicio, filtroProjeto]);

  useEffect(() => {
    void carregarAcessos();
  }, [carregarAcessos]);

  const carregarPainelRastreavel = useCallback(async () => {
    setCarregandoPainelRastreavel(true);

    try {
      const [links, acessosLinks, prints, leituras] = await Promise.all([
        listarLinksRastreaveisNoGerenciador({
          limit: 300,
          projectSystemKey: filtroProjeto,
        }).catch((error) => {
          console.error("Erro ao carregar lista de links rastreaveis no painel:", error);
          return [];
        }),
        listarAcessosLinksRastreaveisNoGerenciador({
          limit: 500,
          projectSystemKey: filtroProjeto,
          startDate: filtroDataInicio,
          endDate: filtroDataFim,
        }).catch((error) => {
          console.error("Erro ao carregar acessos de links rastreaveis no gerenciador:", error);
          return [];
        }),
        listarQrPrintsNoGerenciador({
          limit: 300,
          projectSystemKey: filtroProjeto,
        }).catch((error) => {
          console.error("Erro ao carregar QR prints rastreaveis no gerenciador:", error);
          return [];
        }),
        listarLeiturasQrPrintsNoGerenciador({
          limit: 300,
          projectSystemKey: filtroProjeto,
        }).catch((error) => {
          console.error("Erro ao carregar leituras de QR prints no gerenciador:", error);
          return [];
        }),
      ]);
      if (!mountedRef.current) return;
      setErroPainelRastreavel("");
      setLinksRastreaveis(
        Array.isArray(links) ? links.filter((link) => isTrackableLinkVisible(link)) : []
      );
      setAcessosLinksRastreaveis(Array.isArray(acessosLinks) ? acessosLinks : []);
      setQrPrintsRastreaveis(
        Array.isArray(prints) ? prints.filter((print) => isQrPrintVisible(print)) : []
      );
      setLeiturasQrPrints(Array.isArray(leituras) ? leituras : []);
    } catch (error) {
      if (!mountedRef.current) return;
      console.error("Erro ao carregar painel central de rastreabilidade:", error);
      setErroPainelRastreavel("Nao foi possivel carregar o painel central de rastreabilidade.");
      setLinksRastreaveis([]);
      setAcessosLinksRastreaveis([]);
      setQrPrintsRastreaveis([]);
      setLeiturasQrPrints([]);
    } finally {
      if (mountedRef.current) {
        setCarregandoPainelRastreavel(false);
      }
    }
  }, [filtroDataFim, filtroDataInicio, filtroProjeto]);

  useEffect(() => {
    if (!exibirPainelRastreabilidade) return;
    void carregarPainelRastreavel();
  }, [carregarPainelRastreavel, exibirPainelRastreabilidade]);

  const marcarComoLido = useCallback(async (ids = []) => {
    const idsNormalizados = Array.from(
      new Set((Array.isArray(ids) ? ids : []).map((item) => normalizeText(item)).filter(Boolean))
    );
    if (!idsNormalizados.length) return;

    setMarcandoLido(true);
    setMensagemLeitura("");
    setErro("");

    try {
      await marcarAcessosComoLidosNoGerenciador({ ids: idsNormalizados });
      if (!mountedRef.current) return;
      setAcessos((prev) =>
        prev.map((acesso) =>
          idsNormalizados.includes(normalizeText(acesso?.id))
            ? {
                ...acesso,
                visto: true,
                lido: true,
                statusLeitura: "lido",
              }
            : acesso
        )
      );
      setMensagemLeitura(
        idsNormalizados.length === 1
          ? "Acesso marcado como lido."
          : `${idsNormalizados.length} acessos marcados como lidos.`
      );
      window.dispatchEvent(new CustomEvent("acessos-resumo-atualizado"));
    } catch (error) {
      if (!mountedRef.current) return;
      console.error("Erro ao marcar acessos como lidos:", error);
      setErro("Nao foi possivel marcar os acessos como lidos.");
    } finally {
      if (mountedRef.current) {
        setMarcandoLido(false);
      }
    }
  }, []);

  const projetosMap = useMemo(() => {
    const mapa = new Map();
    projetos.forEach((projeto) => {
      const systemKey = normalizeText(projeto?.systemKey).toLowerCase();
      if (!systemKey) return;
      mapa.set(systemKey, projeto);
    });
    return mapa;
  }, [projetos]);

  const usuarioPodeRemoverRegistrosAuditaveis = useCallback(
    (projectSystemKey = "", item = {}) => {
      if (usuarioEhAdminGerenciador) return true;

      const projectKey = normalizeText(projectSystemKey || filtroProjeto).toLowerCase();
      if (!projectKey) return false;

      const projeto = projetosMap.get(projectKey);
      if (!projeto) return false;

      return usuarioPodeRemoverRegistrosAuditaveisProjeto({
        configSistema: resolveProjetoConfigSistema(projeto),
        usuarioUid: user?.uid || "",
        usuarioEmail: user?.email || "",
        recursoOwnerUid: resolveRecursoOwnerUid(item),
        coCriadoresUids: resolveCoCriadoresUids(item),
      });
    },
    [filtroProjeto, projetosMap, user?.email, user?.uid, usuarioEhAdminGerenciador]
  );

  const abrirAuditoriaEntidade = useCallback(
    ({ projectSystemKey = "", entityType = "", entityId = "" } = {}) => {
      const tipo = normalizeText(entityType);
      const id = normalizeText(entityId);
      if (!tipo || !id) return;

      const params = new URLSearchParams({
        entityType: tipo,
        entityId: id,
      });
      const projectKey = normalizeText(projectSystemKey || filtroProjeto).toLowerCase();
      if (projectKey) params.set("projectSystemKey", projectKey);
      navigate(`/menu/gerenciador/auditoria?${params.toString()}`);
    },
    [filtroProjeto, navigate]
  );

  const removerRegistroAcesso = useCallback(
    async (id = "") => {
      const accessId = normalizeText(id);
      if (!accessId) return;

      const acessoAtual = acessos.find((acesso) => normalizeText(acesso?.id) === accessId) || {};
      const projectSystemKey = normalizeText(
        acessoAtual?.projectSystemKey || acessoAtual?.runtimeProjectKey || filtroProjeto
      ).toLowerCase();

      if (!usuarioPodeRemoverRegistrosAuditaveis(projectSystemKey, acessoAtual)) {
        setErro("Sem permissao para remover registros auditaveis deste projeto.");
        return;
      }

      const confirmar = window.confirm(
        "Remover este registro de acesso? Esta acao exclui o evento da lista de auditoria."
      );
      if (!confirmar) return;

      setRemovendoAcessoId(accessId);
      setMensagemLeitura("");
      setErro("");

      try {
        await removerAcessosNoGerenciador({ ids: [accessId] });
        if (!mountedRef.current) return;
        setAcessos((prev) => prev.filter((acesso) => normalizeText(acesso?.id) !== accessId));
        setMensagemLeitura("Registro de acesso removido.");
        window.dispatchEvent(new CustomEvent("acessos-resumo-atualizado"));
      } catch (error) {
        if (!mountedRef.current) return;
        console.error("Erro ao remover acesso:", error);
        setErro("Nao foi possivel remover o registro de acesso.");
      } finally {
        if (mountedRef.current) {
          setRemovendoAcessoId("");
        }
      }
    },
    [acessos, filtroProjeto, usuarioPodeRemoverRegistrosAuditaveis]
  );

  const linksRastreaveisMap = useMemo(() => {
    const mapa = new Map();
    linksRastreaveis.forEach((item) => {
      if (!isTrackableLinkVisible(item)) return;
      const trackingId = resolveTrackableLinkId(item);
      if (!trackingId) return;
      mapa.set(trackingId, item);
    });
    return mapa;
  }, [linksRastreaveis]);

  const qrPrintsRastreaveisMap = useMemo(() => {
    const mapa = new Map();
    qrPrintsRastreaveis.forEach((item) => {
      if (!isQrPrintVisible(item)) return;
      const printId = resolveQrPrintId(item);
      if (!printId) return;
      mapa.set(printId, item);
    });
    return mapa;
  }, [qrPrintsRastreaveis]);

  const opcoesProjeto = useMemo(
    () =>
      projetos
        .map((projeto) => ({
          value: normalizeText(projeto?.systemKey).toLowerCase(),
          label: normalizeText(projeto?.nomeProjeto) || normalizeText(projeto?.systemKey),
        }))
        .filter((item) => item.value)
        .sort((a, b) => a.label.localeCompare(b.label)),
    [projetos]
  );

  const projetoSelecionadoNovoLink = useMemo(() => {
    const projectKey = normalizeText(
      novoLinkRastreavel.projectSystemKey || filtroProjeto
    ).toLowerCase();
    return projectKey ? projetosMap.get(projectKey) || null : null;
  }, [filtroProjeto, novoLinkRastreavel.projectSystemKey, projetosMap]);

  const atualizarCampoNovoLinkRastreavel = useCallback((campo, valor) => {
    setNovoLinkRastreavel((prev) => ({
      ...prev,
      [campo]: valor,
    }));
  }, []);

  const selecionarProjetoNovoLinkRastreavel = useCallback(
    (projectSystemKey = "") => {
      const projectKey = normalizeText(projectSystemKey).toLowerCase();
      const projeto = projetosMap.get(projectKey) || null;
      setNovoLinkRastreavel((prev) => ({
        ...prev,
        projectSystemKey: projectKey,
        ownerUserId: resolveProjetoOwnerUid(projeto) || prev.ownerUserId,
        baseUrl: resolveProjetoBaseUrl(projeto) || prev.baseUrl,
      }));
    },
    [projetosMap]
  );

  const criarLinkRastreavelCentral = useCallback(
    async (event = null) => {
      event?.preventDefault?.();
      const projectSystemKey = normalizeText(
        novoLinkRastreavel.projectSystemKey || filtroProjeto
      ).toLowerCase();
      const payload = {
        projectSystemKey,
        ownerUserId: normalizeText(novoLinkRastreavel.ownerUserId),
        espacoId: normalizeText(novoLinkRastreavel.espacoId),
        espacoNome: normalizeText(novoLinkRastreavel.espacoNome),
        skinsUsername: normalizeText(novoLinkRastreavel.skinsUsername),
        baseUrl:
          normalizeText(novoLinkRastreavel.baseUrl) ||
          resolveProjetoBaseUrl(projetosMap.get(projectSystemKey)),
        destinoUrl: normalizeText(novoLinkRastreavel.destinoUrl),
        descricao: normalizeText(novoLinkRastreavel.origemPlanejada),
        origemPlanejada: normalizeText(novoLinkRastreavel.origemPlanejada),
      };

      if (!payload.projectSystemKey || !payload.ownerUserId || !payload.espacoId || !payload.destinoUrl) {
        setErroLinkRastreavel("Informe projeto, owner UID, espaco ID e URL destino.");
        setMensagemLinkRastreavel("");
        return;
      }

      setSalvandoLinkRastreavel(true);
      setErroLinkRastreavel("");
      setMensagemLinkRastreavel("");

      try {
        const item = await criarLinkRastreavelNoGerenciador(payload);
        if (!mountedRef.current) return;
        if (item) {
          setLinksRastreaveis((prev) => [
            item,
            ...prev.filter(
              (link) => resolveTrackableLinkId(link) !== resolveTrackableLinkId(item)
            ),
          ]);
        }
        setNovoLinkRastreavel((prev) => ({
          ...prev,
          destinoUrl: "",
          origemPlanejada: "",
        }));
        setMensagemLinkRastreavel("Link rastreavel criado no projeto alvo.");
      } catch (error) {
        if (!mountedRef.current) return;
        console.error("Erro ao criar link rastreavel central:", error);
        setErroLinkRastreavel(error?.message || "Nao foi possivel criar o link rastreavel.");
      } finally {
        if (mountedRef.current) {
          setSalvandoLinkRastreavel(false);
        }
      }
    },
    [filtroProjeto, novoLinkRastreavel, projetosMap]
  );

  const copiarLinkRastreavelCentral = useCallback(async (url = "") => {
    const valor = normalizeText(url);
    if (!valor) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(valor);
      }
      if (!mountedRef.current) return;
      setMensagemLinkRastreavel("URL rastreavel copiada.");
      setErroLinkRastreavel("");
    } catch (error) {
      if (!mountedRef.current) return;
      setErroLinkRastreavel(error?.message || "Nao foi possivel copiar a URL.");
    }
  }, []);

  const atualizarStatusLinkRastreavelCentral = useCallback(
    async (link = {}, action = "") => {
      const trackingId = resolveTrackableLinkId(link);
      const projectSystemKey = normalizeText(
        link?.projectSystemKey || link?.runtimeProjectKey || filtroProjeto
      ).toLowerCase();
      const acao = normalizeText(action).toLowerCase();
      if (!trackingId || !projectSystemKey || !acao) return;

      if (acao === "excluir") {
        if (!usuarioPodeRemoverRegistrosAuditaveis(projectSystemKey, link)) {
          setErroLinkRastreavel("Sem permissao para excluir registros auditaveis deste projeto.");
          setMensagemLinkRastreavel("");
          return;
        }

        const confirmado =
          typeof window === "undefined" ||
          window.confirm("Excluir este link rastreavel?");
        if (!confirmado) return;
      }

      setAcaoLinkRastreavelId(`${trackingId}:${acao}`);
      setErroLinkRastreavel("");
      setMensagemLinkRastreavel("");

      try {
        const item = await atualizarStatusLinkRastreavelNoGerenciador({
          trackingId,
          projectSystemKey,
          action: acao,
        });
        if (!mountedRef.current) return;
        if (item) {
          setLinksRastreaveis((prev) => {
            if (acao === "excluir" || isTrackableLinkDeleted(item)) {
              return prev.filter((linkAtual) => resolveTrackableLinkId(linkAtual) !== trackingId);
            }

            return prev.map((linkAtual) =>
              resolveTrackableLinkId(linkAtual) === trackingId
                ? {
                    ...linkAtual,
                    ...item,
                  }
                : linkAtual
            );
          });
        }
        setMensagemLinkRastreavel(
          acao === "ativar"
            ? "Link rastreavel ativado."
            : acao === "pausar"
              ? "Link rastreavel pausado."
              : "Link rastreavel excluido."
        );
      } catch (error) {
        if (!mountedRef.current) return;
        console.error("Erro ao atualizar link rastreavel:", error);
        setErroLinkRastreavel(error?.message || "Nao foi possivel atualizar o link.");
      } finally {
        if (mountedRef.current) {
          setAcaoLinkRastreavelId("");
        }
      }
    },
    [filtroProjeto, usuarioPodeRemoverRegistrosAuditaveis]
  );

  const duplicarLinkRastreavelCentral = useCallback(
    async (link = {}) => {
      const trackingId = resolveTrackableLinkId(link);
      const projectSystemKey = normalizeText(
        link?.projectSystemKey || link?.runtimeProjectKey || filtroProjeto
      ).toLowerCase();
      if (!trackingId || !projectSystemKey) return;

      setAcaoLinkRastreavelId(`${trackingId}:duplicar`);
      setErroLinkRastreavel("");
      setMensagemLinkRastreavel("");

      try {
        let baseUrl = "";
        try {
          baseUrl = new URL(normalizeText(link?.urlRastreavel)).origin;
        } catch {
          baseUrl = resolveProjetoBaseUrl(projetosMap.get(projectSystemKey));
        }

        const item = await criarLinkRastreavelNoGerenciador({
          projectSystemKey,
          ownerUserId: normalizeText(link?.ownerUserId),
          espacoId: normalizeText(link?.espacoId),
          espacoNome: normalizeText(link?.espacoNome),
          skinsUsername: normalizeText(link?.skinsUsername),
          baseUrl,
          destinoUrl: normalizeText(link?.destinoUrl),
          descricao: `${normalizeText(link?.origemPlanejada || link?.descricao) || "Link"} copia`,
          origemPlanejada: `${normalizeText(link?.origemPlanejada || link?.descricao) || "Link"} copia`,
        });
        if (!mountedRef.current) return;
        if (item) {
          setLinksRastreaveis((prev) => [
            item,
            ...prev.filter(
              (linkAtual) => resolveTrackableLinkId(linkAtual) !== resolveTrackableLinkId(item)
            ),
          ]);
        }
        setMensagemLinkRastreavel("Link rastreavel duplicado.");
      } catch (error) {
        if (!mountedRef.current) return;
        console.error("Erro ao duplicar link rastreavel:", error);
        setErroLinkRastreavel(error?.message || "Nao foi possivel duplicar o link.");
      } finally {
        if (mountedRef.current) {
          setAcaoLinkRastreavelId("");
        }
      }
    },
    [filtroProjeto, projetosMap]
  );

  const linksRastreaveisOperacionais = useMemo(() => {
    return [...linksRastreaveis]
      .filter((link) => {
        if (!isTrackableLinkVisible(link)) return false;
        const projectKey = normalizeText(
          link?.projectSystemKey || link?.runtimeProjectKey
        ).toLowerCase();
        const origem = normalizeText(link?.origemPlanejada || link?.descricao);
        const espacoLabel = resolveTrackableSpaceLabel(link);
        if (filtroProjeto && projectKey !== filtroProjeto) return false;
        if (filtroPainelOrigem && origem !== filtroPainelOrigem) return false;
        if (filtroPainelEspaco && espacoLabel !== filtroPainelEspaco) return false;
        return true;
      })
      .sort(
        (a, b) =>
          (resolveDataTimestampMs(b?.atualizadoEm || b?.criadoEm) || 0) -
          (resolveDataTimestampMs(a?.atualizadoEm || a?.criadoEm) || 0)
      )
      .slice(0, 80);
  }, [filtroPainelEspaco, filtroPainelOrigem, filtroProjeto, linksRastreaveis]);

  const ipsBloqueadosSet = useMemo(
    () => new Set(normalizarIpsBloqueados(ipsBloqueadosRegistro)),
    [ipsBloqueadosRegistro]
  );

  const usuariosBloqueadosSet = useMemo(
    () => new Set(normalizarUsuariosBloqueados(usuariosBloqueadosRegistro)),
    [usuariosBloqueadosRegistro]
  );

  const acessosFiltrados = useMemo(() => {
    return acessos.filter((acesso) => {
      const projectKey = resolveAccessProjectKey(acesso);
      const navigationIdAtual = resolveAccessNavigationId(acesso).toLowerCase();
      const ipAtual = resolveAccessIp(acesso).toLowerCase();
      const acessoTimestamp = resolveDataTimestampMs(acesso?.data || acesso?.criadoEm);
      const lido = isAccessRead(acesso);
      if (
        !mostrarRegistrosBloqueados &&
        isAccessRecordHiddenFromMainView(acesso, ipsBloqueadosSet, usuariosBloqueadosSet)
      ) {
        return false;
      }
      if (filtroProjeto && projectKey !== filtroProjeto) return false;
      if (filtroOrigem && resolveOrigemAcesso(acesso) !== filtroOrigem) return false;
      if (filtroTipoUsuario && resolveTipoUsuario(acesso) !== filtroTipoUsuario) return false;
      if (filtroStatusLeitura === "lido" && !lido) return false;
      if (filtroStatusLeitura === "nao-lido" && lido) return false;
      if (filtroNavigationId && !navigationIdAtual.includes(filtroNavigationId.toLowerCase())) {
        return false;
      }
      if (filtroIp && !ipAtual.includes(filtroIp.toLowerCase())) return false;
      if (filtroDataInicio) {
        const dataInicio = new Date(`${filtroDataInicio}T00:00:00`).getTime();
        if (!Number.isFinite(acessoTimestamp) || acessoTimestamp < dataInicio) return false;
      }
      if (filtroDataFim) {
        const dataFim = new Date(`${filtroDataFim}T23:59:59.999`).getTime();
        if (!Number.isFinite(acessoTimestamp) || acessoTimestamp > dataFim) return false;
      }
      return true;
    });
  }, [
    acessos,
    filtroDataFim,
    filtroDataInicio,
    filtroNavigationId,
    filtroIp,
    filtroOrigem,
    filtroProjeto,
    filtroStatusLeitura,
    filtroTipoUsuario,
    ipsBloqueadosSet,
    mostrarRegistrosBloqueados,
    usuariosBloqueadosSet,
  ]);

  const totalRegistrosBloqueadosOcultos = useMemo(
    () =>
      acessos.filter((acesso) =>
        isAccessRecordHiddenFromMainView(acesso, ipsBloqueadosSet, usuariosBloqueadosSet)
      ).length,
    [acessos, ipsBloqueadosSet, usuariosBloqueadosSet]
  );

  const acessosNaoLidosFiltrados = useMemo(
    () => acessosFiltrados.filter((acesso) => !isAccessRead(acesso)),
    [acessosFiltrados]
  );

  const painelRastreabilidadeBase = useMemo(() => {
    const dataInicioMs = filtroDataInicio ? new Date(`${filtroDataInicio}T00:00:00`).getTime() : NaN;
    const dataFimMs = filtroDataFim ? new Date(`${filtroDataFim}T23:59:59.999`).getTime() : NaN;
    const linksMap = new Map();
    const qrPrintsMap = new Map();

    linksRastreaveis.forEach((link) => {
      if (!isTrackableLinkVisible(link)) return;
      const trackingId = resolveTrackableLinkId(link);
      if (!trackingId) return;
      linksMap.set(trackingId, link);
    });

    qrPrintsRastreaveis.forEach((print) => {
      if (!isQrPrintVisible(print)) return;
      const printId = resolveQrPrintId(print);
      if (!printId) return;
      qrPrintsMap.set(printId, print);
    });

    const acessosLinksUnicos = Array.from(
      new Map(
        [...acessosFiltrados, ...acessosLinksRastreaveis]
          .filter((acesso) => normalizeText(acesso?.trackingId))
          .map((acesso) => {
            const trackingId = normalizeText(acesso?.trackingId);
            const dataMs = resolveDataTimestampMs(acesso?.data || acesso?.criadoEm) || 0;
            const accessKey =
              normalizeText(acesso?.id) ||
              [
                trackingId,
                resolveAccessNavigationId(acesso),
                normalizeText(acesso?.path || acesso?.pathname || acesso?.fullPath || acesso?.url),
                String(dataMs),
              ]
                .filter(Boolean)
                .join("|");

            return [`${trackingId}:${accessKey || dataMs}`, acesso];
          })
      ).values()
    );

    const eventosLinks = acessosLinksUnicos
      .map((acesso) => {
        const trackingId = normalizeText(acesso?.trackingId);
        const link = linksMap.get(trackingId) || null;
        if (!link || !isTrackableLinkVisible(link)) return null;
        const projectKey = resolveAccessProjectKey(acesso) || resolveTrackableLinkProjectKey(link);
        const projectLabel =
          normalizeText(projetosMap.get(projectKey)?.nomeProjeto) ||
          projectKey ||
          managerProjectLabel;
        const origemLabel =
          normalizeText(link?.origemPlanejada) ||
          normalizeText(link?.descricao) ||
          normalizeText(acesso?.trackingOrigemPlanejada) ||
          "--";
        const city = resolveGeoText(acesso?.city, acesso?.cidade);
        const country = resolveGeoText(acesso?.country, acesso?.pais);
        const localizacaoLabel = buildTrackingLocationLabel(city, country);
        const ownerUserId = normalizeText(link?.ownerUserId);
        const espacoId = normalizeText(link?.espacoId);
        return {
          id:
            normalizeText(acesso?.id) ||
            `link-${trackingId}-${resolveDataTimestampMs(acesso?.data || acesso?.criadoEm) || 0}`,
          kind: "link",
          kindLabel: "Link rastreavel",
          itemId: trackingId || "--",
          itemKey: `link:${trackingId || "sem-id"}`,
          titulo: origemLabel,
          detail: `Tracking ID: ${trackingId || "--"}`,
          destino:
            normalizeText(link?.destinoUrl) || normalizeText(acesso?.trackingDestinoUrl) || "--",
          status: resolveTrackableLinkStatus(link),
          projectLabel,
          spaceLabel: resolveTrackableSpaceLabel(link),
          spaceKey:
            normalizeText(link?.spaceKey) ||
            (ownerUserId || espacoId ? `${ownerUserId}|${espacoId}` : `link:${trackingId}`),
          origemLabel,
          localizacaoLabel,
          raw: acesso,
          city,
          country,
          dataMs: resolveDataTimestampMs(acesso?.data || acesso?.criadoEm) || 0,
          data: formatarData(acesso?.data || acesso?.criadoEm),
          navigationId: resolveAccessNavigationId(acesso),
          usuario: resolveAccessUserLabel(acesso),
        };
      })
      .filter(Boolean);

    const leiturasCards = leiturasQrPrints
      .filter((leitura) => {
        const printId = normalizeText(leitura?.printId || leitura?.qrPrintId);
        if (!printId) return false;
        const dataMs = resolveDataTimestampMs(leitura?.data || leitura?.criadoEm);
        if (Number.isFinite(dataInicioMs) && (!Number.isFinite(dataMs) || dataMs < dataInicioMs)) {
          return false;
        }
        if (Number.isFinite(dataFimMs) && (!Number.isFinite(dataMs) || dataMs > dataFimMs)) {
          return false;
        }
        return true;
      })
      .map((leitura) => {
        const printId = normalizeText(leitura?.printId || leitura?.qrPrintId);
        const print = qrPrintsMap.get(printId) || null;
        if (!print || !isQrPrintVisible(print)) return null;
        const projectKey =
          normalizeText(leitura?.runtimeProjectKey || print?.runtimeProjectKey).toLowerCase();
        const projectLabel =
          normalizeText(projetosMap.get(projectKey)?.nomeProjeto) ||
          projectKey ||
          managerProjectLabel;
        const origemLabel =
          normalizeText(print?.descricaoRegistro) ||
          normalizeText(print?.cardNome) ||
          normalizeText(leitura?.cardNome) ||
          "Card rastreavel";
        const city = resolveGeoText(leitura?.city, leitura?.cidade);
        const country = resolveGeoText(leitura?.country, leitura?.pais);
        const localizacaoLabel = buildTrackingLocationLabel(city, country);
        const ownerUserId = normalizeText(print?.ownerUserId || leitura?.ownerUserId);
        const espacoId = normalizeText(print?.espacoId || leitura?.espacoId);
        return {
          id:
            normalizeText(leitura?.id) ||
            `card-${printId}-${resolveDataTimestampMs(leitura?.data || leitura?.criadoEm) || 0}`,
          kind: "card",
          kindLabel: "Card rastreavel",
          itemId: printId || "--",
          itemKey: `card:${printId || "sem-id"}`,
          titulo: origemLabel,
          detail: normalizeText(print?.cardNome || leitura?.cardNome) || `QR ${printId}`,
          destino: normalizeText(print?.urlCard || leitura?.urlCard) || "--",
          status: resolveQrPrintStatus(print),
          projectLabel,
          spaceLabel: resolveQrPrintSpaceLabel(print || leitura),
          spaceKey:
            ownerUserId || espacoId ? `${ownerUserId}|${espacoId}` : `card:${printId}`,
          origemLabel,
          localizacaoLabel,
          raw: leitura,
          city,
          country,
          dataMs: resolveDataTimestampMs(leitura?.data || leitura?.criadoEm) || 0,
          data: formatarData(leitura?.data || leitura?.criadoEm),
          navigationId: resolveAccessNavigationId(leitura),
          usuario: resolveAccessUserLabel(leitura),
        };
      })
      .filter(Boolean);

    const eventos = [...eventosLinks, ...leiturasCards].sort((a, b) => b.dataMs - a.dataMs);
    const opcoesEspaco = Array.from(
      new Set(eventos.map((evento) => normalizeText(evento.spaceLabel)).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    const opcoesOrigem = Array.from(
      new Set(eventos.map((evento) => normalizeText(evento.titulo)).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    const opcoesLocal = Array.from(
      new Set(eventos.map((evento) => normalizeText(evento.localizacaoLabel)).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    return {
      totalLinks: linksRastreaveis.filter((link) => isTrackableLinkVisible(link)).length,
      totalCards: qrPrintsRastreaveis.filter((print) => isQrPrintVisible(print)).length,
      totalLinksAtivos: linksRastreaveis.filter(
        (link) => resolveTrackableLinkStatus(link) === "Ativo"
      ).length,
      totalCardsAtivos: qrPrintsRastreaveis.filter(
        (print) => resolveQrPrintStatus(print) === "Ativo"
      ).length,
      totalEventosLinks: eventosLinks.length,
      totalLeiturasCards: leiturasCards.length,
      eventos,
      opcoesEspaco,
      opcoesOrigem,
      opcoesLocal,
    };
  }, [
    acessosLinksRastreaveis,
    acessosFiltrados,
    filtroDataFim,
    filtroDataInicio,
    leiturasQrPrints,
    linksRastreaveis,
    managerProjectLabel,
    projetosMap,
    qrPrintsRastreaveis,
  ]);

  const painelTemFiltrosAtivos = Boolean(
    filtroPainelTipo || filtroPainelEspaco || filtroPainelOrigem || filtroPainelLocal
  );

  const painelRastreabilidade = useMemo(() => {
    const eventosFiltrados = painelRastreabilidadeBase.eventos.filter((evento) => {
      if (filtroPainelTipo && evento.kind !== filtroPainelTipo) return false;
      if (filtroPainelEspaco && normalizeText(evento.spaceLabel) !== filtroPainelEspaco) return false;
      if (filtroPainelOrigem && normalizeText(evento.titulo) !== filtroPainelOrigem) return false;
      if (filtroPainelLocal && normalizeText(evento.localizacaoLabel) !== filtroPainelLocal) return false;
      return true;
    });

    const rankingItensMap = new Map();
    const espacosMap = new Map();
    const origensMap = new Map();
    const locaisMap = new Map();
    const timelineDiasMap = new Map();
    let ultimoAcessoMs = 0;

    eventosFiltrados.forEach((evento) => {
      if (!rankingItensMap.has(evento.itemKey)) {
        rankingItensMap.set(evento.itemKey, {
          key: evento.itemKey,
          tipo: evento.kind,
          tipoLabel: evento.kindLabel,
          itemId: evento.itemId,
          titulo: evento.titulo,
          detail: evento.detail,
          status: evento.status,
          destino: evento.destino,
          projectLabel: evento.projectLabel,
          spaceLabel: evento.spaceLabel,
          totalAcessos: 0,
          navigationIds: new Set(),
          ultimoAcessoMs: 0,
        });
      }
      const item = rankingItensMap.get(evento.itemKey);
      item.totalAcessos += 1;
      item.ultimoAcessoMs = Math.max(item.ultimoAcessoMs, evento.dataMs);
      if (evento.navigationId) item.navigationIds.add(evento.navigationId);

      if (!espacosMap.has(evento.spaceKey)) {
        espacosMap.set(evento.spaceKey, {
          key: evento.spaceKey,
          label: evento.spaceLabel || "--",
          projectLabel: evento.projectLabel,
          acessos: 0,
          links: new Set(),
          cards: new Set(),
          ultimoAcessoMs: 0,
        });
      }
      const espaco = espacosMap.get(evento.spaceKey);
      espaco.acessos += 1;
      if (evento.kind === "link") espaco.links.add(evento.itemId);
      if (evento.kind === "card") espaco.cards.add(evento.itemId);
      espaco.ultimoAcessoMs = Math.max(espaco.ultimoAcessoMs, evento.dataMs);

      if (evento.origemLabel && evento.origemLabel !== "--") {
        if (!origensMap.has(evento.origemLabel)) {
          origensMap.set(evento.origemLabel, {
            label: evento.origemLabel,
            acessos: 0,
            links: new Set(),
            cards: new Set(),
            ultimoAcessoMs: 0,
          });
        }
        const origem = origensMap.get(evento.origemLabel);
        origem.acessos += 1;
        if (evento.kind === "link") origem.links.add(evento.itemId);
        if (evento.kind === "card") origem.cards.add(evento.itemId);
        origem.ultimoAcessoMs = Math.max(origem.ultimoAcessoMs, evento.dataMs);
      }

      if (evento.localizacaoLabel) {
        if (!locaisMap.has(evento.localizacaoLabel)) {
          locaisMap.set(evento.localizacaoLabel, {
            label: evento.localizacaoLabel,
            acessos: 0,
            ultimoAcessoMs: 0,
          });
        }
        const local = locaisMap.get(evento.localizacaoLabel);
        local.acessos += 1;
        local.ultimoAcessoMs = Math.max(local.ultimoAcessoMs, evento.dataMs);
      }

      if (Number.isFinite(evento.dataMs) && evento.dataMs > 0) {
        const diaDate = new Date(evento.dataMs);
        diaDate.setHours(0, 0, 0, 0);
        const diaMs = diaDate.getTime();
        const diaKey = String(diaMs);
        if (!timelineDiasMap.has(diaKey)) {
          timelineDiasMap.set(diaKey, {
            key: diaKey,
            diaMs,
            label: formatarDiaPainel(diaMs),
            labelCompleto: formatarDiaPainelCompleto(diaMs),
            total: 0,
            links: 0,
            cards: 0,
          });
        }
        const dia = timelineDiasMap.get(diaKey);
        dia.total += 1;
        if (evento.kind === "link") dia.links += 1;
        if (evento.kind === "card") dia.cards += 1;
      }

      ultimoAcessoMs = Math.max(ultimoAcessoMs, evento.dataMs);
    });

    const ordenarRanking = (items = []) =>
      items
        .map((item) => ({
          ...item,
          navigationIdsTotal: item.navigationIds.size,
        }))
        .sort((a, b) => {
          if (b.totalAcessos !== a.totalAcessos) return b.totalAcessos - a.totalAcessos;
          return b.ultimoAcessoMs - a.ultimoAcessoMs;
        });

    const rankingItens = ordenarRanking(Array.from(rankingItensMap.values()));
    const rankingLinks = rankingItens.filter((item) => item.tipo === "link");
    const rankingCards = rankingItens.filter((item) => item.tipo === "card");
    const rankingEspacos = Array.from(espacosMap.values())
      .map((item) => ({
        ...item,
        linksTotal: item.links.size,
        cardsTotal: item.cards.size,
      }))
      .sort((a, b) => {
        if (b.acessos !== a.acessos) return b.acessos - a.acessos;
        return b.ultimoAcessoMs - a.ultimoAcessoMs;
      });
    const rankingOrigens = Array.from(origensMap.values())
      .map((item) => ({
        ...item,
        linksTotal: item.links.size,
        cardsTotal: item.cards.size,
      }))
      .sort((a, b) => {
        if (b.acessos !== a.acessos) return b.acessos - a.acessos;
        return b.ultimoAcessoMs - a.ultimoAcessoMs;
      });
    const rankingLocais = Array.from(locaisMap.values()).sort((a, b) => {
      if (b.acessos !== a.acessos) return b.acessos - a.acessos;
      return b.ultimoAcessoMs - a.ultimoAcessoMs;
    });
    const timelineDias = Array.from(timelineDiasMap.values()).sort((a, b) => a.diaMs - b.diaMs);
    const timelineMaiorTotal = timelineDias.reduce(
      (maior, item) => Math.max(maior, item.total),
      0
    );
    const timelineDiasComIntensidade = timelineDias.map((item) => ({
      ...item,
      intensidadePercentual:
        timelineMaiorTotal > 0 ? Math.max((item.total / timelineMaiorTotal) * 100, 8) : 0,
    }));
    const timelinePico = timelineDiasComIntensidade.reduce(
      (maior, item) => (item.total > (maior?.total || 0) ? item : maior),
      null
    );
    const timelineMedia =
      timelineDiasComIntensidade.length > 0
        ? (eventosFiltrados.length / timelineDiasComIntensidade.length).toFixed(
            eventosFiltrados.length / timelineDiasComIntensidade.length >= 10 ? 0 : 1
          )
        : "--";

    return {
      ...painelRastreabilidadeBase,
      eventosFiltrados,
      totalEventosFiltrados: eventosFiltrados.length,
      totalItensComLeitura: rankingItens.length,
      totalLinksComAcesso: rankingLinks.length,
      totalCardsComLeitura: rankingCards.length,
      totalEspacos: rankingEspacos.length,
      ultimoAcessoMs,
      timelineDias: timelineDiasComIntensidade,
      timelineMaiorTotal,
      rankingItens: rankingItens.slice(0, 6),
      rankingLinks: rankingLinks.slice(0, 6),
      rankingCards: rankingCards.slice(0, 6),
      rankingEspacos: rankingEspacos.slice(0, 5),
      rankingOrigens: rankingOrigens.slice(0, 5),
      rankingLocais: rankingLocais.slice(0, 5),
      ultimosEventos: eventosFiltrados.slice(0, 8),
      timelineResumoItems: [
        {
          label: "Dias ativos",
          value: String(timelineDiasComIntensidade.length),
          detail:
            timelineDiasComIntensidade.length > 0
              ? `${timelineDiasComIntensidade[0].label} ate ${
                  timelineDiasComIntensidade[timelineDiasComIntensidade.length - 1].label
                }`
              : "Sem pulso no recorte",
        },
        {
          label: "Pico diario",
          value: timelinePico ? String(timelinePico.total) : "--",
          detail: timelinePico
            ? `${timelinePico.label} | ${timelinePico.links} links | ${timelinePico.cards} cards`
            : "Sem dia de pico",
        },
        {
          label: "Media por dia",
          value: String(timelineMedia),
          detail:
            timelineDiasComIntensidade.length > 0
              ? `${eventosFiltrados.length} evento(s) no recorte`
              : "Sem eventos para media",
        },
      ],
      cardItems: [
        {
          label: "Links rastreaveis",
          value: String(painelRastreabilidadeBase.totalLinks),
          detail: `${painelRastreabilidadeBase.totalLinksAtivos} ativo(s) no projeto`,
        },
        {
          label: "Cards rastreaveis",
          value: String(painelRastreabilidadeBase.totalCards),
          detail: `${painelRastreabilidadeBase.totalCardsAtivos} ativo(s) no projeto`,
        },
        {
          label: "Eventos de links",
          value: String(painelRastreabilidadeBase.totalEventosLinks),
          detail: painelTemFiltrosAtivos
            ? `${rankingLinks.length} item(ns) no recorte do painel`
            : `baseado nos ultimos ${ACCESS_QUERY_LIMIT} registros de acesso`,
        },
        {
          label: "Leituras de cards",
          value: String(painelRastreabilidadeBase.totalLeiturasCards),
          detail: painelTemFiltrosAtivos
            ? `${rankingCards.length} item(ns) no recorte do painel`
            : "leituras QR no recorte atual",
        },
        {
          label: "Itens com leitura",
          value: String(rankingItens.length),
          detail: rankingItens[0]
            ? `topo: ${rankingItens[0].titulo} (${rankingItens[0].totalAcessos})`
            : "Sem leitura rastreavel",
        },
        {
          label: "Ultima leitura",
          value: ultimoAcessoMs ? formatarData(ultimoAcessoMs) : "--",
          detail: formatarTopLista(
            rankingLocais.map((item) => item.label),
            "Sem localizacao registrada",
            2
          ),
        },
      ],
    };
  }, [
    filtroPainelEspaco,
    filtroPainelLocal,
    filtroPainelOrigem,
    filtroPainelTipo,
    painelRastreabilidadeBase,
    painelTemFiltrosAtivos,
  ]);

  const painelGeoAnalise = useMemo(() => {
    const continentesMap = new Map(
      TRACKING_WORLD_REGIONS.map((regiao) => [
        regiao.key,
        {
          ...regiao,
          total: 0,
          countriesSet: new Set(),
          citiesSet: new Set(),
        },
      ])
    );
    const paisesMap = new Map();
    const cidadesMap = new Map();

    painelRastreabilidade.eventosFiltrados.forEach((evento) => {
      const rawEvento = evento?.raw || evento;
      const geoInfo = resolveAccessGeoInfo(rawEvento);
      const country = resolveGeoText(evento?.country, geoInfo.country);
      const city = resolveGeoText(evento?.city, geoInfo.city, geoInfo.region, geoInfo.uf);
      const continentKey = resolveTrackingContinent(rawEvento);

      if (continentKey && continentesMap.has(continentKey)) {
        const continente = continentesMap.get(continentKey);
        continente.total += 1;
        if (country && country !== "--") continente.countriesSet.add(country);
        if (city && city !== "--") continente.citiesSet.add(city);
      }

      if (country && country !== "--") {
        if (!paisesMap.has(country)) {
          paisesMap.set(country, {
            label: country,
            total: 0,
          });
        }
        paisesMap.get(country).total += 1;
      }

      if (city && city !== "--") {
        if (!cidadesMap.has(city)) {
          cidadesMap.set(city, {
            label: city,
            total: 0,
          });
        }
        cidadesMap.get(city).total += 1;
      }
    });

    const continentes = TRACKING_WORLD_REGIONS.map((regiao) => {
      const item = continentesMap.get(regiao.key);
      return {
        ...regiao,
        total: item?.total || 0,
        active: (item?.total || 0) > 0,
        countriesTotal: item?.countriesSet?.size || 0,
        citiesTotal: item?.citiesSet?.size || 0,
      };
    });
    const continentesAtivos = continentes.filter((item) => item.active);
    const maiorContinenteTotal = continentes.reduce(
      (maior, item) => Math.max(maior, item.total),
      0
    );
    const continentesComIntensidade = continentes.map((item) => ({
      ...item,
      intensidadePercentual:
        maiorContinenteTotal > 0 ? Math.max((item.total / maiorContinenteTotal) * 100, 12) : 0,
    }));
    const topContinente =
      [...continentesComIntensidade]
        .sort((a, b) => {
          if (b.total !== a.total) return b.total - a.total;
          return a.label.localeCompare(b.label);
        })
        .find((item) => item.total > 0) || null;
    const rankingPaises = Array.from(paisesMap.values())
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.label.localeCompare(b.label);
      })
      .slice(0, 6);
    const rankingCidades = Array.from(cidadesMap.values())
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.label.localeCompare(b.label);
      })
      .slice(0, 6);

    return {
      continentes: continentesComIntensidade,
      continentesAtivos,
      rankingPaises,
      rankingCidades,
      geoResumoCards: [
        {
          label: "Continentes ativos",
          value: String(continentesAtivos.length),
          detail: continentesAtivos.length
            ? continentesAtivos.map((item) => item.shortLabel).join(" | ")
            : "Sem continente identificado",
        },
        {
          label: "Pico continental",
          value: topContinente?.label || "--",
          detail: topContinente ? `${topContinente.total} evento(s)` : "Sem pico geografico",
        },
        {
          label: "Paises unicos",
          value: String(paisesMap.size),
          detail: rankingPaises.length
            ? rankingPaises.map((item) => `${item.label} (${item.total})`).join(" | ")
            : "Sem paises suficientes",
        },
        {
          label: "Cidades unicas",
          value: String(cidadesMap.size),
          detail: rankingCidades.length
            ? rankingCidades.map((item) => `${item.label} (${item.total})`).join(" | ")
            : "Sem cidades suficientes",
        },
      ],
    };
  }, [painelRastreabilidade.eventosFiltrados]);

  const resolverItemDetalheRastreavel = useCallback(
    (itemBase = null) => {
      const kind = normalizeText(itemBase?.kind || itemBase?.tipo).toLowerCase();
      const itemId = normalizeText(
        itemBase?.itemId || itemBase?.trackingId || itemBase?.printId || itemBase?.qrPrintId || itemBase?.id
      );
      if (!kind || !itemId) return null;

      if (kind === "link") {
        const raw = linksRastreaveisMap.get(itemId) || null;
        const projectKey = normalizeText(raw?.runtimeProjectKey).toLowerCase();
        const projectLabel =
          normalizeText(itemBase?.projectLabel) ||
          normalizeText(projetosMap.get(projectKey)?.nomeProjeto) ||
          projectKey ||
          managerProjectLabel;
        const trackingRoute =
          normalizeText(raw?.trackingRoute) || normalizeText(raw?.urlRastreavel) || `/r/${itemId}`;

        return {
          key: `link:${itemId}`,
          kind: "link",
          kindLabel: "Link rastreavel",
          itemId,
          titulo:
            normalizeText(raw?.origemPlanejada || raw?.descricao || itemBase?.titulo) ||
            "Link rastreavel",
          detail: `Tracking ID: ${itemId}`,
          status: resolveTrackableLinkStatus(raw || itemBase || {}),
          spaceLabel: normalizeText(itemBase?.spaceLabel) || resolveTrackableSpaceLabel(raw || itemBase || {}),
          projectLabel,
          destinoUrl: normalizeText(raw?.destinoUrl || itemBase?.destino),
          rastreavelUrl: buildAbsolutePanelUrl(trackingRoute),
          raw,
        };
      }

      if (kind === "card") {
        const raw = qrPrintsRastreaveisMap.get(itemId) || null;
        const projectKey = normalizeText(raw?.runtimeProjectKey).toLowerCase();
        const projectLabel =
          normalizeText(itemBase?.projectLabel) ||
          normalizeText(projetosMap.get(projectKey)?.nomeProjeto) ||
          projectKey ||
          managerProjectLabel;
        const rastreavelRoute = normalizeText(raw?.urlQr || raw?.rotaQr);

        return {
          key: `card:${itemId}`,
          kind: "card",
          kindLabel: "Card rastreavel",
          itemId,
          titulo:
            normalizeText(raw?.descricaoRegistro || raw?.cardNome || itemBase?.titulo) ||
            "Card rastreavel",
          detail:
            normalizeText(raw?.cardNome || itemBase?.detail) || `Print ID: ${itemId}`,
          status: resolveQrPrintStatus(raw || itemBase || {}),
          spaceLabel: normalizeText(itemBase?.spaceLabel) || resolveQrPrintSpaceLabel(raw || itemBase || {}),
          projectLabel,
          destinoUrl: normalizeText(raw?.urlCard || itemBase?.destino),
          rastreavelUrl: buildAbsolutePanelUrl(rastreavelRoute),
          raw,
        };
      }

      return null;
    },
    [
      linksRastreaveisMap,
      managerProjectLabel,
      projetosMap,
      qrPrintsRastreaveisMap,
    ]
  );

  const carregarEventosDetalheRastreavel = useCallback(
    async (itemAtual = null) => {
      if (!itemAtual?.itemId || !itemAtual?.kind) return [];

      const itemId = normalizeText(itemAtual.itemId);
      const projectSystemKey = normalizeText(
        itemAtual?.raw?.projectSystemKey || itemAtual?.raw?.runtimeProjectKey || filtroProjeto
      ).toLowerCase();

      if (itemAtual.kind === "link") {
        const eventosRemotos = await listarAcessosLinksRastreaveisNoGerenciador({
          limit: 800,
          projectSystemKey,
          startDate: detalheRastreavel.filtroDataInicio || filtroDataInicio,
          endDate: detalheRastreavel.filtroDataFim || filtroDataFim,
        });

        const eventosLocais = acessosLinksRastreaveis.filter(
          (acesso) => normalizeText(acesso?.trackingId) === itemId
        );

        return Array.from(
          new Map(
            [...eventosLocais, ...eventosRemotos]
              .filter((acesso) => normalizeText(acesso?.trackingId) === itemId)
              .map((acesso) => [
                normalizeText(acesso?.id) ||
                  `${normalizeText(acesso?.trackingId)}:${resolveAccessNavigationId(acesso)}:${resolveDataTimestampMs(acesso?.data || acesso?.criadoEm)}`,
                acesso,
              ])
          ).values()
        );
      }

      if (itemAtual.kind === "card") {
        const leiturasRemotas = await listarLeiturasQrPrintsNoGerenciador({
          limit: 800,
          projectSystemKey,
        });

        const leiturasLocais = leiturasQrPrints.filter(
          (leitura) => normalizeText(leitura?.printId || leitura?.qrPrintId) === itemId
        );

        return Array.from(
          new Map(
            [...leiturasLocais, ...leiturasRemotas]
              .filter((leitura) => normalizeText(leitura?.printId || leitura?.qrPrintId) === itemId)
              .map((leitura) => [
                normalizeText(leitura?.id) ||
                  `${normalizeText(leitura?.printId || leitura?.qrPrintId)}:${resolveAccessNavigationId(leitura)}:${resolveDataTimestampMs(leitura?.data || leitura?.criadoEm)}`,
                leitura,
              ])
          ).values()
        );
      }

      return [];
    },
    [
      acessosLinksRastreaveis,
      detalheRastreavel.filtroDataFim,
      detalheRastreavel.filtroDataInicio,
      filtroDataFim,
      filtroDataInicio,
      filtroProjeto,
      leiturasQrPrints,
    ]
  );

  const carregarDetalheRastreavel = useCallback(
    async (itemBase = null, { abrir = true } = {}) => {
      const itemAtual = resolverItemDetalheRastreavel(itemBase || detalheRastreavel.item);
      if (!itemAtual) return;

      setDetalheRastreavel((prev) => ({
        ...prev,
        aberto: abrir ? true : prev.aberto,
        item: itemAtual,
        loading: true,
        erro: "",
        mensagem: "",
      }));

      try {
        const eventos = await carregarEventosDetalheRastreavel(itemAtual);
        if (!mountedRef.current) return;
        setDetalheRastreavel((prev) => ({
          ...prev,
          aberto: true,
          item: itemAtual,
          eventos: Array.isArray(eventos) ? eventos : [],
          loading: false,
          erro: "",
        }));
      } catch (error) {
        if (!mountedRef.current) return;
        console.error("Erro ao carregar detalhe rastreavel:", error);
        setDetalheRastreavel((prev) => ({
          ...prev,
          aberto: true,
          item: itemAtual,
          eventos: [],
          loading: false,
          erro:
            error?.message || "Nao foi possivel carregar o historico deste item rastreavel.",
        }));
      }
    },
    [carregarEventosDetalheRastreavel, detalheRastreavel.item, resolverItemDetalheRastreavel]
  );

  const abrirDetalheRastreavel = useCallback(
    async (itemBase = null) => {
      await carregarDetalheRastreavel(itemBase, { abrir: true });
    },
    [carregarDetalheRastreavel]
  );

  const fecharDetalheRastreavel = useCallback(() => {
    setDetalheRastreavel(criarEstadoDetalheRastreavel());
  }, []);

  const atualizarCampoDetalheRastreavel = useCallback((updates = {}) => {
    setDetalheRastreavel((prev) => ({
      ...prev,
      ...updates,
    }));
  }, []);

  const copiarTextoRastreavel = useCallback(async (texto = "", mensagem = "Copiado.") => {
    const valor = normalizeText(texto);
    if (!valor) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(valor);
      } else if (typeof window !== "undefined") {
        const input = document.createElement("textarea");
        input.value = valor;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }
      if (!mountedRef.current) return;
      setDetalheRastreavel((prev) => ({
        ...prev,
        mensagem,
        erro: "",
      }));
    } catch (error) {
      if (!mountedRef.current) return;
      setDetalheRastreavel((prev) => ({
        ...prev,
        erro: error?.message || "Nao foi possivel copiar o valor.",
      }));
    }
  }, []);

  const exportarDetalheRastreavelCsv = useCallback(() => {
    if (typeof window === "undefined") return;
    const itemAtual = detalheRastreavel.item;
    if (!itemAtual || !detalheRastreavel.eventos.length) return;

    const dataInicioMs = detalheRastreavel.filtroDataInicio
      ? new Date(`${detalheRastreavel.filtroDataInicio}T00:00:00`).getTime()
      : NaN;
    const dataFimMs = detalheRastreavel.filtroDataFim
      ? new Date(`${detalheRastreavel.filtroDataFim}T23:59:59.999`).getTime()
      : NaN;

    const eventosFiltrados = detalheRastreavel.eventos.filter((evento) => {
      const dataMs = resolveDataTimestampMs(evento?.data || evento?.criadoEm);
      if (Number.isFinite(dataInicioMs) && (!Number.isFinite(dataMs) || dataMs < dataInicioMs)) {
        return false;
      }
      if (Number.isFinite(dataFimMs) && (!Number.isFinite(dataMs) || dataMs > dataFimMs)) {
        return false;
      }
      return true;
    });

    if (!eventosFiltrados.length) return;

    const linhas = [
      [
        "dataHora",
        "tipo",
        "identificador",
        "usuario",
        "navigationId",
        "localizacao",
        "ip",
        "origem",
        "destino",
        "userAgent",
      ].join(";"),
      ...eventosFiltrados.map((evento) =>
        [
          escapeCsvValue(formatarData(evento?.data || evento?.criadoEm)),
          escapeCsvValue(itemAtual.kindLabel),
          escapeCsvValue(itemAtual.itemId),
          escapeCsvValue(resolveAccessUserLabel(evento)),
          escapeCsvValue(resolveHistoricoNavigationId(evento) || "--"),
          escapeCsvValue(buildHistoricoLocalizacao(evento)),
          escapeCsvValue(normalizeText(evento?.ip) || "--"),
          escapeCsvValue(normalizeText(evento?.origemPlanejada || evento?.origem) || "--"),
          escapeCsvValue(normalizeText(evento?.destinoUrl || evento?.urlCard || itemAtual.destinoUrl) || "--"),
          escapeCsvValue(normalizeText(evento?.userAgent) || "--"),
        ].join(";")
      ),
    ];

    const blob = new Blob([`\uFEFF${linhas.join("\n")}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `detalhe-rastreavel-${itemAtual.kind}-${itemAtual.itemId}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }, [detalheRastreavel]);

  const duplicarItemRastreavel = useCallback(async () => {
    const itemAtual = detalheRastreavel.item;
    if (!itemAtual) return;

    setDetalheRastreavel((prev) => ({
      ...prev,
      acaoEmAndamento: "duplicar",
      erro: "",
      mensagem: "",
    }));

    try {
      if (itemAtual.kind === "link") {
        const raw = itemAtual.raw || {};
        const projectSystemKey = normalizeText(
          raw?.projectSystemKey || raw?.runtimeProjectKey || filtroProjeto
        ).toLowerCase();
        let baseUrl = "";
        try {
          baseUrl = new URL(normalizeText(raw?.urlRastreavel || itemAtual.rastreavelUrl)).origin;
        } catch {
          baseUrl = resolveProjetoBaseUrl(projetosMap.get(projectSystemKey));
        }
        await criarLinkRastreavelNoGerenciador({
          projectSystemKey,
          ownerUserId: raw?.ownerUserId,
          espacoId: raw?.espacoId,
          espacoNome: raw?.espacoNome,
          skinsUsername: raw?.skinsUsername,
          baseUrl,
          destinoUrl: raw?.destinoUrl,
          descricao:
            normalizeText(raw?.descricao || raw?.origemPlanejada || itemAtual.titulo) || "Copia",
          origemPlanejada:
            normalizeText(raw?.origemPlanejada || raw?.descricao || itemAtual.titulo) || "Copia",
          permissaoCriarLinks: raw?.permissaoCriarLinks,
          permissaoHistoricoLinks: raw?.permissaoHistoricoLinks,
        });
      } else if (itemAtual.kind === "card") {
        const raw = itemAtual.raw || {};
        await criarQrPrintCard({
          ownerUserId: raw?.ownerUserId,
          espacoId: raw?.espacoId,
          espacoNome: raw?.espacoNome,
          skinsUsername: raw?.skinsUsername,
          oneOwnerPublicaAtiva: Boolean(raw?.oneOwnerPublicaAtiva),
          bloco: {
            id: raw?.blocoId,
            titulo: raw?.blocoTitulo,
          },
          card: {
            id: raw?.cardId,
            nome: raw?.cardNome,
          },
          rotaCard: raw?.rotaCard,
          urlCard: raw?.urlCard,
          descricaoRegistro:
            normalizeText(raw?.descricaoRegistro || itemAtual.titulo || raw?.cardNome) || "Copia",
        });
      }

      if (!mountedRef.current) return;
      setDetalheRastreavel((prev) => ({
        ...prev,
        acaoEmAndamento: "",
        mensagem: `${itemAtual.kindLabel} duplicado com sucesso.`,
      }));
      await carregarPainelRastreavel();
    } catch (error) {
      if (!mountedRef.current) return;
      console.error("Erro ao duplicar item rastreavel:", error);
      setDetalheRastreavel((prev) => ({
        ...prev,
        acaoEmAndamento: "",
        erro: error?.message || "Nao foi possivel duplicar este item rastreavel.",
      }));
    }
  }, [carregarPainelRastreavel, detalheRastreavel.item, filtroProjeto, projetosMap]);

  const excluirItemRastreavelSelecionado = useCallback(async () => {
    const itemAtual = detalheRastreavel.item;
    if (!itemAtual) return;
    const projectSystemKey = normalizeText(
      itemAtual?.raw?.projectSystemKey || itemAtual?.raw?.runtimeProjectKey || filtroProjeto
    ).toLowerCase();

    if (!usuarioPodeRemoverRegistrosAuditaveis(projectSystemKey, itemAtual?.raw || itemAtual)) {
      setDetalheRastreavel((prev) => ({
        ...prev,
        erro: "Sem permissao para excluir registros auditaveis deste projeto.",
        mensagem: "",
      }));
      return;
    }

    const confirmado =
      typeof window === "undefined" ||
      window.confirm(
        `Excluir ${itemAtual.kind === "link" ? "este link" : "este card"} rastreavel?`
      );
    if (!confirmado) return;

    setDetalheRastreavel((prev) => ({
      ...prev,
      acaoEmAndamento: "excluir",
      erro: "",
      mensagem: "",
    }));

    try {
      if (itemAtual.kind === "link") {
        await atualizarStatusLinkRastreavelNoGerenciador({
          trackingId: itemAtual.itemId,
          projectSystemKey,
          action: "excluir",
        });
        if (!mountedRef.current) return;
        setLinksRastreaveis((prev) =>
          prev.filter((item) => resolveTrackableLinkId(item) !== itemAtual.itemId)
        );
      } else if (itemAtual.kind === "card") {
        await atualizarStatusQrPrintNoGerenciador({
          printId: itemAtual.itemId,
          projectSystemKey,
          action: "excluir",
        });
        if (!mountedRef.current) return;
        setQrPrintsRastreaveis((prev) =>
          prev.filter((item) => resolveQrPrintId(item) !== itemAtual.itemId)
        );
      }

      const itemAtualizado = {
        ...itemAtual,
        status: "Excluido",
        raw: {
          ...(itemAtual.raw || {}),
          ativo: false,
          excluido: true,
          status: "excluido",
        },
      };

      setDetalheRastreavel((prev) => ({
        ...prev,
        item: itemAtualizado,
        acaoEmAndamento: "",
        mensagem: `${itemAtual.kindLabel} excluido com sucesso.`,
      }));
    } catch (error) {
      if (!mountedRef.current) return;
      console.error("Erro ao excluir item rastreavel:", error);
      setDetalheRastreavel((prev) => ({
        ...prev,
        acaoEmAndamento: "",
        erro: error?.message || "Nao foi possivel excluir este item rastreavel.",
      }));
    }
  }, [detalheRastreavel.item, filtroProjeto, usuarioPodeRemoverRegistrosAuditaveis]);

  const exportarPainelCentralCsv = useCallback(() => {
    if (!painelRastreabilidade.eventosFiltrados.length) return;

    const cabecalho = [
      "Data",
      "Tipo",
      "Identificador",
      "Titulo",
      "Detalhe",
      "Status",
      "Destino",
      "Projeto",
      "Espaco",
      "Origem planejada",
      "Usuario",
      "Navigation ID",
      "Localizacao",
    ];

    const linhas = painelRastreabilidade.eventosFiltrados.map((evento) =>
      [
        formatarData(evento.dataMs),
        evento.kindLabel,
        evento.itemId,
        evento.titulo,
        evento.detail,
        evento.status,
        evento.destino,
        evento.projectLabel,
        evento.spaceLabel,
        evento.origemLabel,
        evento.usuario,
        evento.navigationId,
        evento.localizacaoLabel || "--",
      ]
        .map(escapeCsvValue)
        .join(";")
    );

    const projetoSlug =
      normalizeText(filtroProjeto)
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "todos-projetos";
    const periodoSlug = `${filtroDataInicio || "inicio"}_${filtroDataFim || "fim"}`
      .replace(/[^0-9_-]+/g, "")
      .replace(/_+/g, "_");
    const csvContent = `sep=;\n${cabecalho.join(";")}\n${linhas.join("\n")}`;
    const blob = new Blob([`\uFEFF${csvContent}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `painel-rastreabilidade-${projetoSlug}-${periodoSlug}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [
    filtroDataFim,
    filtroDataInicio,
    filtroProjeto,
    painelRastreabilidade.eventosFiltrados,
  ]);

  const detalheRastreavelAnalise = useMemo(() => {
    const itemAtual = detalheRastreavel.item;
    const eventos = Array.isArray(detalheRastreavel.eventos) ? detalheRastreavel.eventos : [];
    const filtroInicioMs = detalheRastreavel.filtroDataInicio
      ? new Date(`${detalheRastreavel.filtroDataInicio}T00:00:00`).getTime()
      : NaN;
    const filtroFimMs = detalheRastreavel.filtroDataFim
      ? new Date(`${detalheRastreavel.filtroDataFim}T23:59:59.999`).getTime()
      : NaN;

    const eventosFiltrados = eventos.filter((evento) => {
      const dataMs = resolveDataTimestampMs(evento?.data || evento?.criadoEm);
      if (Number.isFinite(filtroInicioMs) && (!Number.isFinite(dataMs) || dataMs < filtroInicioMs)) {
        return false;
      }
      if (Number.isFinite(filtroFimMs) && (!Number.isFinite(dataMs) || dataMs > filtroFimMs)) {
        return false;
      }
      return true;
    });

    const grupos = detalheRastreavel.agruparPorNavigationId
      ? Object.values(
          eventosFiltrados.reduce((acc, evento) => {
            const navigationId = resolveHistoricoNavigationId(evento) || "sem_identificador";
            if (!acc[navigationId]) {
              acc[navigationId] = {
                navigationId,
                itens: [],
                ultimoAcessoMs: 0,
              };
            }
            const dataMs = resolveDataTimestampMs(evento?.data || evento?.criadoEm);
            acc[navigationId].itens.push(evento);
            acc[navigationId].ultimoAcessoMs = Math.max(
              acc[navigationId].ultimoAcessoMs,
              Number.isFinite(dataMs) ? dataMs : 0
            );
            return acc;
          }, {})
        ).sort((a, b) => b.ultimoAcessoMs - a.ultimoAcessoMs)
      : [];

    const navigationIds = Array.from(
      new Set(eventosFiltrados.map((evento) => resolveHistoricoNavigationId(evento)).filter(Boolean))
    );
    const ultimoAcessoMs = eventosFiltrados.reduce((maximo, evento) => {
      const dataMs = resolveDataTimestampMs(evento?.data || evento?.criadoEm);
      return Math.max(maximo, Number.isFinite(dataMs) ? dataMs : 0);
    }, 0);
    const localizacoesUnicas = Array.from(
      new Set(
        eventosFiltrados
          .map((evento) => buildHistoricoLocalizacao(evento))
          .filter((localizacao) => localizacao && localizacao !== "--")
      )
    );
    const continentesMap = new Map(
      TRACKING_WORLD_REGIONS.map((regiao) => [
        regiao.key,
        {
          ...regiao,
          total: 0,
          countriesSet: new Set(),
          citiesSet: new Set(),
        },
      ])
    );
    const paisesMap = new Map();
    const cidadesMap = new Map();

    eventosFiltrados.forEach((evento) => {
      const geoInfo = resolveAccessGeoInfo(evento);
      const country = resolveGeoText(geoInfo.country);
      const city = resolveGeoText(geoInfo.city, geoInfo.region, geoInfo.uf);
      const continentKey = resolveTrackingContinent(evento);

      if (continentKey && continentesMap.has(continentKey)) {
        const continente = continentesMap.get(continentKey);
        continente.total += 1;
        if (country && country !== "--") continente.countriesSet.add(country);
        if (city && city !== "--") continente.citiesSet.add(city);
      }

      if (country && country !== "--") {
        if (!paisesMap.has(country)) {
          paisesMap.set(country, {
            label: country,
            total: 0,
          });
        }
        paisesMap.get(country).total += 1;
      }

      if (city && city !== "--") {
        if (!cidadesMap.has(city)) {
          cidadesMap.set(city, {
            label: city,
            total: 0,
          });
        }
        cidadesMap.get(city).total += 1;
      }
    });

    const continentes = TRACKING_WORLD_REGIONS.map((regiao) => {
      const item = continentesMap.get(regiao.key);
      return {
        ...regiao,
        total: item?.total || 0,
        active: (item?.total || 0) > 0,
        countriesTotal: item?.countriesSet?.size || 0,
        citiesTotal: item?.citiesSet?.size || 0,
      };
    });
    const continentesAtivos = continentes.filter((item) => item.active);
    const topContinente =
      [...continentes]
        .sort((a, b) => {
          if (b.total !== a.total) return b.total - a.total;
          return a.label.localeCompare(b.label);
        })
        .find((item) => item.total > 0) || null;
    const maiorContinenteTotal = continentes.reduce(
      (maior, item) => Math.max(maior, item.total),
      0
    );
    const continentesComIntensidade = continentes.map((item) => ({
      ...item,
      intensidadePercentual:
        maiorContinenteTotal > 0 ? Math.max((item.total / maiorContinenteTotal) * 100, 12) : 0,
    }));
    const rankingPaises = Array.from(paisesMap.values())
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.label.localeCompare(b.label);
      })
      .slice(0, 5);
    const rankingCidades = Array.from(cidadesMap.values())
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.label.localeCompare(b.label);
      })
      .slice(0, 5);

    const resumoCards = itemAtual
      ? [
          {
            label: "Status",
            value: itemAtual.status,
            detail: itemAtual.kind === "link" ? "Link" : "Card QR",
          },
          {
            label: "Espaco",
            value: itemAtual.spaceLabel || "--",
            detail: itemAtual.projectLabel || "--",
          },
          {
            label: "Eventos",
            value: String(eventos.length),
            detail:
              Number.isFinite(filtroInicioMs) || Number.isFinite(filtroFimMs)
                ? `${eventosFiltrados.length} no recorte`
                : "Historico completo carregado",
          },
          {
            label: "Identificadores",
            value: String(navigationIds.length),
            detail: "Navigation IDs unicos",
          },
          {
            label: "Ultima leitura",
            value: ultimoAcessoMs ? formatarData(ultimoAcessoMs) : "--",
            detail: ultimoAcessoMs ? "Evento mais recente" : "Sem leitura ainda",
          },
          {
            label: "Locais",
            value: localizacoesUnicas.length ? localizacoesUnicas.slice(0, 2).join(" | ") : "--",
            detail:
              localizacoesUnicas.length > 2
                ? `+${localizacoesUnicas.length - 2} local(is)`
                : "Cidade / pais",
          },
        ]
      : [];

    return {
      continentes: continentesComIntensidade,
      continentesAtivos,
      eventosFiltrados,
      geoResumoCards: [
        {
          label: "Continentes ativos",
          value: String(continentesAtivos.length),
          detail: continentesAtivos.length
            ? continentesAtivos.map((item) => item.shortLabel).join(" | ")
            : "Sem continente identificado",
        },
        {
          label: "Pico continental",
          value: topContinente?.label || "--",
          detail: topContinente ? `${topContinente.total} evento(s)` : "Sem pico geografico",
        },
        {
          label: "Paises unicos",
          value: String(paisesMap.size),
          detail: rankingPaises.length
            ? rankingPaises.map((item) => `${item.label} (${item.total})`).join(" | ")
            : "Sem paises suficientes",
        },
        {
          label: "Cidades unicas",
          value: String(cidadesMap.size),
          detail: rankingCidades.length
            ? rankingCidades.map((item) => `${item.label} (${item.total})`).join(" | ")
            : "Sem cidades suficientes",
        },
      ],
      grupos,
      rankingCidades,
      rankingPaises,
      resumoCards,
    };
  }, [detalheRastreavel]);

  const podeExcluirDetalheRastreavel = useMemo(() => {
    const itemAtual = detalheRastreavel.item;
    if (!itemAtual) return false;
    const projectSystemKey = normalizeText(
      itemAtual?.raw?.projectSystemKey || itemAtual?.raw?.runtimeProjectKey || filtroProjeto
    ).toLowerCase();
    return usuarioPodeRemoverRegistrosAuditaveis(projectSystemKey, itemAtual?.raw || itemAtual);
  }, [detalheRastreavel.item, filtroProjeto, usuarioPodeRemoverRegistrosAuditaveis]);

  useEffect(() => {
    if (
      filtroPainelEspaco &&
      !painelRastreabilidadeBase.opcoesEspaco.includes(filtroPainelEspaco)
    ) {
      setFiltroPainelEspaco("");
    }
    if (
      filtroPainelOrigem &&
      !painelRastreabilidadeBase.opcoesOrigem.includes(filtroPainelOrigem)
    ) {
      setFiltroPainelOrigem("");
    }
    if (
      filtroPainelLocal &&
      !painelRastreabilidadeBase.opcoesLocal.includes(filtroPainelLocal)
    ) {
      setFiltroPainelLocal("");
    }
  }, [
    filtroPainelEspaco,
    filtroPainelLocal,
    filtroPainelOrigem,
    painelRastreabilidadeBase.opcoesEspaco,
    painelRastreabilidadeBase.opcoesLocal,
    painelRastreabilidadeBase.opcoesOrigem,
  ]);

  useEffect(() => {
    if (!detalheRastreavel.aberto || !detalheRastreavel.item) return;
    const itemAtualizado = resolverItemDetalheRastreavel(detalheRastreavel.item);
    if (!itemAtualizado) return;
    if (
      itemAtualizado.status === detalheRastreavel.item.status &&
      itemAtualizado.titulo === detalheRastreavel.item.titulo &&
      itemAtualizado.destinoUrl === detalheRastreavel.item.destinoUrl &&
      itemAtualizado.rastreavelUrl === detalheRastreavel.item.rastreavelUrl
    ) {
      return;
    }
    setDetalheRastreavel((prev) => ({
      ...prev,
      item: itemAtualizado,
    }));
  }, [
    detalheRastreavel.aberto,
    detalheRastreavel.item,
    linksRastreaveisMap,
    qrPrintsRastreaveisMap,
    resolverItemDetalheRastreavel,
  ]);

  useEffect(() => {
    if (!detalheRastreavel.aberto) return undefined;
    if (typeof document === "undefined" || typeof window === "undefined") return undefined;

    const overflowAnterior = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        fecharDetalheRastreavel();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [detalheRastreavel.aberto, fecharDetalheRastreavel]);

  useEffect(() => {
    setPaginaAtual(1);
    setGruposExpandidos({});
  }, [
    filtroDataFim,
    filtroDataInicio,
    filtroNavigationId,
    filtroIp,
    filtroOrigem,
    filtroProjeto,
    filtroStatusLeitura,
    filtroTipoUsuario,
    ipsBloqueadosSet,
    mostrarRegistrosBloqueados,
    usuariosBloqueadosSet,
  ]);

  const gruposAcessos = useMemo(() => {
    const gruposMap = new Map();

    acessosFiltrados.forEach((acesso, index) => {
      const navigationId = resolveAccessNavigationId(acesso);
      const projectKey = resolveAccessProjectKey(acesso) || "sem-projeto";
      const fallbackKey =
        normalizeText(acesso?.uid || acesso?.email || resolveAccessIp(acesso) || acesso?.id) ||
        String(index);
      const groupKey = `${projectKey}|${navigationId || `sem-navigation-id:${fallbackKey}`}`;

      if (!gruposMap.has(groupKey)) {
        gruposMap.set(groupKey, {
          key: groupKey,
          navigationId,
          projectKey,
          items: [],
          projetosSet: new Set(),
          ipsSet: new Set(),
          hostsSet: new Set(),
          countriesSet: new Set(),
          regionsSet: new Set(),
          citiesSet: new Set(),
          ufsSet: new Set(),
          orgsSet: new Set(),
          geoSourcesSet: new Set(),
          perfisSet: new Set(),
          eventosSet: new Set(),
          usersSet: new Set(),
          userIdentifiersSet: new Set(),
        });
      }

      const grupo = gruposMap.get(groupKey);
      const geoInfo = resolveAccessGeoInfo(acesso);
      const userIdentifiers = resolveAccessUserIdentifiers(acesso);
      grupo.items.push(acesso);
      grupo.projetosSet.add(resolveAccessProjectKey(acesso));
      grupo.ipsSet.add(resolveAccessIp(acesso));
      grupo.hostsSet.add(normalizeText(acesso?.hostname));
      grupo.countriesSet.add(geoInfo.country);
      grupo.regionsSet.add(geoInfo.region);
      grupo.citiesSet.add(geoInfo.city);
      grupo.ufsSet.add(geoInfo.uf);
      grupo.orgsSet.add(geoInfo.org);
      grupo.geoSourcesSet.add(geoInfo.source);
      grupo.perfisSet.add(normalizeText(acesso?.perfilAcesso));
      grupo.eventosSet.add(normalizeText(acesso?.eventoTipo));
      grupo.usersSet.add(resolveAccessUserLabel(acesso));
      userIdentifiers.forEach((identifier) => grupo.userIdentifiersSet.add(identifier));
    });

    return Array.from(gruposMap.values())
      .map((grupo) => {
        const itemsOrdenados = [...grupo.items].sort((a, b) => {
          const dataA = resolveDataTimestampMs(a?.data || a?.criadoEm) || 0;
          const dataB = resolveDataTimestampMs(b?.data || b?.criadoEm) || 0;
          return dataB - dataA;
        });
        const eventoMaisRecente = itemsOrdenados[0] || null;
        const primeiroEvento = itemsOrdenados[itemsOrdenados.length - 1] || null;

        return {
          key: grupo.key,
          navigationId: grupo.navigationId,
          projectKey: grupo.projectKey,
          items: itemsOrdenados,
          total: itemsOrdenados.length,
          totalBloqueados: itemsOrdenados.filter((item) =>
            isAccessRecordHiddenFromMainView(item, ipsBloqueadosSet, usuariosBloqueadosSet)
          ).length,
          totalNaoLidos: itemsOrdenados.filter((item) => !isAccessRead(item)).length,
          usuario: Array.from(grupo.usersSet).filter(Boolean)[0] || "Visitante",
          projetos: Array.from(grupo.projetosSet).filter(Boolean),
          ips: Array.from(grupo.ipsSet).filter(Boolean),
          hosts: Array.from(grupo.hostsSet).filter(Boolean),
          countries: Array.from(grupo.countriesSet).filter(Boolean),
          regions: Array.from(grupo.regionsSet).filter(Boolean),
          cities: Array.from(grupo.citiesSet).filter(Boolean),
          ufs: Array.from(grupo.ufsSet).filter(Boolean),
          orgs: Array.from(grupo.orgsSet).filter(Boolean),
          geoSources: Array.from(grupo.geoSourcesSet).filter(Boolean),
          perfis: Array.from(grupo.perfisSet).filter(Boolean),
          eventos: Array.from(grupo.eventosSet).filter(Boolean),
          userIdentifiers: Array.from(grupo.userIdentifiersSet).filter(Boolean),
          primeiroEvento,
          eventoMaisRecente,
          primeiroEventoMs: resolveDataTimestampMs(primeiroEvento?.data || primeiroEvento?.criadoEm) || 0,
          eventoMaisRecenteMs:
            resolveDataTimestampMs(eventoMaisRecente?.data || eventoMaisRecente?.criadoEm) || 0,
        };
      })
      .sort((a, b) => b.eventoMaisRecenteMs - a.eventoMaisRecenteMs);
  }, [acessosFiltrados, ipsBloqueadosSet, usuariosBloqueadosSet]);

  const totalPaginas = Math.max(1, Math.ceil(gruposAcessos.length / GROUP_PAGE_SIZE));
  const paginaAtualSegura = Math.min(paginaAtual, totalPaginas);

  useEffect(() => {
    if (paginaAtual !== paginaAtualSegura) {
      setPaginaAtual(paginaAtualSegura);
    }
  }, [paginaAtual, paginaAtualSegura]);

  const gruposPaginados = useMemo(() => {
    const inicio = (paginaAtualSegura - 1) * GROUP_PAGE_SIZE;
    return gruposAcessos.slice(inicio, inicio + GROUP_PAGE_SIZE);
  }, [gruposAcessos, paginaAtualSegura]);

  return (
    <section className="gerenciador-acessos">
      <div className="gerenciador-acessos__header">
        <div>
          <h1 className="gerenciador-acessos__title">
            {exibirSomenteRastreabilidade ? "RASTREABILIDADE" : "ACESSOS"}
          </h1>
          <p className="gerenciador-acessos__subtitle">
            {exibirSomenteRastreabilidade
              ? `Painel de rastreabilidade centralizado no projeto ${managerProjectLabel}.`
              : `Eventos de acesso centralizados no projeto ${managerProjectLabel}.`}
          </p>
        </div>

        <div className="gerenciador-acessos__filters">
          <label className="gerenciador-acessos__filter">
            <span>Projeto</span>
            <select value={filtroProjeto} onChange={(event) => setFiltroProjeto(event.target.value)}>
              <option value="">Todos</option>
              {opcoesProjeto.map((projeto) => (
                <option key={projeto.value} value={projeto.value}>
                  {projeto.label}
                </option>
              ))}
            </select>
          </label>

          {exibirAcessosOperacionais ? (
            <>
              <label className="gerenciador-acessos__filter">
                <span>Origem</span>
                <select
                  value={filtroOrigem}
                  onChange={(event) => setFiltroOrigem(event.target.value)}
                >
                  <option value="">Todas</option>
                  <option value="localhost">localhost</option>
                  <option value="dominio">dominios</option>
                </select>
              </label>

              <label className="gerenciador-acessos__filter">
                <span>Tipo de usuario</span>
                <select
                  value={filtroTipoUsuario}
                  onChange={(event) => setFiltroTipoUsuario(event.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="owner">owners</option>
                  <option value="viewer">viewers</option>
                </select>
              </label>

              <label className="gerenciador-acessos__filter">
                <span>Status</span>
                <select
                  value={filtroStatusLeitura}
                  onChange={(event) => setFiltroStatusLeitura(event.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="nao-lido">Nao lidos</option>
                  <option value="lido">Lidos</option>
                </select>
              </label>

              <div className="gerenciador-acessos__filter-pair">
                <label className="gerenciador-acessos__filter gerenciador-acessos__filter--compact">
                  <span>Identificador</span>
                  <input
                    type="text"
                    value={filtroNavigationId}
                    onChange={(event) => setFiltroNavigationId(event.target.value)}
                    placeholder="Digite o identificador"
                  />
                </label>

                <label className="gerenciador-acessos__filter gerenciador-acessos__filter--compact">
                  <span>IP</span>
                  <input
                    type="text"
                    value={filtroIp}
                    onChange={(event) => setFiltroIp(event.target.value)}
                    placeholder="Digite o IP"
                  />
                </label>
              </div>
            </>
          ) : null}

          <label className="gerenciador-acessos__filter">
            <span>Data inicial</span>
            <input
              type="date"
              value={filtroDataInicio}
              max={filtroDataFim || undefined}
              onChange={(event) => setFiltroDataInicio(event.target.value)}
            />
          </label>

          <label className="gerenciador-acessos__filter">
            <span>Data final</span>
            <input
              type="date"
              value={filtroDataFim}
              min={filtroDataInicio || undefined}
              onChange={(event) => setFiltroDataFim(event.target.value)}
            />
          </label>

          {exibirAcessosOperacionais ? (
            <label className="gerenciador-acessos__filter gerenciador-acessos__filter-check">
              <input
                type="checkbox"
                checked={mostrarRegistrosBloqueados}
                onChange={(event) => setMostrarRegistrosBloqueados(event.target.checked)}
              />
              <span>Mostrar bloqueados/ocultos</span>
            </label>
          ) : null}
        </div>
      </div>

      {exibirAcessosOperacionais ? (
        <>
          <div className="gerenciador-acessos__block-panel">
            <div>
              <strong>Bloqueio de registro por IP</strong>
              <p>
                IPs nesta lista nao geram novos registros de navegacao/acesso. Registros antigos
                continuam visiveis para auditoria.
              </p>
            </div>

        <form
          className="gerenciador-acessos__block-form"
          onSubmit={(event) => {
            event.preventDefault();
            adicionarIpBloqueado(ipBloqueioInput);
          }}
        >
          <input
            type="text"
            value={ipBloqueioInput}
            onChange={(event) => setIpBloqueioInput(event.target.value)}
            placeholder="IP para bloquear"
            disabled={salvandoBloqueioIp}
          />
          <button type="submit" disabled={salvandoBloqueioIp}>
            Bloquear IP
          </button>
        </form>

        {ipsBloqueadosRegistro.length ? (
          <div className="gerenciador-acessos__blocked-list">
            {ipsBloqueadosRegistro.map((ip) => (
              <span key={ip} className="gerenciador-acessos__blocked-chip">
                <code>{ip}</code>
                <button
                  type="button"
                  onClick={() => removerIpBloqueado(ip)}
                  disabled={salvandoBloqueioIp}
                >
                  remover
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="gerenciador-acessos__block-note">Nenhum IP bloqueado.</p>
        )}

        {erroBloqueioIp ? (
          <p className="gerenciador-acessos__error">{erroBloqueioIp}</p>
        ) : null}
        {mensagemBloqueioIp ? (
          <p className="gerenciador-acessos__success">{mensagemBloqueioIp}</p>
        ) : null}
      </div>

      <div className="gerenciador-acessos__block-panel">
        <div>
          <strong>Bloqueio de registro por usuario</strong>
          <p>
            UIDs ou emails nesta lista nao geram novos registros de navegacao/acesso
            quando o visitante estiver logado. Visitantes anonimos continuam dependendo
            do identificador de navegacao ou IP.
          </p>
        </div>

        <form
          className="gerenciador-acessos__block-form"
          onSubmit={(event) => {
            event.preventDefault();
            adicionarUsuarioBloqueado(usuarioBloqueioInput);
          }}
        >
          <input
            type="text"
            value={usuarioBloqueioInput}
            onChange={(event) => setUsuarioBloqueioInput(event.target.value)}
            placeholder="UID ou email para bloquear"
            disabled={salvandoBloqueioUsuario}
          />
          <button type="submit" disabled={salvandoBloqueioUsuario}>
            Bloquear usuario
          </button>
        </form>

        {usuariosBloqueadosRegistro.length ? (
          <div className="gerenciador-acessos__blocked-list">
            {usuariosBloqueadosRegistro.map((usuario) => (
              <span key={usuario} className="gerenciador-acessos__blocked-chip">
                <code>{usuario}</code>
                <button
                  type="button"
                  onClick={() => removerUsuarioBloqueado(usuario)}
                  disabled={salvandoBloqueioUsuario}
                >
                  remover
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="gerenciador-acessos__block-note">Nenhum usuario bloqueado.</p>
        )}

        {erroBloqueioUsuario ? (
          <p className="gerenciador-acessos__error">{erroBloqueioUsuario}</p>
        ) : null}
        {mensagemBloqueioUsuario ? (
          <p className="gerenciador-acessos__success">{mensagemBloqueioUsuario}</p>
        ) : null}
          </div>
        </>
      ) : null}

      {exibirPainelRastreabilidade ? (
        <section
          className="gerenciador-acessos__tracking-panel"
          data-tracking-tab={abaPainelRastreavel}
        >
        <div className="gerenciador-acessos__tracking-head">
          <div>
            <strong>Painel central de rastreabilidade</strong>
            <p className="gerenciador-acessos__block-note">
              Consolida links rastreaveis, espacos mais acessados, origens planejadas e ultimas
              leituras com base no recorte atual de projeto/data.
            </p>
          </div>
          <div className="gerenciador-acessos__tracking-actions">
            <button
              type="button"
              className="gerenciador-acessos__refresh"
              onClick={exportarPainelCentralCsv}
              disabled={!painelRastreabilidade.eventosFiltrados.length}
            >
              Exportar CSV
            </button>
            <button
              type="button"
              className="gerenciador-acessos__refresh"
              onClick={() => {
                void carregarPainelRastreavel();
              }}
              disabled={carregandoPainelRastreavel}
            >
              {carregandoPainelRastreavel ? "Atualizando painel..." : "Atualizar painel"}
            </button>
          </div>
        </div>

        {erroPainelRastreavel ? (
          <p className="gerenciador-acessos__error">{erroPainelRastreavel}</p>
        ) : null}

        <div className="gerenciador-acessos__tracking-tabs" role="tablist" aria-label="Areas de rastreabilidade">
          {TRACKING_PANEL_TABS.map((aba) => (
            <button
              key={aba.id}
              type="button"
              role="tab"
              aria-selected={abaPainelRastreavel === aba.id}
              className={
                abaPainelRastreavel === aba.id
                  ? "gerenciador-acessos__tracking-tab is-active"
                  : "gerenciador-acessos__tracking-tab"
              }
              onClick={() => setAbaPainelRastreavel(aba.id)}
            >
              {aba.label}
            </button>
          ))}
        </div>

        <div className="gerenciador-acessos__tracking-filters">
          <label className="gerenciador-acessos__filter gerenciador-acessos__filter--compact">
            <span>Tipo do rastreavel</span>
            <select
              value={filtroPainelTipo}
              onChange={(event) => setFiltroPainelTipo(event.target.value)}
            >
              <option value="">Todos</option>
              <option value="link">Links</option>
              <option value="card">Cards</option>
            </select>
          </label>

          <label className="gerenciador-acessos__filter">
            <span>Espaco</span>
            <select
              value={filtroPainelEspaco}
              onChange={(event) => setFiltroPainelEspaco(event.target.value)}
            >
              <option value="">Todos</option>
              {painelRastreabilidadeBase.opcoesEspaco.map((espaco) => (
                <option key={espaco} value={espaco}>
                  {espaco}
                </option>
              ))}
            </select>
          </label>

          <label className="gerenciador-acessos__filter">
            <span>Origem planejada</span>
            <select
              value={filtroPainelOrigem}
              onChange={(event) => setFiltroPainelOrigem(event.target.value)}
            >
              <option value="">Todas</option>
              {painelRastreabilidadeBase.opcoesOrigem.map((origem) => (
                <option key={origem} value={origem}>
                  {origem}
                </option>
              ))}
            </select>
          </label>

          <label className="gerenciador-acessos__filter">
            <span>Cidade/Pais</span>
            <select
              value={filtroPainelLocal}
              onChange={(event) => setFiltroPainelLocal(event.target.value)}
            >
              <option value="">Todos</option>
              {painelRastreabilidadeBase.opcoesLocal.map((local) => (
                <option key={local} value={local}>
                  {local}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="gerenciador-acessos__refresh"
            onClick={() => {
              setFiltroPainelTipo("");
              setFiltroPainelEspaco("");
              setFiltroPainelOrigem("");
              setFiltroPainelLocal("");
            }}
            disabled={!painelTemFiltrosAtivos}
          >
            Limpar filtros do painel
          </button>
        </div>

        <div className="gerenciador-acessos__tracking-cards gerenciador-acessos__tracking-section gerenciador-acessos__tracking-section--geral">
          {painelRastreabilidade.cardItems.map((item) => (
            <article className="gerenciador-acessos__tracking-card" key={item.label}>
              <span className="gerenciador-acessos__tracking-label">{item.label}</span>
              <strong className="gerenciador-acessos__tracking-value">{item.value}</strong>
              <span className="gerenciador-acessos__tracking-detail">{item.detail}</span>
            </article>
          ))}
        </div>

        <div className="gerenciador-acessos__tracking-grid">
          <article className="gerenciador-acessos__tracking-box gerenciador-acessos__tracking-box--wide gerenciador-acessos__tracking-section gerenciador-acessos__tracking-section--links">
            <div className="gerenciador-acessos__tracking-box-head">
              <div>
                <strong>Centro de Links Rastreaveis</strong>
                <span>criar, copiar, duplicar, pausar e excluir links de espacos</span>
              </div>
              <span>{`${linksRastreaveisOperacionais.length} link(s) no recorte`}</span>
            </div>

            <form
              className="gerenciador-acessos__tracking-link-form"
              onSubmit={criarLinkRastreavelCentral}
            >
              <label className="gerenciador-acessos__filter">
                <span>Projeto</span>
                <select
                  value={novoLinkRastreavel.projectSystemKey || filtroProjeto}
                  onChange={(event) => selecionarProjetoNovoLinkRastreavel(event.target.value)}
                  disabled={salvandoLinkRastreavel}
                >
                  <option value="">Selecione</option>
                  {opcoesProjeto.map((projeto) => (
                    <option key={`novo-link-${projeto.value}`} value={projeto.value}>
                      {projeto.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="gerenciador-acessos__filter">
                <span>Owner UID</span>
                <input
                  type="text"
                  value={novoLinkRastreavel.ownerUserId}
                  onChange={(event) =>
                    atualizarCampoNovoLinkRastreavel("ownerUserId", event.target.value)
                  }
                  placeholder="UID do owner do espaco"
                  disabled={salvandoLinkRastreavel}
                />
              </label>

              <label className="gerenciador-acessos__filter gerenciador-acessos__filter--compact">
                <span>Espaco ID</span>
                <input
                  type="text"
                  value={novoLinkRastreavel.espacoId}
                  onChange={(event) =>
                    atualizarCampoNovoLinkRastreavel("espacoId", event.target.value)
                  }
                  placeholder="home, portfolio..."
                  disabled={salvandoLinkRastreavel}
                />
              </label>

              <label className="gerenciador-acessos__filter gerenciador-acessos__filter--compact">
                <span>Nome do espaco</span>
                <input
                  type="text"
                  value={novoLinkRastreavel.espacoNome}
                  onChange={(event) =>
                    atualizarCampoNovoLinkRastreavel("espacoNome", event.target.value)
                  }
                  placeholder="Rotulo opcional"
                  disabled={salvandoLinkRastreavel}
                />
              </label>

              <label className="gerenciador-acessos__filter">
                <span>Base URL do projeto</span>
                <input
                  type="url"
                  value={novoLinkRastreavel.baseUrl || resolveProjetoBaseUrl(projetoSelecionadoNovoLink)}
                  onChange={(event) =>
                    atualizarCampoNovoLinkRastreavel("baseUrl", event.target.value)
                  }
                  placeholder="https://seu-projeto.vercel.app"
                  disabled={salvandoLinkRastreavel}
                />
              </label>

              <label className="gerenciador-acessos__filter">
                <span>URL destino</span>
                <input
                  type="url"
                  value={novoLinkRastreavel.destinoUrl}
                  onChange={(event) =>
                    atualizarCampoNovoLinkRastreavel("destinoUrl", event.target.value)
                  }
                  placeholder="Pagina final que o link deve abrir"
                  disabled={salvandoLinkRastreavel}
                />
              </label>

              <label className="gerenciador-acessos__filter gerenciador-acessos__filter--wide">
                <span>Origem planejada / descricao</span>
                <input
                  type="text"
                  value={novoLinkRastreavel.origemPlanejada}
                  onChange={(event) =>
                    atualizarCampoNovoLinkRastreavel("origemPlanejada", event.target.value)
                  }
                  placeholder="Ex.: LinkedIn, QR do curriculo, cartaz da faculdade..."
                  disabled={salvandoLinkRastreavel}
                />
              </label>

              <button
                type="submit"
                className="gerenciador-acessos__refresh gerenciador-acessos__tracking-link-submit"
                disabled={salvandoLinkRastreavel}
              >
                {salvandoLinkRastreavel ? "Criando link..." : "Criar link rastreavel"}
              </button>
            </form>

            {erroLinkRastreavel ? (
              <p className="gerenciador-acessos__error">{erroLinkRastreavel}</p>
            ) : null}
            {mensagemLinkRastreavel ? (
              <p className="gerenciador-acessos__success">{mensagemLinkRastreavel}</p>
            ) : null}

            {linksRastreaveisOperacionais.length ? (
              <div className="gerenciador-acessos__tracking-link-list">
                {linksRastreaveisOperacionais.map((link) => {
                  const trackingId = resolveTrackableLinkId(link);
                  const projectKey = normalizeText(
                    link?.projectSystemKey || link?.runtimeProjectKey
                  ).toLowerCase();
                  const projeto = projetosMap.get(projectKey);
                  const urlRastreavel =
                    normalizeText(link?.urlRastreavel) ||
                    buildAbsoluteUrlFromBase(
                      resolveProjetoBaseUrl(projeto),
                      link?.trackingRoute || (trackingId ? `/r/${trackingId}` : "")
                    );
                  const status = resolveTrackableLinkStatus(link);
                  const destino = normalizeText(link?.destinoUrl) || "--";
                  const origem =
                    normalizeText(link?.origemPlanejada || link?.descricao) ||
                    "Link rastreavel";
                  const isActionRunning = (acao) =>
                    acaoLinkRastreavelId === `${trackingId}:${acao}`;
                  const podeExcluirLinkRastreavel = usuarioPodeRemoverRegistrosAuditaveis(
                    projectKey,
                    link
                  );

                  return (
                    <article
                      className="gerenciador-acessos__tracking-link-item"
                      key={trackingId}
                    >
                      <div className="gerenciador-acessos__tracking-link-main">
                        <strong>{origem}</strong>
                        <span>{`Projeto: ${
                          normalizeText(projeto?.nomeProjeto) || projectKey || "--"
                        }`}</span>
                        <span>{`Espaco: ${resolveTrackableSpaceLabel(link)}`}</span>
                        <span>{`Tracking ID: ${trackingId || "--"}`}</span>
                        <span>{`Status: ${status}`}</span>
                        <span>{`Destino: ${destino}`}</span>
                        <span>{`URL rastreavel: ${urlRastreavel || "--"}`}</span>
                      </div>

                      <div className="gerenciador-acessos__tracking-item-actions">
                        <button
                          type="button"
                          className="gerenciador-acessos__tracking-item-button"
                          onClick={() => {
                            void abrirDetalheRastreavel({
                              ...link,
                              kind: "link",
                              itemId: trackingId,
                              titulo: origem,
                              projectLabel:
                                normalizeText(projeto?.nomeProjeto) || projectKey || "--",
                              spaceLabel: resolveTrackableSpaceLabel(link),
                            });
                          }}
                          disabled={!trackingId}
                        >
                          Historico
                        </button>
                        <button
                          type="button"
                          className="gerenciador-acessos__tracking-item-button"
                          onClick={() => {
                            void copiarLinkRastreavelCentral(urlRastreavel);
                          }}
                          disabled={!urlRastreavel}
                        >
                          Copiar
                        </button>
                        <button
                          type="button"
                          className="gerenciador-acessos__tracking-item-button"
                          onClick={() => {
                            void duplicarLinkRastreavelCentral(link);
                          }}
                          disabled={!trackingId || isActionRunning("duplicar")}
                        >
                          {isActionRunning("duplicar") ? "Duplicando..." : "Duplicar"}
                        </button>
                        <button
                          type="button"
                          className="gerenciador-acessos__tracking-item-button"
                          onClick={() => {
                            abrirAuditoriaEntidade({
                              projectSystemKey: projectKey,
                              entityType: "trackableLink",
                              entityId: trackingId,
                            });
                          }}
                          disabled={!trackingId}
                        >
                          Auditoria
                        </button>
                        {status === "Ativo" ? (
                          <button
                            type="button"
                            className="gerenciador-acessos__tracking-item-button"
                            onClick={() => {
                              void atualizarStatusLinkRastreavelCentral(link, "pausar");
                            }}
                            disabled={!trackingId || isActionRunning("pausar")}
                          >
                            {isActionRunning("pausar") ? "Pausando..." : "Pausar"}
                          </button>
                        ) : status === "Pausado" ? (
                          <button
                            type="button"
                            className="gerenciador-acessos__tracking-item-button"
                            onClick={() => {
                              void atualizarStatusLinkRastreavelCentral(link, "ativar");
                            }}
                            disabled={!trackingId || isActionRunning("ativar")}
                          >
                            {isActionRunning("ativar") ? "Ativando..." : "Ativar"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="gerenciador-acessos__tracking-detail-danger"
                          onClick={() => {
                            void atualizarStatusLinkRastreavelCentral(link, "excluir");
                          }}
                          disabled={
                            !trackingId ||
                            status === "Excluido" ||
                            isActionRunning("excluir") ||
                            !podeExcluirLinkRastreavel
                          }
                          title={
                            !podeExcluirLinkRastreavel
                              ? "Sem permissao para excluir registros auditaveis deste projeto."
                              : undefined
                          }
                        >
                          {isActionRunning("excluir") ? "Excluindo..." : "Excluir"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="gerenciador-acessos__empty">
                Nenhum link rastreavel encontrado para o recorte atual.
              </p>
            )}
          </article>

          <article className="gerenciador-acessos__tracking-box gerenciador-acessos__tracking-box--wide gerenciador-acessos__tracking-box--timeline gerenciador-acessos__tracking-section gerenciador-acessos__tracking-section--geral">
            <div className="gerenciador-acessos__tracking-box-head">
              <strong>Pulso temporal do rastreio</strong>
              <span>{`${painelRastreabilidade.timelineDias.length} dia(s) com evento`}</span>
            </div>

            <div className="gerenciador-acessos__tracking-timeline-summary">
              {painelRastreabilidade.timelineResumoItems.map((item) => (
                <article
                  className="gerenciador-acessos__tracking-timeline-summary-item"
                  key={item.label}
                >
                  <span className="gerenciador-acessos__tracking-label">{item.label}</span>
                  <strong className="gerenciador-acessos__tracking-value">{item.value}</strong>
                  <span className="gerenciador-acessos__tracking-detail">{item.detail}</span>
                </article>
              ))}
            </div>

            {painelRastreabilidade.timelineDias.length ? (
              <div className="gerenciador-acessos__tracking-timeline">
                {painelRastreabilidade.timelineDias.map((item) => (
                  <div className="gerenciador-acessos__tracking-timeline-row" key={item.key}>
                    <span
                      className="gerenciador-acessos__tracking-timeline-day"
                      title={item.labelCompleto}
                    >
                      {item.label}
                    </span>
                    <div className="gerenciador-acessos__tracking-timeline-bar">
                      <span
                        className="gerenciador-acessos__tracking-timeline-fill"
                        style={{ width: `${item.intensidadePercentual}%` }}
                      />
                      <span className="gerenciador-acessos__tracking-timeline-markers" />
                    </div>
                    <div className="gerenciador-acessos__tracking-timeline-meta">
                      <span>{`Total ${item.total}`}</span>
                      <span>{`Links ${item.links}`}</span>
                      <span>{`Cards ${item.cards}`}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="gerenciador-acessos__empty">
                Nenhum pulso temporal foi encontrado para este recorte.
              </p>
            )}
          </article>

          <article className="gerenciador-acessos__tracking-box gerenciador-acessos__tracking-box--wide gerenciador-acessos__tracking-section gerenciador-acessos__tracking-section--geral">
            <div className="gerenciador-acessos__tracking-box-head">
              <strong>Itens rastreaveis mais lidos</strong>
              <span>{`${painelRastreabilidade.totalItensComLeitura} item(ns) com leitura`}</span>
            </div>
            {painelRastreabilidade.rankingItens.length ? (
              <ol className="gerenciador-acessos__tracking-list">
                {painelRastreabilidade.rankingItens.map((item) => (
                  <li className="gerenciador-acessos__tracking-item" key={item.key}>
                    <strong>{item.titulo}</strong>
                    <span>{`${item.tipoLabel}: ${item.itemId}`}</span>
                    <span>{item.detail}</span>
                    <span>{`Espaco: ${item.spaceLabel}`}</span>
                    <span>{`Projeto: ${item.projectLabel}`}</span>
                    <span>{`Acessos: ${item.totalAcessos} / IDs unicos: ${item.navigationIdsTotal}`}</span>
                    <span>{`Status: ${item.status}`}</span>
                    <span>{`Ultima leitura: ${formatarData(item.ultimoAcessoMs)}`}</span>
                    <div className="gerenciador-acessos__tracking-item-actions">
                      <button
                        type="button"
                        className="gerenciador-acessos__tracking-item-button"
                        onClick={() => {
                          void abrirDetalheRastreavel(item);
                        }}
                      >
                        Ver detalhe
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="gerenciador-acessos__empty">
                Nenhum item rastreavel recebeu leitura neste recorte.
              </p>
            )}
          </article>

          <article className="gerenciador-acessos__tracking-box gerenciador-acessos__tracking-section gerenciador-acessos__tracking-section--links">
            <div className="gerenciador-acessos__tracking-box-head">
              <strong>Links mais acessados</strong>
              <span>{`${painelRastreabilidade.totalLinksComAcesso} com leitura`}</span>
            </div>
            {painelRastreabilidade.rankingLinks.length ? (
              <ol className="gerenciador-acessos__tracking-list">
                {painelRastreabilidade.rankingLinks.map((item) => (
                  <li className="gerenciador-acessos__tracking-item" key={item.itemId}>
                    <strong>{item.titulo}</strong>
                    <span>{`Tracking ID: ${item.itemId}`}</span>
                    <span>{`Espaco: ${item.spaceLabel}`}</span>
                    <span>{`Projeto: ${item.projectLabel}`}</span>
                    <span>{`Destino: ${item.destino}`}</span>
                    <span>{`Acessos: ${item.totalAcessos} / IDs unicos: ${item.navigationIdsTotal}`}</span>
                    <span>{`Status: ${item.status}`}</span>
                    <span>{`Ultima leitura: ${formatarData(item.ultimoAcessoMs)}`}</span>
                    <div className="gerenciador-acessos__tracking-item-actions">
                      <button
                        type="button"
                        className="gerenciador-acessos__tracking-item-button"
                        onClick={() => {
                          void abrirDetalheRastreavel(item);
                        }}
                      >
                        Ver detalhe
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="gerenciador-acessos__empty">
                Nenhuma leitura rastreavel encontrada neste recorte.
              </p>
            )}
          </article>

          <article className="gerenciador-acessos__tracking-box gerenciador-acessos__tracking-section gerenciador-acessos__tracking-section--cards">
            <div className="gerenciador-acessos__tracking-box-head">
              <strong>Cards rastreaveis mais lidos</strong>
              <span>{`${painelRastreabilidade.totalCardsComLeitura} com leitura`}</span>
            </div>
            {painelRastreabilidade.rankingCards.length ? (
              <ol className="gerenciador-acessos__tracking-list">
                {painelRastreabilidade.rankingCards.map((item) => (
                  <li className="gerenciador-acessos__tracking-item" key={item.itemId}>
                    <strong>{item.titulo}</strong>
                    <span>{`Print ID: ${item.itemId}`}</span>
                    <span>{item.detail}</span>
                    <span>{`Espaco: ${item.spaceLabel}`}</span>
                    <span>{`Projeto: ${item.projectLabel}`}</span>
                    <span>{`Destino: ${item.destino}`}</span>
                    <span>{`Leituras: ${item.totalAcessos} / IDs unicos: ${item.navigationIdsTotal}`}</span>
                    <span>{`Status: ${item.status}`}</span>
                    <span>{`Ultima leitura: ${formatarData(item.ultimoAcessoMs)}`}</span>
                    <div className="gerenciador-acessos__tracking-item-actions">
                      <button
                        type="button"
                        className="gerenciador-acessos__tracking-item-button"
                        onClick={() => {
                          void abrirDetalheRastreavel(item);
                        }}
                      >
                        Ver detalhe
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="gerenciador-acessos__empty">
                Nenhum card rastreavel foi lido neste recorte.
              </p>
            )}
          </article>

          <article className="gerenciador-acessos__tracking-box gerenciador-acessos__tracking-section gerenciador-acessos__tracking-section--geral">
            <div className="gerenciador-acessos__tracking-box-head">
              <strong>Espacos com mais entrada</strong>
              <span>{`${painelRastreabilidade.totalEspacos} espaco(s)`}</span>
            </div>
            {painelRastreabilidade.rankingEspacos.length ? (
              <ol className="gerenciador-acessos__tracking-list">
                {painelRastreabilidade.rankingEspacos.map((item) => (
                  <li className="gerenciador-acessos__tracking-item" key={item.key}>
                    <strong>{item.label}</strong>
                    <span>{`Projeto: ${item.projectLabel}`}</span>
                    <span>{`Acessos: ${item.acessos}`}</span>
                    <span>{`Links: ${item.linksTotal} / Cards: ${item.cardsTotal}`}</span>
                    <span>{`Ultima leitura: ${formatarData(item.ultimoAcessoMs)}`}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="gerenciador-acessos__empty">
                Ainda nao existe espaco com entrada rastreavel neste recorte.
              </p>
            )}
          </article>

          <article className="gerenciador-acessos__tracking-box gerenciador-acessos__tracking-section gerenciador-acessos__tracking-section--links">
            <div className="gerenciador-acessos__tracking-box-head">
              <strong>Origens planejadas</strong>
              <span>melhor desempenho no recorte</span>
            </div>
            {painelRastreabilidade.rankingOrigens.length ? (
              <ol className="gerenciador-acessos__tracking-list">
                {painelRastreabilidade.rankingOrigens.map((item) => (
                  <li className="gerenciador-acessos__tracking-item" key={item.label}>
                    <strong>{item.label}</strong>
                    <span>{`Acessos: ${item.acessos}`}</span>
                    <span>{`Links: ${item.linksTotal} / Cards: ${item.cardsTotal}`}</span>
                    <span>{`Ultimo acesso: ${formatarData(item.ultimoAcessoMs)}`}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="gerenciador-acessos__empty">
                Nenhuma origem planejada com leitura rastreavel ainda.
              </p>
            )}
          </article>

          <article className="gerenciador-acessos__tracking-box gerenciador-acessos__tracking-box--wide gerenciador-acessos__tracking-section gerenciador-acessos__tracking-section--mapa">
            <div className="gerenciador-acessos__tracking-box-head">
              <strong>Mapa continental de rastreabilidade</strong>
              <span>{`${painelGeoAnalise.continentesAtivos.length} continente(s) com leitura`}</span>
            </div>

            <div className="gerenciador-acessos__tracking-geo-layout">
              <div className="gerenciador-acessos__tracking-geo-map-wrap">
                <svg
                  className="gerenciador-acessos__tracking-geo-map"
                  viewBox="0 0 960 420"
                  role="img"
                  aria-label="Mapa-mundi cyberpink com atividade rastreavel por continente"
                >
                  <defs>
                    <linearGradient id="trackingGeoGridPainel" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="currentColor" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  <rect x="0" y="0" width="960" height="420" fill="url(#trackingGeoGridPainel)" />

                  {TRACKING_WORLD_REGIONS.map((regiao) => {
                    const item =
                      painelGeoAnalise.continentes.find(
                        (continente) => continente.key === regiao.key
                      ) || regiao;
                    return (
                      <g
                        key={regiao.key}
                        className={`gerenciador-acessos__tracking-geo-region${
                          item.active ? " is-active" : ""
                        }`}
                        style={
                          item.active
                            ? { ["--tracking-geo-intensity"]: `${item.intensidadePercentual}%` }
                            : undefined
                        }
                      >
                        <path d={regiao.path} />
                        <circle
                          className="gerenciador-acessos__tracking-geo-pulse"
                          cx={regiao.pulseX}
                          cy={regiao.pulseY}
                          r="10"
                        />
                        <text x={regiao.labelX} y={regiao.labelY}>
                          {`${regiao.shortLabel} ${item.total || 0}`}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="gerenciador-acessos__tracking-geo-summary">
                <div className="gerenciador-acessos__tracking-timeline-summary">
                  {painelGeoAnalise.geoResumoCards.map((item) => (
                    <article
                      className="gerenciador-acessos__tracking-timeline-summary-item"
                      key={`painel-geo-${item.label}`}
                    >
                      <span className="gerenciador-acessos__tracking-label">{item.label}</span>
                      <strong className="gerenciador-acessos__tracking-value">{item.value}</strong>
                      <span className="gerenciador-acessos__tracking-detail">{item.detail}</span>
                    </article>
                  ))}
                </div>

                <div className="gerenciador-acessos__tracking-geo-stacks">
                  <article className="gerenciador-acessos__tracking-detail-group">
                    <div className="gerenciador-acessos__tracking-detail-group-head">
                      <strong>Paises mais recorrentes</strong>
                      <span>{`${painelGeoAnalise.rankingPaises.length} destaque(s)`}</span>
                    </div>
                    {painelGeoAnalise.rankingPaises.length ? (
                      <ol className="gerenciador-acessos__tracking-list">
                        {painelGeoAnalise.rankingPaises.map((item) => (
                          <li
                            className="gerenciador-acessos__tracking-item"
                            key={`painel-pais-${item.label}`}
                          >
                            <strong>{item.label}</strong>
                            <span>{`${item.total} evento(s)`}</span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="gerenciador-acessos__empty">
                        Sem paises suficientes para montar o mapa.
                      </p>
                    )}
                  </article>

                  <article className="gerenciador-acessos__tracking-detail-group">
                    <div className="gerenciador-acessos__tracking-detail-group-head">
                      <strong>Cidades mais recorrentes</strong>
                      <span>{`${painelGeoAnalise.rankingCidades.length} destaque(s)`}</span>
                    </div>
                    {painelGeoAnalise.rankingCidades.length ? (
                      <ol className="gerenciador-acessos__tracking-list">
                        {painelGeoAnalise.rankingCidades.map((item) => (
                          <li
                            className="gerenciador-acessos__tracking-item"
                            key={`painel-cidade-${item.label}`}
                          >
                            <strong>{item.label}</strong>
                            <span>{`${item.total} evento(s)`}</span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="gerenciador-acessos__empty">
                        Sem cidades suficientes para resumir neste recorte.
                      </p>
                    )}
                  </article>
                </div>
              </div>
            </div>
          </article>

          <article className="gerenciador-acessos__tracking-box gerenciador-acessos__tracking-section gerenciador-acessos__tracking-section--mapa">
            <div className="gerenciador-acessos__tracking-box-head">
              <strong>Locais mais recorrentes</strong>
              <span>cidade e pais</span>
            </div>
            {painelRastreabilidade.rankingLocais.length ? (
              <ol className="gerenciador-acessos__tracking-list">
                {painelRastreabilidade.rankingLocais.map((item) => (
                  <li className="gerenciador-acessos__tracking-item" key={item.label}>
                    <strong>{item.label}</strong>
                    <span>{`Acessos: ${item.acessos}`}</span>
                    <span>{`Ultimo acesso: ${formatarData(item.ultimoAcessoMs)}`}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="gerenciador-acessos__empty">
                Sem cidades/paises suficientes para resumir neste recorte.
              </p>
            )}
          </article>

          <article className="gerenciador-acessos__tracking-box gerenciador-acessos__tracking-box--wide gerenciador-acessos__tracking-section gerenciador-acessos__tracking-section--eventos">
            <div className="gerenciador-acessos__tracking-box-head">
              <strong>Ultimas leituras rastreaveis</strong>
              <span>{`${painelRastreabilidade.totalEventosFiltrados} evento(s)`}</span>
            </div>
            {painelRastreabilidade.ultimosEventos.length ? (
              <ol className="gerenciador-acessos__tracking-list">
                {painelRastreabilidade.ultimosEventos.map((item) => (
                  <li className="gerenciador-acessos__tracking-item" key={item.id}>
                    <strong>{item.titulo}</strong>
                    <span>{`${item.kindLabel}: ${item.itemId}`}</span>
                    <span>{item.detail}</span>
                    <span>{`Usuario: ${item.usuario}`}</span>
                    <span>{`Espaco: ${item.spaceLabel}`}</span>
                    <span>{`Projeto: ${item.projectLabel}`}</span>
                    <span>{`Local: ${item.localizacao}`}</span>
                    <span>{`Lido em: ${item.data}`}</span>
                    <div className="gerenciador-acessos__tracking-item-actions">
                      <button
                        type="button"
                        className="gerenciador-acessos__tracking-item-button"
                        onClick={() => {
                          void abrirDetalheRastreavel(item);
                        }}
                      >
                        Abrir detalhe
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="gerenciador-acessos__empty">
                Nenhuma leitura rastreavel recente encontrada.
              </p>
            )}
          </article>
        </div>
        </section>
      ) : null}

      {exibirPainelRastreabilidade &&
      detalheRastreavel.aberto &&
      detalheRastreavel.item &&
      typeof document !== "undefined"
        ? createPortal(
            <div
              className="gerenciador-acessos__tracking-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="gerenciador-acessos-detalhe-rastreavel-titulo"
            >
          <div className="gerenciador-acessos__tracking-detail-backdrop" aria-hidden="true" />
          <section className="gerenciador-acessos__tracking-detail-panel gerenciador-acessos__tracking-detail-panel--modal">
          <div className="gerenciador-acessos__tracking-detail-head">
            <div>
              <strong id="gerenciador-acessos-detalhe-rastreavel-titulo">
                {detalheRastreavel.item.titulo}
              </strong>
              <p className="gerenciador-acessos__block-note">
                {`${detalheRastreavel.item.kindLabel} | ${detalheRastreavel.item.detail} | Espaco ${
                  detalheRastreavel.item.spaceLabel || "--"
                } | Projeto ${detalheRastreavel.item.projectLabel || "--"}`}
              </p>
            </div>
            <button
              type="button"
              className="gerenciador-acessos__tracking-detail-close"
              onClick={fecharDetalheRastreavel}
            >
              Fechar detalhe
            </button>
          </div>

          {detalheRastreavel.erro ? (
            <p className="gerenciador-acessos__error">{detalheRastreavel.erro}</p>
          ) : null}
          {detalheRastreavel.mensagem ? (
            <p className="gerenciador-acessos__success">{detalheRastreavel.mensagem}</p>
          ) : null}

          <div className="gerenciador-acessos__tracking-detail-actions">
            <button
              type="button"
              className="gerenciador-acessos__refresh"
              onClick={() => {
                void copiarTextoRastreavel(
                  detalheRastreavel.item.rastreavelUrl,
                  "URL rastreavel copiada."
                );
              }}
              disabled={!detalheRastreavel.item.rastreavelUrl}
            >
              Copiar URL rastreavel
            </button>
            <button
              type="button"
              className="gerenciador-acessos__refresh"
              onClick={() => {
                void copiarTextoRastreavel(detalheRastreavel.item.destinoUrl, "Destino copiado.");
              }}
              disabled={!detalheRastreavel.item.destinoUrl}
            >
              Copiar destino
            </button>
            <button
              type="button"
              className="gerenciador-acessos__refresh"
              onClick={() => {
                if (typeof window !== "undefined" && detalheRastreavel.item.rastreavelUrl) {
                  window.open(detalheRastreavel.item.rastreavelUrl, "_blank", "noopener,noreferrer");
                }
              }}
              disabled={!detalheRastreavel.item.rastreavelUrl}
            >
              Abrir URL rastreavel
            </button>
            <button
              type="button"
              className="gerenciador-acessos__refresh"
              onClick={() => {
                if (typeof window !== "undefined" && detalheRastreavel.item.destinoUrl) {
                  window.open(detalheRastreavel.item.destinoUrl, "_blank", "noopener,noreferrer");
                }
              }}
              disabled={!detalheRastreavel.item.destinoUrl}
            >
              Abrir destino
            </button>
            <button
              type="button"
              className="gerenciador-acessos__refresh"
              onClick={() => {
                void duplicarItemRastreavel();
              }}
              disabled={detalheRastreavel.acaoEmAndamento === "duplicar"}
            >
              {detalheRastreavel.acaoEmAndamento === "duplicar" ? "Duplicando..." : "Duplicar"}
            </button>
            <button
              type="button"
              className="gerenciador-acessos__refresh"
              onClick={exportarDetalheRastreavelCsv}
              disabled={!detalheRastreavelAnalise.eventosFiltrados.length}
            >
              Exportar CSV
            </button>
            <button
              type="button"
              className="gerenciador-acessos__tracking-detail-danger"
              onClick={() => {
                void excluirItemRastreavelSelecionado();
              }}
              disabled={
                detalheRastreavel.acaoEmAndamento === "excluir" ||
                detalheRastreavel.item.status === "Excluido" ||
                !podeExcluirDetalheRastreavel
              }
              title={
                !podeExcluirDetalheRastreavel
                  ? "Sem permissao para excluir registros auditaveis deste projeto."
                  : undefined
              }
            >
              {detalheRastreavel.acaoEmAndamento === "excluir" ? "Excluindo..." : "Excluir"}
            </button>
          </div>

          <div className="gerenciador-acessos__tracking-detail-meta">
            <span>{`ID: ${detalheRastreavel.item.itemId}`}</span>
            <span>{`Status: ${detalheRastreavel.item.status}`}</span>
            <span>{`URL rastreavel: ${detalheRastreavel.item.rastreavelUrl || "--"}`}</span>
            <span>{`Destino: ${detalheRastreavel.item.destinoUrl || "--"}`}</span>
          </div>

          <div className="gerenciador-acessos__tracking-timeline-summary">
            {detalheRastreavelAnalise.resumoCards.map((item) => (
              <article
                className="gerenciador-acessos__tracking-timeline-summary-item"
                key={`${detalheRastreavel.item.key}-${item.label}`}
              >
                <span className="gerenciador-acessos__tracking-label">{item.label}</span>
                <strong className="gerenciador-acessos__tracking-value">{item.value}</strong>
                <span className="gerenciador-acessos__tracking-detail">{item.detail}</span>
              </article>
            ))}
          </div>

          <section className="gerenciador-acessos__tracking-geo-panel">
            <div className="gerenciador-acessos__tracking-box-head">
              <strong>Geolocalizacao continental</strong>
              <span>{`${detalheRastreavelAnalise.continentesAtivos.length} continente(s) com leitura`}</span>
            </div>

            <div className="gerenciador-acessos__tracking-geo-layout">
              <div className="gerenciador-acessos__tracking-geo-map-wrap">
                <svg
                  className="gerenciador-acessos__tracking-geo-map"
                  viewBox="0 0 960 420"
                  role="img"
                  aria-label="Mapa-mundi estilizado com atividade por continente"
                >
                  <defs>
                    <linearGradient id="trackingGeoGrid" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="currentColor" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  <rect x="0" y="0" width="960" height="420" fill="url(#trackingGeoGrid)" />

                  {TRACKING_WORLD_REGIONS.map((regiao) => {
                    const item =
                      detalheRastreavelAnalise.continentes.find(
                        (continente) => continente.key === regiao.key
                      ) || regiao;
                    return (
                      <g
                        key={regiao.key}
                        className={`gerenciador-acessos__tracking-geo-region${
                          item.active ? " is-active" : ""
                        }`}
                        style={
                          item.active
                            ? { ["--tracking-geo-intensity"]: `${item.intensidadePercentual}%` }
                            : undefined
                        }
                      >
                        <path d={regiao.path} />
                        <circle
                          className="gerenciador-acessos__tracking-geo-pulse"
                          cx={regiao.pulseX}
                          cy={regiao.pulseY}
                          r="10"
                        />
                        <text x={regiao.labelX} y={regiao.labelY}>
                          {`${regiao.shortLabel} ${item.total || 0}`}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="gerenciador-acessos__tracking-geo-summary">
                <div className="gerenciador-acessos__tracking-timeline-summary">
                  {detalheRastreavelAnalise.geoResumoCards.map((item) => (
                    <article
                      className="gerenciador-acessos__tracking-timeline-summary-item"
                      key={`${detalheRastreavel.item.key}-geo-${item.label}`}
                    >
                      <span className="gerenciador-acessos__tracking-label">{item.label}</span>
                      <strong className="gerenciador-acessos__tracking-value">{item.value}</strong>
                      <span className="gerenciador-acessos__tracking-detail">{item.detail}</span>
                    </article>
                  ))}
                </div>

                <div className="gerenciador-acessos__tracking-geo-stacks">
                  <article className="gerenciador-acessos__tracking-detail-group">
                    <div className="gerenciador-acessos__tracking-detail-group-head">
                      <strong>Paises mais recorrentes</strong>
                      <span>{`${detalheRastreavelAnalise.rankingPaises.length} destaque(s)`}</span>
                    </div>
                    {detalheRastreavelAnalise.rankingPaises.length ? (
                      <ol className="gerenciador-acessos__tracking-list">
                        {detalheRastreavelAnalise.rankingPaises.map((item) => (
                          <li
                            className="gerenciador-acessos__tracking-item"
                            key={`${detalheRastreavel.item.key}-pais-${item.label}`}
                          >
                            <strong>{item.label}</strong>
                            <span>{`${item.total} evento(s)`}</span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="gerenciador-acessos__empty">
                        Sem paises suficientes para montar o mapa.
                      </p>
                    )}
                  </article>

                  <article className="gerenciador-acessos__tracking-detail-group">
                    <div className="gerenciador-acessos__tracking-detail-group-head">
                      <strong>Cidades mais recorrentes</strong>
                      <span>{`${detalheRastreavelAnalise.rankingCidades.length} destaque(s)`}</span>
                    </div>
                    {detalheRastreavelAnalise.rankingCidades.length ? (
                      <ol className="gerenciador-acessos__tracking-list">
                        {detalheRastreavelAnalise.rankingCidades.map((item) => (
                          <li
                            className="gerenciador-acessos__tracking-item"
                            key={`${detalheRastreavel.item.key}-cidade-${item.label}`}
                          >
                            <strong>{item.label}</strong>
                            <span>{`${item.total} evento(s)`}</span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="gerenciador-acessos__empty">
                        Sem cidades suficientes para resumir neste recorte.
                      </p>
                    )}
                  </article>
                </div>
              </div>
            </div>
          </section>

          <div className="gerenciador-acessos__tracking-detail-controls">
            <label className="gerenciador-acessos__filter gerenciador-acessos__filter--compact">
              <span>De</span>
              <input
                type="date"
                value={detalheRastreavel.filtroDataInicio}
                onChange={(event) => {
                  atualizarCampoDetalheRastreavel({
                    filtroDataInicio: event.target.value,
                  });
                }}
              />
            </label>
            <label className="gerenciador-acessos__filter gerenciador-acessos__filter--compact">
              <span>Ate</span>
              <input
                type="date"
                value={detalheRastreavel.filtroDataFim}
                onChange={(event) => {
                  atualizarCampoDetalheRastreavel({
                    filtroDataFim: event.target.value,
                  });
                }}
              />
            </label>
            <button
              type="button"
              className="gerenciador-acessos__refresh"
              onClick={() => {
                atualizarCampoDetalheRastreavel({
                  agruparPorNavigationId: !detalheRastreavel.agruparPorNavigationId,
                });
              }}
            >
              {detalheRastreavel.agruparPorNavigationId
                ? "Agrupado por identificador"
                : "Ver eventos soltos"}
            </button>
            <button
              type="button"
              className="gerenciador-acessos__refresh"
              onClick={() => {
                void carregarDetalheRastreavel();
              }}
              disabled={detalheRastreavel.loading}
            >
              {detalheRastreavel.loading ? "Atualizando..." : "Atualizar historico"}
            </button>
            <button
              type="button"
              className="gerenciador-acessos__refresh"
              onClick={() => {
                atualizarCampoDetalheRastreavel({
                  filtroDataInicio: "",
                  filtroDataFim: "",
                });
              }}
              disabled={!detalheRastreavel.filtroDataInicio && !detalheRastreavel.filtroDataFim}
            >
              Limpar recorte
            </button>
          </div>

          {detalheRastreavel.loading ? (
            <p className="gerenciador-acessos__empty">Carregando historico rastreavel...</p>
          ) : detalheRastreavelAnalise.eventosFiltrados.length ? (
            detalheRastreavel.agruparPorNavigationId ? (
              <div className="gerenciador-acessos__tracking-detail-groups">
                {detalheRastreavelAnalise.grupos.map((grupo) => (
                  <article
                    className="gerenciador-acessos__tracking-detail-group"
                    key={`${detalheRastreavel.item.key}-${grupo.navigationId}`}
                  >
                    <div className="gerenciador-acessos__tracking-detail-group-head">
                      <strong>
                        {grupo.navigationId === "sem_identificador"
                          ? "Sem identificador de navegacao"
                          : `Identificador ${grupo.navigationId}`}
                      </strong>
                      <span>{`${grupo.itens.length} evento(s)`}</span>
                      <span>{`Ultimo acesso: ${formatarData(grupo.ultimoAcessoMs)}`}</span>
                    </div>
                    <ol className="gerenciador-acessos__tracking-list">
                      {grupo.itens.map((evento) => (
                        <li
                          className="gerenciador-acessos__tracking-item"
                          key={`${detalheRastreavel.item.key}-${grupo.navigationId}-${evento.id || formatarData(evento?.data || evento?.criadoEm)}`}
                        >
                          <strong>{formatarData(evento?.data || evento?.criadoEm)}</strong>
                          <span>{`Usuario: ${resolveAccessUserLabel(evento)}`}</span>
                          <span>{`Local: ${buildHistoricoLocalizacao(evento)}`}</span>
                          <span>{`IP: ${normalizeText(evento?.ip) || "--"}`}</span>
                          <span>{`Navigation ID: ${resolveHistoricoNavigationId(evento) || "--"}`}</span>
                          <span>{`Dispositivo: ${normalizeText(evento?.userAgent) || "--"}`}</span>
                        </li>
                      ))}
                    </ol>
                  </article>
                ))}
              </div>
            ) : (
              <ol className="gerenciador-acessos__tracking-list">
                {detalheRastreavelAnalise.eventosFiltrados.map((evento) => (
                  <li
                    className="gerenciador-acessos__tracking-item"
                    key={`${detalheRastreavel.item.key}-${evento.id || formatarData(evento?.data || evento?.criadoEm)}`}
                  >
                    <strong>{formatarData(evento?.data || evento?.criadoEm)}</strong>
                    <span>{`Usuario: ${resolveAccessUserLabel(evento)}`}</span>
                    <span>{`Navigation ID: ${resolveHistoricoNavigationId(evento) || "--"}`}</span>
                    <span>{`Local: ${buildHistoricoLocalizacao(evento)}`}</span>
                    <span>{`IP: ${normalizeText(evento?.ip) || "--"}`}</span>
                    <span>{`Dispositivo: ${normalizeText(evento?.userAgent) || "--"}`}</span>
                  </li>
                ))}
              </ol>
            )
          ) : (
            <p className="gerenciador-acessos__empty">
              Nenhum evento rastreavel foi encontrado para os filtros aplicados.
            </p>
          )}
          </section>
            </div>,
            document.body
          )
        : null}

      {exibirAcessosOperacionais ? (
        <>
          <div className="gerenciador-acessos__summary">
        <span>{`Total exibido: ${gruposAcessos.length} grupo(s) / ${acessosFiltrados.length} evento(s)`}</span>
        <span>{`Nao lidos: ${acessosNaoLidosFiltrados.length}`}</span>
        <span>{`Bloqueados/ocultos fora da visualizacao: ${
          mostrarRegistrosBloqueados ? 0 : totalRegistrosBloqueadosOcultos
        }`}</span>
        <span>{`Pagina: ${paginaAtualSegura}/${totalPaginas}`}</span>
        <span>{`Consulta: ultimos ${ACCESS_QUERY_LIMIT} registros`}</span>
        <span>{`Atualizado: ${formatarData(ultimaAtualizacao)}`}</span>
        <button
          type="button"
          className="gerenciador-acessos__refresh"
          onClick={() => {
            void carregarAcessos();
          }}
          disabled={carregando}
        >
          {carregando ? "Atualizando..." : "Atualizar"}
        </button>
        <button
          type="button"
          className="gerenciador-acessos__refresh"
          onClick={() => {
            void marcarComoLido(acessosNaoLidosFiltrados.map((acesso) => acesso.id));
          }}
          disabled={marcandoLido || !acessosNaoLidosFiltrados.length}
        >
          {marcandoLido ? "Marcando..." : "Marcar exibidos como lidos"}
        </button>
      </div>

      {mensagemLeitura ? (
        <p className="gerenciador-acessos__success">{mensagemLeitura}</p>
      ) : null}

      {totalPaginas > 1 ? (
        <div className="gerenciador-acessos__pagination">
          <button
            type="button"
            onClick={() => setPaginaAtual((prev) => Math.max(1, prev - 1))}
            disabled={paginaAtualSegura <= 1}
          >
            Anterior
          </button>
          <span>{`Pagina ${paginaAtualSegura} de ${totalPaginas}`}</span>
          <button
            type="button"
            onClick={() => setPaginaAtual((prev) => Math.min(totalPaginas, prev + 1))}
            disabled={paginaAtualSegura >= totalPaginas}
          >
            Proxima
          </button>
        </div>
      ) : null}

      {erro ? <p className="gerenciador-acessos__error">{erro}</p> : null}

      {!erro && !acessosFiltrados.length ? (
        <p className="gerenciador-acessos__empty">Nenhum acesso encontrado.</p>
      ) : null}

      {!erro && gruposPaginados.length ? (
        <div className="gerenciador-acessos__list">
          {gruposPaginados.map((grupo) => {
            const expandido = Boolean(gruposExpandidos[grupo.key]);
            const eventosVisiveis = expandido
              ? grupo.items
              : grupo.items.slice(0, ACCESS_GROUP_PREVIEW_SIZE);
            const eventosOcultos = Math.max(0, grupo.total - eventosVisiveis.length);
            const projetosGrupo =
              grupo.projetos
                .map((projectKey) => {
                  const projeto = projetosMap.get(projectKey);
                  return normalizeText(projeto?.nomeProjeto) || projectKey;
                })
                .filter(Boolean)
                .join(", ") || "--";
            const ipsGrupo = joinUnique(grupo.ips);
            const hostsGrupo = joinUnique(grupo.hosts);
            const paisesGrupo = joinUnique(grupo.countries);
            const regioesGrupo = joinUnique([...grupo.ufs, ...grupo.regions]);
            const cidadesGrupo = joinUnique(grupo.cities);
            const orgsGrupo = joinUnique(grupo.orgs);
            const fontesGeoGrupo = joinUnique(grupo.geoSources);
            const perfisGrupo = joinUnique(grupo.perfis);
            const eventosGrupo = joinUnique(grupo.eventos);
            const idsNaoLidosGrupo = grupo.items
              .filter((acesso) => !isAccessRead(acesso))
              .map((acesso) => acesso.id);

            return (
              <article key={grupo.key} className="gerenciador-acessos__group">
                <div className="gerenciador-acessos__group-header">
                  <div>
                    <strong>{grupo.usuario}</strong>
                    <span>{`Identificador de navegacao: ${grupo.navigationId || "--"}`}</span>
                  </div>
                  {grupo.total > ACCESS_GROUP_PREVIEW_SIZE ? (
                    <button
                      type="button"
                      className="gerenciador-acessos__more"
                      onClick={() =>
                        setGruposExpandidos((prev) => ({
                          ...prev,
                          [grupo.key]: !prev[grupo.key],
                        }))
                      }
                    >
                      {expandido ? "Ver menos" : `Ver mais (${eventosOcultos})`}
                    </button>
                  ) : null}
                  {idsNaoLidosGrupo.length ? (
                    <button
                      type="button"
                      className="gerenciador-acessos__more"
                      onClick={() => {
                        void marcarComoLido(idsNaoLidosGrupo);
                      }}
                      disabled={marcandoLido}
                    >
                      Marcar grupo como lido
                    </button>
                  ) : null}
                </div>

                <div className="gerenciador-acessos__group-meta">
                  <span>{`Eventos: ${grupo.total}`}</span>
                  {grupo.totalNaoLidos ? (
                    <span className="gerenciador-acessos__unread-badge">
                      {`Nao lidos: ${grupo.totalNaoLidos}`}
                    </span>
                  ) : null}
                  {grupo.totalBloqueados ? (
                    <span className="gerenciador-acessos__blocked-badge">
                      {`Bloqueados/ocultos: ${grupo.totalBloqueados}`}
                    </span>
                  ) : null}
                  <span>{`Primeiro: ${formatarData(
                    grupo.primeiroEvento?.data || grupo.primeiroEvento?.criadoEm
                  )}`}</span>
                  <span>{`Ultimo: ${formatarData(
                    grupo.eventoMaisRecente?.data || grupo.eventoMaisRecente?.criadoEm
                  )}`}</span>
                  <span>{`Projetos: ${projetosGrupo}`}</span>
                  <span>{`Perfil: ${perfisGrupo}`}</span>
                  <span>{`Eventos tipo: ${eventosGrupo}`}</span>
                  <span>{`Hosts: ${hostsGrupo}`}</span>
                  <span>{`IPs: ${ipsGrupo}`}</span>
                  <span>{`Pais: ${paisesGrupo}`}</span>
                  <span>{`Regiao/UF: ${regioesGrupo}`}</span>
                  <span>{`Cidade: ${cidadesGrupo}`}</span>
                  <span>{`Org: ${orgsGrupo}`}</span>
                  <span>{`Geo fonte: ${fontesGeoGrupo}`}</span>
                </div>

                {grupo.ips.length ? (
                  <div className="gerenciador-acessos__ip-actions">
                    {grupo.ips.map((ip) => {
                      const ipNormalizado = normalizeIpBloqueio(ip);
                      const bloqueado = ipsBloqueadosSet.has(ipNormalizado);
                      return (
                        <button
                          key={ipNormalizado || ip}
                          type="button"
                          onClick={() =>
                            bloqueado
                              ? removerIpBloqueado(ipNormalizado)
                              : adicionarIpBloqueado(ipNormalizado)
                          }
                          disabled={salvandoBloqueioIp || !ipNormalizado}
                          className={
                            bloqueado
                              ? "gerenciador-acessos__ip-action is-blocked"
                              : "gerenciador-acessos__ip-action"
                          }
                        >
                          {bloqueado
                            ? `Liberar registro do IP ${ipNormalizado}`
                            : `Bloquear registro do IP ${ipNormalizado}`}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {grupo.userIdentifiers.length ? (
                  <div className="gerenciador-acessos__ip-actions">
                    {grupo.userIdentifiers.map((usuario) => {
                      const usuarioNormalizado = normalizeUsuarioBloqueio(usuario);
                      const bloqueado = usuariosBloqueadosSet.has(usuarioNormalizado);
                      return (
                        <button
                          key={usuarioNormalizado || usuario}
                          type="button"
                          onClick={() =>
                            bloqueado
                              ? removerUsuarioBloqueado(usuarioNormalizado)
                              : adicionarUsuarioBloqueado(usuarioNormalizado)
                          }
                          disabled={salvandoBloqueioUsuario || !usuarioNormalizado}
                          className={
                            bloqueado
                              ? "gerenciador-acessos__ip-action is-blocked"
                              : "gerenciador-acessos__ip-action"
                          }
                        >
                          {bloqueado
                            ? `Liberar registro de ${formatarUsuarioBloqueio(
                                usuarioNormalizado
                              )}`
                            : `Bloquear registro de ${formatarUsuarioBloqueio(
                                usuarioNormalizado
                              )}`}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className="gerenciador-acessos__events">
                  {eventosVisiveis.map((acesso) => {
                    const projectKey = resolveAccessProjectKey(acesso);
                    const projeto = projetosMap.get(projectKey);
                    const navigationId = resolveAccessNavigationId(acesso) || "--";
                    const ipAcesso = resolveAccessIp(acesso) || "--";
                    const origemAcesso = resolveOrigemAcesso(acesso) || "--";
                    const tipoUsuario = resolveTipoUsuario(acesso);
                    const geoInfo = resolveAccessGeoInfo(acesso);
                    const paisAcesso = resolveGeoText(geoInfo.country);
                    const regiaoAcesso = resolveGeoText(geoInfo.uf || geoInfo.region);
                    const cidadeAcesso = resolveGeoText(geoInfo.city);
                    const orgAcesso = resolveGeoText(geoInfo.org);
                    const fonteGeoAcesso = resolveGeoText(geoInfo.source);
                    const erroGeoAcesso = resolveGeoText(geoInfo.error);
                    const visibilidadeAba = resolveGeoText(
                      acesso?.documentVisibility || acesso?.visibilityState
                    );
                    const motivoRegistro = resolveGeoText(
                      acesso?.registroMotivo || acesso?.motivoRegistro
                    );
                    const registroBloqueado = isAccessRecordHiddenFromMainView(
                      acesso,
                      ipsBloqueadosSet,
                      usuariosBloqueadosSet
                    );
                    const acessoLido = isAccessRead(acesso);
                    const removendoEsteAcesso = removendoAcessoId === normalizeText(acesso?.id);
                    const podeRemoverAcesso = usuarioPodeRemoverRegistrosAuditaveis(
                      projectKey,
                      acesso
                    );
                    const motivoBloqueio = resolveGeoText(
                      acesso?.bloqueadoPor || acesso?.motivoBloqueio
                    );
                    const tempoAba = formatarDuracaoMs(acesso?.tempoDesdeAberturaMs);
                    const coordenadasAcesso =
                      geoInfo.latitude !== null && geoInfo.longitude !== null
                        ? `${geoInfo.latitude}, ${geoInfo.longitude}`
                        : "--";

                    return (
                      <article key={acesso.id} className="gerenciador-acessos__card">
                        <div className="gerenciador-acessos__topline">
                          <strong>{resolveAccessUserLabel(acesso)}</strong>
                          {registroBloqueado ? (
                            <span className="gerenciador-acessos__blocked-badge">
                              BLOQUEADO/OCULTO
                            </span>
                          ) : null}
                          <span
                            className={
                              acessoLido
                                ? "gerenciador-acessos__read-badge"
                                : "gerenciador-acessos__unread-badge"
                            }
                          >
                            {acessoLido ? "LIDO" : "NAO LIDO"}
                          </span>
                          <span>{`Data/Hora: ${formatarData(
                            acesso?.data || acesso?.criadoEm
                          )}`}</span>
                        </div>
                        <div className="gerenciador-acessos__meta">
                          <span>{`Projeto: ${
                            normalizeText(projeto?.nomeProjeto) ||
                            normalizeText(acesso?.projectNome) ||
                            projectKey ||
                            "--"
                          }`}</span>
                          <span>{`Status: ${acessoLido ? "LIDO" : "NAO LIDO"}`}</span>
                          <span>{`Perfil: ${normalizeText(acesso?.perfilAcesso) || "--"}`}</span>
                          <span>{`Evento: ${normalizeText(acesso?.eventoTipo) || "--"}`}</span>
                          {normalizeText(acesso?.eventoTipo) === "space_switch" ? (
                            <>
                              <span>{`Espaco origem: ${normalizeText(acesso?.origemEspacoNome || acesso?.origemEspacoId) || "--"}`}</span>
                              <span>{`Espaco destino: ${normalizeText(acesso?.destinoEspacoNome || acesso?.destinoEspacoId) || "--"}`}</span>
                            </>
                          ) : null}
                          <span>{`Motivo: ${motivoRegistro}`}</span>
                          <span>{`Bloqueio/ocultacao: ${registroBloqueado ? motivoBloqueio : "--"}`}</span>
                          <span>{`Visibilidade: ${visibilidadeAba}`}</span>
                          <span>{`Tempo aba: ${tempoAba}`}</span>
                          <span>{`Origem: ${origemAcesso}`}</span>
                          <span>{`Tipo usuario: ${tipoUsuario}`}</span>
                          <span>{`Origem rastreavel: ${normalizeText(acesso?.origemRastreavel) || "--"}`}</span>
                          <span>{`Tracking ID: ${normalizeText(acesso?.trackingId) || "--"}`}</span>
                          <span>{`Origem planejada: ${normalizeText(acesso?.trackingOrigemPlanejada) || "--"}`}</span>
                          <span>{`Destino rastreavel: ${normalizeText(acesso?.trackingDestinoUrl) || "--"}`}</span>
                          <span>{`Runtime: ${normalizeText(acesso?.runtimeProjectId) || "--"}`}</span>
                          <span>{`Host: ${normalizeText(acesso?.hostname) || "--"}`}</span>
                          <span>{`IP: ${ipAcesso}`}</span>
                          <span>{`UID: ${normalizeText(acesso?.uid) || "--"}`}</span>
                          <span>{`Email: ${normalizeText(acesso?.email) || "--"}`}</span>
                          <span>{`Identificador de navegacao: ${navigationId}`}</span>
                          <span>{`Pais: ${paisAcesso}`}</span>
                          <span>{`Regiao: ${regiaoAcesso}`}</span>
                          <span>{`Cidade: ${cidadeAcesso}`}</span>
                          <span>{`Org: ${orgAcesso}`}</span>
                          <span>{`Geo fonte: ${fonteGeoAcesso}`}</span>
                          <span>{`Geo erro: ${erroGeoAcesso}`}</span>
                          <span>{`Coordenadas: ${coordenadasAcesso}`}</span>
                        </div>
                        <div className="gerenciador-acessos__path">
                          <code>{normalizeText(acesso?.fullPath || acesso?.path) || "/"}</code>
                        </div>
                        <div className="gerenciador-acessos__ip-actions">
                          {!acessoLido ? (
                            <button
                              type="button"
                              className="gerenciador-acessos__ip-action"
                              onClick={() => {
                                void marcarComoLido([acesso.id]);
                              }}
                              disabled={marcandoLido || removendoEsteAcesso}
                            >
                              Marcar como lido
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="gerenciador-acessos__ip-action gerenciador-acessos__ip-action--danger"
                            onClick={() => {
                              void removerRegistroAcesso(acesso.id);
                            }}
                            disabled={removendoEsteAcesso || !podeRemoverAcesso}
                            title={
                              !podeRemoverAcesso
                                ? "Sem permissao para remover registros auditaveis deste projeto."
                                : undefined
                            }
                          >
                            {removendoEsteAcesso ? "Removendo..." : "Remover registro"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {totalPaginas > 1 ? (
        <div className="gerenciador-acessos__pagination">
          <button
            type="button"
            onClick={() => setPaginaAtual((prev) => Math.max(1, prev - 1))}
            disabled={paginaAtualSegura <= 1}
          >
            Anterior
          </button>
          <span>{`Pagina ${paginaAtualSegura} de ${totalPaginas}`}</span>
          <button
            type="button"
            onClick={() => setPaginaAtual((prev) => Math.min(totalPaginas, prev + 1))}
            disabled={paginaAtualSegura >= totalPaginas}
          >
            Proxima
          </button>
        </div>
      ) : null}
        </>
      ) : null}
    </section>
  );
}

export default ListaAcessos;
