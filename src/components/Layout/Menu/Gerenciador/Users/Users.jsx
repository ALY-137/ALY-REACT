import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

import {
  listarProjetosNoGerenciador,
  obterFirestoreDoGerenciador,
} from "../../../Sistema/gerenciadorSistemasApi";
import "./users.css";

function normalizarTexto(valor) {
  return String(valor || "").trim();
}

function formatarData(valor) {
  if (!valor) return "--";
  if (typeof valor?.toDate === "function") {
    return valor.toDate().toLocaleString("pt-BR");
  }
  if (typeof valor?.seconds === "number") {
    return new Date(valor.seconds * 1000).toLocaleString("pt-BR");
  }
  return "--";
}

function Users() {
  const [usuarios, setUsuarios] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState("");
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
        console.error("Erro ao carregar projetos para Users:", error);
      });

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    const managerDb = obterFirestoreDoGerenciador();
    if (!managerDb) {
      setErro("Banco do gerenciador nao configurado.");
      setUsuarios([]);
      return undefined;
    }

    const usuariosRef = query(
      collection(managerDb, "usuarios_projetos"),
      orderBy("updatedAt", "desc")
    );
    const unsubscribe = onSnapshot(
      usuariosRef,
      (snapshot) => {
        setErro("");
        setUsuarios(snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() })));
      },
      (error) => {
        console.error("Erro ao carregar usuarios do gerenciador:", error);
        setErro("Nao foi possivel carregar os usuarios.");
      }
    );

    return () => unsubscribe();
  }, []);

  const projetosMap = useMemo(() => {
    const mapa = new Map();
    projetos.forEach((projeto) => {
      const key = normalizarTexto(projeto?.systemKey).toLowerCase();
      if (!key) return;
      mapa.set(key, projeto);
    });
    return mapa;
  }, [projetos]);

  const opcoesProjeto = useMemo(() => {
    return projetos
      .map((projeto) => ({
        value: normalizarTexto(projeto?.systemKey).toLowerCase(),
        label: normalizarTexto(projeto?.nomeProjeto) || normalizarTexto(projeto?.systemKey),
      }))
      .filter((item) => item.value)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [projetos]);

  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter((usuario) => {
      const projectKey = normalizarTexto(
        usuario?.projectSystemKey || usuario?.runtimeProjectKey
      ).toLowerCase();
      const projeto = projetosMap.get(projectKey);
      const tipoProjeto = normalizarTexto(projeto?.tipoProjeto).toLowerCase();

      if (filtroProjeto && projectKey !== filtroProjeto) return false;
      if (filtroTipo && tipoProjeto !== filtroTipo) return false;
      return true;
    });
  }, [usuarios, projetosMap, filtroProjeto, filtroTipo]);

  return (
    <section className="gerenciador-users">
      <div className="gerenciador-users__header">
        <div>
          <h1 className="gerenciador-users__title">USERS</h1>
          <p className="gerenciador-users__subtitle">
            Usuarios espelhados no gerenciador por projeto.
          </p>
        </div>

        <div className="gerenciador-users__filters">
          <label>
            <span>Tipo de projeto</span>
            <select value={filtroTipo} onChange={(event) => setFiltroTipo(event.target.value)}>
              <option value="">Todos</option>
              <option value="multiowner">multiowner</option>
              <option value="oneowner">oneowner</option>
            </select>
          </label>

          <label>
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
      </div>

      <div className="gerenciador-users__summary">
        <span>{`Total exibido: ${usuariosFiltrados.length}`}</span>
      </div>

      {erro ? <p className="gerenciador-users__error">{erro}</p> : null}

      {!erro && !usuariosFiltrados.length ? (
        <p className="gerenciador-users__empty">Nenhum usuario encontrado.</p>
      ) : null}

      {!erro && usuariosFiltrados.length ? (
        <div className="gerenciador-users__grid">
          {usuariosFiltrados.map((usuario) => {
            const projectKey = normalizarTexto(
              usuario?.projectSystemKey || usuario?.runtimeProjectKey
            ).toLowerCase();
            const projeto = projetosMap.get(projectKey);
            return (
              <article key={usuario.id} className="gerenciador-users__card">
                <img
                  className="gerenciador-users__avatar"
                  src={usuario.picGoogle || "/favicon.ico"}
                  alt={`Foto de ${usuario.nomeGoogle || usuario.emailGoogle || usuario.uid}`}
                />
                <div className="gerenciador-users__info">
                  <strong>{usuario.nomeCompletoGoogle || usuario.nomeGoogle || "Usuario"}</strong>
                  <span>{usuario.emailGoogle || usuario.uid || "--"}</span>
                  <span>{`Projeto: ${
                    normalizarTexto(projeto?.nomeProjeto) || projectKey || "--"
                  }`}</span>
                  <span>{`Tipo: ${normalizarTexto(projeto?.tipoProjeto) || "--"}`}</span>
                  <span>{`Atualizado: ${formatarData(usuario.updatedAt || usuario.lastLoginAt)}`}</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export default Users;
