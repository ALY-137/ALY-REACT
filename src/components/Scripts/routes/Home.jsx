import React , { Component }  from "react";

import BoasVindas from "../../Layout/Objects/Containers/Home/BoasVindas";
import Comandante from "../../Layout/Objects/Containers/Home/Comandante";
import MissoesHome from "../../Layout/Objects/Containers/Home/MissoesHome";
import Contato from "../../Layout/Objects/Containers/Home/Contato";

import PropCard from "../../Layout/Objects/Objetos/PropCard";



class Home extends Component {

  
  componentDidMount() {
  

   

    var idcard;

    idcard='CYBERPINK-137';
    PropCard(idcard);
   
  }


  render() {
    return (
      <div> 
            <BoasVindas />
            <Comandante />
            <MissoesHome />
            <Contato />
      </div>
    );
  }
}

export default Home;