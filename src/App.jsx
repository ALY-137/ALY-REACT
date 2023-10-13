import React from 'react';
import './App.css';

import home from './home';
import blue from './dev';
import pink from './design';



import {Link,Outlet} from 'react-router-dom';



function App(){


  return (
    
  <body>



                          <div id="fundo">
                            
                            <div id="conteudo">

                                    <div id="cardProfile">
                                                
                                               
                                                  
                                                    <img src="/imagens/imgHome/busto.png" id="imgBustoHome" alt="imagem"/>
                                                    
                                              
                                          

                                                <div id="MatrixDesign">
                                                    
                        
                                                </div>  

                                                <div id="MatrixDev">
                                                    
                                                </div> 

                                                <div id="MatrixHome">
                                                   
                                                      
                                                </div>  
                                          

                                             
                                      
                                    </div>
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
            

    )}

   



export default App;
