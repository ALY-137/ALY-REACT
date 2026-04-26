import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  listarAuditLogsNoGerenciador,
  listarProjetosNoGerenciador,
} from "../../../Sistema/gerenciadorSistemasApi";
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

export default function Auditoria() {
  const [logs, setLogs] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [filtroProjeto, setFiltroProjeto] = useState("");
  const [filtroAcao, setFiltroAcao] = useState("");
  const [filtroEntidade, setFiltroEntidade] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [detalhe, setDetalhe] = useState(null);

  const projetosMap = useMemo(() => {
    return projetos.reduce((acc, projeto) => {
      const key = normalizeText(projeto?.systemKey || projeto?.id).toLowerCase();
      if (key) acc[key] = projeto;
      return acc;
    }, {});
  }, [projetos]);

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
  }, [filtroAcao, filtroDataFim, filtroDataInicio, filtroEntidade, filtroProjeto]);

  useEffect(() => {
    void carregarProjetos();
  }, [carregarProjetos]);

  useEffect(() => {
    void carregarAuditoria();
  }, [carregarAuditoria]);

  useEffect(() => {
    if (!detalhe) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") setDetalhe(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [detalhe]);

  const actionOptions = useMemo(() => buildUniqueOptions(logs, "action"), [logs]);
  const entityOptions = useMemo(() => buildUniqueOptions(logs, "entityType"), [logs]);
  const totalExclusoes = useMemo(
    () => logs.filter((log) => normalizeText(log?.action).includes("exclu")).length,
    [logs]
  );
  const totalRastreaveis = useMemo(
    () =>
      logs.filter((log) =>
        ["qrPrint", "trackableLink"].includes(normalizeText(log?.entityType))
      ).length,
    [logs]
  );
  const totalBlocosCards = useMemo(
    () =>
      logs.filter((log) => ["bloco", "card"].includes(normalizeText(log?.entityType))).length,
    [logs]
  );

  const limparFiltros = () => {
    setFiltroProjeto("");
    setFiltroAcao("");
    setFiltroEntidade("");
    setFiltroDataInicio("");
    setFiltroDataFim("");
  };

  const resolveProjectLabel = (log = {}) => {
    const key = normalizeText(log?.projectSystemKey || log?.runtimeProjectKey).toLowerCase();
    return normalizeText(projetosMap[key]?.nomeProjeto) || key || "--";
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
        <button type="button" onClick={carregarAuditoria} disabled={loading}>
          {loading ? "Sincronizando..." : "Atualizar"}
        </button>
      </header>

      <div className="auditoria-panel__metrics">
        <article>
          <strong>{logs.length}</strong>
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

      {erro ? <p className="auditoria-panel__error">{erro}</p> : null}

      <div className="auditoria-panel__list" aria-busy={loading}>
        {loading ? (
          <p className="auditoria-panel__empty">Carregando trilha de auditoria...</p>
        ) : logs.length ? (
          logs.map((log) => (
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
                  <span>{resolveProjectLabel(log)}</span>
                  <span>{normalizeText(log?.actorEmail || log?.actorUid) || "ator nao identificado"}</span>
                </div>
              </div>
              <button type="button" onClick={() => setDetalhe(log)}>
                Ver detalhes
              </button>
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
    </section>
  );
}
