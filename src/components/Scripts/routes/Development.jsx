import React, { Component } from 'react';
import MissoesDev from '../../Layout/Objects/Containers/Dev/MissoesDev';
import HabilidadesDev from '../../Layout/Objects/Containers/Dev/HabilidadesDev';
import Rodape from '../../Layout/Rodape/Rodape';
import AcademiaDev from '../../Layout/Objects/Containers/Dev/AcademiaDev';
import { anima3 } from '../matrixDev';
import Loading from '../../Layout/Objects/Objetos/Carregamentos/Loading';

class Development extends Component {

  state = {
    loading: true,
  };

  checkAnimationCompletion = async () => {
    const intervalId = setInterval(async () => {
      const loaded = await anima3();
      if (loaded) {

        clearInterval(intervalId);
        this.setState({ loading: false });
        localStorage.setItem("animationCompleted2", "true");
        console.log("Animação concluída!");

      }
    }, 2000); // Verifica a cada 2 segundos (2000 milissegundos)
  };

  componentDidMount() {

    window.addEventListener('beforeunload', this.handleBeforeUnload);

    const animationCompleted2 = localStorage.getItem("animationCompleted2");

    if (animationCompleted2 === "true") {
      this.setState({ loading: false });
    } else {
      this.checkAnimationCompletion();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }

  handleBeforeUnload = () => {
    localStorage.removeItem("animationCompleted2");
  };


  render() {
    const { loading } = this.state;
    return (
      
      <div className='conteudoAbas'>

        {loading ? (
          <Loading />
        ):(
          <>
          
          <AcademiaDev />
          <HabilidadesDev />
          <MissoesDev />

          <Rodape estilo='rodapeEstiloDev' />
        </>
        )}
      </div>
    );
  }
}

export default Development;