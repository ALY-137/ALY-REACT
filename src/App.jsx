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


function App(){


  const location = useLocation();

  const rotaAtual = location.pathname;


  const [ , setUser] = useState({})

  function handleCallbackResponse(response){

    console.log("Token: " + response.credential );
    const useObject = jwtDecode(response.credential);
    console.log(useObject);
    setUser(useObject);
    document.getElementById('signInDiv').hidden = true;
    window.given_name.textContent = useObject.given_name;

    const login = document.getElementById('login');
    login.style.display = "none";


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
                              <p id='textoLogin'>ENTRE COM O GOOGLE</p>
                              <div id="signInDiv"></div> 
                            </div>
                  <p id='rodapeLogin'>ALY-137© 2023</p>  
            </div>

          
            
            <p id="given_name" ></p>
          



        </div>
     
                      

    )


 
}

   



export default App;
