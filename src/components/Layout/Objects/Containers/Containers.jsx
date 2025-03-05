import EstiloContainerBot from "./EstiloContainerBot";
import EstiloContainerTop from "./EstiloContainerTop";
import './containers.css';

function Container({ titulo , iconUrl }) {
  return (
    <div className="containers">
      <EstiloContainerTop tituloHome={titulo} icon={iconUrl} />
      <p> AHAHAHA </p>
      <EstiloContainerBot />
    </div>
  );
}

export default Container;
