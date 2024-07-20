import firebase from 'firebase/app';
import 'firebase/firestore';

const ExcluirFormulario = async (formToDelete) => {
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
  } catch (error) {
    console.error('Erro ao excluir formulário:', error);
    throw error;
  }
};

export default ExcluirFormulario;
