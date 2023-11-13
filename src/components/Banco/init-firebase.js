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
  

  
export function verificaLogin(){
   
    var verificacao = document.getElementById('verifiedEmail');
    verificacao = verificacao.textContent;
 
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
    
    
    if(verificacao=="true"){ 
 
 
        let bd = firebase.firestore();
        let data = new Date();
        
 
        bd.collection("usuaries").doc('$idGoogle').get().then(function(doc){
 
        if(doc.exists){
 
 
            console.log("USUÁRIO EXISTE");
        
 
    }else{
       
     if(idGoogle==113891358948396359936){
 
       console.log("Savanna");
       
     }else{
 
       
       const user = firebase.firestore().collection("login");
 
        const novoLogin = {
        idGoogle: idGoogle,    
        nomeGoogle: nomeGoogle,
        nomeCompletoGoogle: nomeCompletoGoogle,
        emailGoogle: emailGoogle,
        picGoogle: picGoogle,
        data: data,
        };
 
        user.add(novoLogin);
 
        console.log("LOGIN EFETUADO!");
     }
        
    }
 
 });
 
 
        
    }
 };

 export function fazerContato(assunto, mensagem){

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
        
 
        const user = firebase.firestore().collection("mensagens");
 
        const novaMensagem = {
        idGoogle: idGoogle,    
        nomeGoogle: nomeGoogle,
        nomeCompletoGoogle: nomeCompletoGoogle,
        emailGoogle: emailGoogle,
        picGoogle: picGoogle,
        data: data,
        assunto: assunto,
        mensagem: mensagem, 
        };
 
        user.add(novaMensagem);
 
        console.log("MENSAGEM ENVIADA");
};

















