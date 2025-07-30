import React, { useEffect, useState } from 'react';
import {
  getPaginas,
  createPagina,
  updatePaginaNome,
  setPaginaMain,
  updateOrdemPaginas
} from './../../Banco/firebasePaginas';



export default function GerenciarPaginas() {
  const [paginas, setPaginas] = useState([]);
  const [novoNome, setNovoNome] = useState("");

  const idGoogleCap = localStorage.getItem('idGoogleCap');
  const skinLogadaId = localStorage.getItem('skinLogadaId'); 


  useEffect(() => {
    carregarPaginas();
  }, []);

  const carregarPaginas = async () => {
    const lista = await getPaginas(idGoogleCap, skinLogadaId);
    console.log(idGoogleCap, skinLogadaId);
    setPaginas(lista);
  };

  const adicionarPagina = async () => {
    await createPagina(idGoogleCap, skinLogadaId, novoNome);
    setNovoNome("");
    carregarPaginas();
  };

  const atualizarNome = async (paginaId, nome) => {
    await updatePaginaNome(idGoogleCap, skinLogadaId, paginaId, nome);
    carregarPaginas();
  };

  const definirMain = async (paginaId) => {
    await setPaginaMain(idGoogleCap, skinLogadaId, paginaId);
    carregarPaginas();
  };

  const mover = async (index, direcao) => {
    const novaOrdem = [...paginas];
    const novoIndex = index + direcao;

    if (novoIndex < 0 || novoIndex >= novaOrdem.length) return;

    [novaOrdem[index], novaOrdem[novoIndex]] = [novaOrdem[novoIndex], novaOrdem[index]];
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

      <ul>
        {paginas.map((pagina, i) => (
          <li key={pagina.id_pagina}>
            <input
              value={pagina.nome}
              onChange={(e) => atualizarNome(pagina.id_pagina, e.target.value)}
            />
            {pagina.is_main ? " (Principal)" : (
              <button onClick={() => definirMain(pagina.id_pagina)}>Definir como Principal</button>
            )}
            <button onClick={() => mover(i, -1)}>↑</button>
            <button onClick={() => mover(i, 1)}>↓</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
