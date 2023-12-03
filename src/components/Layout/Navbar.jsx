import React from 'react';

import home from '../../home';
import blue from '../../dev';
import pink from '../../design';

import {Link} from 'react-router-dom';


function Navbar(){

    window.addEventListener("scroll",function(){
        let header = document.getElementById("abas")

        if(window.scrollY > 0){
          header.classList.add('rolagem');
        }
        
    })

    
   return(

    <div id="cabecalho" >    

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

)}

export default Navbar;


