import React from 'react';
import './App.css';

import Navbar from './components/Layout/Navbar';

import {Outlet} from 'react-router-dom';
  
  

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
            

    )}

   



export default App;
