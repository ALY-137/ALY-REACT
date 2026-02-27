import React, { useEffect, useState } from "react";
import ContaManager from "./Conta/ContaManager";
import MercadoPagoConfig from "./Conta/MercadoPagoConfig";
import PixManualConfig from "./Conta/PixManualConfig";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistema,
} from "../../Sistema/configSistema";

function Propriedades() {
  const [integracoesAbertas, setIntegracoesAbertas] = useState(true);
  const [contaAberta, setContaAberta] = useState(false);
  const [configSistema, setConfigSistema] = useState(DEFAULT_SISTEMA_CONFIG);
  const [carregandoConfig, setCarregandoConfig] = useState(true);

  useEffect(() => {
    let ativo = true;

    async function carregarConfigSistema() {
      try {
        const config = await obterConfigSistema();
        if (!ativo) return;
        setConfigSistema(config);
      } catch {
        if (!ativo) return;
        setConfigSistema(DEFAULT_SISTEMA_CONFIG);
      } finally {
        if (ativo) setCarregandoConfig(false);
      }
    }

    carregarConfigSistema();

    return () => {
      ativo = false;
    };
  }, []);

  if (carregandoConfig) {
    return <p>Carregando...</p>;
  }

  return (
    <div>
      <h2>Propriedades</h2>

      <div style={{ marginBottom: 12, border: "1px solid #ccc", borderRadius: 8, padding: 10 }}>
        <button onClick={() => setIntegracoesAbertas((prev) => !prev)}>
          {integracoesAbertas ? "Fechar Integracoes" : "Abrir Integracoes"}
        </button>
        {integracoesAbertas && (
          <div style={{ marginTop: 10 }}>
            {configSistema.mercadoPagoHabilitado ? (
              <MercadoPagoConfig />
            ) : (
              <p>
                Integracao com Mercado Pago desativada em PROPRIEDADES DO SISTEMA.
              </p>
            )}
            {configSistema.pixManualHabilitado ? (
              <PixManualConfig />
            ) : (
              <p>
                Pagamento manual por PIX desativado em PROPRIEDADES DO SISTEMA.
              </p>
            )}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12, border: "1px solid #ccc", borderRadius: 8, padding: 10 }}>
        <button onClick={() => setContaAberta((prev) => !prev)}>
          {contaAberta ? "Fechar Configuracoes da Conta" : "Abrir Configuracoes da Conta"}
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
