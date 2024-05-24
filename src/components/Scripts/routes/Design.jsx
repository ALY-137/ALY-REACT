import React, { Component } from 'react';
import MissoesDesign from '../../Layout/Objects/Containers/Design/MissoesDesign';
import HabilidadesDesign from '../../Layout/Objects/Containers/Design/HabilidadesDesign';
import PropCard from '../../Layout/Objects/Objetos/PropCard';
import Rodape from '../../Layout/Rodape/Rodape'; 
import AcademiaDesign from '../../Layout/Objects/Containers/Design/AcademiaDesign';


class Design extends Component {

  componentDidMount() {

    // Quando precisar inserir novo card deve-se inserir uma nova chamada de função "PropCard". 

    var idcard; 

    idcard='HELLMANS';
    PropCard(idcard);

    idcard='DESIGNGRAFICO';
    PropCard(idcard);
    
  }

  render() {
    return (
      <div className='conteudoAbas'>

         <AcademiaDesign />
         <HabilidadesDesign />
         <MissoesDesign />
         

    
         
         <Rodape estilo='rodapeEstiloDesign' />
      </div>
    );
  }
}

export default Design;