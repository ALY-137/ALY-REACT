import { useEffect, useState } from 'react';
import React from 'react';
import './App.css';

import violet from './home';
import blue from './dev';
import pink from './design';
import layout from './layout';


import { jwtDecode } from 'jwt-decode';
import Estrutura from './components/Layout/Estrutura';


import {useLocation} from 'react-router-dom';

import { verificaUser } from './components/Banco/init-firebase';

let idGoogle;

function App(){


  const location = useLocation();

  const rotaAtual = location.pathname;


  const [ , setUser] = useState({})

  function handleCallbackResponse(response){

    const useObject = jwtDecode(response.credential);
    console.log(useObject);
    setUser(useObject);
    document.getElementById('signInDiv').hidden = true;
    window.given_name.textContent = useObject.given_name;
    window.fullName.textContent = useObject.name
    window.sub.textContent = useObject.sub
    window.family_name.textContent = useObject.family_name
    window.email.textContent = useObject.email
    window.verifiedEmail.textContent = useObject.email_verified
    window.picture.setAttribute("src", useObject.picture)

    const login = document.getElementById('login');
    login.style.display = "none";

    const camp = 'idGoogle';
    idGoogle = useObject.sub;

   
    verificaUser(camp, idGoogle);


    layout(); 


    switch (rotaAtual) {
      case '/':
      case '/home/':
      case '/home':
          violet();
          break;
      case '/development/':
      case '/development':
          blue();
          break;
      case '/design/':
      case '/design':
          pink();
          break;
      default:
  }

   
  }

  

  useEffect  (() =>{

  

   window.google.accounts.id.initialize({
      client_id: "99960275074-f5d0bnogv6a9oq1ui4pkrbou60ffh43f.apps.googleusercontent.com",
      callback: handleCallbackResponse
   });

   window.google.accounts.id.renderButton(

    document.getElementById("signInDiv"),{
      theme: "outline", 
      size: "large",
      type:"icon",
      shape:"retangular",
      text:"$ {button.text}",
      locale:"pt-BR"
    }
   )
  },[])



  


  return ( 

    
        <div> 
          
            <Estrutura />

            <div id='login'> 
                  <div id='iconsLogin'>
                              <img src='/logoNeon.png' id='logoLogin' />
                              <p id='logoTxt'>ALY-137©</p>
                              <p id='textoLogin'>EMBARQUE COM O GOOGLE</p>
                              <div id="signInDiv"></div> 
                            </div>
                  <p id='rodapeLogin'>ALY-137© 2023</p>  
            </div>

          
            
     
            <p id="fullName"></p>
            <p id="sub"></p>
            <p id="given_name"></p>
            <p id="family_name"></p>
            <p id="email"></p>
            <p id="verifiedEmail"></p>
            <img id="picture" />
          



        </div>
     
                      

    )


 
}

   


export { idGoogle }; 
export default App;
