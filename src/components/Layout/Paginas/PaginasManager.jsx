import React, { useEffect, useState, useCallback } from "react";
import firebase from "firebase/app";
import "firebase/firestore";

import {
  getPaginas,
  updatePaginaNome,
  setPaginaMain,
  updateOrdemPaginas,
  deletePagina
} from "./../../Banco/firebasePaginas";

const db = firebase.firestore();

export default function PaginasManager() {
  const [paginas, setPaginas] = useState([]);
  const [novoNome, setNovoNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const userId = localStorage.getItem("idGoogleCap");          // usuário logado
  const skinId = localStorage.getItem("skinLogadoUser");  
  const skinIdAtual = localStorage.getItem("skinIdAtual");     // skin aberta

  useEffect(() => {
    carregarPaginas();
  }, []);

  /* ---------------------------------------
        CARREGAR APENAS PÁGINAS DA SKIN
  ----------------------------------------*/
  const carregarPaginas = async () => {
    setLoading(true);

    try {
      const lista = await getPaginas(userId, skinIdAtual);
      setPaginas(lista);
            console.log(userId);
      console.log(skinIdAtual);
    } catch (e) {
      console.error(e);
      setErro("Erro ao carregar páginas");

    }

    setLoading(false);
  };

  /* ---------------------------------------
        CRIAR PÁGINA JÁ RELACIONADA À SKIN
  ----------------------------------------*/
  const adicionarPagina = async () => {
    if (!novoNome.trim()) return;

    const paginasRef = db
      .collection("users")
      .doc(userId)
      .collection("paginas");

    const docRef = paginasRef.doc();

    await docRef.set({
      id_pagina: docRef.id,
      nome: novoNome,
      ordem: paginas.length,
      is_main: false,
      skins_relacionadas: [skinIdAtual],  // <<< ESSENCIAL
      data: firebase.firestore.FieldValue.serverTimestamp()
    });

    setNovoNome("");
    carregarPaginas();
  };

  /* ---------------------------------------
        ATUALIZAR NOME (DEBOUNCE)
  ----------------------------------------*/
  const atualizarNome = useCallback(
    debounce(async (paginaId, nome) => {
      await updatePaginaNome(userId, paginaId, nome);
    }, 500),
    []
  );

  /* ---------------------------------------
        DEFINIR PÁGINA PRINCIPAL
  ----------------------------------------*/
  const definirMain = async (paginaId) => {
    await setPaginaMain(userId, paginaId);
    carregarPaginas();
  };

  /* ---------------------------------------
        EXCLUIR
  ----------------------------------------*/
  const excluirPagina = async (paginaId) => {
    if (!window.confirm("Excluir página?")) return;

    await deletePagina(userId, paginaId);
    carregarPaginas();
  };

  /* ---------------------------------------
        MOVER ORDEM
  ----------------------------------------*/
  const mover = async (index, direcao) => {
    const nova = [...paginas];
    const novoIndex = index + direcao;

    if (novoIndex < 0 || novoIndex >= nova.length) return;

    [nova[index], nova[novoIndex]] = [nova[novoIndex], nova[index]];

    await updateOrdemPaginas(userId, nova);
    setPaginas(nova);
  };

  return (
    <div>
      <h2>Gerenciar Páginas da Skin</h2>

      <input
        value={novoNome}
        onChange={(e) => setNovoNome(e.target.value)}
        placeholder="Nome da nova página"
      />

      <button onClick={adicionarPagina}>Criar página</button>

      {loading && <p>Carregando...</p>}
      {erro && <p style={{ color: "red" }}>{erro}</p>}

      <ul>
        {paginas.map((p, i) => (
          <li key={p.id_pagina}>
            <input
              defaultValue={p.nome}
              onChange={(e) =>
                atualizarNome(p.id_pagina, e.target.value)
              }
            />

            {p.is_main ? (
              <b> (principal)</b>
            ) : (
              <button onClick={() => definirMain(p.id_pagina)}>
                tornar principal
              </button>
            )}

            <button onClick={() => mover(i, -1)}>↑</button>
            <button onClick={() => mover(i, 1)}>↓</button>

            <button
              style={{ color: "red" }}
              onClick={() => excluirPagina(p.id_pagina)}
            >
              excluir
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* debounce utilitário */
function debounce(func, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => func(...args), delay);
  };
}
