import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";

import {
  listarAuditLogsNoGerenciador,
  listarProjetosNoGerenciador,
  marcarSinalizacoesAuditoriaLidasNoGerenciador,
} from "../../../Sistema/gerenciadorSistemasApi";
import {
  AUDITORIA_CATEGORIAS,
  AUDITORIA_PERMISSOES_GESTAO,
  usuarioPodeExportarAuditoriaProjeto,
  usuarioPodeVerAuditoriaCategoriaProjeto,
  usuarioPodeVerAuditoriaProjeto,
} from "../../../Sistema/modulosPermissoes";
import {
  AUDIT_SEVERITIES,
  humanizeAuditSeverity,
  isAuditSeverityCritical,
  resolveAuditSeverity,
} from "../../../Sistema/auditSeverity";
import { useAuth } from "../../../../../hooks/auth/useAuth";
import { seforAdm } from "../../../../Scripts/verificacoes/verificaAdm";
import "./auditoria.css";

function normalizeText(value = "") {
  return String(value || "").trim();
}

function resolveTimestampMs(value = null) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (Number.isFinite(Number(value?.seconds))) return Number(value.seconds) * 1000;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value = null) {
  const timestamp = resolveTimestampMs(value);
  if (!timestamp) return "--";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(timestamp));
}

