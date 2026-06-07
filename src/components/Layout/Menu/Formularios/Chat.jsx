import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { auth, db } from "../../../Banco/init-firebase.js";
import {
  getProjectCollectionCandidates,
  getProjectDocCandidates,
} from "../../../Banco/projectDataRefs";
import "./formularios.css";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistema,
} from "../../Sistema/configSistema";
import ProjectLoadingFallback from "../../Geral/ProjectLoadingFallback";
import { findSkinByUsernameAcrossProject } from "../../Skins/skinLookup";

const getFirstRef = (refs = []) => (Array.isArray(refs) && refs.length ? refs[0] : null);
const getContatoRefs = (contactId) => getProjectDocCandidates(db, "contatos", String(contactId || "").trim());
const getConversaRefs = (contactId, conversationId) =>
  getProjectDocCandidates(
    db,
    "contatos",
    String(contactId || "").trim(),
    "conversas",
    String(conversationId || "").trim()
  );
const getChatRefs = (contactId, conversationId) =>
  getProjectCollectionCandidates(
    db,
    "contatos",
    String(contactId || "").trim(),
    "conversas",
    String(conversationId || "").trim(),
    "chat"
  );
const getCompradorRefs = (ownerUid, espacoId, blocoId, compradorId) =>
  getProjectDocCandidates(
    db,
    "users",
    String(ownerUid || "").trim(),
    "espacos",
    String(espacoId || "").trim(),
    "blocos",
    String(blocoId || "").trim(),
    "compradores",
    String(compradorId || "").trim()
  );
const getUserRefs = (uid) => getProjectDocCandidates(db, "users", String(uid || "").trim());
const getSkinRefs = (uid, skinId) =>
  getProjectDocCandidates(db, "users", String(uid || "").trim(), "skins", String(skinId || "").trim());
const getSkinsRefs = (uid) =>
  getProjectCollectionCandidates(db, "users", String(uid || "").trim(), "skins");

async function getFirstExistingDoc(refs = []) {
  for (const refItem of refs) {
    const snap = await getDoc(refItem).catch(() => null);
    if (snap?.exists?.()) return snap;
  }
  return null;
}

