import React from "react";
import ContaManager from "./Conta/ContaManager";
import MercadoPagoConfig from "./Conta/MercadoPagoConfig";

function Propriedades() {
  return (
    <div>
      <h2>Propriedades</h2>
      <MercadoPagoConfig />
      <ContaManager />
    </div>
  );
}

export default Propriedades;
