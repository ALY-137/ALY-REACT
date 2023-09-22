import React, { Component } from 'react';
import { blue } from '../dev'; 
import { layout } from '../layout'; 
import MissoesDev from "../components/Containers/Dev/MissoesDev";
import HabilidadesDev from '../components/Containers/Dev/HabilidadesDev';
import PropCard from '../components/Objetos/PropCard';



class Development extends Component {
  componentDidMount() {
    layout();
    blue(); 

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
      </div>
    );
  }
}

export default Development;
