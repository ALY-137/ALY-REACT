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

import { auth, db, enviarChat } from "../../../Banco/init-firebase.js";
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
  const [erroChat, setErroChat] = useState("");
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
      setErroChat("");
      return;
    }

    const chatRef = collection(db, "contatos", contactId, "conversas", conversationId, "chat");
    const q = query(chatRef, orderBy("data"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        void (async () => {
          try {
            setErroChat("");
            const iconCache = new Map();
            const podeBuscarSkins = !!auth.currentUser;

            const mensagens = await Promise.all(
              snapshot.docs.map(async (docSnap) => {
                const chatData = docSnap.data();
                const usernameRemetente = String(chatData.userRemetente || "").trim();

                let iconSkin = null;
                if (podeBuscarSkins && usernameRemetente) {
                  if (iconCache.has(usernameRemetente)) {
                    iconSkin = iconCache.get(usernameRemetente);
                  } else {
                    try {
                      const skinQuery = query(
                        collectionGroup(db, "skins"),
                        where("username", "==", usernameRemetente),
                        limit(1)
                      );
                      const skinSnapshot = await getDocs(skinQuery);
                      iconSkin = !skinSnapshot.empty
                        ? skinSnapshot.docs[0].data().iconSkin || null
                        : null;
                    } catch (erroSkin) {
                      if (erroSkin?.code !== "permission-denied") {
                        console.error("Erro ao buscar iconSkin do chat:", erroSkin);
                      }
                      iconSkin = null;
                    }
                    iconCache.set(usernameRemetente, iconSkin);
                  }
                }

                return {
                  ...chatData,
                  data: chatData.data ? chatData.data.toDate() : null,
                  iconSkin,
                };
              })
            );

            setChatMensagens(mensagens);
          } catch (erroProcessamento) {
            console.error("Erro ao processar mensagens do chat:", erroProcessamento);
          }
        })();
      },
      (erroSnapshot) => {
        if (erroSnapshot?.code === "permission-denied") {
          setChatMensagens([]);
          setErroChat("Sem permissao para visualizar este chat.");
          return;
        }
        console.error("Erro no listener do chat:", erroSnapshot);
      }
    );

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

  if (erroChat) {
    return <p>{erroChat}</p>;
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
