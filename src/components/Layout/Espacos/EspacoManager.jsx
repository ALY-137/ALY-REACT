import React, { useEffect, useState, useCallback } from "react";
import firebase from "firebase/app";
import "firebase/firestore";

import {
  getEspacos,
  updateEspacoNome,
  setEspacoMain,
  updateOrdemEspacos,
  deleteEspaco
} from "./../../Banco/firebaseEspacos";

const db = firebase.firestore();

export default function EspacoManager() {
  const [espacos, setEspacos] = useState([]);
  const [novoNome, setNovoNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const userId = localStorage.getItem("idGoogleCap"); 
  const skinId = localStorage.getItem("skinLogadoUser");  
  const skinIdAtual = localStorage.getItem("skinIdAtual");  
  const [todasEspacos, setTodasEspacos] = useState([]);
   // skin aberta

  useEffect(() => {
    carregarEspacos();
  }, []);

  /* ---------------------------------------
        CARREGAR APENAS PÁGINAS DA SKIN
  ----------------------------------------*/
const carregarEspacos = async () => {
  setLoading(true);

  try {
    const snapshot = await db
      .collection("users")
      .doc(userId)
      .collection("espacos")
      .get();

    const lista = snapshot.docs
      .map(doc => doc.data())
    .filter(p =>
  (p.is_main === true && p.skinOwner === skinIdAtual) ||
  p.skins_relacionadas?.includes(skinIdAtual)
)
      .sort((a, b) => a.ordem - b.ordem);

    setEspacos(lista);
  } catch (e) {
    console.error(e);
    setErro("Erro ao carregar espaços");
  }

  setLoading(false);
};

  /* ---------------------------------------
        CRIAR PÁGINA JÁ RELACIONADA À SKIN
  ----------------------------------------*/
  const adicionarEspaco = async () => {
    if (!novoNome.trim()) return;

    const espacosRef = db
      .collection("users")
      .doc(userId)
      .collection("espacos");

    const docRef = espacosRef.doc();

    await docRef.set({
      id_espaco: docRef.id,
      nome: novoNome,
      ordem: espacos.length,
      is_main: false,
      skins_relacionadas: [skinIdAtual],  // <<< ESSENCIAL
      data: firebase.firestore.FieldValue.serverTimestamp()
    });

    setNovoNome("");
    carregarEspacos();
  };

  /* ---------------------------------------
        ATUALIZAR NOME (DEBOUNCE)
  ----------------------------------------*/
  const atualizarNome = useCallback(
    debounce(async (espacoId, nome) => {
      await updateEspacoNome(userId, espacoId, nome);
    }, 500),
    []
  );

  /* ---------------------------------------
        DEFINIR PÁGINA PRINCIPAL
  ----------------------------------------*/
  const definirMain = async (espacoId) => {
    await setEspacoMain(userId, espacoId);
    carregarEspacos();
  };

  /* ---------------------------------------
        EXCLUIR
  ----------------------------------------*/
  const excluirEspaco = async (espacoId) => {
    if (!window.confirm("Excluir espaço?")) return;

    await deleteEspaco(userId, espacoId);
    carregarEspacos();
  };

  /* ---------------------------------------
        MOVER ORDEM
  ----------------------------------------*/
  const mover = async (index, direcao) => {
    const nova = [...espacos];
    const novoIndex = index + direcao;

    if (novoIndex < 0 || novoIndex >= nova.length) return;

    [nova[index], nova[novoIndex]] = [nova[novoIndex], nova[index]];

    await updateOrdemEspacos(userId, nova);
    setEspacos(nova);
  };

  const carregarTodasEspacos = async () => {
  try {
    const snapshot = await db
      .collection("users")
      .doc(userId)
      .collection("espacos")
      .get();

    const lista = snapshot.docs.map(doc => doc.data());
    setTodasEspacos(lista);
  } catch (e) {
    console.error(e);
  }
};

useEffect(() => {
  carregarEspacos();
  carregarTodasEspacos();
}, []);

const relacionarEspaco = async (espacoId, skinsRelacionadas = []) => {
  const espacoRef = db
    .collection("users")
    .doc(userId)
    .collection("espacos")
    .doc(espacoId);

  await espacoRef.update({
    skins_relacionadas: firebase.firestore.FieldValue.arrayUnion(skinIdAtual)
  });

  carregarEspacos();
  carregarTodasEspacos();
};

const removerRelacionamento = async (espacoId) => {
  const espacoRef = db
    .collection("users")
    .doc(userId)
    .collection("espacos")
    .doc(espacoId);

  await espacoRef.update({
    skins_relacionadas: firebase.firestore.FieldValue.arrayRemove(skinIdAtual)
  });

  carregarEspacos();
  carregarTodasEspacos();
};

  return (
    <div>
      <h2>Gerenciar Espaços da Skin</h2>

      <input
        value={novoNome}
        onChange={(e) => setNovoNome(e.target.value)}
        placeholder="Nome da nova espaço"
      />

      <button onClick={adicionarEspaco}>Criar espaço</button>

      {loading && <p>Carregando...</p>}
      {erro && <p style={{ color: "red" }}>{erro}</p>}

      <ul>
        {espacos.map((p, i) => (
          <li key={p.id_espaco}>
            <input
              defaultValue={p.nome}
              onChange={(e) =>
                atualizarNome(p.id_espaco, e.target.value)
              }
            />

             <button onClick={() => removerRelacionamento(p.id_espaco)}>
        remover da skin
      </button>

            {p.is_main ? (
              <b> (principal)</b>
            ) : (
              <button onClick={() => definirMain(p.id_espaco)}>
                tornar principal
              </button>
            )}

            <button onClick={() => mover(i, -1)}>↑</button>
            <button onClick={() => mover(i, 1)}>↓</button>

            <button
              style={{ color: "red" }}
              onClick={() => excluirEspaco(p.id_espaco)}
            >
              excluir
            </button>
          </li>
        ))}
      </ul>

<ul>
  {todasEspacos
    .filter(p =>
      p.is_main !== true &&
      !p.skins_relacionadas?.includes(skinIdAtual)
    )
    .map(p => (
      <li key={p.id_espaco}>
        {p.nome}
        <button onClick={() => relacionarEspaco(p.id_espaco)}>
          add
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
