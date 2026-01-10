import firebase from "firebase/app";
import 'firebase/firestore';
import { idGoogleCap, primeiroNomeCap , emailCap , picGoogleCap ,fullnameCap } from "../../App";

export const firebaseConfig = {
    apiKey: "AIzaSyAhSNGCUOM_nRiVwtRmmPz9o6ciQA6lSYA",
    authDomain: "teste-aa015.firebaseapp.com",
    projectId: "teste-aa015",
    storageBucket: "teste-aa015.appspot.com",
    messagingSenderId: "99960275074",
    appId: "1:99960275074:web:e2923f7e34a0c0c18c749b"
};

// Inicialização do Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Instância do Firestore
const db = firebase.firestore();

// Função para criar ID único de conversa
export const criarIdConversa = (userRemetente, idDestinatario) => {
  const idsOrdenados = [userRemetente, idDestinatario].sort();
  const numeroAleatorio = Math.floor(Math.random() * 100000); // número entre 0 e 99999
  return `${idsOrdenados[0]}${numeroAleatorio}_${idsOrdenados[1]}`;
};

// Função para criar ID único de chat
export const criarIdChat = () => {
  return db.collection('dummy').doc().id;
};

// Envia uma nova mensagem e atualiza a conversa
export const enviarChat = async ({ idContato, idConversa, userRemetente, mensagem }) => {
  try {
    const conversaRef = db
      .collection('contatos')
      .doc(idContato)
      .collection('conversas')
      .doc(idConversa);

    const conversaDoc = await conversaRef.get();
    if (!conversaDoc.exists) {
      console.error('Erro: Conversa não encontrada.');
      return;
    }

    const idChat = criarIdChat();

    await conversaRef.collection('chat').doc(idChat).set({
      mensagem: mensagem,
      data: firebase.firestore.FieldValue.serverTimestamp(),
      userRemetente: userRemetente,
      idConversa: idConversa,
      idChat: idChat,
    });

    await conversaRef.update({
      ultimaMensagem: mensagem,
      dataUltimaMensagem: firebase.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection('contatos').doc(idContato).update({
      ultimaConversaData: firebase.firestore.FieldValue.serverTimestamp(),
    });

    console.log('Mensagem enviada com sucesso!');
  } catch (error) {
    console.error('Erro ao enviar chat:', error);

    console.log(idContato, idConversa, userRemetente,mensagem)
  }
};



// Envia uma nova mensagem e cria uma nova conversa se necessário
export const enviarMensagem = async (skinLogado, idDestinatario, assunto, mensagem, valorTextareaEmail) => {
  const contatoRef = db.collection('contatos').doc();
  const idContato = contatoRef.id;
  let idConversa;

  try {
    const contatoRef = db.collection('contatos').doc(idContato);

    await contatoRef.set({
      idContato,
      ultimaConversaData: firebase.firestore.FieldValue.serverTimestamp(),
      skinRemetente: skinLogado,
      skinDestinatario: 'savannaoliveira',
    }, { merge: true });

    idConversa = !assunto ? 'principal' : criarIdChat();

    console.log(skinLogado+"Aquiiii!");

    const conversaRef = contatoRef.collection('conversas').doc(idConversa);

    const conversaDoc = await conversaRef.get();
    if (!conversaDoc.exists) {
      await conversaRef.set({
        assunto: assunto || 'PRINCIPAL',
        data: firebase.firestore.FieldValue.serverTimestamp(),
        idContato,
        idConversa,
        ultimaMensagem: mensagem,
        email: valorTextareaEmail,
        dataUltimaMensagem: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await conversaRef.update({
        ultimaMensagem: mensagem,
        dataUltimaMensagem: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }

    const idChat = criarIdChat();
    await conversaRef.collection('chat').doc(idChat).set({
      mensagem,
      data: firebase.firestore.FieldValue.serverTimestamp(),
      userRemetente: skinLogado,
      idConversa,
      idChat,
    });


  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
  }
};

// Verifica se o usuário existe e atualiza ou cria o usuário
export const verificaUser = async (campo, valor) => {
  try {
    const query = db.collection("users").where(campo, '==', valor);
    const snapshot = await query.get();

    if (!snapshot.empty) {
      for (const doc of snapshot.docs) {
        const loginSubcollectionRef = doc.ref.collection('logins');
        await loginSubcollectionRef.add({
          data: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }
    } else {
      const idGoogle = idGoogleCap;
      const nomeGoogle = primeiroNomeCap;
      const emailGoogle = emailCap;
      const picGoogle = picGoogleCap;
      const nomeCompletoGoogle = fullnameCap;
      const data = new Date();

      const user = db.collection("users");

      const id = idGoogle;

      const newUser = {
        idGoogle,
        nomeGoogle,
        nomeCompletoGoogle,
        emailGoogle,
        picGoogle,
        data,
        isAdmin: false,
      };

      await user.doc(id).set(newUser);

      const userDocRef = user.doc(id);
      const loginSubcollectionRef = userDocRef.collection('logins');

      await loginSubcollectionRef.add({
        data: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('Erro ao verificar usuário:', error);
  }
};

export { db };
