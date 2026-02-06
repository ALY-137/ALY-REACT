import React, { useState, useEffect } from 'react';
import './formularios.css';
import { useNavigate, useParams } from 'react-router-dom';

import {
  collection,
  doc,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  writeBatch,
  deleteDoc
} from 'firebase/firestore';

import { db } from '../../../Banco/init-firebase.js';

function ListaConversas({ setBackText, setAtualTxt, handleExpandForm }) {
  const [conversas, setConversas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const { contactId } = useParams();
  const skinLogadoUser = localStorage.getItem('skinLogadoUser');

  useEffect(() => {
    const conversasRef = collection(
      db,
      'contatos',
      contactId,
      'conversas'
    );

    const q = query(
      conversasRef,
      orderBy('dataUltimaMensagem', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const listaConversas = snapshot.docs.map((docSnap) => ({
          conversaId: docSnap.id,
          assunto: docSnap.data().assunto || 'Sem assunto',
          ultimaMensagem:
            docSnap.data().ultimaMensagem || 'Nenhuma mensagem',
          data: docSnap.data().dataUltimaMensagem?.toDate(),
        }));

        setConversas(listaConversas);
        setLoading(false);
      },
      (error) => {
        console.error('Erro ao carregar conversas:', error);
        setError('Erro ao carregar conversas.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [contactId]);

  // 🔥 Exclui todos os chats da conversa
  const deleteChats = async (idConversa) => {
    const chatsRef = collection(
      db,
      'contatos',
      contactId,
      'conversas',
      idConversa,
      'chats'
    );

    const snapshot = await getDocs(chatsRef);
    const batch = writeBatch(db);

    snapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    await batch.commit();
  };

  const handleDelete = async (idConversa, event) => {
    event.stopPropagation();

    try {
      // 1️⃣ Deleta os chats
      await deleteChats(idConversa);

      // 2️⃣ Deleta a conversa
      await deleteDoc(
        doc(
          db,
          'contatos',
          contactId,
          'conversas',
          idConversa
        )
      );

      // 3️⃣ Atualiza estado local
      const novasConversas = conversas.filter(
        (c) => c.conversaId !== idConversa
      );
      setConversas(novasConversas);

      // 4️⃣ Se não sobrar conversa, remove o contato
      if (novasConversas.length === 0) {
        await deleteDoc(doc(db, 'contatos', contactId));
      }
    } catch (error) {
      console.error('Erro ao deletar conversa:', error);
      setError('Erro ao deletar a conversa.');
    }
  };

  const handleConversaClick = (idConversa) => {
    navigate(
      `/menu/${skinLogadoUser}/contatos/${contactId}/chat/${idConversa}`
    );
  };

  return (
    <div>
      {loading && <p>Carregando conversas...</p>}
      {error && <p>{error}</p>}
      {!loading && !error && conversas.length === 0 && (
        <p>Não há conversas.</p>
      )}

      <div className="pageContentForms">
        {conversas.map((conversa) => (
          <div
            key={conversa.conversaId}
            className="boxItemConversa"
            onClick={() =>
              handleConversaClick(conversa.conversaId)
            }
          >
            <div className="conversaHeader">
              <p>
                <strong>Assunto:</strong> {conversa.assunto}
              </p>
              <button
                className="deleteButton"
                onClick={(event) =>
                  handleDelete(conversa.conversaId, event)
                }
              >
                Excluir
              </button>
            </div>

            <p>
              <strong>Última Mensagem:</strong>{' '}
              {conversa.ultimaMensagem}
            </p>
            <p>
              <strong>Data da Última Mensagem:</strong>{' '}
              {conversa.data
                ? conversa.data.toLocaleDateString('pt-BR')
                : 'Data não disponível'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ListaConversas;
