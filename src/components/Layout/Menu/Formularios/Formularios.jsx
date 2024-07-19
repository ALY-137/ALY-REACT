import React, { useState, useEffect } from 'react';
import firebase from 'firebase/app';
import 'firebase/firestore';
import { idGoogle, nomeCompleto } from '../../../../App.jsx';
import './formularios.css';
import '../menu.css';

function Formularios({ setBackText, setAtualTxt, closeForms, handleExpandForm, expandedForm, closeExpandedForm }) {
  const [formularios, setFormularios] = useState([]);
  const [resposta, setResposta] = useState('');
  const [expandedFormRespostas, setExpandedFormRespostas] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formToDelete, setFormToDelete] = useState(null);

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
      data: respostaDoc.data().data.toDate(), // Certificar que é um objeto Date
    })).sort((a, b) => a.data - b.data); // Ordenar em ordem crescente por data e hora
  };

  const renderExpandedForm = (formulario) => {
    if (!formulario || !formulario.data) {
      return null;
    }

    setBackText("MENSAGENS");
    setAtualTxt(formulario.nomeCompletoGoogle);

    const respostasAgrupadas = expandedFormRespostas.reduce((acc, resposta) => {
      const dataResposta = resposta.data.toLocaleDateString('pt-BR');
      if (!acc[dataResposta]) {
        acc[dataResposta] = [];
      }
      acc[dataResposta].push(resposta);
      return acc;
    }, {});

    return (
      <div className='contentPageDetForm'>
        <div className='contentChat'>
          <div className='buttonExcluirForm' onClick={() => deleteForm(formulario)}>
            🗑 EXCLUIR 
          </div>

          <p><strong>Mensagem:</strong> {formulario.mensagem}</p>
          <p><strong>Discussões:</strong></p>
          <ul>
            {Object.keys(respostasAgrupadas).map((data) => (
              <React.Fragment key={data}>
                <li className='dataResposta'><strong>{data}</strong></li>
                {respostasAgrupadas[data].map((resposta, index) => (
                  <li key={index}>
                    {resposta.nomeGoogle} <br />
                    {resposta.resposta} - {resposta.data.toLocaleTimeString('pt-BR')}
                  </li>
                ))}
              </React.Fragment>
            ))}
          </ul>
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
  };

  useEffect(() => {
    const carregarFormularios = async () => {
      try {
        const usersCollection = firebase.firestore().collection('users');
        const usersSnapshot = await usersCollection.get();

        const listaFormularios = [];

        for (const userDoc of usersSnapshot.docs) {
          const formulariosCollection = userDoc.ref.collection('formularios');
          const formulariosSnapshot = await formulariosCollection.get();

          formulariosSnapshot.docs.forEach((formDoc) => {
            listaFormularios.push({
              usuarioId: userDoc.id,
              formId: formDoc.id,
              nomeCompletoGoogle: userDoc.data().nomeCompletoGoogle,
              assunto: formDoc.data().assunto,
              data: formDoc.data().data.toDate(), // Certificar que é um objeto Date
              mensagem: formDoc.data().mensagem,
              respostas: [],
              ultimaResposta: formDoc.data().ultimaResposta ? formDoc.data().ultimaResposta.toDate() : null,
            });
          });
        }

        listaFormularios.sort((a, b) => (b.ultimaResposta || b.data) - (a.ultimaResposta || a.data)); // Ordenar por última resposta ou data do formulário

        setFormularios(listaFormularios);
      } catch (error) {
        console.error('Erro ao carregar formulários:', error);
      }
    };

    carregarFormularios();
  }, []);

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

      const novaRespostaData = new Date();

      await respostasCollection.add({
        resposta: resposta,
        data: novaRespostaData,
        idGoogle: idGoogleValue,
        nomeGoogle: nomeGoogleValue,
      });

      const novaResposta = {
        resposta: resposta,
        data: novaRespostaData,
        idGoogle: idGoogleValue,
        nomeGoogle: nomeGoogleValue,
      };

      await formDoc.ref.update({ ultimaResposta: novaRespostaData });

      setExpandedFormRespostas((prevRespostas) => [...prevRespostas, novaResposta].sort((a, b) => a.data - b.data));

      setFormularios((prevFormularios) =>
        prevFormularios
          .map((formulario) =>
            formulario.usuarioId === usuarioId && formulario.formId === formId
              ? { ...formulario, respostas: [...formulario.respostas, novaResposta].sort((a, b) => a.data - b.data), ultimaResposta: novaRespostaData }
              : formulario
          )
          .sort((a, b) => (b.ultimaResposta || b.data) - (a.ultimaResposta || a.data))
      );

      setResposta('');
    } catch (error) {
      console.error('Erro ao enviar resposta:', error);
    }
  };

  const toggleExpand = (formulario) => {
    if (expandedForm && expandedForm.formId === formulario.formId) {
      closeExpandedForm();
    } else {
      handleExpandForm(formulario);
    }
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

      closeExpandedForm();
      setConfirmDelete(false);
      setFormToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir formulário:', error);
    }
  };

  return (
    <div>
      {expandedForm ? (
        <>
          {renderExpandedForm(expandedForm)}
        </>
      ) : (
        <ul>
          <div className='pageContentForms'>
            {formularios.map((formulario) => (
              <div className='boxItemForm' key={`${formulario.usuarioId}-${formulario.formId}`}>
                <p>{formulario.nomeCompletoGoogle}</p>
                <p><strong>ID:</strong> {formulario.usuarioId}</p>
                <p><strong>Assunto:</strong> {formulario.assunto}</p>
                <p><strong>Data de envio:</strong> {formulario.data.toLocaleDateString('pt-BR')} {formulario.data.toLocaleTimeString('pt-BR')}</p>
                
                <div className='iconOpenForm' onClick={() => toggleExpand(formulario)}>
                  <p><strong> 🗨 CHAT </strong></p>
                </div>
              </div>
            ))}
          </div>
        </ul>
      )}

      {confirmDelete && formToDelete && (
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

export default Formularios;