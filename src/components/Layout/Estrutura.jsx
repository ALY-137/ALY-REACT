import Navbar from "./Navbar";
import {Outlet} from 'react-router-dom';
import Menu from "./Menu";


function Estrutura(){


    function openMenu(){

        var Menu = document.getElementById('Menu');
        Menu.style.display  = 'block';

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

            <div className='menu' onClick={openMenu}> ㆔ </div>
                           
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