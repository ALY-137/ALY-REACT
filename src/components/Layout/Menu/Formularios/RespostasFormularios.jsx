import React, { useState, useEffect } from 'react';
import firebase from 'firebase/app';
import 'firebase/firestore';
import { nomeCompleto } from '../../../../App.jsx';
import './formularios.css';

function RespostasFormularios({ formulario, closeExpandedForm }) {
  const [resposta, setResposta] = useState('');
  const [expandedFormRespostas, setExpandedFormRespostas] = useState([]);

  const carregarRespostas = async (usuarioId, formId) => {
    const respostasCollection = firebase.firestore()
      .collection('users')
      .doc(usuarioId)
      .collection('formularios')
      .doc(formId)
      .collection('respostas');

    const respostasSnapshot = await respostasCollection.orderBy('data').get();
    const usersCollection = firebase.firestore().collection('users');

    const respostasComFotos = await Promise.all(
      respostasSnapshot.docs.map(async (respostaDoc) => {
        const respostaData = respostaDoc.data();
        const userDoc = await usersCollection.doc(respostaData.idGoogle).get();
        const userData = userDoc.data();

        return {
          ...respostaData,
          data: respostaData.data.toDate(),
          picGoogle: userData.picGoogle,
        };
      })
    );

    return respostasComFotos;
  };

  useEffect(() => {
    const carregarRespostasExpandidas = async () => {
      if (formulario) {
        const respostaExpandida = await carregarRespostas(formulario.usuarioId, formulario.formId);
        setExpandedFormRespostas(respostaExpandida);
      }
    };

    carregarRespostasExpandidas();
  }, [formulario]);

  const enviarResposta = async (usuarioId, formId) => {
    try {
      const usersCollection = firebase.firestore().collection('users');
      const userDoc = await usersCollection.doc(usuarioId).get();
      const formulariosCollection = userDoc.ref.collection('formularios');
      const formDoc = await formulariosCollection.doc(formId).get();
      const respostasCollection = formDoc.ref.collection('respostas');

      const idGoogleValue = firebase.auth().currentUser.uid;
      const nomeGoogleValue = firebase.auth().currentUser.displayName;

      await respostasCollection.add({
        resposta: resposta,
        data: new Date(),
        idGoogle: idGoogleValue,
        nomeGoogle: nomeGoogleValue,
      });

      const novaResposta = {
        resposta: resposta,
        data: new Date(),
        idGoogle: idGoogleValue,
        nomeGoogle: nomeGoogleValue,
        picGoogle: firebase.auth().currentUser.photoURL,
      };

      setExpandedFormRespostas((prevRespostas) => [...prevRespostas, novaResposta]);

      setResposta('');
    } catch (error) {
      console.error('Erro ao enviar resposta:', error);
    }
  };

  return (
    <div className='contentPageDetForm'>
      <div className='contentChat'>
       
        <p><strong>Mensagem:</strong> {formulario.mensagem}</p>
  
        <div>
          {expandedFormRespostas.map((resposta, index) => {
            const mostrarFoto = resposta.nomeGoogle !== nomeCompleto && (index === 0 || expandedFormRespostas[index - 1].nomeGoogle !== resposta.nomeGoogle);
            return (
              <div className='chat-container' key={index}>
                {index === 0 || expandedFormRespostas[index - 1].data.toDateString() !== resposta.data.toDateString() ? (
                  <div className='dataResposta'>
                    {resposta.data.toLocaleDateString('pt-BR')}
                  </div>
                ) : null}
                <div className={`resposta-item ${resposta.nomeGoogle === nomeCompleto ? 'resposta-enviada' : 'resposta-recebida'} ${!mostrarFoto ? 'sem-foto' : ''}`}>
                  {mostrarFoto && (
                    <img className='fotoUsuario' src={resposta.picGoogle} alt="User" />
                  )}
                  <div className='resposta-texto'>{resposta.resposta}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className='boxResposta'>
        <input
          type="text"
          className='inputResposta'
          placeholder="Digite sua resposta..."
          value={resposta}
          onChange={(e) => setResposta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              enviarResposta(formulario.usuarioId, formulario.formId);
            }
          }}
        />
        <div className="buttonWrapper">
          <div className='buttonEnviarResp' onClick={() => enviarResposta(formulario.usuarioId, formulario.formId)}>
            ✔
          </div>
        </div>
      </div>
    </div>
  );
}

export default RespostasFormularios;
