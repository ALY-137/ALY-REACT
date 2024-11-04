import React, { useState, useEffect, useRef } from 'react';
import firebase from 'firebase/app';
import 'firebase/firestore';
import './formularios.css';
import { useParams } from 'react-router-dom';
import { idGoogle } from '../../../../App.jsx';
import { enviarChat } from '../../../Banco/init-firebase.js';

function Chat({ closeExpandedForm }) {
  const { contactId, conversationId } = useParams(); // Obtém contactId e conversationId da URL
  const [mensagem, setMensagem] = useState('');
  const [chatMensagens, setChatMensagens] = useState([]);
  const contentChatRef = useRef(null);

  useEffect(() => {
    const unsubscribe = firebase.firestore()
      .collection('contatos')
      .doc(contactId) // Usa contactId
      .collection('conversas')
      .doc(conversationId) // Usa conversationId
      .collection('chat')
      .orderBy('data')
      .onSnapshot(async (snapshot) => {
        const chatComFotos = await Promise.all(
          snapshot.docs.map(async (chatDoc) => {
            const chatData = chatDoc.data();
            const userDoc = await firebase.firestore()
              .collection('users')
              .doc(chatData.idRemetente)
              .get();
            const userData = userDoc.data();

            return {
              ...chatData,
              data: chatData.data ? chatData.data.toDate() : null,
              picGoogle: userData ? userData.picGoogle : null,
              nomeGoogle: userData ? userData.nomeGoogle : null,
            };
          })
        );
        setChatMensagens(chatComFotos);
      });

    return () => unsubscribe();
  }, [contactId, conversationId]);

  useEffect(() => {
    if (contentChatRef.current) {
      contentChatRef.current.scrollTop = contentChatRef.current.scrollHeight;
    }
  }, [chatMensagens]);

  const handleEnviarChat = async () => {
    if (mensagem.trim() === '') {
      return; // Não enviar se a mensagem estiver vazia
    }

    try {
      await enviarChat({
        idContato: contactId, // Usa contactId
        idConversa: conversationId, // Usa conversationId
        idRemetente: idGoogle,
        mensagem: mensagem,
      });

      setMensagem(''); // Limpar a mensagem após o envio
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  };

  return (
    <div className='contentPageDetForm'>
      <div className='contentChat' ref={contentChatRef}>
        {chatMensagens.map((mensagem, index) => {
          const isSentByMe = mensagem.idRemetente === idGoogle;
          const mostrarFoto = !isSentByMe && (index === 0 || chatMensagens[index - 1].nomeGoogle !== mensagem.nomeGoogle);

          return (
            <div className='chat-container' key={index}>
              {/* Exibe a data da mensagem, caso seja o primeiro chat do dia */}
              {mensagem.data && (index === 0 || chatMensagens[index - 1].data?.toDateString() !== mensagem.data.toDateString()) ? (
                <div className='dataResposta'>
                  {mensagem.data.toLocaleDateString('pt-BR')}
                </div>
              ) : null}

              <div className={`resposta-item ${isSentByMe ? 'resposta-enviada' : 'resposta-recebida'} ${!mostrarFoto ? 'sem-foto' : ''}`}>
                {!isSentByMe && mostrarFoto && (
                  <img className='fotoUsuario' src={mensagem.picGoogle} alt="User" />
                )}
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
            if (e.key === 'Enter') {
              handleEnviarChat();
            }
          }}
        />
        <div className="buttonWrapper">
          <button className='buttonEnviarResp' onClick={handleEnviarChat}>
            ✔
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chat;