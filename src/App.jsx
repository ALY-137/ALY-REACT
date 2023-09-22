import React from 'react';
import './App.css';

import home from './home';
import blue from './dev';
import pink from './design';



import {Link,Outlet}from 'react-router-dom';



function App(){


  return (
    
  <body>



                          <div id="fundo">
                            
                            <div id="conteudo">

                                    <div id="cardProfile">

                                            <img src="/imagens/imgHome/note.png" id="imgnoteHome" alt="imagem"/>
                                            <img src="/imagens/imgDev/note.png" id="imgnoteDev" alt="imagem"/>
                                            <img src="/imagens/imgDesign/note.png" id="imgnoteDesign" alt="imagem"/>

                                            <div id="MatrixDesign">
                                                
                                                <img src="/imagens/imgDesign/busto.png" id="imgBustoDesign" alt="imagem"/>
                                                <img src="/imagens/imgDesign/busto0.png" id="imgBustoDesign0" alt="imagem"/>  
                                                <img src="/imagens/imgDesign/busto1.png" id="imgBustoDesign1" alt="imagem"/> 
                                                <img src="/imagens/imgDesign/busto.png" id="imgBustoDesign2" alt="imagem"/> 

                                            </div>  

                                            <div id="MatrixDev">
                                                <img src="/imagens/imgDev/busto.png" id="imgBustoDev" alt="imagem"/>
                                                <img src="/imagens/imgDev/busto0.png" id="imgBustoDev0" alt="imagem"/>  
                                                <img src="/imagens/imgDev/busto1.png" id="imgBustoDev1" alt="imagem"/> 
                                                <img src="/imagens/imgDev/busto.png" id="imgBustoDev2" alt="imagem"/> 
                                                  
                                            </div> 

                                            <div id="MatrixHome">
                                                <img src="/imagens/imgHome/busto.png" id="imgBustoHome" alt="imagem"/>
                                                <img src="/imagens/imgHome/busto0.png" id="imgBustoHome0" alt="imagem"/>  
                                                <img src="/imagens/imgHome/busto1.png" id="imgBustoHome1" alt="imagem"/> 
                                                <img src="/imagens/imgHome/busto.png" id="imgBustoHome2" alt="imagem"/>   
                                            </div>   
                                      
                                    </div>
                                  

                                  <div id="conteudoAbas">

                                      <div id="cabecalho">

                                          <div id="abas">

                                           

                                            <Link onClick={blue} class="optionsAbas" id="abaDev" to='/development'> 
                                              <p id="txtAbaDev" className="numNeutroHome">DEV</p>            
                                            </Link>  

                                            <Link onClick={home} class="optionsAbasFoco" id="abaHome" to='/home'> 
                                              <p id="txtAbaHome" className="numBrilhaHome">CENTRAL</p>                
                                            </Link>

                                            <Link onClick={pink} class="optionsAbas" id="abaDesign" to='/design'>                          
                                              <p id="txtAbaDesign" className="numNeutroHome">DESIGN</p>                                         
                                            </Link>
                                         


                                          </div>
                                      </div>
                                      
                                      <Outlet />
                    
                 <div id="rodape">
                                <img src="/logo.png" id="logoRod" alt="imagem"/>
                                <p>ALY-137©</p>  
                              

                                  </div>   


                              

                                  

                              </div>


                              </div>

                                 
               
                                  
                                  
                                     </div>  

                        

                          </body>
            

    )}

   



export default App;
