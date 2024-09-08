import React, { useState, useEffect } from 'react';
import firebase from 'firebase/app';
import 'firebase/firestore';
import './formularios.css';

function ListaConversas({ conversaId, setBackText, setAtualTxt, handleExpandForm }) {
  const [conversas, setConversas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = firebase.firestore()
      .collection('contatos')
      .doc(conversaId)
      .collection('conversas')
      .orderBy('dataUltimaMensagem', 'desc')
      .onSnapshot(
        (snapshot) => {
          const listaConversas = snapshot.docs.map((conversaDoc) => ({
            conversaId: conversaDoc.id,
            assunto: conversaDoc.data().assunto || 'Sem assunto',
            ultimaMensagem: conversaDoc.data().ultimaMensagem || 'Nenhuma mensagem',
            data: conversaDoc.data().dataUltimaMensagem?.toDate(),
          }));
          setConversas(listaConversas);
          setLoading(false);
        },
        (error) => {
          setError('Erro ao carregar conversas.');
          console.error('Erro ao carregar conversas:', error);
          setLoading(false);
        }
      );

    return () => unsubscribe();
  }, [conversaId]);

  const deleteChats = async (idConversa) => {
    const chatsRef = firebase.firestore()
      .collection('contatos')
      .doc(conversaId)
      .collection('conversas')
      .doc(idConversa)
      .collection('chats');

    const snapshot = await chatsRef.get();
    const batch = firebase.firestore().batch();

    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  };

  const handleDelete = async (idConversa, event) => {
    event.stopPropagation(); // Evita que o clique no botão se propague para o elemento pai

    try {
      // Exclui todos os "chats" da subcoleção
      await deleteChats(idConversa);

      // Exclui a conversa
      await firebase.firestore()
        .collection('contatos')
        .doc(conversaId)
        .collection('conversas')
        .doc(idConversa)
        .delete();

      // Atualiza o estado das conversas
      const novasConversas = conversas.filter(conversa => conversa.conversaId !== idConversa);
      setConversas(novasConversas);

      // Verifica se não há mais conversas e exclui a coleção "contatos" se estiver vazia
      if (novasConversas.length === 0) {
        await firebase.firestore().collection('contatos').doc(conversaId).delete();
      }
    } catch (error) {
      console.error('Erro ao deletar a conversa e seus chats:', error);
      setError('Erro ao deletar a conversa e seus chats.');
    }
  };

  return (
    <div>
      {loading && <p>Carregando conversas...</p>}
      {error && <p>{error}</p>}
      {!loading && !error && conversas.length === 0 && <p>Não há conversas.</p>}
      
      <div className='pageContentForms'>
        {conversas.map((conversa) => (
          <div className='boxItemConversa' onClick={() => {
            handleExpandForm(conversa.conversaId);
            setBackText('Voltar');
            setAtualTxt(conversa.assunto);
          }} key={conversa.conversaId}>
            <div className="conversaHeader">
              <p><strong>Assunto:</strong> {conversa.assunto}</p>
              <button
                className="deleteButton"
                onClick={(event) => handleDelete(conversa.conversaId, event)}
              >
                Excluir
              </button>
            </div>
            <p><strong>Última Mensagem:</strong> {conversa.ultimaMensagem}</p>
            <p><strong>Data da Última Mensagem:</strong> {conversa.data?.toLocaleDateString('pt-BR') || 'Data não disponível'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ListaConversas;
