import React, { useState, useEffect } from 'react';
import firebase from 'firebase/app';
import 'firebase/firestore';
import './formularios.css';

function ListaContatos({ setBackText, setAtualTxt, handleExpandForm }) {
  const [contatos, setContatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = firebase.firestore()
      .collection('contatos')
      .orderBy('ultimaConversaData', 'desc') // Ordena pela data da última conversa em ordem decrescente
      .onSnapshot(
        (snapshot) => {
          const listaContatos = snapshot.docs.map((contatoDoc) => ({
            contatoId: contatoDoc.id,
            nome: contatoDoc.data().nome || 'Nome não disponível',
            ultimaConversaData: contatoDoc.data().ultimaConversaData?.toDate() || new Date(0), // Fallback para data mínima
          }));

          setContatos(listaContatos);
          setLoading(false);
        },
        (error) => {
          setError('Erro ao carregar contatos.');
          console.error('Erro ao carregar contatos:', error);
          setLoading(false);
        }
      );

    // Limpeza do listener ao desmontar o componente
    return () => unsubscribe();
  }, []);

  return (
    <div>
      {loading && <p>Carregando contatos...</p>}
      {error && <p>{error}</p>}
      {!loading && !error && contatos.length === 0 && <p>Não há contatos.</p>}
      
      <div className='pageContentForms'>
        {contatos.map((contato) => (
          <div className='boxItemContato' onClick={() => handleExpandForm(contato.contatoId)} key={contato.contatoId}>
            <p><strong>ID do Contato:</strong> {contato.contatoId}</p>
            <p><strong>Nome:</strong> {contato.nome}</p>
            <p><strong>Última Conversa:</strong> {contato.ultimaConversaData.toLocaleDateString('pt-BR')}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ListaContatos;
