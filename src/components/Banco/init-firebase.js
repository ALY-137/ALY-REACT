import firebase from "firebase/app";
import 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAhSNGCUOM_nRiVwtRmmPz9o6ciQA6lSYA",
    authDomain: "teste-aa015.firebaseapp.com",
    projectId: "teste-aa015",
    storageBucket: "teste-aa015.appspot.com",
    messagingSenderId: "99960275074",
    appId: "1:99960275074:web:e2923f7e34a0c0c18c749b"
  };
  

firebase.initializeApp(firebaseConfig);
  

export const fazerContato = async (valor, assunto, mensagem) => {
  try {
    const userCollection = firebase.firestore().collection("user");

    // Consulta para verificar se o usuário já existe na coleção "user"
    const query = userCollection.where('idGoogle', '==', valor);
    const snapshot = await query.get();

    if (!snapshot.empty) {
      // Usuário encontrado, adiciona a mensagem na subcoleção 'mensagem' do usuário existente
      snapshot.forEach(async (doc) => {
        const mensagemSubcollectionRef = doc.ref.collection('mensagem');
        await mensagemSubcollectionRef.add({
          assunto: assunto,
          mensagem: mensagem,
          data: firebase.firestore.FieldValue.serverTimestamp(),
        });

       
      });
    } else {
      console.log('Usuário não encontrado. Mensagem não registrada.');
    }
  } catch (error) {
    console.error('Erro ao verificar usuário e enviar mensagem:', error);
  }
};

;

export const verificaUser = async (campo, valor) => {
  try {
    const bd = firebase.firestore();
    const query = bd.collection("user").where(campo, '==', valor);
    const snapshot = await query.get();
   

    if (!snapshot.empty) {

      for (const doc of snapshot.docs) {
            
            const loginSubcollectionRef = doc.ref.collection('login');
            await loginSubcollectionRef.add({
              data: firebase.firestore.FieldValue.serverTimestamp(),          
            });
      }   
      
    } else {

          var idGoogle = document.getElementById('sub');
          idGoogle = idGoogle.textContent;
      
          var nomeGoogle = document.getElementById('given_name');
          nomeGoogle = nomeGoogle.textContent;
      
          var emailGoogle = document.getElementById('email');
          emailGoogle = emailGoogle.textContent;
      
          var picGoogle = document.getElementById('picture');
          picGoogle = picGoogle.src;
      
          var nomeCompletoGoogle = document.getElementById('fullName');
          nomeCompletoGoogle = nomeCompletoGoogle.textContent;
      

          let data = new Date();
       
          const user = firebase.firestore().collection("user");
    
          const newUser = {
          idGoogle: idGoogle,    
          nomeGoogle: nomeGoogle,
          nomeCompletoGoogle: nomeCompletoGoogle,
          emailGoogle: emailGoogle,
          picGoogle: picGoogle,
          data: data,
          };

          const userDocRef = await user.add(newUser);

          const loginSubcollectionRef =  userDocRef.collection('login');
  
          await loginSubcollectionRef.add({
            data: firebase.firestore.FieldValue.serverTimestamp(),
          });
    
 

    }
  } catch (error) {
    console.error('Erro ao verificar usuário:', error);
  }
};





