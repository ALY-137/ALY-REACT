import React, { Component } from 'react';

import MissoesDesign from '../../Layout/Objects/Containers/Design/MissoesDesign';
import HabilidadesDesign from '../../Layout/Objects/Containers/Design/HabilidadesDesign';
import PropCard from '../../Layout/Objects/Objetos/PropCard';

import Rodape from '../../Layout/Rodape/Rodape';



class Design extends Component {
  componentDidMount() {

    var idcard;

    idcard='HELLMANS';
    PropCard(idcard);


  }

  

  render() {
    return (
      <div className='conteudoAbas'>

        
         <HabilidadesDesign />
         <MissoesDesign />

    
         
         <Rodape estilo='rodapeEstiloDesign' />
      </div>
    );
  }
}

export default Design;
