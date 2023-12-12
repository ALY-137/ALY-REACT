import Navbar from "./Navbar/Navbar";
import {Outlet} from 'react-router-dom';
import Menu from "./Menu/Menu";

import { idGoogle } from "../../App";


function Estrutura(){


    function openMenu(){

        document.getElementById('Menu').classList.remove('oculta');
        document.getElementById('Menu').classList.add('openMenu');

        //Retorna para o estado normal de rolamento do conteúdo da página.
        document.getElementById('fundo').classList.add('scroll-lock');
        document.getElementById('cardProfile').classList.add('scroll-lock');
        document.getElementById('conteudo').classList.add('scroll-lock');

        if(idGoogle==='113891358948396359936'){
            document.getElementById('gavetaUsers').classList.add('mostra');
       
        }else{
            document.getElementById('gavetaUsers').classList.add('oculta');
        
            
        }
    
    }

    return(

        <body>
        
        <div id="fundo">

         <Menu />

        <div id="cardProfile">
          
            <img src="/imagens/imgHome/busto.png" id="imgBustoHome" alt="imagem"/>

            <div id="MatrixDesign"></div>  

            <div id="MatrixDev"></div> 

            <div id="MatrixHome"></div>  

            <div className='menuIcon' onClick={openMenu}> ㆔ </div>
                           
        </div>                
       
                            
        <div id="conteudo">


                <Navbar />
    

                <div id="conteudoAbas">      
                    
                    <Outlet />

                <div id="rodape">
                <img src="/logo.png" id="logoRod" alt="imagem"/>
                <p>ALY-137©</p>  
            

         </div>   


          

              

          </div>


          </div>

             

              
              
                 </div>  

    

      </body> 

    )
}

export default Estrutura;