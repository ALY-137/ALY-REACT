import React, { Component } from 'react';

import MissoesDesign from '../../Layout/Objects/Containers/Design/MissoesDesign';
import HabilidadesDesign from '../../Layout/Objects/Containers/Design/HabilidadesDesign';
import PropCard from '../../Layout/Objects/Objetos/PropCard';


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
