import React, { useState, useEffect, useRef } from 'react';
import firebase from 'firebase/app';
import 'firebase/firestore';
import './formularios.css';
import { useParams } from 'react-router-dom';
import { enviarChat } from '../../../Banco/init-firebase.js';

function Chat({ closeExpandedForm }) {
  const { contactId, conversationId } = useParams(); // Obtém contactId e conversationId da URL
  const [mensagem, setMensagem] = useState('');
  const [chatMensagens, setChatMensagens] = useState([]);
  const contentChatRef = useRef(null);



  const skinLogadoUser = localStorage.getItem('skinLogadoUser');


useEffect(() => {
  const unsubscribe = firebase.firestore()
    .collection('contatos')
    .doc(contactId)
    .collection('conversas')
    .doc(conversationId)
    .collection('chat')
    .orderBy('data')
    .onSnapshot(async (snapshot) => {
      const mensagens = await Promise.all(snapshot.docs.map(async (doc) => {
        const chatData = doc.data();



        const skinSnapshot = await firebase.firestore()
          .collectionGroup('skins')
          .where('username', '==', chatData.userRemetente)
          .limit(1)
          .get();

        let iconSkin = null;
        if (!skinSnapshot.empty) {
          iconSkin = skinSnapshot.docs[0].data().iconSkin;
        }

        return {
          ...chatData,
          data: chatData.data ? chatData.data.toDate() : null,
          iconSkin: iconSkin,
        };
      }));



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
    if (mensagem.trim() === '') {
      return; // Não enviar se a mensagem estiver vazia
    }

    try {

      await enviarChat({
        idContato: contactId, // Usa contactId
        idConversa: conversationId, // Usa conversationId
        userRemetente: skinLogadoUser,
        mensagem: mensagem,

      });
          console.log(skinLogadoUser+"Aquiiii 2!");

      setMensagem(''); // Limpar a mensagem após o envio
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
              {/* Exibe a data da mensagem, caso seja o primeiro chat do dia */}
              {mensagem.data && (index === 0 || chatMensagens[index - 1].data?.toDateString() !== mensagem.data.toDateString()) ? (
                <div className='dataResposta'>
                  {mensagem.data.toLocaleDateString('pt-BR')}
                </div>
              ) : null}

              <div className={`resposta-item ${isSentByMe ? 'resposta-enviada' : 'resposta-recebida'} ${!mostrarFoto ? 'sem-foto' : ''}`}>
                {!isSentByMe && mostrarFoto && (
                  <img className='fotoUsuario' src={mensagem.iconSkin} alt="User" />
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