import React, { useState, useEffect } from 'react';
import firebase from 'firebase/app';
import 'firebase/firestore';
import { idGoogle, nomeCompleto } from '../../../../App.jsx';

import './formularios.css';

function Formularios() {
  const [formularios, setFormularios] = useState([]);
  const [resposta, setResposta] = useState('');
  const [expandedForm, setExpandedForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formToDelete, setFormToDelete] = useState(null);
  const [expandedFormRespostas, setExpandedFormRespostas] = useState([]);

  const carregarRespostas = async (usuarioId, formId) => {
    const respostasCollection = firebase.firestore()
      .collection('users')
      .doc(usuarioId)
      .collection('formularios')
      .doc(formId)
      .collection('respostas');

    const respostasSnapshot = await respostasCollection.get();

    return respostasSnapshot.docs.map((respostaDoc) => ({
      nomeGoogle: respostaDoc.data().nomeGoogle,
      resposta: respostaDoc.data().resposta,
      data: respostaDoc.data().data.toDate().toLocaleDateString('pt-BR'),
    }));
  };

  const renderExpandedForm = (formulario) => {
    if (!formulario || !formulario.data) {
      return null;
    }

    return (
      <div>
        <div className='contentPageDetForm'>
          <p>{formulario.nomeCompletoGoogle}</p>
          <p><strong>ID:</strong> {formulario.usuarioId}</p>
          <p><strong>Mensagem:</strong> {formulario.mensagem}</p>
          <p><strong>Discussões:</strong></p>
          <ul>
            {expandedFormRespostas.map((resposta, index) => (
              <li key={index}>
                {resposta.nomeGoogle} <br />
                {resposta.resposta} - {resposta.data}
              </li>
            ))}
          </ul>
        </div>
        <div className="back-detail" onClick={() => toggleExpand(null)}> ❮❮ </div>
        <div className='boxResposta'>
          <div>
            <input
              type="text"
              placeholder="Digite sua resposta..."
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
            />
            <button onClick={() => enviarResposta(formulario.usuarioId, formulario.formId)}>
              Enviar Resposta
            </button>
          </div>
          <button onClick={() => deleteForm(formulario)}>
            Excluir Formulário
          </button>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const carregarFormularios = async () => {
      try {
        const usersCollection = firebase.firestore().collection('users');
        const usersSnapshot = await usersCollection.get();

        const listeners = usersSnapshot.docs.map((userDoc) => {
          if (userDoc.id === idGoogle && idGoogle !== '113891358948396359936') {
            return userDoc.ref.collection('formularios').onSnapshot((formulariosSnapshot) => {
              const listaFormularios = formulariosSnapshot.docs.map((formDoc) => {
                return {
                  usuarioId: userDoc.id,
                  formId: formDoc.id,
                  nomeCompletoGoogle: userDoc.data().nomeCompletoGoogle,
                  assunto: formDoc.data().assunto,
                  data: formDoc.data().data.toDate().toLocaleDateString('pt-BR'),
                  mensagem: formDoc.data().mensagem,
                  respostas: [],
                };
              });

              setFormularios(listaFormularios);
            });
          } else {
            const listeners = usersSnapshot.docs.map((userDoc) => {
              const user = userDoc.data();
              const formulariosCollection = userDoc.ref.collection('formularios');

              return formulariosCollection.onSnapshot((formulariosSnapshot) => {
                const listaFormularios = formulariosSnapshot.docs.map((formDoc) => {
                  return {
                    usuarioId: userDoc.id,
                    formId: formDoc.id,
                    nomeCompletoGoogle: userDoc.data().nomeCompletoGoogle,
                    assunto: formDoc.data().assunto,
                    data: formDoc.data().data.toDate().toLocaleDateString('pt-BR'),
                    mensagem: formDoc.data().mensagem,
                    respostas: [],
                  };
                });

                setFormularios((prevFormularios) => {
                  const updatedFormularios = prevFormularios.filter(
                    (prevForm) => prevForm.usuarioId !== userDoc.id
                  );

                  return [...updatedFormularios, ...listaFormularios];
                });
              });
            });
          }

          return null;
        });

        return () => {
          listeners.forEach((listener) => {
            listener();
          });
        };
      } catch (error) {
        console.error('Erro ao carregar formulários:', error);
      }
    };

    carregarFormularios();
  }, [idGoogle, resposta]);

  useEffect(() => {
    const carregarRespostasExpandidas = async () => {
      if (expandedForm) {
        const respostaExpandida = await carregarRespostas(expandedForm.usuarioId, expandedForm.formId);
        setExpandedFormRespostas(respostaExpandida);
      }
    };

    carregarRespostasExpandidas();
  }, [expandedForm]);

  const enviarResposta = async (usuarioId, formId) => {
    try {
      const usersCollection = firebase.firestore().collection('users');
      const userDoc = await usersCollection.doc(usuarioId).get();

      const formulariosCollection = userDoc.ref.collection('formularios');
      const formDoc = await formulariosCollection.doc(formId).get();

      const respostasCollection = formDoc.ref.collection('respostas');

      const idGoogleValue = idGoogle;
      const nomeGoogleValue = nomeCompleto;

      await respostasCollection.add({
        resposta: resposta,
        data: new Date(),
        idGoogle: idGoogleValue,
        nomeGoogle: nomeGoogleValue,
      });

      const novaResposta = {
        resposta: resposta,
        data: new Date().toLocaleDateString('pt-BR'),
        idGoogle: idGoogleValue,
        nomeGoogle: nomeGoogleValue,
      };

      setExpandedFormRespostas((prevRespostas) => [...prevRespostas, novaResposta]);

      setFormularios((prevFormularios) =>
        prevFormularios.map((formulario) =>
          formulario.usuarioId === usuarioId && formulario.formId === formId
            ? { ...formulario, respostas: [...formulario.respostas, novaResposta] }
            : formulario
        )
      );

      setResposta('');
    } catch (error) {
      console.error('Erro ao enviar resposta:', error);
    }
  };

  const toggleExpand = (formId) => {
    setExpandedForm((prevForm) => (prevForm === formId ? null : formId));
  };

  const deleteForm = (formulario) => {
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

      setFormularios((prevFormularios) =>
        prevFormularios.filter(
          (formulario) => !(formulario.usuarioId === formToDelete.usuarioId && formulario.formId === formToDelete.formId)
        )
      );

      setExpandedForm(null);
      setConfirmDelete(false);
      setFormToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir formulário:', error);
    }
  };

  return (
    <div className='pageMenu'>
      {expandedForm ? (
        <>
          {renderExpandedForm(expandedForm)}
        </>
      ) : (
        <ul>
          <h2 className='tituloPageMenu'>MENSAGENS</h2>
          <div className='contentPageMenu'>
            {formularios.map((formulario) => (
              <div className='boxItemForm' key={`${formulario.usuarioId}-${formulario.formId}`}>
                <p> {formulario.nomeCompletoGoogle}</p>
                <p><strong>Assunto:</strong> {formulario.assunto}</p>
                <p><strong>Data de envio:</strong> {formulario.data}</p>
                <div className='iconOpenForm' onClick={() => toggleExpand(formulario)}>
                  <p><strong> 🗨 CHAT </strong></p> 
                </div>
              </div>
            ))}
          </div>
        </ul>
      )}

      {confirmDelete && formToDelete && (
        <div>
          <p>Tem certeza que deseja excluir este formulário?</p>
          <button onClick={confirmDeleteForm}>Sim</button>
          <button onClick={() => { setConfirmDelete(false); setFormToDelete(null); }}>Não</button>
        </div>
      )}
    </div>
  );
}

export default Formularios;
