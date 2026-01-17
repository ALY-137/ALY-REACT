import React, { useEffect, useState, useCallback } from "react";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from "firebase/firestore";
import { initializeApp } from "firebase/app";

import {
  getEspacos,
  updateEspacoNome,
  setEspacoMain,
  updateOrdemEspacos,
  deleteEspaco
} from "./../../Banco/firebaseEspacos";

// ===============================
// FIREBASE INIT
// ===============================
const firebaseConfig = {
  apiKey: "AIzaSyAhSNGCUOM_nRiVwtRmmPz9o6ciQA6lSYA",
  authDomain: "teste-aa015.firebaseapp.com",
  projectId: "teste-aa015",
  storageBucket: "teste-aa015.appspot.com",
  messagingSenderId: "99960275074",
  appId: "1:99960275074:web:e2923f7e34a0c0c18c749b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function EspacoManager() {
  const [espacos, setEspacos] = useState([]);
  const [novoNome, setNovoNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const userId = localStorage.getItem("idGoogleCap");
  const skinIdAtual = localStorage.getItem("skinIdAtual");

  const [todasEspacos, setTodasEspacos] = useState([]);

  useEffect(() => {
    carregarEspacos();
    carregarTodasEspacos();
  }, []);

  // ── CARREGAR ESPAÇOS DA SKIN
  const carregarEspacos = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "users", userId, "espacos"));
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

  // ── CARREGAR TODOS ESPAÇOS
  const carregarTodasEspacos = async () => {
    try {
      const snapshot = await getDocs(collection(db, "users", userId, "espacos"));
      setTodasEspacos(snapshot.docs.map(doc => doc.data()));
    } catch (e) {
      console.error(e);
    }
  };

  // ── ADICIONAR ESPAÇO
  const adicionarEspaco = async () => {
    if (!novoNome.trim()) return;
    const espacoRef = doc(collection(db, "users", userId, "espacos"));
    await setDoc(espacoRef, {
      id_espaco: espacoRef.id,
      nome: novoNome,
      ordem: espacos.length,
      is_main: false,
      skins_relacionadas: [skinIdAtual],
      data: serverTimestamp()
    });
    setNovoNome("");
    carregarEspacos();
  };

  // ── ATUALIZAR NOME COM DEBOUNCE
  const atualizarNome = useCallback(
    debounce(async (espacoId, nome) => {
      await updateEspacoNome(userId, espacoId, nome);
    }, 500),
    []
  );

  // ── DEFINIR PÁGINA PRINCIPAL
  const definirMain = async (espacoId) => {
    await setEspacoMain(userId, espacoId);
    carregarEspacos();
  };

  // ── EXCLUIR ESPAÇO
  const excluirEspaco = async (espacoId) => {
    if (!window.confirm("Excluir espaço?")) return;
    await deleteEspaco(userId, espacoId);
    carregarEspacos();
  };

  // ── MOVER ORDEM
  const mover = async (index, direcao) => {
    const nova = [...espacos];
    const novoIndex = index + direcao;
    if (novoIndex < 0 || novoIndex >= nova.length) return;
    [nova[index], nova[novoIndex]] = [nova[novoIndex], nova[index]];
    await updateOrdemEspacos(userId, nova);
    setEspacos(nova);
  };

  // ── RELACIONAR ESPAÇO COM SKIN
  const relacionarEspaco = async (espacoId) => {
    const espacoRef = doc(db, "users", userId, "espacos", espacoId);
    await updateDoc(espacoRef, { skins_relacionadas: arrayUnion(skinIdAtual) });
    carregarEspacos();
    carregarTodasEspacos();
  };

  // ── REMOVER RELACIONAMENTO COM SKIN
  const removerRelacionamento = async (espacoId) => {
    const espacoRef = doc(db, "users", userId, "espacos", espacoId);
    await updateDoc(espacoRef, { skins_relacionadas: arrayRemove(skinIdAtual) });
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
              onChange={(e) => atualizarNome(p.id_espaco, e.target.value)}
            />

            <button onClick={() => removerRelacionamento(p.id_espaco)}>
              remover da skin
            </button>

            {p.is_main ? (
              <b> (principal)</b>
            ) : (
              <button onClick={() => definirMain(p.id_espaco)}>tornar principal</button>
            )}

            <button onClick={() => mover(i, -1)}>↑</button>
            <button onClick={() => mover(i, 1)}>↓</button>

            <button style={{ color: "red" }} onClick={() => excluirEspaco(p.id_espaco)}>
              excluir
            </button>
          </li>
        ))}
      </ul>

      <ul>
        {todasEspacos
          .filter(p => p.is_main !== true && !p.skins_relacionadas?.includes(skinIdAtual))
          .map(p => (
            <li key={p.id_espaco}>
              {p.nome}
              <button onClick={() => relacionarEspaco(p.id_espaco)}>add</button>
            </li>
          ))}
      </ul>
    </div>
  );
}

// ── FUNÇÃO DEBOUNCE
function debounce(func, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => func(...args), delay);
  };
}
