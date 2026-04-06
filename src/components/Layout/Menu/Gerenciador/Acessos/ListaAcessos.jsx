import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  listarAcessosNoGerenciador,
  listarProjetosNoGerenciador,
} from "../../../Sistema/gerenciadorSistemasApi";
import { obterManagerProjectLabel } from "../../../Sistema/configSistema";
import "./acessos.css";

const PAGE_SIZE = 24;
const ACCESS_QUERY_LIMIT = 100;

function normalizeText(value) {
  return String(value || "").trim();
}

function resolveGeoText(acesso, ...candidates) {
  for (const candidate of candidates) {
    const value = normalizeText(candidate);
    if (value) return value;
  }

  return "--";
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

function formatarData(value) {
  const timestampMs = resolveDataTimestampMs(value);
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return "--";
  return new Date(timestampMs).toLocaleString("pt-BR");
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

function ListaAcessos() {
  const managerProjectLabel = obterManagerProjectLabel();
  const mountedRef = useRef(true);
  const [acessos, setAcessos] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [filtroProjeto, setFiltroProjeto] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState("");
  const [filtroTipoUsuario, setFiltroTipoUsuario] = useState("");
  const [filtroHash, setFiltroHash] = useState("");
  const [filtroIp, setFiltroIp] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(1);
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
      setUltimaAtualizacao(Date.now());
    } catch (error) {
      if (!mountedRef.current) return;
      console.error("Erro ao carregar acessos do gerenciador:", error);
      setErro("Nao foi possivel carregar os acessos.");
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

  const projetosMap = useMemo(() => {
    const mapa = new Map();
    projetos.forEach((projeto) => {
      const systemKey = normalizeText(projeto?.systemKey).toLowerCase();
      if (!systemKey) return;
      mapa.set(systemKey, projeto);
    });
    return mapa;
  }, [projetos]);

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

  const acessosFiltrados = useMemo(() => {
    return acessos.filter((acesso) => {
      const projectKey = normalizeText(
        acesso?.projectSystemKey || acesso?.runtimeProjectKey
      ).toLowerCase();
      const hashAtual = normalizeText(acesso?.visitorHash || acesso?.hash).toLowerCase();
      const ipAtual = normalizeText(acesso?.ip).toLowerCase();
      const acessoTimestamp = resolveDataTimestampMs(acesso?.data || acesso?.criadoEm);
      if (filtroProjeto && projectKey !== filtroProjeto) return false;
      if (filtroOrigem && resolveOrigemAcesso(acesso) !== filtroOrigem) return false;
      if (filtroTipoUsuario && resolveTipoUsuario(acesso) !== filtroTipoUsuario) return false;
      if (filtroHash && !hashAtual.includes(filtroHash.toLowerCase())) return false;
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
    filtroHash,
    filtroIp,
    filtroOrigem,
    filtroProjeto,
    filtroTipoUsuario,
  ]);

  useEffect(() => {
    setPaginaAtual(1);
  }, [
    filtroDataFim,
    filtroDataInicio,
    filtroHash,
    filtroIp,
    filtroOrigem,
    filtroProjeto,
    filtroTipoUsuario,
  ]);

  const totalPaginas = Math.max(1, Math.ceil(acessosFiltrados.length / PAGE_SIZE));
  const paginaAtualSegura = Math.min(paginaAtual, totalPaginas);

  useEffect(() => {
    if (paginaAtual !== paginaAtualSegura) {
      setPaginaAtual(paginaAtualSegura);
    }
  }, [paginaAtual, paginaAtualSegura]);

  const acessosPaginados = useMemo(() => {
    const inicio = (paginaAtualSegura - 1) * PAGE_SIZE;
    return acessosFiltrados.slice(inicio, inicio + PAGE_SIZE);
  }, [acessosFiltrados, paginaAtualSegura]);

  return (
    <section className="gerenciador-acessos">
      <div className="gerenciador-acessos__header">
        <div>
          <h1 className="gerenciador-acessos__title">ACESSOS</h1>
          <p className="gerenciador-acessos__subtitle">
            {`Eventos de acesso centralizados no projeto ${managerProjectLabel}.`}
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

          <label className="gerenciador-acessos__filter">
            <span>Origem</span>
            <select value={filtroOrigem} onChange={(event) => setFiltroOrigem(event.target.value)}>
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

          <div className="gerenciador-acessos__filter-pair">
            <label className="gerenciador-acessos__filter gerenciador-acessos__filter--compact">
              <span>Hash</span>
              <input
                type="text"
                value={filtroHash}
                onChange={(event) => setFiltroHash(event.target.value)}
                placeholder="Digite o hash"
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
        </div>
      </div>

      <div className="gerenciador-acessos__summary">
        <span>{`Total exibido: ${acessosFiltrados.length}`}</span>
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
      </div>

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

      {!erro && acessosPaginados.length ? (
        <div className="gerenciador-acessos__list">
          {acessosPaginados.map((acesso) => {
            const projectKey = normalizeText(
              acesso?.projectSystemKey || acesso?.runtimeProjectKey
            ).toLowerCase();
            const projeto = projetosMap.get(projectKey);
            const hashAnonimo = normalizeText(acesso?.visitorHash || acesso?.hash) || "--";
            const ipAcesso = normalizeText(acesso?.ip) || "--";
            const origemAcesso = resolveOrigemAcesso(acesso) || "--";
            const tipoUsuario = resolveTipoUsuario(acesso);
            const paisAcesso = resolveGeoText(
              acesso,
              acesso?.country,
              acesso?.pais,
              acesso?.geo?.country,
              acesso?.geo?.pais
            );
            const regiaoAcesso = resolveGeoText(
              acesso,
              acesso?.region,
              acesso?.regiao,
              acesso?.uf,
              acesso?.geo?.region,
              acesso?.geo?.regiao,
              acesso?.geo?.uf
            );
            const cidadeAcesso = resolveGeoText(
              acesso,
              acesso?.city,
              acesso?.cidade,
              acesso?.geo?.city,
              acesso?.geo?.cidade
            );
            return (
              <article key={acesso.id} className="gerenciador-acessos__card">
                <div className="gerenciador-acessos__topline">
                  <strong>
                    {normalizeText(acesso?.displayName || acesso?.email || acesso?.uid) ||
                      "Visitante"}
                  </strong>
                  <span>{`Data/Hora: ${formatarData(acesso?.data || acesso?.criadoEm)}`}</span>
                </div>
                <div className="gerenciador-acessos__meta">
                  <span>{`Projeto: ${
                    normalizeText(projeto?.nomeProjeto) ||
                    normalizeText(acesso?.projectNome) ||
                    projectKey ||
                    "--"
                  }`}</span>
                  <span>{`Perfil: ${normalizeText(acesso?.perfilAcesso) || "--"}`}</span>
                  <span>{`Evento: ${normalizeText(acesso?.eventoTipo) || "--"}`}</span>
                  <span>{`Origem: ${origemAcesso}`}</span>
                  <span>{`Tipo usuario: ${tipoUsuario}`}</span>
                  <span>{`Runtime: ${normalizeText(acesso?.runtimeProjectId) || "--"}`}</span>
                  <span>{`Host: ${normalizeText(acesso?.hostname) || "--"}`}</span>
                  <span>{`IP: ${ipAcesso}`}</span>
                  <span>{`Hash: ${hashAnonimo}`}</span>
                  <span>{`Pais: ${paisAcesso}`}</span>
                  <span>{`Regiao: ${regiaoAcesso}`}</span>
                  <span>{`Cidade: ${cidadeAcesso}`}</span>
                </div>
                <div className="gerenciador-acessos__path">
                  <code>{normalizeText(acesso?.fullPath || acesso?.path) || "/"}</code>
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
    </section>
  );
}

export default ListaAcessos;
