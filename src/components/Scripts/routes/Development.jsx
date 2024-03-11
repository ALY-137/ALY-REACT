import React, { Component } from 'react';

import MissoesDev from '../../Layout/Objects/Containers/Dev/MissoesDev';
import HabilidadesDev from '../../Layout/Objects/Containers/Dev/HabilidadesDev';
import PropCard from '../../Layout/Objects/Objetos/PropCard';

import Rodape from '../../Layout/Rodape/Rodape';

class Development extends Component {
  componentDidMount() {

    var idcard;

    idcard='CAFE';
    PropCard(idcard);
    idcard='ECONOLISTA';
    PropCard(idcard);
  }

  render() {
    return (
      <div>
        <HabilidadesDev />
        <MissoesDev />


        <Rodape estilo='rodapeEstiloDev' />
      </div>
    );
  }
}

export default Development;
