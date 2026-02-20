import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  collectionGroup,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db, enviarChat } from "../../../Banco/init-firebase.js";
import "./formularios.css";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistema,
} from "../../Sistema/configSistema";

function Chat() {
  const { contactId, conversationId } = useParams();
  const [mensagem, setMensagem] = useState("");
  const [chatMensagens, setChatMensagens] = useState([]);
  const [chatHabilitado, setChatHabilitado] = useState(DEFAULT_SISTEMA_CONFIG.chatHabilitado);
  const [carregandoConfig, setCarregandoConfig] = useState(true);
  const contentChatRef = useRef(null);

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
    if (!chatHabilitado || !contactId || !conversationId) {
      setChatMensagens([]);
      return;
    }

    const chatRef = collection(db, "contatos", contactId, "conversas", conversationId, "chat");
    const q = query(chatRef, orderBy("data"));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const mensagens = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const chatData = docSnap.data();

          const skinQuery = query(
            collectionGroup(db, "skins"),
            where("username", "==", chatData.userRemetente),
            limit(1)
          );
          const skinSnapshot = await getDocs(skinQuery);

          let iconSkin = null;
          if (!skinSnapshot.empty) {
            iconSkin = skinSnapshot.docs[0].data().iconSkin;
          }

          return {
            ...chatData,
            data: chatData.data ? chatData.data.toDate() : null,
            iconSkin,
          };
        })
      );

      setChatMensagens(mensagens);
    });

    return () => unsubscribe();
  }, [chatHabilitado, contactId, conversationId]);

  useEffect(() => {
    if (contentChatRef.current) {
      contentChatRef.current.scrollTop = contentChatRef.current.scrollHeight;
    }
  }, [chatMensagens]);

  const handleEnviarChat = async () => {
    if (!mensagem.trim() || !chatHabilitado) return;

    try {
      await enviarChat({
        idContato: contactId,
        idConversa: conversationId,
        userRemetente: skinLogadoUser,
        mensagem,
      });
      setMensagem("");
    } catch (erroEnvio) {
      console.error("Erro ao enviar mensagem:", erroEnvio);
    }
  };

  if (carregandoConfig) {
    return <p>Carregando...</p>;
  }

  if (!chatHabilitado) {
    return <p>Chat desativado em PROPRIEDADES DO SISTEMA.</p>;
  }

  return (
    <div className="contentPageDetForm">
      <div className="contentChat" ref={contentChatRef}>
        {chatMensagens.map((mensagemItem, index) => {
          const isSentByMe = mensagemItem.userRemetente === skinLogadoUser;
          const mostrarFoto =
            !isSentByMe &&
            (index === 0 || chatMensagens[index - 1].nomeGoogle !== mensagemItem.nomeGoogle);

          return (
            <div className="chat-container" key={index}>
              {mensagemItem.data &&
                (index === 0 ||
                  chatMensagens[index - 1].data?.toDateString() !==
                    mensagemItem.data.toDateString()) && (
                  <div className="dataResposta">
                    {mensagemItem.data.toLocaleDateString("pt-BR")}
                  </div>
                )}

              <div
                className={`resposta-item ${isSentByMe ? "resposta-enviada" : "resposta-recebida"} ${
                  !mostrarFoto ? "sem-foto" : ""
                }`}
              >
                {!isSentByMe && mostrarFoto && (
                  <img className="fotoUsuario" src={mensagemItem.iconSkin} alt="User" />
                )}
                <div className="resposta-texto">{mensagemItem.mensagem}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="boxResposta">
        <input
          type="text"
          className="inputResposta"
          placeholder="Digite sua mensagem..."
          value={mensagem}
          onChange={(event) => setMensagem(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleEnviarChat();
          }}
        />
        <div className="buttonWrapper">
          <button className="buttonEnviarResp" onClick={handleEnviarChat}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chat;
