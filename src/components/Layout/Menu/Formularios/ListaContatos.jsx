import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  collectionGroup,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import "./formularios.css";
import { db } from "../../../Banco/init-firebase.js";
import { seforAdm } from "../../../Scripts/verificacoes/verificaAdm";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistema,
} from "../../Sistema/configSistema";

function ListaContatos() {
  const [contatos, setContatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chatHabilitado, setChatHabilitado] = useState(DEFAULT_SISTEMA_CONFIG.chatHabilitado);
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
    if (!chatHabilitado) {
      setContatos([]);
      setLoading(false);
      return;
    }

    let cancelado = false;

    const fetchSkinDataByUsername = async (username) => {
      try {
        let skinsQuery = query(
          collectionGroup(db, "skins"),
          where("username", "==", username),
          limit(1)
        );

        if (!isAdmin) {
          skinsQuery = query(
            collectionGroup(db, "skins"),
            where("username", "==", username),
            where("visibilidade", "in", ["publico", "publico_restritivo", "privado"]),
            limit(1)
          );
        }

        const skinsSnapshot = await getDocs(skinsQuery);

        if (!skinsSnapshot.empty) {
          const skinData = skinsSnapshot.docs[0].data();
          return {
            nome: skinData.username || "Sem nome",
            foto: skinData.iconSkin || "default-user.jpg",
          };
        }
      } catch (erroSkin) {
        console.error(`Erro ao buscar dados da skin (${username}):`, erroSkin);
      }

      return {
        nome: username,
        foto: "default-user.jpg",
      };
    };

    const fetchContatos = async () => {
      setLoading(true);
      try {
        const contatosQuery = query(
          collection(db, "contatos"),
          orderBy("ultimaConversaData", "desc")
        );

        const snapshot = await getDocs(contatosQuery);

        const listaContatos = await Promise.all(
          snapshot.docs.map(async (contatoDoc) => {
            const data = contatoDoc.data();
            const remetente = data.skinRemetente;
            const destinatario = data.skinDestinatario;

            if (!isAdmin) {
              const userIsInvolved =
                remetente === skinLogadoUser || destinatario === skinLogadoUser;

              if (!userIsInvolved) return null;
            }

            const remetenteData = await fetchSkinDataByUsername(remetente);
            const destinatarioData = await fetchSkinDataByUsername(destinatario);

            return {
              contatoId: contatoDoc.id,
              conversaId: data.conversaId,
              fotoRemetente: remetenteData.foto,
              fotoDestinatario: destinatarioData.foto,
              nomeRemetente: remetenteData.nome,
              nomeDestinatario: destinatarioData.nome,
              ultimaConversaData: data.ultimaConversaData?.toDate() || new Date(0),
            };
          })
        );

        if (cancelado) return;
        setContatos(listaContatos.filter(Boolean));
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
  }, [chatHabilitado, isAdmin, skinLogadoUser]);

  const handleChatRedirect = (contatoId) => {
    navigate(`/menu/${skinLogadoUser}/contatos/${contatoId}/chat/principal`);
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
      {loading && <p>Carregando contatos...</p>}
      {error && <p>{error}</p>}
      {!loading && !error && contatos.length === 0 && <p>Nao ha contatos.</p>}

      <div className="pageContentForms">
        {contatos.map((contato) => (
          <div
            key={contato.contatoId}
            className="boxItemContato"
            onClick={() => handleListarConversasRedirect(contato.contatoId)}
          >
            <div className="fotoContainer">
              {isAdmin && (
                <>
                  <img
                    src={contato.fotoRemetente}
                    alt="Foto remetente"
                    className="fotoContato"
                  />
                  <p> | </p>
                </>
              )}

              <img
                src={contato.fotoDestinatario}
                alt="Foto destinatario"
                className="fotoContato"
              />
            </div>

            <div className="infosContato">
              <p className="nomesContatos">
                {isAdmin
                  ? `${contato.nomeRemetente} | ${contato.nomeDestinatario}`
                  : contato.nomeDestinatario}
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
              src="https://firebasestorage.googleapis.com/v0/b/teste-aa015.appspot.com/o/imagens%2Fthemes%2Fcyberpink%2Fviolet%2Fchat.png?alt=media&token=663a432d-f916-4917-98b2-e90eacd65745"
              alt="Abrir chat"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default ListaContatos;
