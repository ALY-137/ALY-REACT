import React, { useState, useEffect } from 'react';
import firebase from 'firebase/app';
import 'firebase/firestore';
import { idGoogle, nomeCompleto } from '../../../../App.jsx';
import './formularios.css';

function RespostasFormularios({ formulario, closeExpandedForm }) {
  const [resposta, setResposta] = useState('');
  const [expandedFormRespostas, setExpandedFormRespostas] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formToDelete, setFormToDelete] = useState(null);

  useEffect(() => {
    const carregarRespostas = async () => {
      try {
        const respostasCollection = firebase.firestore()
          .collection('users')
          .doc(formulario.usuarioId)
          .collection('formularios')
          .doc(formulario.formId)
          .collection('respostas');

        const respostasSnapshot = await respostasCollection.orderBy('data').get();
        const usersCollection = firebase.firestore().collection('users');
        const userDoc = await usersCollection.doc(formulario.usuarioId).get();
        const userData = userDoc.data();

        const respostas = respostasSnapshot.docs.map((respostaDoc) => ({
          nomeGoogle: respostaDoc.data().nomeGoogle,
          resposta: respostaDoc.data().resposta,
          data: respostaDoc.data().data.toDate(),
          picGoogle: userData.picGoogle,
        }));

        setExpandedFormRespostas(respostas);
      } catch (error) {
        console.error('Erro ao carregar respostas:', error);
      }
    };

    carregarRespostas();
  }, [formulario]);

  const enviarResposta = async () => {
    try {
      const usersCollection = firebase.firestore().collection('users');
      const userDoc = await usersCollection.doc(formulario.usuarioId).get();

      const formulariosCollection = userDoc.ref.collection('formularios');
      const formDoc = await formulariosCollection.doc(formulario.formId).get();

      const respostasCollection = formDoc.ref.collection('respostas');

      await respostasCollection.add({
        resposta: resposta,
        data: new Date(),
        idGoogle: idGoogle,
        nomeGoogle: nomeCompleto,
      });

      const novaResposta = {
        resposta: resposta,
        data: new Date(),
        idGoogle: idGoogle,
        nomeGoogle: nomeCompleto,
      };

      setExpandedFormRespostas((prevRespostas) => [...prevRespostas, novaResposta]);
      setResposta('');
    } catch (error) {
      console.error('Erro ao enviar resposta:', error);
    }
  };

  const deleteForm = () => {
    setConfirmDelete(true);
    setFormToDelete(formulario);
  };

  const confirmDeleteForm = async () => {
    try {
      const usersCollection = firebase.firestore().collection('users');
      const userDoc = await usersCollection.doc(formToDelete.usuarioId).get();

      const formulariosCollection = userDoc.ref.collection('formularios');
      const formDoc = await formulariosCollection.doc(formToDelete.formId).get();

      const respostasCollection = formDoc.ref.collection('respostas');
      const respostasSnapshot = await respostasCollection.get();
      respostasSnapshot.forEach(async (respostaDoc) => {
        await respostaDoc.ref.delete();
      });

      await formDoc.ref.delete();

      closeExpandedForm();
      setConfirmDelete(false);
      setFormToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir formulário:', error);
    }
  };

  return (
    <div className='contentPageDetForm'>
      <div className='contentChat'>
        <div className='buttonExcluirForm' onClick={deleteForm}>
          🗑 EXCLUIR
        </div>
        {formulario ? (
          <>
            <p><strong>Mensagem:</strong> {formulario.mensagem}</p>
            <p><strong>Discussões:</strong></p>
            <div>
              {expandedFormRespostas.map((resposta, index) => (
                <div className='chat-container' key={index}>
                  <div className='dataResposta'>
                    {index === 0 || expandedFormRespostas[index - 1].data.toDateString() !== resposta.data.toDateString() 
                      ? resposta.data.toLocaleDateString('pt-BR') 
                      : ''}
                  </div>
                  <div className={`resposta-item ${resposta.nomeGoogle === nomeCompleto ? 'resposta-enviada' : 'resposta-recebida'}`}>
                    {resposta.nomeGoogle !== nomeCompleto && (
                      <img className='fotoUsuario' src={resposta.picGoogle} alt="User" />
                    )}
                    <div className='resposta-texto'>{resposta.resposta}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p>Carregando...</p>
        )}
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
              enviarResposta();
            }
          }}
        />
        <div className="buttonWrapper">
          <div className='buttonEnviarResp' onClick={enviarResposta}>
            ✔
          </div>
        </div>
      </div>

      {confirmDelete && (
        <div className='excluirForm'>
          <p>Tem certeza que deseja excluir este formulário?</p>
          <div className='buttonsExcluir'>
            <button onClick={confirmDeleteForm}>Sim</button>
            <button onClick={() => { setConfirmDelete(false); setFormToDelete(null); }}>Não</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default RespostasFormularios;
