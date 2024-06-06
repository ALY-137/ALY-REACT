import React, { Component } from 'react';

import MissoesDev from '../../Layout/Objects/Containers/Dev/MissoesDev';
import HabilidadesDev from '../../Layout/Objects/Containers/Dev/HabilidadesDev';
import PropCard from '../../Layout/Objects/Objetos/PropCard';

import Rodape from '../../Layout/Rodape/Rodape';
import AcademiaDev from '../../Layout/Objects/Containers/Dev/AcademiaDev';


class Development extends Component {
  componentDidMount() {

    var idcard;

    idcard='CAFE';
    PropCard(idcard);
    
    idcard='ECONOLISTA';
    PropCard(idcard);

    idcard='SISTEMASPARAINTERNET';
    PropCard(idcard);
    

  }


  render() {
    return (
      <div className='conteudoAbas'>
        
        <AcademiaDev />
        <HabilidadesDev />
        <MissoesDev />

        <Rodape estilo='rodapeEstiloDev' />
      </div>
    );
  }
}

export default Development;
