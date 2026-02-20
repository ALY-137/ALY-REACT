import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  writeBatch,
} from "firebase/firestore";

import "./formularios.css";
import { db } from "../../../Banco/init-firebase.js";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistema,
} from "../../Sistema/configSistema";

function ListaConversas() {
  const [conversas, setConversas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chatHabilitado, setChatHabilitado] = useState(DEFAULT_SISTEMA_CONFIG.chatHabilitado);
  const [carregandoConfig, setCarregandoConfig] = useState(true);

  const navigate = useNavigate();
  const { contactId } = useParams();
  const skinLogadoUser = localStorage.getItem("skinLogadoUser");

  useEffect(() => {
    let ativo = true;

    async function carregarConfigSistema() {
      try {
        const config = await obterConfigSistema();
        if (!ativo) return;
        setChatHabilitado(config?.chatHabilitado !== false);
      } catch {
        if (!ativo) return;
        setChatHabilitado(DEFAULT_SISTEMA_CONFIG.chatHabilitado);
      } finally {
        if (ativo) setCarregandoConfig(false);
      }
    }

    carregarConfigSistema();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (!chatHabilitado || !contactId) {
      setConversas([]);
      setLoading(false);
      return;
    }

    const conversasRef = collection(db, "contatos", contactId, "conversas");
    const q = query(conversasRef, orderBy("dataUltimaMensagem", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const listaConversas = snapshot.docs.map((docSnap) => ({
          conversaId: docSnap.id,
          assunto: docSnap.data().assunto || "Sem assunto",
          ultimaMensagem: docSnap.data().ultimaMensagem || "Nenhuma mensagem",
          data: docSnap.data().dataUltimaMensagem?.toDate(),
        }));

        setConversas(listaConversas);
        setLoading(false);
      },
      (snapshotError) => {
        console.error("Erro ao carregar conversas:", snapshotError);
        setError("Erro ao carregar conversas.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [chatHabilitado, contactId]);

  const deleteChats = async (idConversa) => {
    const chatsRef = collection(
      db,
      "contatos",
      contactId,
      "conversas",
      idConversa,
      "chats"
    );

    const snapshot = await getDocs(chatsRef);
    const batch = writeBatch(db);

    snapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    await batch.commit();
  };

  const handleDelete = async (idConversa, event) => {
    event.stopPropagation();

    try {
      await deleteChats(idConversa);

      await deleteDoc(doc(db, "contatos", contactId, "conversas", idConversa));

      const novasConversas = conversas.filter((item) => item.conversaId !== idConversa);
      setConversas(novasConversas);

      if (novasConversas.length === 0) {
        await deleteDoc(doc(db, "contatos", contactId));
      }
    } catch (erroDelete) {
      console.error("Erro ao deletar conversa:", erroDelete);
      setError("Erro ao deletar a conversa.");
    }
  };

  const handleConversaClick = (idConversa) => {
    navigate(`/menu/${skinLogadoUser}/contatos/${contactId}/chat/${idConversa}`);
  };

  if (carregandoConfig) {
    return <p>Carregando...</p>;
  }

  if (!chatHabilitado) {
    return <p>Chat desativado em PROPRIEDADES DO SISTEMA.</p>;
  }

  return (
    <div>
      {loading && <p>Carregando conversas...</p>}
      {error && <p>{error}</p>}
      {!loading && !error && conversas.length === 0 && <p>Nao ha conversas.</p>}

      <div className="pageContentForms">
        {conversas.map((conversa) => (
          <div
            key={conversa.conversaId}
            className="boxItemConversa"
            onClick={() => handleConversaClick(conversa.conversaId)}
          >
            <div className="conversaHeader">
              <p>
                <strong>Assunto:</strong> {conversa.assunto}
              </p>
              <button
                className="deleteButton"
                onClick={(event) => handleDelete(conversa.conversaId, event)}
              >
                Excluir
              </button>
            </div>

            <p>
              <strong>Ultima mensagem:</strong> {conversa.ultimaMensagem}
            </p>
            <p>
              <strong>Data da ultima mensagem:</strong>{" "}
              {conversa.data ? conversa.data.toLocaleDateString("pt-BR") : "Data nao disponivel"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ListaConversas;
