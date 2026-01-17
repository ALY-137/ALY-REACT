import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import './formularios.css';
import { seforAdm } from '../../../Scripts/verificações/verificaAdm';
import { idGoogleCap } from '../../../../App';

import { app } from '../../../Banco/init-firebase.js';
import { getFirestore } from 'firebase/firestore';
const db = getFirestore(app);


function ListaContatos() {
  const [contatos, setContatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate(); // Hook para navegação

  
const skinLogadoUser = localStorage.getItem('skinLogadoUser'); // Obtém o nome de usuário da skin logada

  useEffect(() => {
  
      const fetchSkinDataByUsername = async (username) => {
        try {
          const usersSnapshot = await firebase.firestore().collection('users').get();
      
          for (const userDoc of usersSnapshot.docs) {
            const skinsSnapshot = await userDoc.ref
              .collection('skins')
              .where('username', '==', username)
              .get();
      
            if (!skinsSnapshot.empty) {
              const skinData = skinsSnapshot.docs[0].data();
              return {
                nome: skinData.username || 'Sem nome',
                foto: skinData.iconSkin || 'default-user.jpg',
              };
            }
          }
        } catch (error) {
          console.error(`Erro ao buscar dados do usuário (${username}):`, error);
        }
      
        return {
          nome: username,
          foto: 'default-user.jpg',
        };
      };
      

      const fetchContatos = async () => {
        let query = firebase.firestore().collection('contatos').orderBy('ultimaConversaData', 'desc');

        try {
          const snapshot = await query.get();

          const listaContatos = await Promise.all(
  snapshot.docs.map(async (contatoDoc) => {
    const data = contatoDoc.data();
    const remetente = data.skinRemetente;
    const destinatario = data.skinDestinatario;

    // FILTRO PARA NÃO ADM
    if (!seforAdm()) {
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
      ultimaConversaData: data.ultimaConversaData?.toDate() || new Date(0),
    };
  })
);


          setContatos(listaContatos.filter(contato => contato !== null));
          setLoading(false);
        } catch (error) {
          setError('Erro ao carregar contatos.');
          console.error('Erro ao carregar contatos:', error);
          setLoading(false);
        }
      };


  fetchContatos();
  }, [skinLogadoUser]); 

  const handleChatRedirect = (contatoId) => {
    // Redireciona para a conversa principal
    navigate(`/menu/${skinLogadoUser}/contatos/${contatoId}/chat/principal`);
  };

  const handleListarConversasRedirect = (contatoId) => {
    // Redireciona para a lista de conversas
    navigate(`/menu/${skinLogadoUser}/contatos/${contatoId}`);
  };

  return (
    <div>
      {loading && <p>Carregando contatos...</p>}
      {error && <p>{error}</p>}
      {!loading && !error && contatos.length === 0 && <p>Não há contatos.</p>}
      
      <div className='pageContentForms'>
        {contatos.map((contato) => (
          <div
            className='boxItemContato'
            onClick={() => handleListarConversasRedirect(contato.contatoId)} // Redireciona para a lista de conversas
            key={contato.contatoId}
          >
            <div className='fotoContainer'>
              {/* Se for admin, mostra tanto o remetente quanto o destinatário */}
              {seforAdm() ? (
                <>
                  <img src={contato.fotoRemetente} alt="Foto Remetente" className='fotoContato' />
                  <p> ◄--► </p>
                </>
              ) : null}
              <img src={contato.fotoDestinatario} alt="Foto Destinatário" className='fotoContato' />
            </div>

            <div className='infosContato'>
              <p className='nomesContatos'>
                {/* Se for admin, mostra os dois nomes, caso contrário, só o nome do destinatário */}
                {seforAdm() ? `${contato.nomeRemetente} | ${contato.nomeDestinatario}` : `${contato.nomeDestinatario}`}
              </p>
              <p className='dataContatos'> Último contato: {contato.ultimaConversaData.toLocaleDateString('pt-BR')} </p>
            </div>

            {/* Botão para redirecionar ao chat principal */}
              <img
                className='btnChat'
                onClick={(e) => {
                  e.stopPropagation();
                  handleChatRedirect(contato.contatoId);
                }} // Redireciona para o chat principal
              src='https://firebasestorage.googleapis.com/v0/b/teste-aa015.appspot.com/o/imagens%2Fthemes%2Fcyberpink%2Fviolet%2Fchat.png?alt=media&token=663a432d-f916-4917-98b2-e90eacd65745'
              alt='Abrir chat'
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default ListaContatos;