function Chat() {
  const { contactId, conversationId } = useParams();
  const [mensagem, setMensagem] = useState("");
  const [chatMensagens, setChatMensagens] = useState([]);
  const [conversaAtual, setConversaAtual] = useState(null);
  const [chatHabilitado, setChatHabilitado] = useState(DEFAULT_SISTEMA_CONFIG.chatHabilitado);
  const [iconSkinPadraoUrl, setIconSkinPadraoUrl] = useState(
    DEFAULT_SISTEMA_CONFIG.iconSkinPadraoUrl || ""
  );
  const [acessoLiveLiberado, setAcessoLiveLiberado] = useState(true);
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
        setIconSkinPadraoUrl(
          String(config?.iconSkinPadraoUrl || DEFAULT_SISTEMA_CONFIG.iconSkinPadraoUrl || "")
            .trim()
        );
      } catch {
        if (!ativo) return;
        setChatHabilitado(DEFAULT_SISTEMA_CONFIG.chatHabilitado);
        setIconSkinPadraoUrl(
          String(DEFAULT_SISTEMA_CONFIG.iconSkinPadraoUrl || "").trim()
        );
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
    let ativo = true;

    async function verificarAcessoLive() {
      if (!chatHabilitado || !contactId) {
        if (!ativo) return;
        setAcessoLiveLiberado(true);
        return;
      }

      try {
        const contatoSnap = await getFirstExistingDoc(getContatoRefs(contactId));
        if (!contatoSnap?.exists?.()) {
          if (!ativo) return;
          setAcessoLiveLiberado(true);
          return;
        }

        const contato = contatoSnap.data() || {};
        const tipoContato = String(contato?.tipo || "").trim().toLowerCase();
        if (tipoContato !== "live") {
          if (!ativo) return;
          setAcessoLiveLiberado(true);
          return;
        }

        const currentUid = String(auth?.currentUser?.uid || "").trim();
        if (!currentUid) {
          if (!ativo) return;
          setAcessoLiveLiberado(false);
          setErroChat("Faça login para acessar o chat da live.");
          return;
        }

        const ownerUserId = String(contato?.ownerUserId || "").trim();
        const espacoId = String(contato?.espacoId || "").trim();
        const blocoId = String(contato?.blocoId || "").trim();
        if (!ownerUserId || !espacoId || !blocoId) {
          if (!ativo) return;
          setAcessoLiveLiberado(false);
          setErroChat("Dados da live incompletos para validar acesso.");
          return;
        }

        if (currentUid === ownerUserId) {
          if (!ativo) return;
          setAcessoLiveLiberado(true);
          return;
        }

        const compradorUidSnap = await getFirstExistingDoc(
          getCompradorRefs(ownerUserId, espacoId, blocoId, currentUid)
        );
        if (compradorUidSnap?.exists?.()) {
          if (!ativo) return;
          setAcessoLiveLiberado(true);
          return;
        }

        let skinAtivaId = "";
        try {
          const userSnap = await getFirstExistingDoc(getUserRefs(currentUid));
          skinAtivaId = String(userSnap.data()?.skinAtivaId || "").trim();
        } catch {
          skinAtivaId = "";
        }

        if (skinAtivaId) {
          const compradorSkinSnap = await getFirstExistingDoc(
            getCompradorRefs(ownerUserId, espacoId, blocoId, skinAtivaId)
          );
          if (compradorSkinSnap?.exists?.()) {
            if (!ativo) return;
            setAcessoLiveLiberado(true);
            return;
          }
        }

        if (!ativo) return;
        setAcessoLiveLiberado(false);
        setErroChat("Acesso ao chat da live requer pagamento confirmado.");
      } catch {
        if (!ativo) return;
        setAcessoLiveLiberado(false);
        setErroChat("Nao foi possivel validar acesso ao chat da live.");
      }
    }

    verificarAcessoLive();

    return () => {
      ativo = false;
    };
  }, [chatHabilitado, contactId]);

  useEffect(() => {
    if (!chatHabilitado || !contactId || !conversationId) {
      setChatMensagens([]);
      setConversaAtual(null);
      if (acessoLiveLiberado) {
        setErroChat("");
      }
      return;
    }

    if (!acessoLiveLiberado) {
      setChatMensagens([]);
      return;
    }

    void (async () => {
      const conversaSnap = await getFirstExistingDoc(getConversaRefs(contactId, conversationId));
      setConversaAtual(conversaSnap?.exists?.() ? conversaSnap.data() || null : null);
    })();

    const chatRef = getFirstRef(getChatRefs(contactId, conversationId));
    if (!chatRef) {
      setChatMensagens([]);
      setErroChat("Chat indisponivel.");
      return undefined;
    }
    const q = query(chatRef, orderBy("data"));

  const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        void (async () => {
          try {
            setErroChat("");
            const iconCachePorUsername = new Map();
            const iconCachePorUid = new Map();
            const iconCachePorUidSkin = new Map();
            const podeBuscarSkins = !!auth.currentUser;

            const buscarIconSkinPorUidSkin = async (uid = "", skinId = "") => {
              const uidNorm = String(uid || "").trim();
              const skinIdNorm = String(skinId || "").trim();
              if (!uidNorm || !skinIdNorm) return "";
              const cacheKey = `${uidNorm}::${skinIdNorm}`;
              if (iconCachePorUidSkin.has(cacheKey)) {
                return String(iconCachePorUidSkin.get(cacheKey) || "").trim();
              }

              let icon = "";
              try {
                for (const skinRef of getSkinRefs(uidNorm, skinIdNorm)) {
                  const skinSnap = await getDoc(skinRef);
                  if (skinSnap.exists()) {
                    icon = String(skinSnap.data()?.iconSkin || "").trim();
                    if (icon) break;
                  }
                }
              } catch (erroSkin) {
                if (erroSkin?.code !== "permission-denied") {
                  console.error("Erro ao buscar iconSkin por uid/skin:", erroSkin);
                }
              }

              iconCachePorUidSkin.set(cacheKey, icon);
              return icon;
            };

            const buscarIconSkinPorUid = async (uid = "") => {
              const uidNorm = String(uid || "").trim();
              if (!uidNorm) return "";
              if (iconCachePorUid.has(uidNorm)) {
                return String(iconCachePorUid.get(uidNorm) || "").trim();
              }

              let icon = "";
              try {
                const userSnap = await getFirstExistingDoc(getUserRefs(uidNorm));
                const skinAtivaId = String(userSnap?.data?.()?.skinAtivaId || "").trim();

                if (skinAtivaId) {
                  for (const skinAtivaRef of getSkinRefs(uidNorm, skinAtivaId)) {
                    const skinAtivaSnap = await getDoc(skinAtivaRef);
                    if (skinAtivaSnap.exists()) {
                      icon = String(skinAtivaSnap.data()?.iconSkin || "").trim();
                      if (icon) break;
                    }
                  }
                }

                if (!icon) {
                  for (const skinsRef of getSkinsRefs(uidNorm)) {
                    const skinsSnapshot = await getDocs(query(skinsRef, limit(1)));
                    if (!skinsSnapshot.empty) {
                      icon = String(skinsSnapshot.docs[0].data()?.iconSkin || "").trim();
                      if (icon) break;
                    }
                  }
                }
              } catch (erroSkin) {
                if (erroSkin?.code !== "permission-denied") {
                  console.error("Erro ao buscar iconSkin por uid:", erroSkin);
                }
              }

              iconCachePorUid.set(uidNorm, icon);
              return icon;
            };

            const buscarIconSkinPorUsername = async (username = "") => {
              const usernameNorm = String(username || "").trim();
              if (!usernameNorm) return "";
              if (iconCachePorUsername.has(usernameNorm)) {
                return String(iconCachePorUsername.get(usernameNorm) || "").trim();
              }

              let icon = "";
              try {
                const skinDoc = await findSkinByUsernameAcrossProject(db, usernameNorm, {
                  authenticated: Boolean(auth.currentUser),
                  allowPrivateWhenAuthenticated: Boolean(auth.currentUser),
                  includeLegacy: true,
                });
                icon = String(skinDoc?.data?.()?.iconSkin || "").trim();
              } catch (erroSkin) {
                if (erroSkin?.code !== "permission-denied") {
                  console.error("Erro ao buscar iconSkin por username:", erroSkin);
                }
              }

              iconCachePorUsername.set(usernameNorm, icon);
              return icon;
            };

            const mensagens = await Promise.all(
              snapshot.docs.map(async (docSnap) => {
                const chatData = docSnap.data();
                const usernameRemetente = String(chatData.userRemetente || "").trim();
                const userUidRemetente = String(chatData.userUid || "").trim();
                const senderSkinId = String(chatData.senderSkinId || "").trim();

                let iconSkin = String(chatData.iconSkin || "").trim();
                if (podeBuscarSkins && (userUidRemetente || usernameRemetente)) {
                  if (!iconSkin && userUidRemetente && senderSkinId) {
                    iconSkin = await buscarIconSkinPorUidSkin(userUidRemetente, senderSkinId);
                  }
                  if (!iconSkin && userUidRemetente) {
                    iconSkin = await buscarIconSkinPorUid(userUidRemetente);
                  }
                  if (!iconSkin && usernameRemetente) {
                    iconSkin = await buscarIconSkinPorUsername(usernameRemetente);
                  }
                }

                return {
                  ...chatData,
                  data: chatData.data ? chatData.data.toDate() : null,
                  iconSkin: String(iconSkin || iconSkinPadraoUrl || "").trim() || null,
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
  }, [chatHabilitado, contactId, conversationId, iconSkinPadraoUrl, acessoLiveLiberado]);

  useEffect(() => {
    if (contentChatRef.current) {
      contentChatRef.current.scrollTop = contentChatRef.current.scrollHeight;
    }
  }, [chatMensagens]);

  const handleEnviarChat = async () => {
    if (!mensagem.trim() || !chatHabilitado) return;

    try {
      const idContato = String(contactId || "").trim();
      const idConversa = String(conversationId || "").trim();
      const userUid = String(auth?.currentUser?.uid || "").trim();
      const senderSkinId = String(localStorage.getItem("skinIdAtual") || "").trim();
      if (!idContato || !idConversa) return;

      const conversaSnap = await getFirstExistingDoc(getConversaRefs(idContato, idConversa));
      if (!conversaSnap?.exists?.()) {
        setErroChat("Conversa nao encontrada.");
        return;
      }

      const idChat = doc(collection(db, "_dummy")).id;
      const payloadChat = {
        mensagem,
        data: serverTimestamp(),
        userRemetente: skinLogadoUser,
        userUid,
        senderSkinId,
        idConversa,
        idChat,
      };

      for (const chatRef of getChatRefs(idContato, idConversa)) {
        await setDoc(doc(chatRef, idChat), payloadChat);
      }

      for (const conversaRef of getConversaRefs(idContato, idConversa)) {
        await setDoc(
          conversaRef,
          {
            ultimaMensagem: mensagem,
            dataUltimaMensagem: serverTimestamp(),
          },
          { merge: true }
        );
      }

      for (const contatoRef of getContatoRefs(idContato)) {
        const payloadContato = {
          ultimaConversaData: serverTimestamp(),
        };
        if (userUid) {
          payloadContato.participantUids = arrayUnion(userUid);
        }
        await setDoc(
          contatoRef,
          payloadContato,
          { merge: true }
        );
      }

      setMensagem("");
      setErroChat("");
    } catch (erroEnvio) {
      console.error("Erro ao enviar mensagem:", erroEnvio);
      if (erroEnvio?.code === "permission-denied") {
        setErroChat("Sem permissao para enviar mensagem neste chat.");
      }
    }
  };

  if (carregandoConfig) {
    return <ProjectLoadingFallback text="Carregando..." />;
  }

  if (!chatHabilitado) {
    return <p>Chat desativado em PROPRIEDADES DO SISTEMA.</p>;
  }

  if (erroChat) {
    return <p>{erroChat}</p>;
  }

  const obterChaveRemetente = (mensagemItem = {}) =>
    String(mensagemItem?.userUid || mensagemItem?.userRemetente || mensagemItem?.nomeGoogle || "")
      .trim();
  const uidAtual = String(auth?.currentUser?.uid || "").trim();

  return (
    <div className="contentPageDetForm">
      {conversaAtual?.assunto ? (
        <div
          style={{
            display: "grid",
            gap: 4,
            marginBottom: 10,
            padding: 10,
            border: "1px solid rgba(255,255,255,0.18)",
          }}
        >
          <strong>{conversaAtual.assunto}</strong>
          {conversaAtual?.produtoSnapshot?.nome ? (
            <span style={{ fontSize: 12, opacity: 0.78 }}>
              {conversaAtual.produtoSnapshot.nome}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="contentChat" ref={contentChatRef}>
        {chatMensagens.map((mensagemItem, index) => {
          const remetenteAtual = obterChaveRemetente(mensagemItem);
          const remetenteAnterior =
            index > 0 ? obterChaveRemetente(chatMensagens[index - 1]) : "";
          const isSentByMe =
            (mensagemItem.userUid && String(mensagemItem.userUid).trim() === uidAtual) ||
            (!mensagemItem.userUid && mensagemItem.userRemetente === skinLogadoUser);
          const mostrarFoto =
            !isSentByMe && (index === 0 || remetenteAnterior !== remetenteAtual);

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
                  <img
                    className="fotoUsuario"
                    src={mensagemItem.iconSkin || iconSkinPadraoUrl || "default-user.jpg"}
                    alt={mensagemItem.userRemetente || "User"}
                  />
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
