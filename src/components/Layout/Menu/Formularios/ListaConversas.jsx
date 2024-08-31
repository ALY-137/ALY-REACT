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
      .orderBy('dataUltimaMensagem', 'desc') // Ordena pela data da última mensagem em ordem decrescente
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

    // Limpeza do listener ao desmontar o componente
    return () => unsubscribe();
  }, [conversaId]);

  return (
    <div>
      {loading && <p>Carregando conversas...</p>}
      {error && <p>{error}</p>}
      {!loading && !error && conversas.length === 0 && <p>Não há conversas.</p>}
      
      <div className='pageContentForms'>
        {conversas.map((conversa) => (
          <div className='boxItemConversa' key={conversa.conversaId}>
            <p><strong>ID da Conversa:</strong> {conversa.conversaId}</p>
            <p><strong>Assunto:</strong> {conversa.assunto}</p>
            <p><strong>Última Mensagem:</strong> {conversa.ultimaMensagem}</p>
            <p><strong>Data da Última Mensagem:</strong> {conversa.data?.toLocaleDateString('pt-BR') || 'Data não disponível'}</p>
            <div className='iconOpenForm' onClick={() => handleExpandForm(conversa.conversaId)}>
              <p><strong>Ver Mensagens</strong></p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ListaConversas;
