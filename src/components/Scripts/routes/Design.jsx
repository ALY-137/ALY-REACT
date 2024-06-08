import React, { Component } from 'react';
import MissoesDesign from '../../Layout/Objects/Containers/Design/MissoesDesign';
import HabilidadesDesign from '../../Layout/Objects/Containers/Design/HabilidadesDesign';
import Rodape from '../../Layout/Rodape/Rodape'; 
import AcademiaDesign from '../../Layout/Objects/Containers/Design/AcademiaDesign';
import Loading from '../../Layout/Objects/Objetos/Carregamentos/Loading';
import { anima3 } from '../matrixDesign';

class Design extends Component {

  state = {
    loading: true,
  
  };

  checkAnimationCompletion = async () => {
    const intervalId = setInterval(async () => {
      const loaded = await anima3();
      if (loaded) {
        clearInterval(intervalId);
        this.setState({ loading: false });
        localStorage.setItem("animationCompleted3", "true");
        console.log("Animação concluída!");

       
      }
    }, 2000); // Verifica a cada 2 segundos (2000 milissegundos)
  };

  componentDidMount() {

    window.addEventListener('beforeunload', this.handleBeforeUnload);

    const animationCompleted3 = localStorage.getItem("animationCompleted3");

    if (animationCompleted3 === "true") {
      this.setState({ loading: false });
      
    } else {
      this.checkAnimationCompletion();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }

  handleBeforeUnload = () => {
    localStorage.removeItem("animationCompleted3");
  };

  render() {
    const { loading } = this.state;

    return (
      <div className='conteudoAbas'>
        {loading ? (
          <Loading />
        ) : (
          <>
            <AcademiaDesign />
            <HabilidadesDesign />
            <MissoesDesign />
            <Rodape estilo='rodapeEstiloDesign' />
          </>
        )}
      </div>
    );
  }
}

export default Design;