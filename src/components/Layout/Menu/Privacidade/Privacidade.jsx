import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../../../hooks/auth/useAuth";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterOwnerEmailConfigurado,
  obterOwnerUidConfigurado,
  obterConfigSistema,
  obterConfigSistemaCacheLocal,
  usuarioCorrespondeOwnerConfigurado,
} from "../../Sistema/configSistema";
import {
  atualizarSolicitacaoLgpd,
  criarSolicitacaoLgpd,
  isLgpdConsentRequired,
  listarSolicitacoesLgpdDoProjeto,
  listarSolicitacoesLgpd,
  obterConsentimentoLgpdAtual,
  registrarConsentimentoLgpd,
  resolveLgpdPolicySnapshot,
} from "../../Sistema/lgpdConsentApi";
import ProjectLoadingFallback from "../../Geral/ProjectLoadingFallback";
import { seforAdm } from "../../../Scripts/verificacoes/verificaAdm";
import "./privacidade.css";

const TIPOS_SOLICITACAO = [
  { value: "acesso_dados", label: "Acesso aos meus dados" },
  { value: "correcao_dados", label: "Correcao de dados" },
  { value: "exclusao_dados", label: "Exclusao ou anonimizacao" },
  { value: "portabilidade", label: "Portabilidade" },
  { value: "revogacao_consentimento", label: "Revogacao de consentimento" },
  { value: "oposicao", label: "Oposicao ao tratamento" },
  { value: "revisao_decisao", label: "Revisao de decisao automatizada" },
  { value: "informacoes", label: "Informacoes sobre privacidade" },
];

const STATUS_SOLICITACAO_OWNER = [
  { value: "aberta", label: "Aberta" },
  { value: "em_analise", label: "Em analise" },
  { value: "aguardando_usuario", label: "Aguardando usuario" },
  { value: "concluida", label: "Concluida" },
  { value: "recusada_justificada", label: "Recusada com justificativa" },
];

function resolveTipoSolicitacaoLabel(value = "") {
  return (
    TIPOS_SOLICITACAO.find((tipoItem) => tipoItem.value === value)?.label ||
    value ||
    "Solicitacao"
  );
}

function resolveStatusSolicitacaoLabel(value = "") {
  return (
    STATUS_SOLICITACAO_OWNER.find((statusItem) => statusItem.value === value)?.label ||
    value ||
    "Aberta"
  );
}

function buildOwnerRequestKey(item = {}) {
  return `${item.userId || item.uid || ""}:${item.id || ""}`;
}

function resolveUsuarioEhOwnerProjeto(configSistema = {}, user = null) {
  if (!user?.uid) return false;
  const ownerUid = String(obterOwnerUidConfigurado(configSistema) || "").trim();
  const ownerEmail = String(obterOwnerEmailConfigurado(configSistema) || "").trim();
  return (
    usuarioCorrespondeOwnerConfigurado(configSistema, {
      uid: user.uid,
      email: user.email,
    }) ||
    (!ownerUid && !ownerEmail && seforAdm(user))
  );
}

