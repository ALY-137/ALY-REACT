import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

import {
  listarProjetosNoGerenciador,
  obterFirestoreDoGerenciador,
} from "../../../Sistema/gerenciadorSistemasApi";
import { obterManagerProjectLabel } from "../../../Sistema/configSistema";
import "./acessos.css";

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
  return "--";
}

function ListaAcessos() {
  const managerProjectLabel = obterManagerProjectLabel();
  const [acessos, setAcessos] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [filtroProjeto, setFiltroProjeto] = useState("");
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
    const managerDb = obterFirestoreDoGerenciador();
    if (!managerDb) {
      setErro("Banco do gerenciador nao configurado.");
      setAcessos([]);
      return undefined;
    }

    const acessosRef = query(collection(managerDb, "acessos"), orderBy("data", "desc"));
    const unsubscribe = onSnapshot(
      acessosRef,
      (snapshot) => {
        setErro("");
        setAcessos(snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() })));
      },
      (error) => {
        console.error("Erro ao carregar acessos do gerenciador:", error);
        setErro("Nao foi possivel carregar os acessos.");
      }
    );

    return () => unsubscribe();
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
      </div>

      {erro ? <p className="gerenciador-acessos__error">{erro}</p> : null}

      {!erro && !acessosFiltrados.length ? (
        <p className="gerenciador-acessos__empty">Nenhum acesso encontrado.</p>
      ) : null}

      {!erro && acessosFiltrados.length ? (
        <div className="gerenciador-acessos__list">
          {acessosFiltrados.map((acesso) => {
            const projectKey = normalizeText(
              acesso?.projectSystemKey || acesso?.runtimeProjectKey
            ).toLowerCase();
            const projeto = projetosMap.get(projectKey);
            return (
              <article key={acesso.id} className="gerenciador-acessos__card">
                <div className="gerenciador-acessos__topline">
                  <strong>
                    {normalizeText(acesso?.displayName || acesso?.email || acesso?.uid) ||
                      "Visitante"}
                  </strong>
                  <span>{formatarData(acesso?.data || acesso?.criadoEm)}</span>
                </div>
                <div className="gerenciador-acessos__meta">
                  <span>{`Projeto: ${
                    normalizeText(projeto?.nomeProjeto) ||
                    normalizeText(acesso?.projectNome) ||
                    projectKey ||
                    "--"
                  }`}</span>
                  <span>{`Perfil: ${normalizeText(acesso?.perfilAcesso) || "--"}`}</span>
                  <span>{`Runtime: ${normalizeText(acesso?.runtimeProjectId) || "--"}`}</span>
                  <span>{`Host: ${normalizeText(acesso?.hostname) || "--"}`}</span>
                </div>
                <div className="gerenciador-acessos__path">
                  <code>{normalizeText(acesso?.fullPath || acesso?.path) || "/"}</code>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export default ListaAcessos;
