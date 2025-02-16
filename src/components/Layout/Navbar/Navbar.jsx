import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Switch, Link } from 'react-router-dom';
import Blue from '../Temas/CYBERPINK/Blue.jsx';
import violet from '../Temas/CYBERPINK/violet.js';
import pink from '../Temas/CYBERPINK/pink.js';

const Navbar = ({ routes }) =>{

  let skinLocal = localStorage.getItem('skinLocal');

  
    window.addEventListener("scroll",function(){
        let header = document.getElementById("abas")

        if(window.scrollY > 0){
          header.classList.add('rolagem');
        }
        
    })


   return(

    <div id="cabecalho" >    

          <div id="abas">
            
                <Link onClick={Blue} className="optionsAbas" id="abaDev" to={`/${skinLocal}/development`}> 
                  <p id="txtAbaDev" className="numNeutroHome">DEV</p>            
                </Link>  

                <Link onClick={violet} className="optionsAbasFoco" id="abaHome" to={`/${skinLocal}/home`}> 
                  <p id="txtAbaHome" className="numBrilhaHome">CENTRAL</p>                
                </Link>

                <Link onClick={pink} className="optionsAbas" id="abaDesign"  to={`/${skinLocal}/design`}>                          
                  <p id="txtAbaDesign" className="numNeutroHome">DESIGN</p>                                         
                </Link>


          </div>
          
    </div>

)
}
export default Navbar;