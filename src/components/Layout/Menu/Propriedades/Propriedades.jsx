import React, { useState } from "react";
import ContaManager from "./Conta/ContaManager";
import MercadoPagoConfig from "./Conta/MercadoPagoConfig";

function Propriedades() {
  const [integracoesAbertas, setIntegracoesAbertas] = useState(true);
  const [contaAberta, setContaAberta] = useState(false);

  return (
    <div>
      <h2>Propriedades</h2>

      <div style={{ marginBottom: 12, border: "1px solid #ccc", borderRadius: 8, padding: 10 }}>
        <button onClick={() => setIntegracoesAbertas((prev) => !prev)}>
          {integracoesAbertas ? "Fechar Integrações" : "Abrir Integrações"}
        </button>
        {integracoesAbertas && (
          <div style={{ marginTop: 10 }}>
            <MercadoPagoConfig />
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12, border: "1px solid #ccc", borderRadius: 8, padding: 10 }}>
        <button onClick={() => setContaAberta((prev) => !prev)}>
          {contaAberta ? "Fechar Configurações da Conta" : "Abrir Configurações da Conta"}
        </button>
        {contaAberta && (
          <div style={{ marginTop: 10 }}>
            <ContaManager />
          </div>
        )}
      </div>
    </div>
  );
}

export default Propriedades;
