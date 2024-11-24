import React, { useState, useEffect , useParams } from 'react';
import { useNavigate } from 'react-router-dom';
import firebase from 'firebase/app';
import 'firebase/firestore';
import './formularios.css';
import { seforAdm } from '../../../Scripts/verificações/verificaAdm';
import { idGoogleCap } from '../../../../App';


function ListaContatos() {
  const [contatos, setContatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate(); // Hook para navegação




  useEffect(() => {
    const fetchUserData = async (idGoogleCap) => {
      try {
        const userDoc = await firebase.firestore().collection('users').where('idGoogle', '==', idGoogleCap).get();
        if (!userDoc.empty) {
          const data = userDoc.docs[0].data();
          return {
            nome: data.nomeCompletoGoogle || 'Nome não disponível',
            foto: data.picGoogle || 'default-user.jpg',
          };
        }
      } catch (error) {
        console.error('Erro ao buscar dados do usuário:', error);
      }
      return {
        nome: 'Nome não disponível',
        foto: 'default-user.jpg',
      };
    };

    const fetchContatos = async () => {
      let query = firebase.firestore().collection('contatos').orderBy('ultimaConversaData', 'desc');

      try {
        const snapshot = await query.get();
        const listaContatos = await Promise.all(snapshot.docs.map(async (contatoDoc) => {
          const data = contatoDoc.data();
          const [idRemetente, idDestinatario] = data.idContato.split('_');

          // Filtra os contatos que envolvem o usuário logado, caso ele não seja administrador
          if (!seforAdm() && idGoogleCap !== idRemetente && idGoogleCap !== idDestinatario) {
            return null; // Se não for admin e o contato não pertence ao usuário, ignore-o
          }

          const remetenteData = await fetchUserData(idRemetente);
          const destinatarioData = await fetchUserData(idDestinatario);

          return {
            contatoId: contatoDoc.id,
            conversaId: data.conversaId, // Capturando o conversaId do contato
            fotoRemetente: remetenteData.foto,
            fotoDestinatario: destinatarioData.foto,
            nomeRemetente: remetenteData.nome,
            nomeDestinatario: destinatarioData.nome,
            ultimaConversaData: data.ultimaConversaData?.toDate() || new Date(0),
          };
        }));

        // Remove contatos que não pertencem ao usuário logado quando ele não é admin
        setContatos(listaContatos.filter(contato => contato !== null));
        setLoading(false);
      } catch (error) {
        setError('Erro ao carregar contatos.');
        console.error('Erro ao carregar contatos:', error);
        setLoading(false);
      }
    };

    fetchContatos();
  }, [idGoogleCap]); // Adiciona idGoogleCap como dependência

  const handleChatRedirect = (contatoId) => {
    // Redireciona para a conversa principal
    navigate(`/menu/${idGoogleCap}/contatos/${contatoId}/chat/principal`);
  };

  const handleListarConversasRedirect = (contatoId) => {
    // Redireciona para a lista de conversas
    navigate(`/menu/${idGoogleCap}/contatos/${contatoId}`);
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
              <p className='dataContatos'>Último contato: {contato.ultimaConversaData.toLocaleDateString('pt-BR')}</p>
            </div>

            {/* Botão para redirecionar ao chat principal */}
            <button
              className='btnChat'
              onClick={(e) => {
                e.stopPropagation(); // Evita que o clique no botão acione o onClick do contato
                handleChatRedirect(contato.contatoId); // Redireciona para a conversa principal
              }}
            >
              Chat
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ListaContatos;
