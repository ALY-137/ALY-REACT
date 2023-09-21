import React, { Component } from 'react';
import '../App.css';

import home from '../home';
import blue from '../dev';
import pink from '../design';



import {Link,Outlet}from 'react-router-dom';



  class App extends Component {
    componentDidMount() {
   
  


  
    }
  
    render(){
 


  return (
    
  <body>



                          <div id="fundo">
                            
                            <div id="conteudo">

                                    <div id="cardProfile">

                                            <img src="/imagens/imgHome/note.png" id="imgnoteHome"/>
                                            <img src="/imagens/imgDev/note.png" id="imgnoteDev"/>
                                            <img src="/imagens/imgDesign/note.png" id="imgnoteDesign"/>

                                            <div id="MatrixDesign">
                                                
                                                <img src="/imagens/imgDesign/busto.png" id="imgBustoDesign"/>
                                                <img src="/imagens/imgDesign/busto0.png" id="imgBustoDesign0"/>  
                                                <img src="/imagens/imgDesign/busto1.png" id="imgBustoDesign1"/> 
                                                <img src="/imagens/imgDesign/busto.png" id="imgBustoDesign2"/> 

                                            </div>  

                                            <div id="MatrixDev">
                                                <img src="/imagens/imgDev/busto.png" id="imgBustoDev"/>
                                                <img src="/imagens/imgDev/busto0.png" id="imgBustoDev0"/>  
                                                <img src="/imagens/imgDev/busto1.png" id="imgBustoDev1"/> 
                                                <img src="/imagens/imgDev/busto.png" id="imgBustoDev2"/> 
                                                  
                                            </div> 

                                            <div id="MatrixHome">
                                                <img src="/imagens/imgHome/busto.png" id="imgBustoHome"/>
                                                <img src="/imagens/imgHome/busto0.png" id="imgBustoHome0"/>  
                                                <img src="/imagens/imgHome/busto1.png" id="imgBustoHome1"/> 
                                                <img src="/imagens/imgHome/busto.png" id="imgBustoHome2"/>   
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
                                <img src="/logo.png" id="logoRod"/>
                                <p>ALY-137©</p>  
                              

                                  </div>   


                              

                                  

                              </div>


                              </div>

                                 
               
                                  
                                  
                                     </div>  

                        

                          </body>
            

    )}

   

}

export default App;