function humanizeAction(action = "") {
  const normalized = normalizeText(action);
  if (!normalized) return "Evento";
  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function humanizeEntity(entityType = "") {
  const normalized = normalizeText(entityType);
  if (!normalized) return "Entidade";
  const labels = {
    bloco: "Bloco",
    card: "Card",
    qrPrint: "Card rastreavel",
    trackableLink: "Link rastreavel",
    acesso: "Acesso",
  };
  return labels[normalized] || humanizeAction(normalized);
}

const AUDIT_CATEGORY_OPTIONS = AUDITORIA_CATEGORIAS.map(({ value, label }) => ({ value, label }));

function resolveAuditCategory(log = {}) {
  const explicitCategory = normalizeText(log?.auditCategory || log?.metadata?.auditCategory);
  if (explicitCategory) return explicitCategory;

  const entityType = normalizeText(log?.entityType);
  if (["acesso", "accessSettings", "usuario_projeto"].includes(entityType)) return "acessos";
  if (["qrPrint", "trackableLink"].includes(entityType)) return "rastreaveis";
  if (["system", "systemConfig", "systemPreconfig", "iconCollection"].includes(entityType)) {
    return "configuracoes";
  }
  return "conteudo";
}

function humanizeAuditCategory(category = "") {
  const normalized = normalizeText(category).toLowerCase();
  return AUDIT_CATEGORY_OPTIONS.find((option) => option.value === normalized)?.label || "Conteudo";
}

function resolveLogSeverity(log = {}) {
  return normalizeText(log?.severity) || resolveAuditSeverity(log);
}

function isAuditLogRead(log = {}) {
  return log?.sinalizacaoMenuLida === true || log?.sinalizacaoLida === true || log?.alertaLido === true;
}

function markAuditLogAsRead(log = {}) {
  if (!log || typeof log !== "object") return log;
  return {
    ...log,
    sinalizacaoMenuLida: true,
    sinalizacaoLida: true,
  };
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

function compactId(value = "") {
  const normalized = normalizeText(value);
  if (!normalized) return "--";
  if (normalized.length <= 18) return normalized;
  return `${normalized.slice(0, 9)}...${normalized.slice(-6)}`;
}

function stringifyDetails(value) {
  if (value === undefined || value === null || value === "") return "--";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildUniqueOptions(items = [], key) {
  return Array.from(
    new Set(
      items
        .map((item) => normalizeText(item?.[key]))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
}

function sanitizeFilePart(value = "") {
  const normalized = normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "todos";
}

function buildAuditLogKey(log = {}) {
  const runtimeProjectId = normalizeText(log?.runtimeProjectId);
  const path = normalizeText(log?.auditPath || log?.id);
  return path ? `${runtimeProjectId}:${path}` : "";
}

function buildAuditReadItem(log = {}) {
  return {
    id: normalizeText(log?.id),
    auditPath: normalizeText(log?.auditPath),
    runtimeProjectId: normalizeText(log?.runtimeProjectId),
    projectSystemKey: normalizeText(log?.projectSystemKey || log?.runtimeProjectKey).toLowerCase(),
  };
}

function csvEscape(value = "") {
  const normalized = value === undefined || value === null ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function downloadTextFile({ filename = "auditoria.csv", content = "", type = "text/csv" } = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function sortLogsChronologically(items = []) {
  return [...items].sort((a, b) => {
    const timestampA = resolveTimestampMs(a?.criadoEm || a?.data || a?.createdAt);
    const timestampB = resolveTimestampMs(b?.criadoEm || b?.data || b?.createdAt);
    return timestampA - timestampB;
  });
}

export default function Auditoria() {
  const { user } = useAuth();
  const location = useLocation();
  const [logs, setLogs] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [acaoSinalizacao, setAcaoSinalizacao] = useState("");
  const [erro, setErro] = useState("");
  const [mensagemSinalizacao, setMensagemSinalizacao] = useState("");
  const [filtroProjeto, setFiltroProjeto] = useState("");
  const [filtroAcao, setFiltroAcao] = useState("");
  const [filtroEntidade, setFiltroEntidade] = useState("");
  const [filtroEntidadeId, setFiltroEntidadeId] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroSeveridade, setFiltroSeveridade] = useState("");
  const [somenteCriticos, setSomenteCriticos] = useState(false);
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [detalhe, setDetalhe] = useState(null);
  const [linhaDoTempo, setLinhaDoTempo] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState("eventos");

  const projetosMap = useMemo(() => {
    return projetos.reduce((acc, projeto) => {
      const key = normalizeText(projeto?.systemKey || projeto?.id).toLowerCase();
      if (key) acc[key] = projeto;
      return acc;
    }, {});
  }, [projetos]);

  const projetoSelecionado = useMemo(() => {
    const key = normalizeText(filtroProjeto).toLowerCase();
    return key ? projetosMap[key] || null : null;
  }, [filtroProjeto, projetosMap]);

  const usuarioEhAdminGerenciador = Boolean(user && seforAdm(user));

  const contextoAuditoriaProjetoSelecionado = useMemo(() => {
    if (!projetoSelecionado) {
      return null;
    }

    return {
      configSistema: resolveProjetoConfigSistema(projetoSelecionado),
      usuarioUid: user?.uid || "",
      usuarioEmail: user?.email || "",
    };
  }, [projetoSelecionado, user?.email, user?.uid]);

  const permissaoAuditoriaProjetoSelecionado = useMemo(() => {
    if (!projetoSelecionado) {
      return {
        podeVer: true,
        podeExportar: true,
      };
    }

    if (usuarioEhAdminGerenciador) {
      return {
        podeVer: true,
        podeExportar: true,
      };
    }

    return {
      podeVer: usuarioPodeVerAuditoriaProjeto(contextoAuditoriaProjetoSelecionado),
      podeExportar: usuarioPodeExportarAuditoriaProjeto(contextoAuditoriaProjetoSelecionado),
    };
  }, [contextoAuditoriaProjetoSelecionado, projetoSelecionado, usuarioEhAdminGerenciador]);

  const carregarProjetos = useCallback(async () => {
    try {
      const lista = await listarProjetosNoGerenciador();
      setProjetos(Array.isArray(lista) ? lista : []);
    } catch {
      setProjetos([]);
    }
  }, []);

  const carregarAuditoria = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const itens = await listarAuditLogsNoGerenciador({
        limit: 500,
        projectSystemKey: filtroProjeto,
        action: filtroAcao,
        entityType: filtroEntidade,
        entityId: filtroEntidadeId,
        auditCategory: filtroCategoria,
        severity: somenteCriticos ? "alto" : filtroSeveridade,
        startDate: filtroDataInicio,
        endDate: filtroDataFim,
      });
      setLogs(Array.isArray(itens) ? itens : []);
    } catch (error) {
      console.error("Erro ao carregar auditoria:", error);
      setErro(error?.message || "Nao foi possivel carregar os logs de auditoria.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [
    filtroAcao,
    filtroCategoria,
    filtroDataFim,
    filtroDataInicio,
    filtroEntidade,
    filtroEntidadeId,
    filtroProjeto,
    filtroSeveridade,
    somenteCriticos,
  ]);

  const marcarSinalizacoesAuditoria = useCallback(async ({ severity = "" } = {}) => {
    const acao = severity === "alto" ? "alto" : "todos";
    setAcaoSinalizacao(acao);
    setErro("");
    setMensagemSinalizacao("");

    try {
      const resultado = await marcarSinalizacoesAuditoriaLidasNoGerenciador({
        limit: 1000,
        projectSystemKey: filtroProjeto,
        severity,
      });
      const total = Number(resultado?.total) || 0;
      const escopoProjeto = filtroProjeto ? " deste projeto" : "";
      const complementoLimite = resultado?.limitReached
        ? " Execute novamente se ainda restarem sinalizacoes antigas."
        : "";

      setMensagemSinalizacao(
        acao === "alto"
          ? total
            ? `${total} item(ns) de severidade alta marcado(s) como lido(s) na Auditoria${escopoProjeto}.${complementoLimite}`
            : `Nenhum item de severidade alta estava sinalizado na Auditoria${escopoProjeto}.`
          : total
            ? `${total} item(ns) sinalizado(s) marcado(s) como lido(s) na Auditoria${escopoProjeto}.${complementoLimite}`
            : `Nenhum item sinalizado estava pendente na Auditoria${escopoProjeto}.`
      );
      window.dispatchEvent(new CustomEvent("auditoria-resumo-atualizado"));
      await carregarAuditoria();
    } catch (error) {
      console.error("Erro ao marcar sinalizacoes de auditoria como lidas:", error);
      setErro(error?.message || "Nao foi possivel marcar os itens da Auditoria como lidos.");
    } finally {
      setAcaoSinalizacao("");
    }
  }, [carregarAuditoria, filtroProjeto]);

  const marcarLogComoLidoLocalmente = useCallback((log = {}) => {
    const key = buildAuditLogKey(log);
    if (!key) return;

    setLogs((prev) =>
      prev.map((item) => (buildAuditLogKey(item) === key ? markAuditLogAsRead(item) : item))
    );
    setDetalhe((prev) => (prev && buildAuditLogKey(prev) === key ? markAuditLogAsRead(prev) : prev));
    setLinhaDoTempo((prev) =>
      prev
        ? {
            ...prev,
            baseLog:
              prev.baseLog && buildAuditLogKey(prev.baseLog) === key
                ? markAuditLogAsRead(prev.baseLog)
                : prev.baseLog,
            items: Array.isArray(prev.items)
              ? prev.items.map((item) =>
                  buildAuditLogKey(item) === key ? markAuditLogAsRead(item) : item
                )
              : prev.items,
          }
        : prev
    );
  }, []);

  const abrirDetalhe = useCallback(async (log = {}) => {
    const readItem = buildAuditReadItem(log);
    setDetalhe(markAuditLogAsRead(log));

    if (isAuditLogRead(log) || !readItem.auditPath) return;

    marcarLogComoLidoLocalmente(log);

    try {
      const resultado = await marcarSinalizacoesAuditoriaLidasNoGerenciador({
        limit: 1,
        auditItems: [readItem],
      });

      if (Number(resultado?.total) > 0) {
        window.dispatchEvent(new CustomEvent("auditoria-resumo-atualizado"));
      }
    } catch (error) {
      console.error("Erro ao marcar item de auditoria como lido:", error);
      setErro(error?.message || "Nao foi possivel marcar este item da Auditoria como lido.");
    }
  }, [marcarLogComoLidoLocalmente]);

  const abrirLinhaDoTempo = useCallback(async (log = {}) => {
    const entityType = normalizeText(log?.entityType);
    const entityId = normalizeText(log?.entityId);
    const projectSystemKey = normalizeText(log?.projectSystemKey || log?.runtimeProjectKey).toLowerCase();
    const requestKey = `${projectSystemKey || "todos"}:${entityType}:${entityId}`;

    if (!entityType || !entityId) {
      setLinhaDoTempo({
        requestKey,
        baseLog: log,
        items: [],
        loading: false,
        erro: "Este evento nao possui identificador suficiente para montar uma linha do tempo.",
      });
      return;
    }

    setLinhaDoTempo({
      requestKey,
      baseLog: log,
      items: [],
      loading: true,
      erro: "",
    });

    try {
      const itens = await listarAuditLogsNoGerenciador({
        limit: 1000,
        projectSystemKey,
        entityType,
        entityId,
      });
      setLinhaDoTempo((prev) =>
        prev?.requestKey === requestKey
          ? {
              ...prev,
              items: Array.isArray(itens) ? itens : [],
              loading: false,
              erro: "",
            }
          : prev
      );
    } catch (error) {
      console.error("Erro ao carregar linha do tempo da entidade:", error);
      setLinhaDoTempo((prev) =>
        prev?.requestKey === requestKey
          ? {
              ...prev,
              items: [],
              loading: false,
              erro: error?.message || "Nao foi possivel carregar a linha do tempo da entidade.",
            }
          : prev
      );
    }
  }, []);

  useEffect(() => {
    void carregarProjetos();
  }, [carregarProjetos]);

  useEffect(() => {
    void carregarAuditoria();
  }, [carregarAuditoria]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const projectSystemKey = normalizeText(params.get("projectSystemKey")).toLowerCase();
    const entityType = normalizeText(params.get("entityType"));
    const entityId = normalizeText(params.get("entityId"));
    const action = normalizeText(params.get("action"));
    const auditCategory = normalizeText(params.get("auditCategory"));

    if (projectSystemKey) setFiltroProjeto(projectSystemKey);
    if (entityType) setFiltroEntidade(entityType);
    if (entityId) setFiltroEntidadeId(entityId);
    if (action) setFiltroAcao(action);
    if (auditCategory) setFiltroCategoria(auditCategory);
  }, [location.search]);

  useEffect(() => {
    if (!detalhe && !linhaDoTempo) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (detalhe) {
          setDetalhe(null);
        } else {
          setLinhaDoTempo(null);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [detalhe, linhaDoTempo]);

  const categoriaPermitida = useCallback(
    (categoria = "") => {
      if (usuarioEhAdminGerenciador) return true;
      if (!projetoSelecionado || !contextoAuditoriaProjetoSelecionado) {
        return permissaoAuditoriaProjetoSelecionado.podeVer;
      }
      return usuarioPodeVerAuditoriaCategoriaProjeto(
        contextoAuditoriaProjetoSelecionado,
        categoria
      );
    },
    [
      contextoAuditoriaProjetoSelecionado,
      permissaoAuditoriaProjetoSelecionado.podeVer,
      projetoSelecionado,
      usuarioEhAdminGerenciador,
    ]
  );

  const logsVisiveis = permissaoAuditoriaProjetoSelecionado.podeVer
    ? logs.filter((log) => categoriaPermitida(resolveAuditCategory(log)))
    : [];
  const podeExportarAuditoria = permissaoAuditoriaProjetoSelecionado.podeExportar;

  const actionOptions = useMemo(() => buildUniqueOptions(logsVisiveis, "action"), [logsVisiveis]);
  const entityOptions = useMemo(() => buildUniqueOptions(logsVisiveis, "entityType"), [logsVisiveis]);
  const totalExclusoes = useMemo(
    () => logsVisiveis.filter((log) => normalizeText(log?.action).includes("exclu")).length,
    [logsVisiveis]
  );
  const totalRastreaveis = useMemo(
    () =>
      logsVisiveis.filter((log) =>
        ["qrPrint", "trackableLink"].includes(normalizeText(log?.entityType))
      ).length,
    [logsVisiveis]
  );
  const totalBlocosCards = useMemo(
    () =>
      logsVisiveis.filter((log) => ["bloco", "card"].includes(normalizeText(log?.entityType))).length,
    [logsVisiveis]
  );
  const totalCriticos = useMemo(
    () => logsVisiveis.filter((log) => isAuditSeverityCritical(resolveLogSeverity(log))).length,
    [logsVisiveis]
  );
  const linhaDoTempoItens = useMemo(
    () =>
      sortLogsChronologically(
        (linhaDoTempo?.items || []).filter((item) => categoriaPermitida(resolveAuditCategory(item)))
      ),
    [categoriaPermitida, linhaDoTempo?.items]
  );
  const politicaAuditoria = useMemo(() => {
    const configSistema = projetoSelecionado ? resolveProjetoConfigSistema(projetoSelecionado) : {};
    const totalPorCategoria = AUDITORIA_CATEGORIAS.reduce((acc, categoria) => {
      acc[categoria.value] = logsVisiveis.filter(
        (log) => resolveAuditCategory(log) === categoria.value
      ).length;
      return acc;
    }, {});

    return {
      projetoNome: projetoSelecionado
        ? normalizeText(projetoSelecionado?.nomeProjeto) ||
          normalizeText(projetoSelecionado?.systemKey || projetoSelecionado?.id)
        : "Todos os projetos",
      auditoriaAtiva: !projetoSelecionado || configSistema.auditoriaAtiva !== false,
      retencaoDias: Number(configSistema.auditoriaRetencaoDias ?? 180),
      ttlStatus: Number(configSistema.auditoriaRetencaoDias ?? 180) > 0
        ? "TTL ativo em auditLogs.expiresAt"
        : "Sem expiracao automatica",
      categorias: AUDITORIA_CATEGORIAS.map((categoria) => ({
        ...categoria,
        ativa: !projetoSelecionado || configSistema[categoria.enabledField] !== false,
        permissao:
          configSistema[categoria.permissionField] ||
          configSistema.auditoriaVerHistoricoPermissao ||
          "owner_projeto",
        podeVer: categoriaPermitida(categoria.value),
        total: totalPorCategoria[categoria.value] || 0,
      })),
      ultimoEvento: logsVisiveis[0] || null,
    };
  }, [categoriaPermitida, logsVisiveis, projetoSelecionado]);

  const limparFiltros = () => {
    setFiltroProjeto("");
    setFiltroAcao("");
    setFiltroEntidade("");
    setFiltroEntidadeId("");
    setFiltroCategoria("");
    setFiltroSeveridade("");
    setSomenteCriticos(false);
    setFiltroDataInicio("");
    setFiltroDataFim("");
  };

  const resolveProjectLabel = (log = {}) => {
    const key = normalizeText(log?.projectSystemKey || log?.runtimeProjectKey).toLowerCase();
    return normalizeText(projetosMap[key]?.nomeProjeto) || key || "--";
  };

  const montarCsvAuditoria = (items = []) => {
    const headers = [
      "data",
      "projeto",
      "categoria",
      "severidade",
      "entidade",
      "entidadeId",
      "acao",
      "ator",
      "origem",
      "espaco",
      "blocoId",
      "cardId",
      "motivo",
      "runtimeProjectId",
      "auditPath",
    ];

    const rows = items.map((log) => [
      formatDate(log?.criadoEm || log?.data || log?.createdAt),
      resolveProjectLabel(log),
      humanizeAuditCategory(resolveAuditCategory(log)),
      humanizeAuditSeverity(resolveLogSeverity(log)),
      humanizeEntity(log?.entityType),
      normalizeText(log?.entityId),
      humanizeAction(log?.action),
      normalizeText(log?.actorEmail || log?.actorUid) || "ator nao identificado",
      normalizeText(log?.source),
      normalizeText(log?.espacoNome || log?.espacoId),
      normalizeText(log?.blocoId),
      normalizeText(log?.cardId),
      normalizeText(log?.motivo),
      normalizeText(log?.runtimeProjectId),
      normalizeText(log?.auditPath || log?.id),
    ]);

    return [
      headers.map(csvEscape).join(","),
      ...rows.map((row) => row.map(csvEscape).join(",")),
    ].join("\n");
  };

  const exportarCsvAuditoria = async () => {
    if (!podeExportarAuditoria || !logsVisiveis.length) return;
    const hoje = new Date().toISOString().slice(0, 10);
    const nomeProjeto = filtroProjeto || "todos-projetos";
    const nomeCategoria = filtroCategoria || (somenteCriticos ? "criticos" : "todas-categorias");
    try {
      const itens = await listarAuditLogsNoGerenciador({
        limit: 1000,
        projectSystemKey: filtroProjeto,
        action: filtroAcao,
        entityType: filtroEntidade,
        entityId: filtroEntidadeId,
        auditCategory: filtroCategoria,
        severity: somenteCriticos ? "alto" : filtroSeveridade,
        startDate: filtroDataInicio,
        endDate: filtroDataFim,
        purpose: "export",
      });
      downloadTextFile({
        filename: `auditoria-${sanitizeFilePart(nomeProjeto)}-${sanitizeFilePart(nomeCategoria)}-${hoje}.csv`,
        content: `\uFEFF${montarCsvAuditoria(Array.isArray(itens) ? itens : logsVisiveis)}`,
      });
    } catch (error) {
      console.error("Erro ao exportar auditoria:", error);
      setErro(error?.message || "Nao foi possivel exportar auditoria.");
    }
  };

  const exportarCsvLinhaDoTempo = async () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const entityType = normalizeText(linhaDoTempo?.baseLog?.entityType) || "entidade";
    const entityId = normalizeText(linhaDoTempo?.baseLog?.entityId) || "sem-id";
    const projectSystemKey = normalizeText(
      linhaDoTempo?.baseLog?.projectSystemKey || linhaDoTempo?.baseLog?.runtimeProjectKey
    ).toLowerCase();

    try {
      const itens = await listarAuditLogsNoGerenciador({
        limit: 1000,
        projectSystemKey,
        entityType,
        entityId,
        purpose: "export",
      });
      downloadTextFile({
        filename: `linha-do-tempo-${sanitizeFilePart(entityType)}-${sanitizeFilePart(entityId)}-${hoje}.csv`,
        content: `\uFEFF${montarCsvAuditoria(Array.isArray(itens) ? sortLogsChronologically(itens) : linhaDoTempoItens)}`,
      });
    } catch (error) {
      console.error("Erro ao exportar linha do tempo:", error);
      setErro(error?.message || "Nao foi possivel exportar a linha do tempo.");
    }
  };

  return (
    <section className="auditoria-panel">
      <header className="auditoria-panel__hero">
        <div>
          <p className="auditoria-panel__eyebrow">Trilha imutavel</p>
          <h2>Auditoria do Sistema</h2>
          <span>
            Eventos de exclusao, criacao e alteracao para rastreaveis, cards, blocos e acessos.
          </span>
        </div>
        <div className="auditoria-panel__hero-actions">
          <button
            type="button"
            className="auditoria-panel__signal-action"
            onClick={() => {
              void marcarSinalizacoesAuditoria({ severity: "alto" });
            }}
            disabled={Boolean(acaoSinalizacao)}
          >
            {acaoSinalizacao === "alto" ? "Marcando..." : "Marcar alta como lida"}
          </button>
          <button
            type="button"
            onClick={() => {
              void exportarCsvAuditoria();
            }}
            disabled={loading || !logsVisiveis.length || !podeExportarAuditoria}
            title={!podeExportarAuditoria ? "Sem permissao para exportar auditoria deste projeto." : undefined}
          >
            Exportar CSV
          </button>
          <button type="button" onClick={carregarAuditoria} disabled={loading}>
            {loading ? "Sincronizando..." : "Atualizar"}
          </button>
        </div>
      </header>

      <div className="auditoria-panel__tabs" role="tablist" aria-label="Navegacao da auditoria">
        <button
          type="button"
          className={abaAtiva === "eventos" ? "is-active" : ""}
          onClick={() => setAbaAtiva("eventos")}
        >
          Eventos
        </button>
        <button
          type="button"
          className={abaAtiva === "politica" ? "is-active" : ""}
          onClick={() => setAbaAtiva("politica")}
        >
          Politica de Auditoria
        </button>
      </div>

      {abaAtiva === "politica" ? (
        <section className="auditoria-policy">
          <div className="auditoria-policy__core">
            <article>
              <span>Projeto</span>
              <strong>{politicaAuditoria.projetoNome}</strong>
            </article>
            <article className={politicaAuditoria.auditoriaAtiva ? "" : "is-disabled"}>
              <span>Status</span>
              <strong>{politicaAuditoria.auditoriaAtiva ? "Auditoria ativa" : "Auditoria desligada"}</strong>
            </article>
            <article>
              <span>Retencao</span>
              <strong>
                {politicaAuditoria.retencaoDias > 0
                  ? `${politicaAuditoria.retencaoDias} dias`
                  : "sem expirar"}
              </strong>
            </article>
            <article>
              <span>TTL</span>
              <strong>{politicaAuditoria.ttlStatus}</strong>
            </article>
          </div>

          <div className="auditoria-policy__categories">
            {politicaAuditoria.categorias.map((categoria) => (
              <article
                key={categoria.value}
                className={!categoria.ativa || !categoria.podeVer ? "is-disabled" : ""}
              >
                <div>
                  <strong>{categoria.label}</strong>
                  <span>{categoria.ativa ? "registrando eventos" : "registro desligado"}</span>
                </div>
                <div>
                  <span>Permissao</span>
                  <strong>
                    {AUDITORIA_PERMISSOES_GESTAO.find(
                      (opcao) => opcao.value === categoria.permissao
                    )?.label || categoria.permissao}
                  </strong>
                </div>
                <div>
                  <span>Visibilidade atual</span>
                  <strong>{categoria.podeVer ? "permitida" : "bloqueada"}</strong>
                </div>
                <div>
                  <span>Eventos carregados</span>
                  <strong>{categoria.total}</strong>
                </div>
              </article>
            ))}
          </div>

          <div className="auditoria-policy__timeline">
            <h3>Saude da trilha</h3>
            <p>
              Novos logs recebem <code>expiresAt</code> e sao elegiveis para expurgo automatico
              pelo TTL do Firestore. A remocao operacional continua gerando auditoria para
              manter uma trilha explicavel.
            </p>
            {politicaAuditoria.ultimoEvento ? (
              <button
                type="button"
                onClick={() => {
                  setAbaAtiva("eventos");
                  void abrirDetalhe(politicaAuditoria.ultimoEvento);
                }}
              >
                Ver ultimo evento: {humanizeAction(politicaAuditoria.ultimoEvento?.action)}
              </button>
            ) : (
              <span>Nenhum evento carregado para os filtros atuais.</span>
            )}
          </div>
        </section>
      ) : (
        <>
      <div className="auditoria-panel__metrics">
        <article>
          <strong>{logsVisiveis.length}</strong>
          <span>eventos carregados</span>
        </article>
        <article>
          <strong>{totalExclusoes}</strong>
          <span>exclusoes</span>
        </article>
        <article>
          <strong>{totalRastreaveis}</strong>
          <span>rastreaveis</span>
        </article>
        <article>
          <strong>{totalBlocosCards}</strong>
          <span>cards/blocos</span>
        </article>
        <article className={totalCriticos > 0 ? "auditoria-panel__metric--critical" : ""}>
          <strong>{totalCriticos}</strong>
          <span>criticos</span>
        </article>
      </div>

      <div className="auditoria-panel__filters">
        <label>
          Projeto
          <select value={filtroProjeto} onChange={(event) => setFiltroProjeto(event.target.value)}>
            <option value="">Todos</option>
            {projetos.map((projeto) => {
              const key = normalizeText(projeto?.systemKey || projeto?.id).toLowerCase();
              if (!key) return null;
              return (
                <option key={key} value={key}>
                  {normalizeText(projeto?.nomeProjeto) || key}
                </option>
              );
            })}
          </select>
        </label>
        <label>
          Acao
          <select value={filtroAcao} onChange={(event) => setFiltroAcao(event.target.value)}>
            <option value="">Todas</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {humanizeAction(action)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Entidade
          <select value={filtroEntidade} onChange={(event) => setFiltroEntidade(event.target.value)}>
            <option value="">Todas</option>
            {entityOptions.map((entityType) => (
              <option key={entityType} value={entityType}>
                {humanizeEntity(entityType)}
              </option>
            ))}
          </select>
        </label>
        <label>
          ID entidade
          <input
            type="text"
            value={filtroEntidadeId}
            onChange={(event) => setFiltroEntidadeId(event.target.value)}
            placeholder="ID do card, bloco, link..."
          />
        </label>
        <label>
          Categoria
          <select
            value={filtroCategoria}
            onChange={(event) => setFiltroCategoria(event.target.value)}
          >
            <option value="">Todas</option>
            {AUDIT_CATEGORY_OPTIONS.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Severidade
          <select
            value={filtroSeveridade}
            onChange={(event) => {
              setFiltroSeveridade(event.target.value);
              if (event.target.value) setSomenteCriticos(false);
            }}
            disabled={somenteCriticos}
          >
            <option value="">Todas</option>
            {AUDIT_SEVERITIES.map((severity) => (
              <option key={severity.value} value={severity.value}>
                {severity.label}
              </option>
            ))}
          </select>
        </label>
        <label className="auditoria-panel__critical-filter">
          Criticos
          <span>
            <input
              type="checkbox"
              checked={somenteCriticos}
              onChange={(event) => {
                setSomenteCriticos(event.target.checked);
                if (event.target.checked) setFiltroSeveridade("");
              }}
            />
            Somente altos
          </span>
        </label>
        <label>
          Inicio
          <input
            type="date"
            value={filtroDataInicio}
            onChange={(event) => setFiltroDataInicio(event.target.value)}
          />
        </label>
        <label>
          Fim
          <input
            type="date"
            value={filtroDataFim}
            onChange={(event) => setFiltroDataFim(event.target.value)}
          />
        </label>
        <button type="button" onClick={limparFiltros}>
          Limpar filtros
        </button>
      </div>

      {mensagemSinalizacao ? (
        <p className="auditoria-panel__success">{mensagemSinalizacao}</p>
      ) : null}
      {erro ? <p className="auditoria-panel__error">{erro}</p> : null}
      {!permissaoAuditoriaProjetoSelecionado.podeVer ? (
        <p className="auditoria-panel__error">
          Sem permissao para visualizar a auditoria deste projeto pela configuracao atual.
        </p>
      ) : null}
      {permissaoAuditoriaProjetoSelecionado.podeVer && !podeExportarAuditoria ? (
        <p className="auditoria-panel__error">
          Voce pode visualizar, mas nao exportar a auditoria deste projeto.
        </p>
      ) : null}

      <div className="auditoria-panel__list" aria-busy={loading}>
        {loading ? (
          <p className="auditoria-panel__empty">Carregando trilha de auditoria...</p>
        ) : logsVisiveis.length ? (
          logsVisiveis.map((log) => (
            <article key={`${log?.auditPath || log?.id}`} className="auditoria-event">
              <div className="auditoria-event__signal" aria-hidden="true" />
              <div className="auditoria-event__main">
                <div className="auditoria-event__topline">
                  <strong>{humanizeAction(log?.action)}</strong>
                  <span>{formatDate(log?.criadoEm || log?.data || log?.createdAt)}</span>
                </div>
                <p>{humanizeEntity(log?.entityType)}</p>
                <div className="auditoria-event__chips">
                  <span>{`ID ${compactId(log?.entityId)}`}</span>
                  <span>{humanizeAuditCategory(resolveAuditCategory(log))}</span>
                  <span className={`auditoria-event__severity auditoria-event__severity--${resolveLogSeverity(log)}`}>
                    {humanizeAuditSeverity(resolveLogSeverity(log))}
                  </span>
                  <span>{resolveProjectLabel(log)}</span>
                  <span>{normalizeText(log?.actorEmail || log?.actorUid) || "ator nao identificado"}</span>
                  <span
                    className={`auditoria-event__read-status ${
                      isAuditLogRead(log)
                        ? "auditoria-event__read-status--read"
                        : "auditoria-event__read-status--unread"
                    }`}
                  >
                    {isAuditLogRead(log) ? "Lido" : "Nao lido"}
                  </span>
                </div>
              </div>
              <div className="auditoria-event__actions">
                <button type="button" onClick={() => abrirLinhaDoTempo(log)}>
                  Linha do tempo
                </button>
                <button type="button" onClick={() => void abrirDetalhe(log)}>
                  Ver descricao
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="auditoria-panel__empty">Nenhum evento encontrado para os filtros atuais.</p>
        )}
      </div>

      {detalhe
        ? createPortal(
            <div className="auditoria-modal" role="dialog" aria-modal="true">
              <div className="auditoria-modal__box">
                <button
                  type="button"
                  className="auditoria-modal__close"
                  onClick={() => setDetalhe(null)}
                  aria-label="Fechar detalhes"
                >
                  ×
                </button>
                <header>
                  <p>{humanizeEntity(detalhe?.entityType)}</p>
                  <h3>{humanizeAction(detalhe?.action)}</h3>
                  <span>{formatDate(detalhe?.criadoEm || detalhe?.data || detalhe?.createdAt)}</span>
                </header>
                <div className="auditoria-modal__actions">
                  <button type="button" onClick={() => abrirLinhaDoTempo(detalhe)}>
                    Ver linha do tempo da entidade
                  </button>
                </div>
                <div className="auditoria-modal__grid">
                  <div>
                    <strong>Entidade</strong>
                    <span>{compactId(detalhe?.entityId)}</span>
                  </div>
                  <div>
                    <strong>Projeto</strong>
                    <span>{resolveProjectLabel(detalhe)}</span>
                  </div>
                  <div>
                    <strong>Ator</strong>
                    <span>{normalizeText(detalhe?.actorEmail || detalhe?.actorUid) || "--"}</span>
                  </div>
                  <div>
                    <strong>Origem</strong>
                    <span>{normalizeText(detalhe?.source) || "--"}</span>
                  </div>
                  <div>
                    <strong>Categoria</strong>
                    <span>{humanizeAuditCategory(resolveAuditCategory(detalhe))}</span>
                  </div>
                  <div>
                    <strong>Severidade</strong>
                    <span>{humanizeAuditSeverity(resolveLogSeverity(detalhe))}</span>
                  </div>
                  <div>
                    <strong>Status</strong>
                    <span>{isAuditLogRead(detalhe) ? "Lido" : "Nao lido"}</span>
                  </div>
                  <div>
                    <strong>Espaco</strong>
                    <span>{normalizeText(detalhe?.espacoNome || detalhe?.espacoId) || "--"}</span>
                  </div>
                  <div>
                    <strong>Motivo</strong>
                    <span>{normalizeText(detalhe?.motivo) || "--"}</span>
                  </div>
                </div>
                <div className="auditoria-modal__snapshots">
                  <section>
                    <h4>Snapshot Antes</h4>
                    <pre>{stringifyDetails(detalhe?.snapshotAntes)}</pre>
                  </section>
                  <section>
                    <h4>Snapshot Depois</h4>
                    <pre>{stringifyDetails(detalhe?.snapshotDepois)}</pre>
                  </section>
                  <section>
                    <h4>Metadados</h4>
                    <pre>{stringifyDetails(detalhe?.metadata || detalhe?.clientContext)}</pre>
                  </section>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {linhaDoTempo
        ? createPortal(
            <div className="auditoria-modal auditoria-modal--timeline" role="dialog" aria-modal="true">
              <div className="auditoria-modal__box auditoria-modal__box--timeline">
                <button
                  type="button"
                  className="auditoria-modal__close"
                  onClick={() => setLinhaDoTempo(null)}
                  aria-label="Fechar linha do tempo"
                >
                  X
                </button>
                <header>
                  <p>Linha do tempo da entidade</p>
                  <h3>{humanizeEntity(linhaDoTempo?.baseLog?.entityType)}</h3>
                  <span>{`ID ${compactId(linhaDoTempo?.baseLog?.entityId)}`}</span>
                </header>

                <div className="auditoria-modal__grid">
                  <div>
                    <strong>Projeto</strong>
                    <span>{resolveProjectLabel(linhaDoTempo?.baseLog)}</span>
                  </div>
                  <div>
                    <strong>Categoria</strong>
                    <span>{humanizeAuditCategory(resolveAuditCategory(linhaDoTempo?.baseLog))}</span>
                  </div>
                  <div>
                    <strong>Severidade</strong>
                    <span>{humanizeAuditSeverity(resolveLogSeverity(linhaDoTempo?.baseLog))}</span>
                  </div>
                  <div>
                    <strong>Eventos</strong>
                    <span>{linhaDoTempo.loading ? "Sincronizando..." : linhaDoTempoItens.length}</span>
                  </div>
                </div>

                <div className="auditoria-modal__actions">
                  <button
                    type="button"
                    onClick={() => {
                      void exportarCsvLinhaDoTempo();
                    }}
                    disabled={linhaDoTempo.loading || !linhaDoTempoItens.length || !podeExportarAuditoria}
                    title={
                      !podeExportarAuditoria
                        ? "Sem permissao para exportar auditoria deste projeto."
                        : undefined
                    }
                  >
                    Exportar linha do tempo CSV
                  </button>
                </div>

                {linhaDoTempo.erro ? (
                  <p className="auditoria-panel__error">{linhaDoTempo.erro}</p>
                ) : null}

                <div className="auditoria-timeline" aria-busy={linhaDoTempo.loading}>
                  {linhaDoTempo.loading ? (
                    <p className="auditoria-panel__empty">Carregando linha do tempo...</p>
                  ) : linhaDoTempoItens.length ? (
                    linhaDoTempoItens.map((item, index) => (
                      <article
                        key={`${item?.auditPath || item?.id || index}`}
                        className="auditoria-timeline__item"
                      >
                        <div className="auditoria-timeline__pin" aria-hidden="true">
                          {String(index + 1).padStart(2, "0")}
                        </div>
                        <div className="auditoria-timeline__content">
                          <div className="auditoria-event__topline">
                            <strong>{humanizeAction(item?.action)}</strong>
                            <span>{formatDate(item?.criadoEm || item?.data || item?.createdAt)}</span>
                          </div>
                          <p>{normalizeText(item?.motivo) || humanizeEntity(item?.entityType)}</p>
                          <div className="auditoria-event__chips">
                            <span>{normalizeText(item?.actorEmail || item?.actorUid) || "ator nao identificado"}</span>
                            <span>{normalizeText(item?.source) || "origem desconhecida"}</span>
                            <span>{humanizeAuditCategory(resolveAuditCategory(item))}</span>
                            <span className={`auditoria-event__severity auditoria-event__severity--${resolveLogSeverity(item)}`}>
                              {humanizeAuditSeverity(resolveLogSeverity(item))}
                            </span>
                            <span
                              className={`auditoria-event__read-status ${
                                isAuditLogRead(item)
                                  ? "auditoria-event__read-status--read"
                                  : "auditoria-event__read-status--unread"
                              }`}
                            >
                              {isAuditLogRead(item) ? "Lido" : "Nao lido"}
                            </span>
                          </div>
                        </div>
                        <button type="button" onClick={() => void abrirDetalhe(item)}>
                          Descricao
                        </button>
                      </article>
                    ))
                  ) : (
                    <p className="auditoria-panel__empty">
                      Nenhum outro evento encontrado para esta entidade.
                    </p>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
        </>
      )}
    </section>
  );
}
