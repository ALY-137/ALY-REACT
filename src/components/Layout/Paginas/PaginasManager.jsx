import React, { useEffect, useState, useCallback } from 'react';
import {
  getPaginas,
  createPagina,
  updatePaginaNome,
  setPaginaMain,
  updateOrdemPaginas,
  deletePagina // <-- ADICIONE ISSO no seu firebasePaginas
} from './../../Banco/firebasePaginas';

export default function GerenciarPaginas() {
  const [paginas, setPaginas] = useState([]);
  const [novoNome, setNovoNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const idGoogleCap = localStorage.getItem('idGoogleCap');
  const skinLogadaId = localStorage.getItem('skinLogadaId');

  useEffect(() => {
    carregarPaginas();
  }, []);

  const carregarPaginas = async () => {
    setLoading(true);
    try {
      const lista = await getPaginas(idGoogleCap, skinLogadaId);
      setPaginas(lista);
    } catch (e) {
      setErro("Erro ao carregar páginas.");
      console.error(e);
    }
    setLoading(false);
  };

  const adicionarPagina = async () => {
    if (!novoNome.trim()) return;
    await createPagina(idGoogleCap, skinLogadaId, novoNome);
    setNovoNome("");
    carregarPaginas();
  };

  // --- DEBOUNCE para atualizar nome ---
  const atualizarNome = useCallback(
    debounce(async (paginaId, nome) => {
      await updatePaginaNome(idGoogleCap, skinLogadaId, paginaId, nome);
    }, 500),
    []
  );

  const definirMain = async (paginaId) => {
    await setPaginaMain(idGoogleCap, skinLogadaId, paginaId);
    carregarPaginas();
  };

const excluirPagina = async (paginaId) => {
  if (!window.confirm("Tem certeza que deseja excluir esta página?")) return;

  await deletePagina(idGoogleCap, skinLogadaId, paginaId);
  carregarPaginas();
};


  const mover = async (index, direcao) => {
    const novaOrdem = [...paginas];
    const novoIndex = index + direcao;

    if (novoIndex < 0 || novoIndex >= novaOrdem.length) return;

    [novaOrdem[index], novaOrdem[novoIndex]] = [
      novaOrdem[novoIndex], novaOrdem[index]
    ];

    await updateOrdemPaginas(idGoogleCap, skinLogadaId, novaOrdem);
    setPaginas(novaOrdem);
  };

  return (
    <div>
      <h2>Gerenciar Páginas</h2>

      <input
        type="text"
        value={novoNome}
        onChange={(e) => setNovoNome(e.target.value)}
        placeholder="Nome da nova página"
      />
      <button onClick={adicionarPagina}>Criar Página</button>

      {loading && <p>Carregando...</p>}
      {erro && <p style={{ color: "red" }}>{erro}</p>}

      <ul>
        {paginas.map((pagina, i) => (
          <li key={pagina.id_pagina}>
            <input
              defaultValue={pagina.nome}
              onChange={(e) =>
                atualizarNome(pagina.id_pagina, e.target.value)
              }
            />

            {pagina.is_main ? (
              <strong> (Principal) </strong>
            ) : (
              <button onClick={() => definirMain(pagina.id_pagina)}>
                Principal
              </button>
            )}

            <button onClick={() => mover(i, -1)}>↑</button>
            <button onClick={() => mover(i, 1)}>↓</button>

            {/* --- BOTÃO DE EXCLUIR --- */}
            <button
              onClick={() => excluirPagina(pagina.id_pagina)}
              style={{ color: "red" }}
            >
              Excluir
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function debounce(func, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => func(...args), delay);
  };
}