function formatDate(value) {
  if (!value) return "--";
  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : typeof value?.seconds === "number"
        ? new Date(value.seconds * 1000)
        : new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function Privacidade() {
  const { user, loading: authLoading } = useAuth();
  const [configSistema, setConfigSistema] = useState(
    () => obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG
  );
  const [loading, setLoading] = useState(true);
  const [consentimento, setConsentimento] = useState(null);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [solicitacoesProjeto, setSolicitacoesProjeto] = useState([]);
  const [tipo, setTipo] = useState("acesso_dados");
  const [descricao, setDescricao] = useState("");
  const [savingConsent, setSavingConsent] = useState(false);
  const [savingRequest, setSavingRequest] = useState(false);
  const [savingOwnerRequestKey, setSavingOwnerRequestKey] = useState("");
  const [ownerStatusDraft, setOwnerStatusDraft] = useState({});
  const [ownerRespostaDraft, setOwnerRespostaDraft] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const policy = useMemo(
    () => resolveLgpdPolicySnapshot(configSistema),
    [configSistema]
  );
  const aceiteObrigatorio = isLgpdConsentRequired(configSistema);
  const aceiteAtual = consentimento?.current === true;
  const usuarioEhOwnerProjeto = useMemo(
    () => resolveUsuarioEhOwnerProjeto(configSistema, user),
    [configSistema, user]
  );

  const carregar = async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError("");
    try {
      const config = await obterConfigSistema().catch(
        () => obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG
      );
      const configFinal = config || DEFAULT_SISTEMA_CONFIG;
      const ownerAtual = resolveUsuarioEhOwnerProjeto(configFinal, user);
      setConfigSistema(configFinal);
      const [consent, requests] = await Promise.all([
        obterConsentimentoLgpdAtual({ user, configSistema: configFinal }),
        listarSolicitacoesLgpd({ user, limit: 50 }),
      ]);
      setConsentimento(consent);
      setSolicitacoes(requests);
      if (ownerAtual) {
        const requestsProjeto = await listarSolicitacoesLgpdDoProjeto({ limit: 120 });
        setSolicitacoesProjeto(requestsProjeto);
        setOwnerStatusDraft((prev) => {
          const next = { ...prev };
          requestsProjeto.forEach((item) => {
            const key = buildOwnerRequestKey(item);
            if (!next[key]) next[key] = item.status || "aberta";
          });
          return next;
        });
        setOwnerRespostaDraft((prev) => {
          const next = { ...prev };
          requestsProjeto.forEach((item) => {
            const key = buildOwnerRequestKey(item);
            if (typeof next[key] !== "string") next[key] = item.resposta || "";
          });
          return next;
        });
      } else {
        setSolicitacoesProjeto([]);
      }
    } catch (err) {
      console.warn("Falha ao carregar central de privacidade:", err);
      setError("Nao foi possivel carregar seus dados de privacidade.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    void carregar();
  }, [authLoading, user?.uid]);

  const aceitarVersaoAtual = async () => {
    if (!user?.uid || savingConsent) return;
    setSavingConsent(true);
    setMessage("");
    setError("");
    try {
      await registrarConsentimentoLgpd({
        user,
        configSistema,
        origem: "central_privacidade",
        accepted: true,
      });
      await carregar();
      setMessage("Aceite atualizado com sucesso.");
    } catch (err) {
      console.warn("Falha ao registrar aceite pela central de privacidade:", err);
      setError("Nao foi possivel registrar o aceite.");
    } finally {
      setSavingConsent(false);
    }
  };

  const abrirSolicitacao = async (event) => {
    event.preventDefault();
    if (!user?.uid || savingRequest) return;
    setSavingRequest(true);
    setMessage("");
    setError("");
    try {
      await criarSolicitacaoLgpd({
        user,
        configSistema,
        tipo,
        descricao,
      });
      setDescricao("");
      await carregar();
      setMessage("Solicitacao registrada para analise.");
    } catch (err) {
      console.warn("Falha ao abrir solicitacao LGPD:", err);
      setError("Nao foi possivel abrir a solicitacao.");
    } finally {
      setSavingRequest(false);
    }
  };

  const responderSolicitacaoOwner = async (item = {}) => {
    const key = buildOwnerRequestKey(item);
    const targetUid = item.userId || item.uid || "";
    if (!usuarioEhOwnerProjeto || !targetUid || !item.id || savingOwnerRequestKey) return;

    setSavingOwnerRequestKey(key);
    setMessage("");
    setError("");
    try {
      await atualizarSolicitacaoLgpd({
        user,
        targetUid,
        requestId: item.id,
        status: ownerStatusDraft[key] || item.status || "em_analise",
        resposta: ownerRespostaDraft[key] || "",
      });
      await carregar();
      setMessage("Solicitacao LGPD atualizada.");
    } catch (err) {
      console.warn("Falha ao responder solicitacao LGPD:", err);
      setError("Nao foi possivel atualizar a solicitacao LGPD.");
    } finally {
      setSavingOwnerRequestKey("");
    }
  };

  if (authLoading || loading) {
    return <ProjectLoadingFallback text="Carregando privacidade..." />;
  }

  if (!user?.uid) {
    return (
      <main className="privacidade-page">
        <section className="privacidade-page__panel">
          <h1>Privacidade</h1>
          <p>Entre com sua conta para consultar seus dados de privacidade.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="privacidade-page">
      <section className="privacidade-page__header">
        <p className="privacidade-page__eyebrow">LGPD</p>
        <h1>Privacidade e meus dados</h1>
        <p>
          Acompanhe o aceite vigente e registre pedidos relacionados aos seus dados
          pessoais neste projeto.
        </p>
      </section>

      {message ? <p className="privacidade-page__success">{message}</p> : null}
      {error ? <p className="privacidade-page__error">{error}</p> : null}

      <section className="privacidade-page__grid">
        <article className="privacidade-page__panel">
          <h2>Aceite atual</h2>
          <dl className="privacidade-page__facts">
            <div>
              <dt>Status</dt>
              <dd>{aceiteAtual ? "Atualizado" : aceiteObrigatorio ? "Pendente" : "Opcional"}</dd>
            </div>
            <div>
              <dt>Termos</dt>
              <dd>v{policy.termosUsoVersao}</dd>
            </div>
            <div>
              <dt>Politica</dt>
              <dd>v{policy.politicaPrivacidadeVersao}</dd>
            </div>
            <div>
              <dt>Ultimo aceite</dt>
              <dd>{formatDate(consentimento?.data?.acceptedAt || consentimento?.data?.updatedAt)}</dd>
            </div>
          </dl>

          <div className="privacidade-page__links">
            {policy.termosUsoUrl ? (
              <a href={policy.termosUsoUrl} target="_blank" rel="noreferrer">
                Abrir termos de uso
              </a>
            ) : null}
            {policy.politicaPrivacidadeUrl ? (
              <a href={policy.politicaPrivacidadeUrl} target="_blank" rel="noreferrer">
                Abrir politica de privacidade
              </a>
            ) : null}
          </div>

          <button type="button" onClick={aceitarVersaoAtual} disabled={savingConsent}>
            {savingConsent ? "Salvando..." : aceiteAtual ? "Reafirmar aceite" : "Aceitar versao atual"}
          </button>
        </article>

        <article className="privacidade-page__panel">
          <h2>Solicitar direitos LGPD</h2>
          <form onSubmit={abrirSolicitacao} className="privacidade-page__form">
            <label htmlFor="lgpdTipo">Tipo de solicitacao</label>
            <select
              id="lgpdTipo"
              value={tipo}
              onChange={(event) => setTipo(event.target.value)}
            >
              {TIPOS_SOLICITACAO.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <label htmlFor="lgpdDescricao">Descricao</label>
            <textarea
              id="lgpdDescricao"
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
              maxLength={3000}
              rows={6}
              placeholder="Descreva o que voce precisa consultar, corrigir, excluir ou revisar."
            />

            <button type="submit" disabled={savingRequest}>
              {savingRequest ? "Enviando..." : "Abrir solicitacao"}
            </button>
          </form>
        </article>
      </section>

      <section className="privacidade-page__panel">
        <h2>Minhas solicitacoes</h2>
        {solicitacoes.length ? (
          <ol className="privacidade-page__requests">
            {solicitacoes.map((item) => {
              return (
                <li key={item.id}>
                  <strong>{resolveTipoSolicitacaoLabel(item.tipo)}</strong>
                  <span>Status: {resolveStatusSolicitacaoLabel(item.status || "aberta")}</span>
                  <span>Criada em: {formatDate(item.createdAt)}</span>
                  {item.descricao ? <p>{item.descricao}</p> : null}
                  {item.resposta ? (
                    <p>
                      <strong>Resposta:</strong> {item.resposta}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <p>Nenhuma solicitacao registrada ainda.</p>
        )}
      </section>

      {usuarioEhOwnerProjeto ? (
        <section className="privacidade-page__panel privacidade-page__panel--owner">
          <div className="privacidade-page__owner-title">
            <div>
              <p className="privacidade-page__eyebrow">Atendimento</p>
              <h2>Solicitacoes LGPD recebidas</h2>
            </div>
            <span>{solicitacoesProjeto.length} abertas ou historicas</span>
          </div>

          {solicitacoesProjeto.length ? (
            <ol className="privacidade-page__requests privacidade-page__requests--owner">
              {solicitacoesProjeto.map((item) => {
                const key = buildOwnerRequestKey(item);
                const savingItem = savingOwnerRequestKey === key;

                return (
                  <li key={key} className="privacidade-page__owner-request">
                    <div className="privacidade-page__owner-head">
                      <strong>{resolveTipoSolicitacaoLabel(item.tipo)}</strong>
                      <span>
                        Status: {resolveStatusSolicitacaoLabel(item.status || "aberta")}
                      </span>
                      <span>
                        Usuario: {item.userEmail || item.userName || item.userId || "--"}
                      </span>
                      <span>Criada em: {formatDate(item.createdAt)}</span>
                      {item.updatedAt ? (
                        <span>Atualizada em: {formatDate(item.updatedAt)}</span>
                      ) : null}
                    </div>

                    {item.descricao ? <p>{item.descricao}</p> : null}
                    {item.resposta ? (
                      <p>
                        <strong>Resposta atual:</strong> {item.resposta}
                      </p>
                    ) : null}

                    <div className="privacidade-page__owner-actions">
                      <label htmlFor={`lgpd-status-${key}`}>
                        Status
                        <select
                          id={`lgpd-status-${key}`}
                          value={ownerStatusDraft[key] || item.status || "aberta"}
                          onChange={(event) =>
                            setOwnerStatusDraft((prev) => ({
                              ...prev,
                              [key]: event.target.value,
                            }))
                          }
                        >
                          {STATUS_SOLICITACAO_OWNER.map((statusItem) => (
                            <option key={statusItem.value} value={statusItem.value}>
                              {statusItem.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label htmlFor={`lgpd-resposta-${key}`}>
                        Resposta ao titular
                        <textarea
                          id={`lgpd-resposta-${key}`}
                          value={ownerRespostaDraft[key] ?? item.resposta ?? ""}
                          onChange={(event) =>
                            setOwnerRespostaDraft((prev) => ({
                              ...prev,
                              [key]: event.target.value,
                            }))
                          }
                          maxLength={5000}
                          rows={4}
                          placeholder="Registre a resposta, orientacao ou justificativa enviada ao titular."
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => responderSolicitacaoOwner(item)}
                        disabled={savingItem || Boolean(savingOwnerRequestKey)}
                      >
                        {savingItem ? "Salvando..." : "Salvar resposta"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p>Nenhuma solicitacao LGPD recebida ainda.</p>
          )}
        </section>
      ) : null}
    </main>
  );
}

export default Privacidade;
