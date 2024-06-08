import React, { Component } from "react";
import BoasVindas from "../../Layout/Objects/Containers/Home/BoasVindas";
import Comandante from "../../Layout/Objects/Containers/Home/Comandante";
import MissoesHome from "../../Layout/Objects/Containers/Home/MissoesHome";
import Contato from "../../Layout/Objects/Containers/Home/Contato";
import Rodape from "../../Layout/Rodape/Rodape";
import Loading from "../../Layout/Objects/Objetos/Carregamentos/Loading";
import { anima3 } from "../matrixHome";

class Home extends Component {
  state = {
    loading: true,
  };

  checkAnimationCompletion = async () => {
    const intervalId = setInterval(async () => {
      const loaded = await anima3();
      if (loaded) {
        clearInterval(intervalId);
        this.setState({ loading: false });
        localStorage.setItem("animationCompleted1", "true");
        console.log("Animação concluída!");
      }
    }, 2000); // Verifica a cada 2 segundos (2000 milissegundos)
  };

  componentDidMount() {
    window.addEventListener('beforeunload', this.handleBeforeUnload);

    const animationCompleted1 = localStorage.getItem("animationCompleted1");

    if (animationCompleted1 === "true") {
      this.setState({ loading: false });
    } else {
      this.checkAnimationCompletion();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }

  handleBeforeUnload = () => {
    localStorage.removeItem("animationCompleted1");
  };

  render() {
    const { loading } = this.state;

    return (
      <div className="conteudoAbas">
        {loading ? (
          <Loading />
        ) : (
          <>
            <BoasVindas />
            <Comandante />
            <MissoesHome />
            <Contato />
            <Rodape estilo="rodapeEstiloHome" />
          </>
        )}
      </div>
    );
  }
}

export default Home;
