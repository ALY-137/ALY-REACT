import firebase from "firebase/app";
import 'firebase/firestore';

export const firebaseConfig = {
    apiKey: "AIzaSyAhSNGCUOM_nRiVwtRmmPz9o6ciQA6lSYA",
    authDomain: "teste-aa015.firebaseapp.com",
    projectId: "teste-aa015",
    storageBucket: "teste-aa015.appspot.com",
    messagingSenderId: "99960275074",
    appId: "1:99960275074:web:e2923f7e34a0c0c18c749b"
};

export const db = firebase.initializeApp(firebaseConfig);

// Função para criar ID único de conversa
const criarIdConversa = (idRemetente, idDestinatario) => {
  const idsOrdenados = [idRemetente, idDestinatario].sort();
  return `${idsOrdenados[0]}_${idsOrdenados[1]}`;
};

// Função para criar ID único de chat
const criarIdChat = () => {
  return firebase.firestore().collection('dummy').doc().id;
};

// Envia uma nova mensagem e atualiza a conversa
export const enviarChat = async ({ idContato, idConversa, idRemetente, mensagem }) => {
  try {
    const db = firebase.firestore();

    // Referência ao documento da conversa
    const conversaRef = db
      .collection('contatos')
      .doc(idContato)
      .collection('conversas')
      .doc(idConversa);

    // Verifica se a conversa existe
    const conversaDoc = await conversaRef.get();
    if (!conversaDoc.exists) {
      console.error('Erro: Conversa não encontrada.');
      return;
    }

    // Cria um ID único para a nova mensagem
    const idChat = criarIdChat();

    // Adiciona a nova mensagem à subcoleção "chat"
    await conversaRef.collection('chat').doc(idChat).set({
      mensagem: mensagem,
      data: firebase.firestore.FieldValue.serverTimestamp(),
      idRemetente: idRemetente,
      idConversa: idConversa,
      idChat: idChat, // ID único para a mensagem
    });

    // Atualiza a última mensagem e o timestamp da conversa
    await conversaRef.update({
      ultimaMensagem: mensagem, // Atualiza o campo ultimaMensagem com o conteúdo da última mensagem
      dataUltimaMensagem: firebase.firestore.FieldValue.serverTimestamp(), // Atualiza o timestamp da última mensagem
    });

    // Atualiza a data da última conversa no documento de contato
    await db.collection('contatos').doc(idContato).update({
      ultimaConversaData: firebase.firestore.FieldValue.serverTimestamp(),
    });

    console.log('Mensagem enviada com sucesso!');
  } catch (error) {
    console.error('Erro ao enviar chat:', error);
  }
};

// Envia uma nova mensagem e cria uma nova conversa se necessário
export const enviarMensagem = async (idRemetente, idDestinatario, assunto, mensagem) => {
  const db = firebase.firestore();
  const idContato = criarIdConversa(idRemetente, idDestinatario); 
  const idConversa = criarIdChat(); 

  try {
    const contatoRef = db.collection('contatos').doc(idContato);

    // Cria ou atualiza o contato, incluindo o idContato como um campo
    await contatoRef.set({
      idContato, // Adiciona o ID do contato como um campo
      ultimaConversaData: firebase.firestore.FieldValue.serverTimestamp(), // Adiciona a data da última conversa
    }, { merge: true });

    const conversaRef = contatoRef.collection('conversas').doc(idConversa);

    await conversaRef.set({
      assunto,
      data: firebase.firestore.FieldValue.serverTimestamp(),
      idContato, // Adiciona o ID do contato como uma referência
      idConversa, // Adiciona o ID da conversa como um campo
      ultimaMensagem: mensagem, // Define a última mensagem
      dataUltimaMensagem: firebase.firestore.FieldValue.serverTimestamp(), // Define o timestamp da última mensagem
    });

    const idChat = criarIdChat();

    await conversaRef.collection('chat').doc(idChat).set({
      mensagem,
      data: firebase.firestore.FieldValue.serverTimestamp(),
      idRemetente,
      idConversa,
      idChat,
    });

    console.log('Mensagem enviada e nova conversa criada com sucesso!');
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
  }
};

// Verifica se o usuário existe e atualiza ou cria o usuário
export const verificaUser = async (campo, valor) => {
  try {
    const bd = firebase.firestore();
    const query = bd.collection("users").where(campo, '==', valor);
    const snapshot = await query.get();

    if (!snapshot.empty) {
      for (const doc of snapshot.docs) {
        const loginSubcollectionRef = doc.ref.collection('logins');
        await loginSubcollectionRef.add({
          data: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }
    } else {
      var idGoogle = document.getElementById('sub').textContent;
      var nomeGoogle = document.getElementById('given_name').textContent;
      var emailGoogle = document.getElementById('email').textContent;
      var picGoogle = document.getElementById('picture').src;
      var nomeCompletoGoogle = document.getElementById('fullName').textContent;

      let data = new Date();
    
      const user = firebase.firestore().collection("users");

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
