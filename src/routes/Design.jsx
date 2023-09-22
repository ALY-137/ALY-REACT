import React, { Component } from 'react';
import { pink } from '../design'; 
import { layout } from '../layout';
import MissoesDesign from '../components/Containers/Design/MissoesDesign';
import HabilidadesDesign from '../components/Containers/Design/HabilidadesDesign';
import PropCard from '../components/Objetos/PropCard';

class Design extends Component {
  componentDidMount() {
    layout();
    pink(); 

    var idcard;

    idcard='HELLMANS';
    PropCard(idcard);

  }

  render() {
    return (
      <div>
        
         <HabilidadesDesign />
         <MissoesDesign />
         
      </div>
    );
  }
}

export default Design;
