import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { app } from '../../../Banco/init-firebase.js';
import { getFirestore } from 'firebase/firestore';
const db = getFirestore(app);

import './formularios.css';



function Chat({ closeExpandedForm }) {
  const { contactId, conversationId } = useParams();
  const [mensagem, setMensagem] = useState('');
  const [chatMensagens, setChatMensagens] = useState([]);
  const contentChatRef = useRef(null);

  const skinLogadoUser = localStorage.getItem('skinLogadoUser');

  useEffect(() => {
    const chatRef = collection(db, 'contatos', contactId, 'conversas', conversationId, 'chat');
    const q = query(chatRef, orderBy('data'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const mensagens = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const chatData = docSnap.data();

          // Busca ícone da skin do usuário remetente
          const skinQuery = query(
            collectionGroup(db, 'skins'),
            where('username', '==', chatData.userRemetente),
            limit(1)
          );
          const skinSnapshot = await getDocs(skinQuery);

          let iconSkin = null;
          if (!skinSnapshot.empty) {
            iconSkin = skinSnapshot.docs[0].data().iconSkin;
          }

          return {
            ...chatData,
            data: chatData.data ? chatData.data.toDate() : null,
            iconSkin,
          };
        })
      );

      setChatMensagens(mensagens);
    });

    return () => unsubscribe();
  }, [contactId, conversationId]);

  useEffect(() => {
    if (contentChatRef.current) {
      contentChatRef.current.scrollTop = contentChatRef.current.scrollHeight;
    }
  }, [chatMensagens]);

  const handleEnviarChat = async () => {
    if (!mensagem.trim()) return;

    try {
      await enviarChat({
        idContato: contactId,
        idConversa: conversationId,
        userRemetente: skinLogadoUser,
        mensagem,
      });
      setMensagem('');
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  };

  return (
    <div className='contentPageDetForm'>
      <div className='contentChat' ref={contentChatRef}>
        {chatMensagens.map((mensagem, index) => {
          const isSentByMe = mensagem.userRemetente === skinLogadoUser;
          const mostrarFoto = !isSentByMe && (index === 0 || chatMensagens[index - 1].nomeGoogle !== mensagem.nomeGoogle);

          return (
            <div className='chat-container' key={index}>
              {mensagem.data && (index === 0 || chatMensagens[index - 1].data?.toDateString() !== mensagem.data.toDateString()) && (
                <div className='dataResposta'>
                  {mensagem.data.toLocaleDateString('pt-BR')}
                </div>
              )}

              <div className={`resposta-item ${isSentByMe ? 'resposta-enviada' : 'resposta-recebida'} ${!mostrarFoto ? 'sem-foto' : ''}`}>
                {!isSentByMe && mostrarFoto && <img className='fotoUsuario' src={mensagem.iconSkin} alt="User" />}
                <div className='resposta-texto'>{mensagem.mensagem}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className='boxResposta'>
        <input
          type="text"
          className='inputResposta'
          placeholder="Digite sua mensagem..."
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleEnviarChat();
          }}
        />
        <div className="buttonWrapper">
          <button className='buttonEnviarResp' onClick={handleEnviarChat}>✔</button>
        </div>
      </div>
    </div>
  );
}

export default Chat;
