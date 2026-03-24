import React, { useEffect, useMemo, useState } from "react";

import {
  listarAcessosNoGerenciador,
  listarProjetosNoGerenciador,
} from "../../../Sistema/gerenciadorSistemasApi";
import { obterManagerProjectLabel } from "../../../Sistema/configSistema";
import "./acessos.css";

const PAGE_SIZE = 24;

function normalizeText(value) {
  return String(value || "").trim();
}

function formatarData(value) {
  if (!value) return "--";
  if (typeof value?.toDate === "function") {
    return value.toDate().toLocaleString("pt-BR");
  }
  if (typeof value?.seconds === "number") {
    return new Date(value.seconds * 1000).toLocaleString("pt-BR");
  }
  if (typeof value?._seconds === "number") {
    return new Date(value._seconds * 1000).toLocaleString("pt-BR");
  }
  const timestampMs =
    value instanceof Date
      ? value.getTime()
      : (typeof value === "number" && Number.isFinite(value) ? value : new Date(value).getTime());
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return "--";
  return new Date(timestampMs).toLocaleString("pt-BR");
}

function ListaAcessos() {
  const managerProjectLabel = obterManagerProjectLabel();
  const [acessos, setAcessos] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [filtroProjeto, setFiltroProjeto] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [erro, setErro] = useState("");

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

  useEffect(() => {
    let ativo = true;

    const carregarAcessos = async () => {
      try {
        const lista = await listarAcessosNoGerenciador();
        if (!ativo) return;
        setErro("");
        setAcessos(Array.isArray(lista) ? lista : []);
      } catch (error) {
        if (!ativo) return;
        console.error("Erro ao carregar acessos do gerenciador:", error);
        setErro("Nao foi possivel carregar os acessos.");
        setAcessos([]);
      }
    };

    carregarAcessos();
    const timerId = window.setInterval(carregarAcessos, 30000);

    return () => {
      ativo = false;
      window.clearInterval(timerId);
    };
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
      if (filtroProjeto && projectKey !== filtroProjeto) return false;
      return true;
    });
  }, [acessos, filtroProjeto]);

  useEffect(() => {
    setPaginaAtual(1);
  }, [filtroProjeto]);

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
      </div>

      <div className="gerenciador-acessos__summary">
        <span>{`Total exibido: ${acessosFiltrados.length}`}</span>
        <span>{`Pagina: ${paginaAtualSegura}/${totalPaginas}`}</span>
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
                  <span>{`Runtime: ${normalizeText(acesso?.runtimeProjectId) || "--"}`}</span>
                  <span>{`Host: ${normalizeText(acesso?.hostname) || "--"}`}</span>
                  <span>{`IP: ${ipAcesso}`}</span>
                  <span>{`Hash: ${hashAnonimo}`}</span>
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
