import { useCallback, useEffect, useMemo, useState } from "react";
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../../Banco/init-firebase";
import {
  getPrimaryProjectCollection,
  getPrimaryProjectDoc,
} from "../../Banco/projectDataRefs";
import ProjectLoadingFallback from "../Geral/ProjectLoadingFallback";
import { obterStatusMercadoPago, obterStatusPixManual } from "../Pagamentos/mercadoPagoApi";
import {
  CYBERPINK_SUBTHEMES,
  getCyberpinkSubthemeLabel,
  normalizeCyberpinkSubtheme,
} from "../Temas/cyberpink/subthemes";
import {
  DEFAULT_SISTEMA_CONFIG,
  isOneOwnerComEntradaPublica,
  obterConfigSistema,
  obterRotulosEspaco,
} from "../Sistema/configSistema";
import {
  normalizarPermissaoGestaoModulo,
  usuarioPodeGerenciarPorPermissao,
} from "../Sistema/modulosPermissoes";
import { listarIconCollectionsNoGerenciador } from "../Sistema/gerenciadorProjetosApi";
import {
  removerEstruturaPublicaEspaco,
  sincronizarEstruturaPublicaEspaco,
} from "./firebaseEspacos";
import {
  criarLinkRastreavelEspaco,
  excluirLinkRastreavelEspaco,
  listarAcessosLinkRastreavelEspaco,
  listarLinksRastreaveisEspaco,
} from "./trackableLinksApi";
import { registrarAuditLog } from "../Sistema/auditLogsApi";

const capitalizar = (texto = "") =>
  texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "";

const OPCOES_VISIBILIDADE_ESPACO_BASE = [
  { value: "publico", label: "Publico" },
  { value: "publico_restritivo", label: "Publico restritivo" },
  { value: "privado", label: "Privado (autenticado)" },
];

const OPCOES_VISIBILIDADE_ESPACO_ASSINATURA = [
  { value: "exclusivo_assinante", label: "Exclusivo assinante" },
];

const LABEL_VISIBILIDADE_ESPACO = {
  publico: "Publico",
  publico_restritivo: "Publico restritivo",
  privado: "Privado (autenticado)",
  exclusivo_assinante: "Exclusivo assinante",
};
const CYBERPINK_THEME_KEY = "CYBERPINK";

const criarEstadoLinksRastreaveis = (patch = {}) => ({
  aberto: false,
  loading: false,
  erro: "",
  itens: [],
  historicos: {},
  descricao: "",
  criando: false,
  excluindoId: "",
  mensagem: "",
  ...patch,
});

const criarEstadoHistoricoLinkRastreavel = (patch = {}) => ({
  aberto: false,
  loading: false,
  erro: "",
  itens: [],
  filtroDataInicio: "",
  filtroDataFim: "",
  agruparPorNavigationId: true,
  ...patch,
});

const encodeRouteSegment = (value = "") => encodeURIComponent(String(value || "").trim());

const montarUrlAbsoluta = (rota = "") => {
  const rotaNormalizada = String(rota || "").trim();
  if (!rotaNormalizada) return "";
  try {
    return new URL(rotaNormalizada, window.location.origin).href;
  } catch {
    return rotaNormalizada;
  }
};

const formatarDataCurta = (value = null) => {
  if (!value) return "--";
  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : Number.isFinite(Number(value?.seconds))
        ? new Date(Number(value.seconds) * 1000)
        : new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("pt-BR");
};

const resolveDataTimestampMs = (value = null) => {
  if (!value) return NaN;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (Number.isFinite(Number(value?.seconds))) return Number(value.seconds) * 1000;
  const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : NaN;
};

const resolveHistoricoNavigationId = (acesso = {}) =>
  String(acesso?.navigationId || acesso?.visitorHash || acesso?.hash || "").trim();

const buildHistoricoLocalizacao = (acesso = {}) => {
  const cidade = String(acesso?.city || acesso?.cidade || "").trim();
  const pais = String(acesso?.country || acesso?.pais || "").trim();
  return [cidade, pais].filter(Boolean).join(", ") || "--";
};

const resolveStatusLinkRastreavel = (link = {}) => {
  const status = String(link?.status || "").trim().toLowerCase();
  if (link?.excluido === true || link?.ativo === false || status === "excluido") {
    return "Excluido";
  }
  return "Ativo";
};

const csvEscape = (value = "") => `"${String(value ?? "").replace(/"/g, '""')}"`;

const buildIconSelectionValue = (espaco = {}) => {
  const collectionId = String(espaco?.iconCollectionId || "").trim();
  const iconId = String(espaco?.iconId || "").trim();
  if (!collectionId || !iconId) return "";
  return `${collectionId}::${iconId}`;
};

const parseIconSelectionValue = (valor = "", colecoes = []) => {
  const [collectionId, iconId] = String(valor || "").split("::");
  if (!collectionId || !iconId) {
    return {
      iconCollectionId: "",
      iconId: "",
      iconUrl: "",
      iconLabel: "",
    };
  }

  const colecao = (colecoes || []).find((item) => item.id === collectionId);
  const icon = (colecao?.icons || []).find((item) => item.id === iconId);
  if (!icon) {
    return {
      iconCollectionId: "",
      iconId: "",
      iconUrl: "",
      iconLabel: "",
    };
  }

  return {
    iconCollectionId: collectionId,
    iconId,
    iconUrl: String(icon.url || "").trim(),
    iconLabel: String(icon.label || "").trim(),
  };
};

