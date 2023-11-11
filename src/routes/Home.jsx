import React , { Component }  from "react";
import BoasVindas from "../components/Containers/Home/BoasVindas";
import Comandante from "../components/Containers/Home/Comandante";
import Contato from "../components/Containers/Home/Contato";
import MissoesHome from "../components/Containers/Home/MissoesHome";


import PropCard from '../components/Objetos/PropCard';



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