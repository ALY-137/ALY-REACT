import React, { useState, useEffect } from 'react';
import firebase from 'firebase/app';
import 'firebase/firestore';
import './formularios.css';
import { seforAdm } from '../../../Scripts/verificações/verificaAdm';
import { idGoogle } from '../../../../App';

function ListaContatos({ handleExpandForm }) {
  const [contatos, setContatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserData = async (idGoogle) => {
      try {
        const userDoc = await firebase.firestore().collection('users').where('idGoogle', '==', idGoogle).get();
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
          if (!seforAdm() && idGoogle !== idRemetente && idGoogle !== idDestinatario) {
            return null; // Se não for admin e o contato não pertence ao usuário, ignore-o
          }

          const remetenteData = await fetchUserData(idRemetente);
          const destinatarioData = await fetchUserData(idDestinatario);

          return {
            contatoId: contatoDoc.id,
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

    return () => {}; // Cleanup se necessário
  }, []);

  return (
    <div>
      {loading && <p>Carregando contatos...</p>}
      {error && <p>{error}</p>}
      {!loading && !error && contatos.length === 0 && <p>Não há contatos.</p>}
      
      <div className='pageContentForms'>
        {contatos.map((contato) => (
          <div className='boxItemContato' onClick={() => handleExpandForm(contato.contatoId)} key={contato.contatoId}>
              <div className='fotoContainer'>
                <img src={contato.fotoRemetente} alt="Foto Remetente" className='fotoContato' />
                <p> ◄-► </p>
                <img src={contato.fotoDestinatario} alt="Foto Destinatário" className='fotoContato' />
              </div>
              <p>{contato.nomeRemetente} | {contato.nomeDestinatario}</p>         
              <p>Último contato: {contato.ultimaConversaData.toLocaleDateString('pt-BR')}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ListaContatos;
