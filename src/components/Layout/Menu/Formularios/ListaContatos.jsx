import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import './formularios.css';
import { seforAdm } from '../../../Scripts/verificacoes/verificaAdm';

import {
  collectionGroup,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';

import { db } from '../../../Banco/init-firebase.js';

function ListaContatos() {
  const [contatos, setContatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const skinLogadoUser = localStorage.getItem('skinLogadoUser');
  const userId = localStorage.getItem('userId');
  const isAdmin = seforAdm({ uid: userId });

  useEffect(() => {

    // 🔹 Busca dados da skin pelo username
    const fetchSkinDataByUsername = async (username) => {
      try {
        let skinsQuery = query(
          collectionGroup(db, 'skins'),
          where('username', '==', username),
          limit(1)
        );

        if (!isAdmin) {
          skinsQuery = query(
            collectionGroup(db, 'skins'),
            where('username', '==', username),
            where('visibilidade', 'in', ['publico', 'publico_restritivo', 'privado']),
            limit(1)
          );
        }

        const skinsSnapshot = await getDocs(skinsQuery);

        if (!skinsSnapshot.empty) {
          const skinData = skinsSnapshot.docs[0].data();
          return {
            nome: skinData.username || 'Sem nome',
            foto: skinData.iconSkin || 'default-user.jpg',
          };
        }
      } catch (error) {
        console.error(`Erro ao buscar dados da skin (${username}):`, error);
      }

      return {
        nome: username,
        foto: 'default-user.jpg',
      };
    };

    // 🔹 Busca contatos
    const fetchContatos = async () => {
      try {
        const contatosQuery = query(
          collection(db, 'contatos'),
          orderBy('ultimaConversaData', 'desc')
        );

        const snapshot = await getDocs(contatosQuery);

        const listaContatos = await Promise.all(
          snapshot.docs.map(async (contatoDoc) => {
            const data = contatoDoc.data();
            const remetente = data.skinRemetente;
            const destinatario = data.skinDestinatario;

            // 🔒 Filtro para não-admin
            if (!isAdmin) {
              const userIsInvolved =
                remetente === skinLogadoUser ||
                destinatario === skinLogadoUser;

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
              ultimaConversaData:
                data.ultimaConversaData?.toDate() || new Date(0),
            };
          })
        );

        setContatos(listaContatos.filter(Boolean));
        setLoading(false);
      } catch (error) {
        console.error('Erro ao carregar contatos:', error);
        setError('Erro ao carregar contatos.');
        setLoading(false);
      }
    };

    fetchContatos();
  }, [skinLogadoUser]);

  const handleChatRedirect = (contatoId) => {
    navigate(`/menu/${skinLogadoUser}/contatos/${contatoId}/chat/principal`);
  };

  const handleListarConversasRedirect = (contatoId) => {
    navigate(`/menu/${skinLogadoUser}/contatos/${contatoId}`);
  };

  return (
    <div>
      {loading && <p>Carregando contatos...</p>}
      {error && <p>{error}</p>}
      {!loading && !error && contatos.length === 0 && (
        <p>Não há contatos.</p>
      )}

      <div className="pageContentForms">
        {contatos.map((contato) => (
          <div
            key={contato.contatoId}
            className="boxItemContato"
            onClick={() =>
              handleListarConversasRedirect(contato.contatoId)
            }
          >
            <div className="fotoContainer">
              {isAdmin && (
                <>
                  <img
                    src={contato.fotoRemetente}
                    alt="Foto Remetente"
                    className="fotoContato"
                  />
                  <p> ◄--► </p>
                </>
              )}

              <img
                src={contato.fotoDestinatario}
                alt="Foto Destinatário"
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
                Último contato:{' '}
                {contato.ultimaConversaData.toLocaleDateString('pt-BR')}
              </p>
            </div>

            <img
              className="btnChat"
              onClick={(e) => {
                e.stopPropagation();
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


