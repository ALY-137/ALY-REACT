import React, { Component } from 'react';

import MissoesDesign from '../components/Containers/Design/MissoesDesign';
import HabilidadesDesign from '../components/Containers/Design/HabilidadesDesign';
import PropCard from '../components/Objetos/PropCard';


class Design extends Component {
  componentDidMount() {

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