export default function EspacoManager() {
  const [homeDaSkin, setHomeDaSkin] = useState(null);
  const [espacosRelacionados, setEspacosRelacionados] = useState([]);
  const [espacosRelacionaveis, setEspacosRelacionaveis] = useState([]);
  const [novoNome, setNovoNome] = useState("");
  const [novaVisibilidade, setNovaVisibilidade] = useState("privado");
  const [loading, setLoading] = useState(false);

  const [editingEspacoId, setEditingEspacoId] = useState(null);
  const [editingNome, setEditingNome] = useState("");
  const [editingVisibilidade, setEditingVisibilidade] = useState("privado");
  const [editingIconSelection, setEditingIconSelection] = useState("");
  const [editingSubtema, setEditingSubtema] = useState(normalizeCyberpinkSubtheme());
  const [novaSelecaoIcone, setNovaSelecaoIcone] = useState("");
  const [novoSubtema, setNovoSubtema] = useState(normalizeCyberpinkSubtheme());
  const [homeIconSelection, setHomeIconSelection] = useState("");
  const [homeSubtemaSelection, setHomeSubtemaSelection] = useState(normalizeCyberpinkSubtheme());
  const [nomeEspacoSingular, setNomeEspacoSingular] = useState(
    DEFAULT_SISTEMA_CONFIG.nomeEspacoSingular
  );
  const [nomeEspacoPlural, setNomeEspacoPlural] = useState(
    DEFAULT_SISTEMA_CONFIG.nomeEspacoPlural
  );
  const [mercadoPagoSistemaHabilitado, setMercadoPagoSistemaHabilitado] = useState(
    DEFAULT_SISTEMA_CONFIG.mercadoPagoHabilitado
  );
  const [pixManualSistemaHabilitado, setPixManualSistemaHabilitado] = useState(
    DEFAULT_SISTEMA_CONFIG.pixManualHabilitado
  );
  const [mpConectado, setMpConectado] = useState(false);
  const [pixManualConectado, setPixManualConectado] = useState(false);
  const [contextoCarregado, setContextoCarregado] = useState(false);
  const [userIdResolvido, setUserIdResolvido] = useState("");
  const [skinIdResolvida, setSkinIdResolvida] = useState("");
  const [configSistemaAtual, setConfigSistemaAtual] = useState(DEFAULT_SISTEMA_CONFIG);
  const [iconCollectionsDisponiveis, setIconCollectionsDisponiveis] = useState([]);
  const [linksRastreaveisPorEspaco, setLinksRastreaveisPorEspaco] = useState({});

  const authUidAtual = auth.currentUser?.uid || "";
  const authEmailAtual = auth.currentUser?.email || "";
  const userId = userIdResolvido || authUidAtual || "";
  const skinIdAtual = skinIdResolvida || localStorage.getItem("skinIdAtual") || "";
  const nomeEspacoSingularCapitalizado = capitalizar(nomeEspacoSingular);
  const nomeEspacoPluralCapitalizado = capitalizar(nomeEspacoPlural);
  const metodoPagamentoAssinaturaDisponivel =
    (mercadoPagoSistemaHabilitado && mpConectado) ||
    (pixManualSistemaHabilitado && pixManualConectado);
  const temaProjeto = String(
    configSistemaAtual?.temaPadraoSistema || DEFAULT_SISTEMA_CONFIG.temaPadraoSistema
  ).trim();
  const projetoUsaSubtemasCyberpink = temaProjeto.toUpperCase() === CYBERPINK_THEME_KEY;
  const colecoesIconesPermitidas = Array.isArray(configSistemaAtual?.iconCollectionIds)
    ? configSistemaAtual.iconCollectionIds
    : [];
  const iconCollectionsFiltradas = useMemo(
    () =>
      iconCollectionsDisponiveis.filter((colecao) => {
        const collectionAllowedByProject =
          !colecoesIconesPermitidas.length || colecoesIconesPermitidas.includes(colecao.id);
        const collectionAllowedByTheme =
          !Array.isArray(colecao.themeIds) ||
          !colecao.themeIds.length ||
          colecao.themeIds.includes(temaProjeto);
        return collectionAllowedByProject && collectionAllowedByTheme;
      }),
    [iconCollectionsDisponiveis, colecoesIconesPermitidas, temaProjeto]
  );
  const projetoPossuiColecoesIcones = iconCollectionsFiltradas.length > 0;
  const rastreabilidadeAcessosHabilitada =
    configSistemaAtual?.rastreabilidadeAcessosHabilitada === true;
  const modoRastreabilidadeAcessos = String(
    configSistemaAtual?.modoRastreabilidadeAcessos || "preferencial"
  ).trim().toLowerCase();
  const rastreabilidadePreferencialAtiva =
    rastreabilidadeAcessosHabilitada && modoRastreabilidadeAcessos === "preferencial";
  const oneOwnerPublicaAtiva = isOneOwnerComEntradaPublica(configSistemaAtual);
  const rastreabilidadeCriarLinksPermissao = normalizarPermissaoGestaoModulo(
    configSistemaAtual?.rastreabilidadeCriarLinksPermissao,
    DEFAULT_SISTEMA_CONFIG.rastreabilidadeCriarLinksPermissao
  );
  const rastreabilidadeHistoricoLinksPermissao = normalizarPermissaoGestaoModulo(
    configSistemaAtual?.rastreabilidadeHistoricoLinksPermissao,
    DEFAULT_SISTEMA_CONFIG.rastreabilidadeHistoricoLinksPermissao
  );

  useEffect(() => {
    if (userId && skinIdAtual) carregarEspacos();
  }, [userId, skinIdAtual]);

  useEffect(() => {
    setHomeSubtemaSelection(normalizeCyberpinkSubtheme(homeDaSkin?.subtema));
  }, [homeDaSkin?.subtema]);

  useEffect(() => {
    let ativo = true;

    async function resolverContextoEdicao() {
      try {
        const authUser = auth.currentUser;
        if (!authUser?.uid) {
          if (!ativo) return;
          setUserIdResolvido("");
          setSkinIdResolvida("");
          setContextoCarregado(true);
          return;
        }

        const configSistema = await obterConfigSistema().catch(() => DEFAULT_SISTEMA_CONFIG);
        if (!ativo) return;
        setConfigSistemaAtual(configSistema);
        const oneownerPublica = isOneOwnerComEntradaPublica(configSistema);
        const ownerUidCandidates = Array.from(
          new Set(
            [
              oneownerPublica ? configSistema?.ownerUid : "",
              oneownerPublica ? configSistema?.adminUid : "",
              oneownerPublica ? configSistema?.projectOwnerUid : "",
              oneownerPublica ? configSistema?.projectLastEditorUid : "",
              authUser.uid,
            ]
              .map((value) => String(value || "").trim())
              .filter(Boolean)
          )
        );

        let skinId = String(localStorage.getItem("skinIdAtual") || "").trim();
        let ownerUidEncontrado = "";

        for (const ownerUidCandidate of ownerUidCandidates) {
          if (!ownerUidCandidate) continue;

          const skinsRef = getPrimaryProjectCollection(db, "users", ownerUidCandidate, "skins");
          let skinsSnap = await getDocs(query(skinsRef, where("is_main", "==", true), limit(1)));

          if (skinsSnap.empty) {
            skinsSnap = await getDocs(query(skinsRef, limit(1)));
          }

          if (!skinsSnap.empty) {
            ownerUidEncontrado = ownerUidCandidate;
            skinId = skinsSnap.docs[0].id;
            localStorage.setItem("skinIdAtual", skinId);
            const username = String(skinsSnap.docs[0].data()?.username || "").trim();
            if (username) {
              localStorage.setItem("skinLogadoUser", username);
              localStorage.setItem("targetUsername", username);
            }
            break;
          }
        }

        if (!ativo) return;
        setUserIdResolvido(ownerUidEncontrado || authUser.uid);
        setSkinIdResolvida(skinId);
        setContextoCarregado(true);
      } catch {
        if (!ativo) return;
        setUserIdResolvido(auth.currentUser?.uid || "");
        setSkinIdResolvida(String(localStorage.getItem("skinIdAtual") || "").trim());
        setContextoCarregado(true);
      }
    }

    resolverContextoEdicao();
    return () => {
      ativo = false;
    };
  }, [authUidAtual]);

  useEffect(() => {
    let ativo = true;

    async function carregarNomenclatura() {
      try {
        const configSistema = await obterConfigSistema();
        if (!ativo) return;
        setConfigSistemaAtual(configSistema);
        const rotulosEspaco = obterRotulosEspaco(configSistema);
        setNomeEspacoSingular(rotulosEspaco?.singular || DEFAULT_SISTEMA_CONFIG.nomeEspacoSingular);
        setNomeEspacoPlural(rotulosEspaco?.plural || DEFAULT_SISTEMA_CONFIG.nomeEspacoPlural);
        setMercadoPagoSistemaHabilitado(configSistema?.mercadoPagoHabilitado !== false);
        setPixManualSistemaHabilitado(configSistema?.pixManualHabilitado !== false);
      } catch {
        if (!ativo) return;
        setNomeEspacoSingular(DEFAULT_SISTEMA_CONFIG.nomeEspacoSingular);
        setNomeEspacoPlural(DEFAULT_SISTEMA_CONFIG.nomeEspacoPlural);
        setMercadoPagoSistemaHabilitado(DEFAULT_SISTEMA_CONFIG.mercadoPagoHabilitado);
        setPixManualSistemaHabilitado(DEFAULT_SISTEMA_CONFIG.pixManualHabilitado);
      }
    }

    carregarNomenclatura();
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
        setIconCollectionsDisponiveis(colecoes);
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

    async function carregarStatusPagamentos() {
      try {
        const [statusMercadoPago, statusPixManual] = await Promise.allSettled([
          obterStatusMercadoPago(),
          obterStatusPixManual(),
        ]);

        if (!ativo) return;

        setMpConectado(
          statusMercadoPago.status === "fulfilled" && Boolean(statusMercadoPago.value?.conectado)
        );
        setPixManualConectado(
          statusPixManual.status === "fulfilled" &&
            Boolean(statusPixManual.value?.chavePix || statusPixManual.value?.conectado)
        );
      } catch {
        if (!ativo) return;
        setMpConectado(false);
        setPixManualConectado(false);
      }
    }

    carregarStatusPagamentos();
    return () => {
      ativo = false;
    };
  }, []);

  const proxOrdem = useMemo(() => {
    if (!espacosRelacionados.length) return 1;
    const maior = espacosRelacionados.reduce(
      (acc, e) => Math.max(acc, Number(e.ordem) || 0),
      0
    );
    return maior + 1;
  }, [espacosRelacionados]);

  const opcoesVisibilidadeEspaco = useMemo(() => {
    const opcoes = [...OPCOES_VISIBILIDADE_ESPACO_BASE];
    if (metodoPagamentoAssinaturaDisponivel) {
      opcoes.push(...OPCOES_VISIBILIDADE_ESPACO_ASSINATURA);
    }
    const valorEditando = editingVisibilidade || homeDaSkin?.visibilidade || novaVisibilidade;
    if (
      valorEditando &&
      !opcoes.some((opcao) => opcao.value === valorEditando) &&
      LABEL_VISIBILIDADE_ESPACO[valorEditando]
    ) {
      opcoes.push({
        value: valorEditando,
        label: LABEL_VISIBILIDADE_ESPACO[valorEditando],
      });
    }
    return opcoes;
  }, [
    editingVisibilidade,
    homeDaSkin?.visibilidade,
    metodoPagamentoAssinaturaDisponivel,
    novaVisibilidade,
  ]);

  const carregarEspacos = async () => {
    setLoading(true);
    try {
      try {
        await obterConfigSistema();
      } catch {
        // Continua com a leitura dos espacos com a config em cache.
      }

      const espacosSnap = await getDocs(getPrimaryProjectCollection(db, "users", userId, "espacos"));

      const todosEspacos = espacosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const home =
        todosEspacos.find((e) => e.skinOwner === skinIdAtual && e.isHome === true) || null;

      const relacionados = todosEspacos
        .filter(
          (e) =>
            Array.isArray(e.skins_relacionadas) &&
            e.skins_relacionadas.includes(skinIdAtual) &&
            e.isHome !== true
        )
        .sort(
          (a, b) =>
            (Number.isFinite(a.ordem) ? a.ordem : Number.MAX_SAFE_INTEGER) -
            (Number.isFinite(b.ordem) ? b.ordem : Number.MAX_SAFE_INTEGER)
        );

      const relacionaveis = todosEspacos
        .filter((e) => e.isHome !== true)
        .filter(
          (e) =>
            !Array.isArray(e.skins_relacionadas) ||
            !e.skins_relacionadas.includes(skinIdAtual)
        );

      await Promise.all(
        todosEspacos.map((espaco) =>
          sincronizarEstruturaPublicaEspaco(userId, {
            ...espaco,
            id: espaco.id,
            ownerUserId: espaco.ownerUserId || userId,
          })
        )
      );

      setHomeDaSkin(home);
      setEspacosRelacionados(relacionados);
      setEspacosRelacionaveis(relacionaveis);
    } finally {
      setLoading(false);
    }
  };

  const criarEspaco = async () => {
    if (!novoNome.trim()) return;
    const iconPayload = parseIconSelectionValue(novaSelecaoIcone, iconCollectionsFiltradas);

    const ref = doc(getPrimaryProjectCollection(db, "users", userId, "espacos"));

    const novoEspaco = {
      id_espaco: ref.id,
      nome: novoNome.trim(),
      ordem: proxOrdem,
      ownerUserId: userId,
      skins_relacionadas: [skinIdAtual],
      skinOwner: skinIdAtual,
      visibilidade: novaVisibilidade || "privado",
      subtema: normalizeCyberpinkSubtheme(novoSubtema),
      ...iconPayload,
      createdAt: serverTimestamp(),
      isHome: false,
    };

    await setDoc(ref, novoEspaco);
    await sincronizarEstruturaPublicaEspaco(userId, {
      ...novoEspaco,
      id: ref.id,
    });
    await registrarAuditLog({
      action: "criou_espaco",
      entityType: "espaco",
      entityId: ref.id,
      ownerUserId: userId,
      espacoId: ref.id,
      espacoNome: novoEspaco.nome,
      source: "espaco_manager",
      snapshotDepois: {
        ...novoEspaco,
        id: ref.id,
      },
      metadata: {
        skinId: skinIdAtual,
      },
    });

    setNovoNome("");
    setNovaVisibilidade("privado");
    setNovaSelecaoIcone("");
    setNovoSubtema(normalizeCyberpinkSubtheme());
    carregarEspacos();
  };

  const iniciarEdicao = (espaco) => {
    setEditingEspacoId(espaco.id);
    setEditingNome(espaco.nome || "");
    setEditingVisibilidade(espaco.visibilidade || "publico");
    setEditingIconSelection(buildIconSelectionValue(espaco));
    setEditingSubtema(normalizeCyberpinkSubtheme(espaco?.subtema));
  };

  const cancelarEdicao = () => {
    setEditingEspacoId(null);
    setEditingNome("");
    setEditingVisibilidade("privado");
    setEditingIconSelection("");
    setEditingSubtema(normalizeCyberpinkSubtheme());
  };

  const salvarEdicao = async (espacoId) => {
    if (!editingNome.trim()) return;
    const iconPayload = parseIconSelectionValue(editingIconSelection, iconCollectionsFiltradas);

    const espacoExistente = espacosRelacionados.find((espaco) => espaco.id === espacoId);
    const espacoAtualizado = {
      ...(espacoExistente || {}),
      id: espacoId,
      id_espaco: espacoId,
      nome: editingNome.trim(),
      visibilidade: editingVisibilidade || "publico",
      subtema: normalizeCyberpinkSubtheme(editingSubtema),
      ...iconPayload,
      ownerUserId: espacoExistente?.ownerUserId || userId,
    };

    await updateDoc(getPrimaryProjectDoc(db, "users", userId, "espacos", espacoId), {
      nome: editingNome.trim(),
      visibilidade: editingVisibilidade || "publico",
      subtema: normalizeCyberpinkSubtheme(editingSubtema),
      ...iconPayload,
    });
    await sincronizarEstruturaPublicaEspaco(userId, espacoAtualizado);
    await registrarAuditLog({
      action: "editou_espaco",
      entityType: "espaco",
      entityId: espacoId,
      ownerUserId: userId,
      espacoId,
      espacoNome: espacoAtualizado.nome,
      source: "espaco_manager",
      snapshotAntes: espacoExistente || null,
      snapshotDepois: espacoAtualizado,
      metadata: {
        skinId: skinIdAtual,
      },
    });

    cancelarEdicao();
    carregarEspacos();
  };

  const salvarHome = async (patch = {}) => {
    if (!homeDaSkin?.id) return;
    const proximoEspaco = {
      ...homeDaSkin,
      ...patch,
    };
    await updateDoc(getPrimaryProjectDoc(db, "users", userId, "espacos", homeDaSkin.id), {
      ...patch,
    });
    await sincronizarEstruturaPublicaEspaco(userId, {
      ...proximoEspaco,
      id: homeDaSkin.id,
      ownerUserId: proximoEspaco.ownerUserId || userId,
    });
    await registrarAuditLog({
      action: "editou_home_espaco",
      entityType: "espaco",
      entityId: homeDaSkin.id,
      ownerUserId: userId,
      espacoId: homeDaSkin.id,
      espacoNome: proximoEspaco.nome,
      source: "espaco_manager",
      snapshotAntes: homeDaSkin,
      snapshotDepois: proximoEspaco,
      metadata: {
        patch,
        skinId: skinIdAtual,
      },
    });
    carregarEspacos();
  };

  const excluirEspaco = async (espaco) => {
    const ok = window.confirm(
      `Excluir o ${nomeEspacoSingular} "${espaco.nome}"? Esta acao nao pode ser desfeita.`
    );
    if (!ok) return;

    await deleteDoc(getPrimaryProjectDoc(db, "users", userId, "espacos", espaco.id));
    await removerEstruturaPublicaEspaco(userId, espaco.id);
    await registrarAuditLog({
      action: "excluiu_espaco",
      entityType: "espaco",
      entityId: espaco.id,
      ownerUserId: userId,
      espacoId: espaco.id,
      espacoNome: espaco.nome,
      motivo: "exclusao_manual",
      source: "espaco_manager",
      snapshotAntes: espaco,
      metadata: {
        skinId: skinIdAtual,
      },
    });

    if (editingEspacoId === espaco.id) {
      cancelarEdicao();
    }

    carregarEspacos();
  };

  const salvarOrdem = async (listaOrdenada) => {
    const updates = listaOrdenada.map((espaco, index) =>
      updateDoc(getPrimaryProjectDoc(db, "users", userId, "espacos", espaco.id), {
        ordem: index + 1,
      })
    );

    await Promise.all(updates);
    await Promise.all(
      listaOrdenada.map((espaco, index) =>
        sincronizarEstruturaPublicaEspaco(userId, {
          ...espaco,
          id: espaco.id,
          ordem: index + 1,
          ownerUserId: espaco.ownerUserId || userId,
        })
      )
    );
    await registrarAuditLog({
      action: "reordenou_espacos",
      entityType: "espaco",
      entityId: "ordem",
      ownerUserId: userId,
      source: "espaco_manager",
      snapshotDepois: listaOrdenada.map((espaco, index) => ({
        id: espaco.id,
        nome: espaco.nome,
        ordem: index + 1,
      })),
      metadata: {
        skinId: skinIdAtual,
        totalEspacos: listaOrdenada.length,
      },
    });
  };

  const moverEspaco = async (espacoId, direcao) => {
    const index = espacosRelacionados.findIndex((e) => e.id === espacoId);
    if (index < 0) return;

    const novoIndex = index + direcao;
    if (novoIndex < 0 || novoIndex >= espacosRelacionados.length) return;

    const ordenada = [...espacosRelacionados];
    const [movido] = ordenada.splice(index, 1);
    ordenada.splice(novoIndex, 0, movido);

    setEspacosRelacionados(ordenada);
    await salvarOrdem(ordenada);
  };

  const relacionar = async (id) => {
    await updateDoc(getPrimaryProjectDoc(db, "users", userId, "espacos", id), {
      skins_relacionadas: arrayUnion(skinIdAtual),
    });
    const espaco = espacosRelacionaveis.find((item) => item.id === id);
    await sincronizarEstruturaPublicaEspaco(userId, {
      ...(espaco || {}),
      id,
      id_espaco: id,
      ownerUserId: espaco?.ownerUserId || userId,
      skins_relacionadas: Array.from(
        new Set([...(espaco?.skins_relacionadas || []), skinIdAtual].filter(Boolean))
      ),
    });
    await registrarAuditLog({
      action: "relacionou_skin_espaco",
      entityType: "espaco",
      entityId: id,
      ownerUserId: userId,
      espacoId: id,
      espacoNome: espaco?.nome || "",
      source: "espaco_manager",
      snapshotAntes: espaco || null,
      metadata: {
        skinId: skinIdAtual,
      },
    });
    carregarEspacos();
  };

  const remover = async (id) => {
    await updateDoc(getPrimaryProjectDoc(db, "users", userId, "espacos", id), {
      skins_relacionadas: arrayRemove(skinIdAtual),
    });
    const espaco = espacosRelacionados.find((item) => item.id === id);
    await sincronizarEstruturaPublicaEspaco(userId, {
      ...(espaco || {}),
      id,
      id_espaco: id,
      ownerUserId: espaco?.ownerUserId || userId,
      skins_relacionadas: (espaco?.skins_relacionadas || []).filter(
        (skinId) => skinId !== skinIdAtual
      ),
    });
    await registrarAuditLog({
      action: "removeu_skin_espaco",
      entityType: "espaco",
      entityId: id,
      ownerUserId: userId,
      espacoId: id,
      espacoNome: espaco?.nome || "",
      motivo: "desvinculo_skin",
      source: "espaco_manager",
      snapshotAntes: espaco || null,
      metadata: {
        skinId: skinIdAtual,
      },
    });
    carregarEspacos();
  };

  const atualizarEstadoLinksEspaco = useCallback((espacoId = "", patch = {}) => {
    const chave = String(espacoId || "").trim();
    if (!chave) return;
    setLinksRastreaveisPorEspaco((prev) => {
      const atual = prev[chave] || criarEstadoLinksRastreaveis();
      const proximoPatch = typeof patch === "function" ? patch(atual) : patch;
      return {
        ...prev,
        [chave]: {
          ...atual,
          ...proximoPatch,
        },
      };
    });
  }, []);

  const atualizarHistoricoLinkRastreavel = useCallback(
    (espacoId = "", trackingId = "", patch = {}) => {
      const chaveEspaco = String(espacoId || "").trim();
      const chaveTracking = String(trackingId || "").trim();
      if (!chaveEspaco || !chaveTracking) return;

      atualizarEstadoLinksEspaco(chaveEspaco, (prev) => {
        const atual =
          prev.historicos?.[chaveTracking] || criarEstadoHistoricoLinkRastreavel();
        const proximoPatch = typeof patch === "function" ? patch(atual) : patch;
        return {
          historicos: {
            ...(prev.historicos || {}),
            [chaveTracking]: {
              ...atual,
              ...proximoPatch,
            },
          },
        };
      });
    },
    [atualizarEstadoLinksEspaco]
  );

  const obterSkinUsernameAtual = useCallback(() => {
    if (typeof window === "undefined") return "";
    return String(
      window.localStorage.getItem("skinLogadoUser") ||
        window.localStorage.getItem("targetUsername") ||
        ""
    ).trim();
  }, []);

  const montarRotaEspacoGerenciado = useCallback(
    (espaco = {}) => {
      const nomeEspaco = encodeRouteSegment(espaco?.nome || "");
      if (!nomeEspaco) return "";
      const skinUsername = encodeRouteSegment(obterSkinUsernameAtual());
      if (oneOwnerPublicaAtiva || !skinUsername) return `/${nomeEspaco}`;
      return `/${skinUsername}/${nomeEspaco}`;
    },
    [obterSkinUsernameAtual, oneOwnerPublicaAtiva]
  );

  const usuarioPodePorPermissaoRastreabilidade = useCallback(
    (espaco = {}, permissao = "dono_espaco") =>
      usuarioPodeGerenciarPorPermissao({
        permissao,
        usuarioUid: authUidAtual,
        usuarioEmail: authEmailAtual,
        ownerProjetoUid:
          configSistemaAtual?.ownerUid ||
          configSistemaAtual?.adminUid ||
          configSistemaAtual?.projectOwnerUid,
        ownerProjetoEmail: configSistemaAtual?.ownerEmail || configSistemaAtual?.adminEmail,
        adminProjetoUid: configSistemaAtual?.adminUid,
        adminProjetoEmail: configSistemaAtual?.adminEmail,
        recursoOwnerUid: espaco?.ownerUserId || userId,
        coCriadoresUids: espaco?.coCriadoresUids,
      }),
    [authEmailAtual, authUidAtual, configSistemaAtual, userId]
  );

  const usuarioPodeCriarLinksRastreaveisEspaco = useCallback(
    (espaco = {}) =>
      usuarioPodePorPermissaoRastreabilidade(espaco, rastreabilidadeCriarLinksPermissao),
    [rastreabilidadeCriarLinksPermissao, usuarioPodePorPermissaoRastreabilidade]
  );

  const usuarioPodeVerHistoricoLinksRastreaveisEspaco = useCallback(
    (espaco = {}) =>
      usuarioPodePorPermissaoRastreabilidade(espaco, rastreabilidadeHistoricoLinksPermissao),
    [rastreabilidadeHistoricoLinksPermissao, usuarioPodePorPermissaoRastreabilidade]
  );

  const carregarLinksRastreaveisEspaco = useCallback(
    async (espaco = {}) => {
      const espacoIdAtual = String(espaco?.id || espaco?.id_espaco || "").trim();
      const ownerUserId = String(espaco?.ownerUserId || userId || "").trim();
      if (
        !espacoIdAtual ||
        !ownerUserId ||
        !rastreabilidadePreferencialAtiva ||
        !usuarioPodeVerHistoricoLinksRastreaveisEspaco(espaco)
      ) {
        return;
      }

      atualizarEstadoLinksEspaco(espacoIdAtual, {
        aberto: true,
        loading: true,
        erro: "",
        mensagem: "",
      });

      try {
        const itens = await listarLinksRastreaveisEspaco({
          ownerUserId,
          espacoId: espacoIdAtual,
        });
        atualizarEstadoLinksEspaco(espacoIdAtual, {
          loading: false,
          erro: "",
          itens,
        });
      } catch (error) {
        atualizarEstadoLinksEspaco(espacoIdAtual, {
          loading: false,
          erro:
            error?.code === "permission-denied"
              ? "Sem permissao para carregar links rastreaveis deste espaco."
              : error?.message || "Falha ao carregar links rastreaveis.",
          itens: [],
        });
      }
    },
    [
      atualizarEstadoLinksEspaco,
      rastreabilidadePreferencialAtiva,
      userId,
      usuarioPodeVerHistoricoLinksRastreaveisEspaco,
    ]
  );

  const alternarLinksRastreaveisEspaco = useCallback(
    (espaco = {}) => {
      const espacoIdAtual = String(espaco?.id || espaco?.id_espaco || "").trim();
      if (!espacoIdAtual) return;
      const estadoAtual = linksRastreaveisPorEspaco[espacoIdAtual] || criarEstadoLinksRastreaveis();
      if (estadoAtual.aberto) {
        atualizarEstadoLinksEspaco(espacoIdAtual, { aberto: false });
        return;
      }
      if (
        usuarioPodeCriarLinksRastreaveisEspaco(espaco) &&
        !usuarioPodeVerHistoricoLinksRastreaveisEspaco(espaco)
      ) {
        atualizarEstadoLinksEspaco(espacoIdAtual, {
          aberto: true,
          loading: false,
          erro: "",
          mensagem: "",
          itens: [],
        });
        return;
      }
      void carregarLinksRastreaveisEspaco(espaco);
    },
    [
      atualizarEstadoLinksEspaco,
      carregarLinksRastreaveisEspaco,
      linksRastreaveisPorEspaco,
      usuarioPodeCriarLinksRastreaveisEspaco,
      usuarioPodeVerHistoricoLinksRastreaveisEspaco,
    ]
  );

  const criarLinkRastreavelDoEspaco = useCallback(
    async (espaco = {}) => {
      const espacoIdAtual = String(espaco?.id || espaco?.id_espaco || "").trim();
      const ownerUserId = String(espaco?.ownerUserId || userId || "").trim();
      const estadoAtual = linksRastreaveisPorEspaco[espacoIdAtual] || criarEstadoLinksRastreaveis();
      const destinoUrl = montarRotaEspacoGerenciado(espaco);
      if (
        !espacoIdAtual ||
        !ownerUserId ||
        !destinoUrl ||
        !rastreabilidadePreferencialAtiva ||
        !usuarioPodeCriarLinksRastreaveisEspaco(espaco) ||
        estadoAtual.criando
      ) {
        return;
      }

      atualizarEstadoLinksEspaco(espacoIdAtual, {
        criando: true,
        erro: "",
        mensagem: "",
      });

      try {
        const descricao = String(estadoAtual.descricao || "").trim();
        const link = await criarLinkRastreavelEspaco({
          ownerUserId,
          espacoId: espacoIdAtual,
          espacoNome: espaco?.nome || "",
          skinsUsername: obterSkinUsernameAtual(),
          destinoUrl,
          descricao,
          origemPlanejada: descricao,
          permissaoCriarLinks: rastreabilidadeCriarLinksPermissao,
          permissaoHistoricoLinks: rastreabilidadeHistoricoLinksPermissao,
        });

        atualizarEstadoLinksEspaco(espacoIdAtual, (prev) => ({
          criando: false,
          descricao: "",
          mensagem: "Link rastreavel criado.",
          itens: [
            {
              id: link.trackingId,
              trackingId: link.trackingId,
              destinoUrl: link.destinoUrl,
              urlRastreavel: link.urlRastreavel,
              trackingRoute: link.trackingRoute,
              descricao,
              origemPlanejada: descricao,
              criadoEm: new Date().toISOString(),
            },
            ...(Array.isArray(prev.itens) ? prev.itens : []),
          ],
        }));
      } catch (error) {
        atualizarEstadoLinksEspaco(espacoIdAtual, {
          criando: false,
          erro:
            error?.code === "permission-denied"
              ? "Sem permissao para criar link rastreavel deste espaco."
              : error?.message || "Falha ao criar link rastreavel.",
        });
      }
    },
    [
      atualizarEstadoLinksEspaco,
      linksRastreaveisPorEspaco,
      montarRotaEspacoGerenciado,
      obterSkinUsernameAtual,
      rastreabilidadePreferencialAtiva,
      rastreabilidadeCriarLinksPermissao,
      rastreabilidadeHistoricoLinksPermissao,
      userId,
      usuarioPodeCriarLinksRastreaveisEspaco,
    ]
  );

  const copiarLinkRastreavelEspaco = useCallback(
    async (espacoId = "", url = "") => {
      const espacoIdAtual = String(espacoId || "").trim();
      const urlNormalizada = String(url || "").trim();
      if (!espacoIdAtual || !urlNormalizada || typeof navigator === "undefined" || !navigator.clipboard) {
        return;
      }
      try {
        await navigator.clipboard.writeText(urlNormalizada);
        atualizarEstadoLinksEspaco(espacoIdAtual, {
          mensagem: "Link copiado.",
          erro: "",
        });
      } catch {
        atualizarEstadoLinksEspaco(espacoIdAtual, {
          erro: "Nao foi possivel copiar o link automaticamente.",
        });
      }
    },
    [atualizarEstadoLinksEspaco]
  );

  const carregarHistoricoAcessosLinkRastreavel = useCallback(
    async (espacoId = "", trackingId = "", { abrir = true } = {}) => {
      const espacoIdAtual = String(espacoId || "").trim();
      const trackingIdNormalizado = String(trackingId || "").trim();
      if (!espacoIdAtual || !trackingIdNormalizado) return;

      atualizarHistoricoLinkRastreavel(espacoIdAtual, trackingIdNormalizado, (atual) => ({
        ...atual,
        aberto: abrir ? true : atual.aberto,
        loading: true,
        erro: "",
      }));

      try {
        const itens = await listarAcessosLinkRastreavelEspaco({
          trackingId: trackingIdNormalizado,
          limite: 50,
        });
        atualizarHistoricoLinkRastreavel(espacoIdAtual, trackingIdNormalizado, (atual) => ({
          ...atual,
          aberto: abrir ? true : atual.aberto,
          loading: false,
          erro: "",
          itens,
        }));
      } catch (error) {
        atualizarHistoricoLinkRastreavel(espacoIdAtual, trackingIdNormalizado, (atual) => ({
          ...atual,
          aberto: abrir ? true : atual.aberto,
          loading: false,
          erro:
            error?.code === "permission-denied"
              ? "Sem permissao para carregar os acessos deste link."
              : error?.message || "Falha ao carregar acessos deste link.",
          itens: [],
        }));
      }
    },
    [atualizarHistoricoLinkRastreavel]
  );

  const alternarHistoricoAcessosLinkRastreavel = useCallback(
    async (espacoId = "", trackingId = "") => {
      const espacoIdAtual = String(espacoId || "").trim();
      const trackingIdNormalizado = String(trackingId || "").trim();
      if (!espacoIdAtual || !trackingIdNormalizado) return;

      const estadoAtual = linksRastreaveisPorEspaco[espacoIdAtual] || criarEstadoLinksRastreaveis();
      const historicoAtual =
        estadoAtual.historicos?.[trackingIdNormalizado] ||
        criarEstadoHistoricoLinkRastreavel();

      if (historicoAtual.aberto && !historicoAtual.loading) {
        atualizarHistoricoLinkRastreavel(espacoIdAtual, trackingIdNormalizado, {
          ...historicoAtual,
          aberto: false,
        });
        return;
      }

      await carregarHistoricoAcessosLinkRastreavel(espacoIdAtual, trackingIdNormalizado, {
        abrir: true,
      });
    },
    [
      atualizarHistoricoLinkRastreavel,
      carregarHistoricoAcessosLinkRastreavel,
      linksRastreaveisPorEspaco,
    ]
  );

  const exportarHistoricoAcessosLinkRastreavel = useCallback((link = {}, itens = []) => {
    if (typeof window === "undefined") return;
    const lista = Array.isArray(itens) ? itens : [];
    if (!lista.length) return;

    const trackingId = String(link?.trackingId || link?.id || "link").trim() || "link";
    const linhas = [
      [
        "trackingId",
        "dataHora",
        "navigationId",
        "usuario",
        "localizacao",
        "ip",
        "origemPlanejada",
        "destinoUrl",
        "userAgent",
      ].join(";"),
      ...lista.map((acesso) => {
        const dataMs = resolveDataTimestampMs(acesso?.data || acesso?.criadoEm);
        const dataIso =
          Number.isFinite(dataMs) && dataMs > 0 ? new Date(dataMs).toISOString() : "";
        const navigationId = resolveHistoricoNavigationId(acesso) || "--";
        const usuario = String(acesso?.email || acesso?.uid || "Visitante").trim();
        const localizacao = buildHistoricoLocalizacao(acesso);
        const ip = String(acesso?.ip || "").trim() || "--";
        const origemPlanejada = String(
          acesso?.origemPlanejada || link?.origemPlanejada || link?.descricao || ""
        ).trim();
        const destinoUrl = String(acesso?.destinoUrl || link?.destinoUrl || "").trim();
        const userAgent = String(acesso?.userAgent || "").trim();

        return [
          csvEscape(trackingId),
          csvEscape(dataIso),
          csvEscape(navigationId),
          csvEscape(usuario),
          csvEscape(localizacao),
          csvEscape(ip),
          csvEscape(origemPlanejada),
          csvEscape(destinoUrl),
          csvEscape(userAgent),
        ].join(";");
      }),
    ];

    const blob = new Blob([`\uFEFF${linhas.join("\n")}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `historico-link-rastreavel-${trackingId}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }, []);

  const excluirLinkRastreavelDoEspaco = useCallback(
    async (espacoId = "", trackingId = "") => {
      const espacoIdAtual = String(espacoId || "").trim();
      const trackingIdNormalizado = String(trackingId || "").trim();
      const estadoAtual = linksRastreaveisPorEspaco[espacoIdAtual] || criarEstadoLinksRastreaveis();
      if (!espacoIdAtual || !trackingIdNormalizado || estadoAtual.excluindoId) return;

      const confirmado =
        typeof window === "undefined" ||
        window.confirm("Excluir este link rastreavel? Ele sera desativado para novos acessos.");
      if (!confirmado) return;

      atualizarEstadoLinksEspaco(espacoIdAtual, {
        excluindoId: trackingIdNormalizado,
        erro: "",
        mensagem: "",
      });

      try {
        await excluirLinkRastreavelEspaco(trackingIdNormalizado);
        atualizarEstadoLinksEspaco(espacoIdAtual, (prev) => ({
          excluindoId: "",
          mensagem: "Link rastreavel excluido.",
          itens: (Array.isArray(prev.itens) ? prev.itens : []).filter(
            (item) => String(item?.id || item?.trackingId || "").trim() !== trackingIdNormalizado
          ),
        }));
      } catch (error) {
        atualizarEstadoLinksEspaco(espacoIdAtual, {
          excluindoId: "",
          erro:
            error?.code === "permission-denied"
              ? "Sem permissao para excluir este link rastreavel."
              : error?.message || "Falha ao excluir link rastreavel.",
        });
      }
    },
    [atualizarEstadoLinksEspaco, linksRastreaveisPorEspaco]
  );

  const renderizarPainelLinksRastreaveis = (espaco = {}) => {
    const espacoIdAtual = String(espaco?.id || espaco?.id_espaco || "").trim();
    if (!rastreabilidadePreferencialAtiva || !espacoIdAtual) return null;
    const podeCriarLinks = usuarioPodeCriarLinksRastreaveisEspaco(espaco);
    const podeVerHistoricoLinks = usuarioPodeVerHistoricoLinksRastreaveisEspaco(espaco);
    if (!podeCriarLinks && !podeVerHistoricoLinks) return null;

    const estado = linksRastreaveisPorEspaco[espacoIdAtual] || criarEstadoLinksRastreaveis();
    if (!estado.aberto) return null;

    return (
      <section className="espaco-trackable-links espaco-trackable-links--manager" aria-live="polite">
        <div className="espaco-trackable-links__header">
          <div>
            <strong>Links rastreaveis do espaco</strong>
            <p>
              Crie URLs diferentes para compartilhar este {nomeEspacoSingular}, mantendo o destino
              final igual e registrando a origem de cada acesso.
            </p>
          </div>
          {podeVerHistoricoLinks ? (
            <button
              type="button"
              className="espaco-trackable-links__button"
              onClick={() => {
                void carregarLinksRastreaveisEspaco(espaco);
              }}
              disabled={estado.loading}
            >
              {estado.loading ? "Atualizando..." : "Atualizar"}
            </button>
          ) : null}
        </div>

        {podeCriarLinks ? (
          <div className="espaco-trackable-links__creator">
            <label>
              <span>Descricao / origem planejada</span>
              <textarea
                rows={2}
                value={estado.descricao}
                onChange={(event) =>
                  atualizarEstadoLinksEspaco(espacoIdAtual, {
                    descricao: event.target.value,
                  })
                }
                maxLength={220}
                placeholder="Ex.: curriculo PDF, LinkedIn, evento da faculdade..."
              />
            </label>
            <button
              type="button"
              className="espaco-trackable-links__button"
              onClick={() => {
                void criarLinkRastreavelDoEspaco(espaco);
              }}
              disabled={estado.criando}
            >
              {estado.criando ? "Criando..." : "Criar link rastreavel"}
            </button>
          </div>
        ) : null}

        {estado.erro ? <p className="espaco-trackable-links__error">{estado.erro}</p> : null}
        {estado.mensagem ? (
          <p className="espaco-trackable-links__success">{estado.mensagem}</p>
        ) : null}

        {!podeVerHistoricoLinks ? (
          <p className="espaco-trackable-links__empty">
            Seu perfil pode criar links, mas nao tem permissao para ver o historico/lista deste
            {` ${nomeEspacoSingular}`}.
          </p>
        ) : estado.itens.length ? (
          <div className="espaco-trackable-links__list">
            {estado.itens.map((link) => {
              const trackingId = String(link?.trackingId || link?.id || "").trim();
              const urlRastreavel = String(
                link?.urlRastreavel ||
                  montarUrlAbsoluta(link?.trackingRoute || (trackingId ? `/r/${trackingId}` : ""))
              ).trim();
              const historicoLink =
                estado.historicos?.[trackingId] || criarEstadoHistoricoLinkRastreavel();
              const acessosHistorico = Array.isArray(historicoLink.itens)
                ? historicoLink.itens
                : [];
              const filtroDataInicio = String(historicoLink.filtroDataInicio || "").trim();
              const filtroDataFim = String(historicoLink.filtroDataFim || "").trim();
              const filtroInicioMs = filtroDataInicio
                ? new Date(`${filtroDataInicio}T00:00:00`).getTime()
                : NaN;
              const filtroFimMs = filtroDataFim
                ? new Date(`${filtroDataFim}T23:59:59.999`).getTime()
                : NaN;
              const acessosHistoricoFiltrados = acessosHistorico.filter((acesso) => {
                const dataMs = resolveDataTimestampMs(acesso?.data || acesso?.criadoEm);
                if (Number.isFinite(filtroInicioMs) && (!Number.isFinite(dataMs) || dataMs < filtroInicioMs)) {
                  return false;
                }
                if (Number.isFinite(filtroFimMs) && (!Number.isFinite(dataMs) || dataMs > filtroFimMs)) {
                  return false;
                }
                return true;
              });
              const gruposHistorico = historicoLink.agruparPorNavigationId
                ? Object.values(
                    acessosHistoricoFiltrados.reduce((acc, acesso) => {
                      const navigationId =
                        resolveHistoricoNavigationId(acesso) || "sem_identificador";
                      if (!acc[navigationId]) {
                        acc[navigationId] = {
                          navigationId,
                          itens: [],
                          ultimoAcessoMs: 0,
                        };
                      }
                      const dataMs = resolveDataTimestampMs(acesso?.data || acesso?.criadoEm);
                      acc[navigationId].itens.push(acesso);
                      acc[navigationId].ultimoAcessoMs = Math.max(
                        acc[navigationId].ultimoAcessoMs,
                        Number.isFinite(dataMs) ? dataMs : 0
                      );
                      return acc;
                    }, {})
                  ).sort((a, b) => b.ultimoAcessoMs - a.ultimoAcessoMs)
                : [];
              const filtrosAtivos = Boolean(filtroDataInicio || filtroDataFim);
              const totalAcessos = acessosHistorico.length;
              const totalAcessosFiltrados = acessosHistoricoFiltrados.length;
              const uniqueNavigationIds = Array.from(
                new Set(
                  acessosHistorico
                    .map((acesso) => resolveHistoricoNavigationId(acesso))
                    .filter(Boolean)
                )
              );
              const uniqueNavigationIdsFiltrados = Array.from(
                new Set(
                  acessosHistoricoFiltrados
                    .map((acesso) => resolveHistoricoNavigationId(acesso))
                    .filter(Boolean)
                )
              );
              const ultimoAcessoMs = acessosHistorico.reduce((maximo, acesso) => {
                const dataMs = resolveDataTimestampMs(acesso?.data || acesso?.criadoEm);
                return Math.max(maximo, Number.isFinite(dataMs) ? dataMs : 0);
              }, 0);
              const localizacoesUnicas = Array.from(
                new Set(
                  acessosHistorico
                    .map((acesso) => buildHistoricoLocalizacao(acesso))
                    .filter((localizacao) => localizacao && localizacao !== "--")
                )
              );
              const localizacoesResumo = localizacoesUnicas.length
                ? localizacoesUnicas.slice(0, 3).join(" • ")
                : "--";
              const localizacoesComplemento =
                localizacoesUnicas.length > 3
                  ? ` +${localizacoesUnicas.length - 3} local(is)`
                  : "";
              const origemPlanejada =
                String(link?.origemPlanejada || link?.descricao || "").trim() || "--";
              const statusLink = resolveStatusLinkRastreavel(link);
              const cardsResumoHistorico = [
                {
                  label: "Status",
                  value: statusLink,
                  detail: statusLink === "Ativo" ? "Link disponivel para uso" : "Link removido",
                },
                {
                  label: "Origem planejada",
                  value: origemPlanejada,
                  detail: `Criado em ${formatarDataCurta(link?.criadoEm)}`,
                },
                {
                  label: "Total de acessos",
                  value: String(totalAcessos),
                  detail: filtrosAtivos
                    ? `${totalAcessosFiltrados} no recorte atual`
                    : "Sem filtro aplicado",
                },
                {
                  label: "Identificadores",
                  value: String(uniqueNavigationIds.length),
                  detail: filtrosAtivos
                    ? `${uniqueNavigationIdsFiltrados.length} no recorte atual`
                    : "Navigation IDs unicos",
                },
                {
                  label: "Ultimo acesso",
                  value: totalAcessos ? formatarDataCurta(ultimoAcessoMs) : "--",
                  detail: totalAcessos ? "Horario mais recente registrado" : "Sem acessos ainda",
                },
                {
                  label: "Locais vistos",
                  value: localizacoesResumo,
                  detail: localizacoesComplemento || "Cidades/paises distintos",
                },
              ];

              return (
                <article className="espaco-trackable-links__item" key={trackingId}>
                  <div className="espaco-trackable-links__item-main">
                    <strong>
                      {String(link?.origemPlanejada || link?.descricao || "Link rastreavel").trim()}
                    </strong>
                    <span>{`Identificador: ${trackingId || "--"}`}</span>
                    <span>{`Destino: ${String(
                      link?.destinoUrl || montarRotaEspacoGerenciado(espaco)
                    ).trim() || "--"}`}</span>
                    <span>{`URL: ${urlRastreavel || "--"}`}</span>
                    <span>{`Criado: ${formatarDataCurta(link?.criadoEm)}`}</span>
                  </div>
                  <div className="espaco-trackable-links__actions">
                    <button
                      type="button"
                      className="espaco-trackable-links__button"
                      onClick={() => {
                        void alternarHistoricoAcessosLinkRastreavel(espacoIdAtual, trackingId);
                      }}
                      disabled={!trackingId || historicoLink.loading}
                    >
                      {historicoLink.loading
                        ? "Carregando..."
                        : historicoLink.aberto
                          ? "Ocultar acessos"
                          : "Ver acessos"}
                    </button>
                    <button
                      type="button"
                      className="espaco-trackable-links__button"
                      onClick={() => {
                        void copiarLinkRastreavelEspaco(espacoIdAtual, urlRastreavel);
                      }}
                      disabled={!urlRastreavel}
                    >
                      Copiar
                    </button>
                    {podeCriarLinks ? (
                      <button
                        type="button"
                        className="espaco-trackable-links__button espaco-trackable-links__button--danger"
                        onClick={() => {
                          void excluirLinkRastreavelDoEspaco(espacoIdAtual, trackingId);
                        }}
                        disabled={estado.excluindoId === trackingId}
                      >
                        {estado.excluindoId === trackingId ? "Excluindo..." : "Excluir"}
                      </button>
                    ) : null}
                  </div>
                  {historicoLink.aberto ? (
                    <div className="espaco-trackable-links__timeline">
                      <div className="espaco-trackable-links__timeline-head">
                        <strong>Linha do tempo de acessos</strong>
                        <span>{`${acessosHistoricoFiltrados.length} evento(s) exibido(s)`}</span>
                      </div>
                      <div className="espaco-trackable-links__summary">
                        {cardsResumoHistorico.map((card) => (
                          <article
                            className="espaco-trackable-links__summary-card"
                            key={`${trackingId}-${card.label}`}
                          >
                            <span className="espaco-trackable-links__summary-label">
                              {card.label}
                            </span>
                            <strong className="espaco-trackable-links__summary-value">
                              {card.value}
                            </strong>
                            <span className="espaco-trackable-links__summary-detail">
                              {card.detail}
                            </span>
                          </article>
                        ))}
                      </div>
                      <div className="espaco-trackable-links__timeline-controls">
                        <label className="espaco-trackable-links__timeline-filter">
                          <span>De</span>
                          <input
                            type="date"
                            value={filtroDataInicio}
                            onChange={(event) => {
                              atualizarHistoricoLinkRastreavel(espacoIdAtual, trackingId, {
                                filtroDataInicio: event.target.value,
                              });
                            }}
                          />
                        </label>
                        <label className="espaco-trackable-links__timeline-filter">
                          <span>Ate</span>
                          <input
                            type="date"
                            value={filtroDataFim}
                            onChange={(event) => {
                              atualizarHistoricoLinkRastreavel(espacoIdAtual, trackingId, {
                                filtroDataFim: event.target.value,
                              });
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className={`espaco-trackable-links__button${
                            historicoLink.agruparPorNavigationId
                              ? " espaco-trackable-links__button--active"
                              : ""
                          }`}
                          onClick={() => {
                            atualizarHistoricoLinkRastreavel(espacoIdAtual, trackingId, {
                              agruparPorNavigationId: !historicoLink.agruparPorNavigationId,
                            });
                          }}
                        >
                          {historicoLink.agruparPorNavigationId
                            ? "Agrupado por identificador"
                            : "Ver eventos soltos"}
                        </button>
                        <button
                          type="button"
                          className="espaco-trackable-links__button"
                          onClick={() => {
                            void carregarHistoricoAcessosLinkRastreavel(espacoIdAtual, trackingId);
                          }}
                          disabled={historicoLink.loading}
                        >
                          {historicoLink.loading ? "Atualizando..." : "Atualizar acessos"}
                        </button>
                        <button
                          type="button"
                          className="espaco-trackable-links__button"
                          onClick={() => {
                            exportarHistoricoAcessosLinkRastreavel(link, acessosHistoricoFiltrados);
                          }}
                          disabled={!acessosHistoricoFiltrados.length}
                        >
                          Exportar CSV
                        </button>
                      </div>
                      {historicoLink.erro ? (
                        <p className="espaco-trackable-links__error">{historicoLink.erro}</p>
                      ) : historicoLink.loading ? (
                        <p className="espaco-trackable-links__empty">Carregando acessos...</p>
                      ) : acessosHistoricoFiltrados.length ? (
                        historicoLink.agruparPorNavigationId ? (
                          <div className="espaco-trackable-links__timeline-groups">
                            {gruposHistorico.map((grupo) => (
                              <article
                                className="espaco-trackable-links__timeline-group"
                                key={`${trackingId}-${grupo.navigationId}`}
                              >
                                <div className="espaco-trackable-links__timeline-group-head">
                                  <strong>
                                    {grupo.navigationId === "sem_identificador"
                                      ? "Sem identificador de navegacao"
                                      : `Identificador ${grupo.navigationId}`}
                                  </strong>
                                  <span>{`${grupo.itens.length} evento(s)`}</span>
                                  <span>{`Ultimo acesso: ${formatarDataCurta(grupo.ultimoAcessoMs)}`}</span>
                                </div>
                                <ol className="espaco-trackable-links__timeline-list">
                                  {grupo.itens.map((acesso) => {
                                    const acessoId = String(acesso?.id || "").trim();
                                    const localizacao = buildHistoricoLocalizacao(acesso);
                                    const usuario =
                                      String(acesso?.email || acesso?.uid || "").trim() ||
                                      "Visitante";

                                    return (
                                      <li
                                        className="espaco-trackable-links__timeline-event"
                                        key={
                                          acessoId ||
                                          `${trackingId}-${grupo.navigationId}-${formatarDataCurta(
                                            acesso?.data
                                          )}`
                                        }
                                      >
                                        <span>{formatarDataCurta(acesso?.data || acesso?.criadoEm)}</span>
                                        <span>{`Usuario: ${usuario}`}</span>
                                        <span>{`Local: ${localizacao}`}</span>
                                        <span>{`IP: ${String(acesso?.ip || "").trim() || "--"}`}</span>
                                        <span>{`Dispositivo: ${
                                          String(acesso?.userAgent || "").trim() || "--"
                                        }`}</span>
                                      </li>
                                    );
                                  })}
                                </ol>
                              </article>
                            ))}
                          </div>
                        ) : (
                        <ol className="espaco-trackable-links__timeline-list">
                          {acessosHistoricoFiltrados.map((acesso) => {
                            const acessoId = String(acesso?.id || "").trim();
                            const navigationId = resolveHistoricoNavigationId(acesso) || "--";
                            const localizacao = buildHistoricoLocalizacao(acesso);
                            const usuario =
                              String(acesso?.email || acesso?.uid || "").trim() || "Visitante";

                            return (
                              <li
                                className="espaco-trackable-links__timeline-event"
                                key={acessoId || `${trackingId}-${navigationId}-${formatarDataCurta(acesso?.data)}`}
                              >
                                <span>{formatarDataCurta(acesso?.data || acesso?.criadoEm)}</span>
                                <span>{`Identificador: ${navigationId || "--"}`}</span>
                                <span>{`Usuario: ${usuario}`}</span>
                                <span>{`Local: ${localizacao}`}</span>
                                <span>{`IP: ${String(acesso?.ip || "").trim() || "--"}`}</span>
                                <span>{`Dispositivo: ${
                                  String(acesso?.userAgent || "").trim() || "--"
                                }`}</span>
                              </li>
                            );
                          })}
                        </ol>
                        )
                      ) : (
                        <p className="espaco-trackable-links__empty">
                          Nenhum acesso encontrado para os filtros aplicados.
                        </p>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="espaco-trackable-links__empty">
            Nenhum link rastreavel criado para este {nomeEspacoSingular} ainda.
          </p>
        )}
      </section>
    );
  };

  if (!contextoCarregado) {
    return <ProjectLoadingFallback text="Carregando..." />;
  }

  if (!userId || !skinIdAtual) {
    return <p>Usuario ou skin nao carregados.</p>;
  }

  return (
    <div className="espaco-manager">
      <section className="espaco-manager__section">
        <div className="espaco-manager__section-header">
          <h2 className="espaco-manager__title">Home da Skin</h2>
        </div>

        {homeDaSkin ? (
          <div className="espaco-manager__item espaco-manager__item--home">
            <div className="espaco-manager__item-header">
              <div className="espaco-manager__item-title-line">
                <strong className="espaco-manager__item-title">{homeDaSkin.nome}</strong>
                <small className="espaco-manager__meta">
                  {LABEL_VISIBILIDADE_ESPACO[homeDaSkin.visibilidade || "publico"] || "Publico"}
                </small>
              </div>
            </div>

            <div className="espaco-manager__controls">
              <select
                value={homeDaSkin.visibilidade || "publico"}
                onChange={(event) => salvarHome({ visibilidade: event.target.value || "publico" })}
              >
                {opcoesVisibilidadeEspaco.map((opcao) => (
                  <option key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </option>
                ))}
              </select>

              {projetoPossuiColecoesIcones ? (
                <select
                  value={homeIconSelection || buildIconSelectionValue(homeDaSkin)}
                  onChange={(event) => {
                    const valor = event.target.value;
                    setHomeIconSelection(valor);
                    salvarHome(parseIconSelectionValue(valor, iconCollectionsFiltradas));
                  }}
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
              ) : null}

              {projetoUsaSubtemasCyberpink ? (
                <select
                  value={homeSubtemaSelection || normalizeCyberpinkSubtheme(homeDaSkin?.subtema)}
                  onChange={(event) => {
                    const valor = normalizeCyberpinkSubtheme(event.target.value);
                    setHomeSubtemaSelection(valor);
                    salvarHome({ subtema: valor });
                  }}
                >
                  {CYBERPINK_SUBTHEMES.map((subtema) => (
                    <option key={subtema.value} value={subtema.value}>
                      {`Subtema: ${subtema.label}`}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            {rastreabilidadePreferencialAtiva &&
            (
              usuarioPodeCriarLinksRastreaveisEspaco(homeDaSkin) ||
              usuarioPodeVerHistoricoLinksRastreaveisEspaco(homeDaSkin)
            ) ? (
              <div className="espaco-manager__actions">
                <button
                  type="button"
                  onClick={() => alternarLinksRastreaveisEspaco(homeDaSkin)}
                >
                  Links rastreaveis
                </button>
              </div>
            ) : null}

            {renderizarPainelLinksRastreaveis(homeDaSkin)}
          </div>
        ) : (
          <p className="espaco-manager__empty">Home nao encontrada.</p>
        )}
      </section>

      <section className="espaco-manager__section">
        <div className="espaco-manager__section-header">
          <h3 className="espaco-manager__title">{`${nomeEspacoPluralCapitalizado} Relacionados`}</h3>
        </div>

        {loading ? <ProjectLoadingFallback text="Carregando..." inline /> : null}

        {!loading && espacosRelacionados.length === 0 ? (
          <p className="espaco-manager__empty">{`Nenhum ${nomeEspacoSingular} relacionado.`}</p>
        ) : null}

        <div className="espaco-manager__list">
          {espacosRelacionados.map((e) => (
            <article key={e.id} className="espaco-manager__item">
              <div className="espaco-manager__item-header">
                <div className="espaco-manager__item-title-line">
                  <strong className="espaco-manager__item-title">{e.nome}</strong>
                  <small className="espaco-manager__meta">
                    {`Ordem ${e.ordem ?? "-"} | ${
                      LABEL_VISIBILIDADE_ESPACO[e.visibilidade || "publico"] || "Publico"
                    }${
                      projetoUsaSubtemasCyberpink
                        ? ` | ${getCyberpinkSubthemeLabel(e?.subtema)}`
                        : ""
                    }`}
                  </small>
                </div>
              </div>

              {String(e.iconUrl || "").trim() ? (
                <div className="espaco-manager__icon-preview">
                  <img
                    src={e.iconUrl}
                    alt={e.iconLabel || e.nome}
                    className="espaco-manager__icon"
                  />
                </div>
              ) : null}

              <div className="espaco-manager__actions">
                <button onClick={() => remover(e.id)}>Remover</button>
                <button onClick={() => moverEspaco(e.id, -1)} title="Mover para cima">
                  Subir
                </button>
                <button onClick={() => moverEspaco(e.id, 1)} title="Mover para baixo">
                  Descer
                </button>
                <button onClick={() => iniciarEdicao(e)}>Editar</button>
                {rastreabilidadePreferencialAtiva &&
                (
                  usuarioPodeCriarLinksRastreaveisEspaco(e) ||
                  usuarioPodeVerHistoricoLinksRastreaveisEspaco(e)
                ) ? (
                  <button type="button" onClick={() => alternarLinksRastreaveisEspaco(e)}>
                    Links rastreaveis
                  </button>
                ) : null}
                <button onClick={() => excluirEspaco(e)} className="espaco-manager__danger">
                  Excluir
                </button>
              </div>

              {editingEspacoId === e.id ? (
                <div className="espaco-manager__editor">
                  <div className="espaco-manager__controls">
                    <input
                      value={editingNome}
                      onChange={(event) => setEditingNome(event.target.value)}
                      placeholder={`Novo nome do ${nomeEspacoSingular}`}
                    />
                    <select
                      value={editingVisibilidade}
                      onChange={(event) => setEditingVisibilidade(event.target.value)}
                    >
                      {opcoesVisibilidadeEspaco.map((opcao) => (
                        <option key={opcao.value} value={opcao.value}>
                          {opcao.label}
                        </option>
                      ))}
                    </select>

                    {projetoPossuiColecoesIcones ? (
                      <select
                        value={editingIconSelection}
                        onChange={(event) => setEditingIconSelection(event.target.value)}
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
                    ) : null}

                    {projetoUsaSubtemasCyberpink ? (
                      <select
                        value={editingSubtema}
                        onChange={(event) =>
                          setEditingSubtema(normalizeCyberpinkSubtheme(event.target.value))
                        }
                      >
                        {CYBERPINK_SUBTHEMES.map((subtema) => (
                          <option key={subtema.value} value={subtema.value}>
                            {`Subtema: ${subtema.label}`}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>

                  <div className="espaco-manager__actions">
                    <button onClick={() => salvarEdicao(e.id)}>{`Salvar ${nomeEspacoSingular}`}</button>
                    <button onClick={cancelarEdicao}>Cancelar</button>
                  </div>
                </div>
              ) : null}

              {renderizarPainelLinksRastreaveis(e)}
            </article>
          ))}
        </div>
      </section>

      <section className="espaco-manager__section">
        <div className="espaco-manager__section-header">
          <h3 className="espaco-manager__title">{`Relacionar ${nomeEspacoPluralCapitalizado}`}</h3>
        </div>

        <div className="espaco-manager__actions">
          {espacosRelacionaveis.map((e) => (
            <button key={e.id} onClick={() => relacionar(e.id)}>
              {`Relacionar ${nomeEspacoSingular}: ${e.nome}`}
            </button>
          ))}
        </div>
      </section>

      <section className="espaco-manager__section">
        <div className="espaco-manager__section-header">
          <h3 className="espaco-manager__title">{`Criar ${nomeEspacoSingularCapitalizado} Adicional`}</h3>
        </div>

        <div className="espaco-manager__controls">
          <input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder={`Nome do ${nomeEspacoSingular}`}
          />
          <select
            value={novaVisibilidade}
            onChange={(event) => setNovaVisibilidade(event.target.value)}
          >
            {opcoesVisibilidadeEspaco.map((opcao) => (
              <option key={opcao.value} value={opcao.value}>
                {opcao.label}
              </option>
            ))}
          </select>

          {projetoPossuiColecoesIcones ? (
            <select
              value={novaSelecaoIcone}
              onChange={(event) => setNovaSelecaoIcone(event.target.value)}
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
          ) : null}

          {projetoUsaSubtemasCyberpink ? (
            <select
              value={novoSubtema}
              onChange={(event) => setNovoSubtema(normalizeCyberpinkSubtheme(event.target.value))}
            >
              {CYBERPINK_SUBTHEMES.map((subtema) => (
                <option key={subtema.value} value={subtema.value}>
                  {`Subtema: ${subtema.label}`}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <div className="espaco-manager__actions">
          <button onClick={criarEspaco}>{`Criar ${nomeEspacoSingularCapitalizado}`}</button>
        </div>

        {!mercadoPagoSistemaHabilitado && !pixManualSistemaHabilitado ? (
          <p className="espaco-manager__note">
            Metodos de pagamento desativados em PROPRIEDADES DO SISTEMA.
          </p>
        ) : !metodoPagamentoAssinaturaDisponivel ? (
          <p className="espaco-manager__note">
            {`Conecte o Mercado Pago ou configure PIX manual para habilitar visibilidade exclusiva para assinantes de ${nomeEspacoPlural}.`}
          </p>
        ) : !projetoPossuiColecoesIcones ? (
          <p className="espaco-manager__note">
            Nenhuma colecao de icones permitida para este projeto/tema.
          </p>
        ) : null}
      </section>
    </div>
  );
}
