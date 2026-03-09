import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import "./formularios.css";
import { auth, db } from "../../../Banco/init-firebase.js";
import { getProjectCollectionCandidates } from "../../../Banco/projectDataRefs";
import { findSkinByUsernameAcrossProject } from "../../Skins/skinLookup";
import { seforAdm } from "../../../Scripts/verificacoes/verificaAdm";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistema,
} from "../../Sistema/configSistema";

const getContatosRefs = () => getProjectCollectionCandidates(db, "contatos");
const getConversasRefs = (contatoId) =>
  getProjectCollectionCandidates(db, "contatos", String(contatoId || "").trim(), "conversas");

function ListaContatos() {
  const [contatos, setContatos] = useState([]);
  const [conversas, setConversas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chatHabilitado, setChatHabilitado] = useState(DEFAULT_SISTEMA_CONFIG.chatHabilitado);
  const [iconSkinPadraoUrl, setIconSkinPadraoUrl] = useState(
    DEFAULT_SISTEMA_CONFIG.iconSkinPadraoUrl || ""
  );
  const [chatButtonIconUrl, setChatButtonIconUrl] = useState(
    DEFAULT_SISTEMA_CONFIG.chatButtonIconUrl || ""
  );
  const [carregandoConfig, setCarregandoConfig] = useState(true);

  const navigate = useNavigate();
  const skinLogadoUser = localStorage.getItem("skinLogadoUser");
  const userId = localStorage.getItem("userId");
  const isAdmin = seforAdm({ uid: userId });

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
        setChatButtonIconUrl(
          String(config?.chatButtonIconUrl || DEFAULT_SISTEMA_CONFIG.chatButtonIconUrl || "")
            .trim()
        );
      } catch {
        if (!ativo) return;
        setChatHabilitado(DEFAULT_SISTEMA_CONFIG.chatHabilitado);
        setIconSkinPadraoUrl(
          String(DEFAULT_SISTEMA_CONFIG.iconSkinPadraoUrl || "").trim()
        );
        setChatButtonIconUrl(String(DEFAULT_SISTEMA_CONFIG.chatButtonIconUrl || "").trim());
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
    if (!chatHabilitado) {
      setContatos([]);
      setConversas([]);
      setLoading(false);
      return;
    }

    let cancelado = false;

    const fetchSkinDataByUsername = async (username) => {
      try {
        const skinDoc = await findSkinByUsernameAcrossProject(db, username, {
          authenticated: Boolean(userId),
          allowPrivateWhenAuthenticated: Boolean(isAdmin),
          includeLegacy: true,
        });
        const skinData = skinDoc?.data?.() || null;

        if (skinData) {
          return {
            nome: skinData.username || "Sem nome",
            foto:
              String(skinData.iconSkin || "").trim() ||
              iconSkinPadraoUrl ||
              "default-user.jpg",
          };
        }
      } catch (erroSkin) {
        console.error(`Erro ao buscar dados da skin (${username}):`, erroSkin);
      }

      return {
        nome: username,
        foto: iconSkinPadraoUrl || "default-user.jpg",
      };
    };

    const fetchContatos = async () => {
      setLoading(true);
      try {
        const contatosMap = new Map();
        for (const contatosRef of getContatosRefs()) {
          try {
            const contatosQuery = query(
              contatosRef,
              orderBy("ultimaConversaData", "desc")
            );
            const snapshot = await getDocs(contatosQuery);
            for (const contatoDoc of snapshot.docs) {
              if (!contatosMap.has(contatoDoc.id)) {
                contatosMap.set(contatoDoc.id, contatoDoc);
              }
            }
          } catch (erroContatosRef) {
            if (erroContatosRef?.code !== "permission-denied") {
              throw erroContatosRef;
            }
          }
        }

        const uidAtual = String(auth?.currentUser?.uid || userId || "").trim();
        const contatoIdsLiberadosPorPedido = new Set();
        if (!isAdmin && uidAtual && contatosMap.size) {
          const owners = Array.from(
            new Set(
              [...contatosMap.values()]
                .map((contatoDoc) => String(contatoDoc?.data?.()?.ownerUserId || "").trim())
                .filter(Boolean)
            )
          );

          for (const ownerUid of owners) {
            for (const pedidosRef of getProjectCollectionCandidates(db, "users", ownerUid, "pedidos")) {
              try {
                const pedidosSnap = await getDocs(
                  query(pedidosRef, where("compradorUid", "==", uidAtual))
                );
                pedidosSnap.docs.forEach((pedidoDoc) => {
                  const pedido = pedidoDoc.data() || {};
                  const status = String(pedido?.status || "").trim().toLowerCase();
                  const contactId = String(pedido?.sessionContactId || "").trim();
                  if (status === "pagamento_confirmado" && contactId) {
                    contatoIdsLiberadosPorPedido.add(contactId);
                  }
                });
              } catch (erroPedidos) {
                if (erroPedidos?.code !== "permission-denied") {
                  throw erroPedidos;
                }
              }
            }
          }
        }

        const listaContatos = await Promise.all(
          [...contatosMap.values()].map(async (contatoDoc) => {
            const data = contatoDoc.data();
            const remetente = String(data.skinRemetente || "").trim();
            const destinatario = String(data.skinDestinatario || "").trim();
            const contatoIdAtual = String(contatoDoc.id || "").trim();
            const ownerUserIdContato = String(data.ownerUserId || "").trim();
            const compradorUidContato = String(data.compradorUid || "").trim();
            const participantUids = Array.isArray(data.participantUids)
              ? data.participantUids
                  .map((value) => String(value || "").trim())
                  .filter(Boolean)
              : [];
            const userIsInvolvedByUid = Boolean(
              uidAtual &&
                (
                  participantUids.includes(uidAtual) ||
                  ownerUserIdContato === uidAtual ||
                  compradorUidContato === uidAtual
                )
            );

            if (!isAdmin) {
              const userTemPedidoConfirmado =
                contatoIdAtual && contatoIdsLiberadosPorPedido.has(contatoIdAtual);

              if (!userIsInvolvedByUid && !userTemPedidoConfirmado) return null;
            }

            const remetenteData = await fetchSkinDataByUsername(remetente);
            const destinatarioData =
              destinatario === "participantes_live"
                ? { nome: "participantes", foto: iconSkinPadraoUrl || "default-user.jpg" }
                : await fetchSkinDataByUsername(destinatario);
            const tipoContato = String(data.tipo || "").trim().toLowerCase();
            const ehLiveGrupo = tipoContato === "live" || contatoIdAtual.toLowerCase().startsWith("live_");
            const nomeUsuarioComum = ehLiveGrupo ? remetenteData.nome : destinatarioData.nome;

            return {
              contatoId: contatoIdAtual,
              conversaId: data.conversaId,
              ownerUserId: ownerUserIdContato,
              fotoRemetente: remetenteData.foto,
              fotoDestinatario: destinatarioData.foto,
              nomeRemetente: remetenteData.nome,
              nomeDestinatario: destinatarioData.nome,
              nomeUsuarioComum,
              ehLiveGrupo,
              ultimaConversaData: data.ultimaConversaData?.toDate() || new Date(0),
            };
          })
        );

        if (cancelado) return;
        const contatosFiltrados = listaContatos.filter(Boolean);
        setContatos(contatosFiltrados);

        if (!isAdmin) {
          const conversasMap = new Map();

          for (const contato of contatosFiltrados) {
            const contatoIdAtual = String(contato?.contatoId || "").trim();
            if (!contatoIdAtual) continue;

            let encontrouConversa = false;

            for (const conversasRef of getConversasRefs(contatoIdAtual)) {
              try {
                const conversasSnap = await getDocs(
                  query(conversasRef, orderBy("dataUltimaMensagem", "desc"))
                );

                conversasSnap.docs.forEach((conversaDoc) => {
                  encontrouConversa = true;
                  const conversaData = conversaDoc.data() || {};
                  const conversaIdAtual = String(conversaDoc.id || "").trim();
                  if (!conversaIdAtual) return;

                  const chave = `${contatoIdAtual}::${conversaIdAtual}`;
                  if (conversasMap.has(chave)) return;

                  const dataUltimaMensagem =
                    typeof conversaData?.dataUltimaMensagem?.toDate === "function"
                      ? conversaData.dataUltimaMensagem.toDate()
                      : contato.ultimaConversaData || new Date(0);

                  conversasMap.set(chave, {
                    contatoId: contatoIdAtual,
                    conversaId: conversaIdAtual,
                    assunto: String(conversaData?.assunto || "Sem assunto").trim() || "Sem assunto",
                    ultimaMensagem:
                      String(conversaData?.ultimaMensagem || "Nenhuma mensagem").trim() ||
                      "Nenhuma mensagem",
                    dataUltimaMensagem,
                    nomeContato: contato.nomeUsuarioComum || contato.nomeDestinatario || "Contato",
                    fotoContato: contato.fotoDestinatario || contato.fotoRemetente || "default-user.jpg",
                  });
                });
              } catch (erroConversasRef) {
                if (erroConversasRef?.code !== "permission-denied") {
                  throw erroConversasRef;
                }
              }
            }

            if (!encontrouConversa && contato.conversaId) {
              const conversaIdFallback = String(contato.conversaId || "").trim();
              if (conversaIdFallback) {
                const chaveFallback = `${contatoIdAtual}::${conversaIdFallback}`;
                if (!conversasMap.has(chaveFallback)) {
                  conversasMap.set(chaveFallback, {
                    contatoId: contatoIdAtual,
                    conversaId: conversaIdFallback,
                    assunto: "Conversa",
                    ultimaMensagem: "Sem mensagens",
                    dataUltimaMensagem: contato.ultimaConversaData || new Date(0),
                    nomeContato: contato.nomeUsuarioComum || contato.nomeDestinatario || "Contato",
                    fotoContato: contato.fotoDestinatario || contato.fotoRemetente || "default-user.jpg",
                  });
                }
              }
            }
          }

          const listaConversasUsuario = [...conversasMap.values()].sort(
            (a, b) =>
              (b?.dataUltimaMensagem?.getTime?.() || 0) -
              (a?.dataUltimaMensagem?.getTime?.() || 0)
          );

          if (!cancelado) {
            setConversas(listaConversasUsuario);
          }
        } else {
          setConversas([]);
        }

        setError(null);
      } catch (erroContatos) {
        if (cancelado) return;
        console.error("Erro ao carregar contatos:", erroContatos);
        setError("Erro ao carregar contatos.");
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    fetchContatos();

    return () => {
      cancelado = true;
    };
  }, [chatHabilitado, iconSkinPadraoUrl, isAdmin, skinLogadoUser]);

  const handleChatRedirect = (contatoId, conversaId = "principal") => {
    navigate(`/menu/${skinLogadoUser}/contatos/${contatoId}/chat/${conversaId}`);
  };

  const handleListarConversasRedirect = (contatoId) => {
    navigate(`/menu/${skinLogadoUser}/contatos/${contatoId}`);
  };

  if (carregandoConfig) {
    return <p>Carregando...</p>;
  }

  if (!chatHabilitado) {
    return <p>Chat desativado em PROPRIEDADES DO SISTEMA.</p>;
  }

  return (
    <div>
      {loading && <p>{isAdmin ? "Carregando contatos..." : "Carregando conversas..."}</p>}
      {error && <p>{error}</p>}
      {!loading && !error && isAdmin && contatos.length === 0 && <p>Nao ha contatos.</p>}
      {!loading && !error && !isAdmin && conversas.length === 0 && <p>Nao ha conversas.</p>}

      <div className="pageContentForms">
        {isAdmin
          ? contatos.map((contato) => (
              <div
                key={contato.contatoId}
                className="boxItemContato"
                onClick={() => handleListarConversasRedirect(contato.contatoId)}
              >
                <div className="fotoContainer">
                  <>
                    <img
                      src={contato.fotoRemetente}
                      alt="Foto remetente"
                      className="fotoContato"
                    />
                    <p> | </p>
                  </>

                  <img
                    src={contato.fotoDestinatario}
                    alt="Foto destinatario"
                    className="fotoContato"
                  />
                </div>

                <div className="infosContato">
                  <p className="nomesContatos">
                    {`${contato.nomeRemetente} | ${contato.nomeDestinatario}`}
                  </p>
                  <p className="dataContatos">
                    Ultimo contato: {contato.ultimaConversaData.toLocaleDateString("pt-BR")}
                  </p>
                </div>

                <img
                  className="btnChat"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleChatRedirect(contato.contatoId);
                  }}
                  src={
                    chatButtonIconUrl ||
                    "https://firebasestorage.googleapis.com/v0/b/teste-aa015.appspot.com/o/imagens%2Fthemes%2Fcyberpink%2Fviolet%2Fchat.png?alt=media&token=663a432d-f916-4917-98b2-e90eacd65745"
                  }
                  alt="Abrir chat"
                />
              </div>
            ))
          : conversas.map((conversa) => (
              <div
                key={`${conversa.contatoId}-${conversa.conversaId}`}
                className="boxItemContato"
                onClick={() => handleChatRedirect(conversa.contatoId, conversa.conversaId)}
              >
                <div className="fotoContainer">
                  <img
                    src={conversa.fotoContato}
                    alt="Foto contato"
                    className="fotoContato"
                  />
                </div>

                <div className="infosContato">
                  <p className="nomesContatos">{conversa.nomeContato}</p>
                  <p className="dataContatos">
                    {`Ultima mensagem: ${conversa.dataUltimaMensagem.toLocaleDateString("pt-BR")}`}
                  </p>
                  <p style={{ margin: 0, fontSize: 12 }}>{conversa.assunto}</p>
                </div>

                <img
                  className="btnChat"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleChatRedirect(conversa.contatoId, conversa.conversaId);
                  }}
                  src={
                    chatButtonIconUrl ||
                    "https://firebasestorage.googleapis.com/v0/b/teste-aa015.appspot.com/o/imagens%2Fthemes%2Fcyberpink%2Fviolet%2Fchat.png?alt=media&token=663a432d-f916-4917-98b2-e90eacd65745"
                  }
                  alt="Abrir chat"
                />
              </div>
            ))}
      </div>
    </div>
  );
}

export default ListaContatos;
