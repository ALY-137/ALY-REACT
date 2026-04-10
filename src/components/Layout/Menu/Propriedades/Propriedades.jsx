import React, { useEffect, useState } from "react";
import ContaManager from "./Conta/ContaManager";
import MercadoPagoConfig from "./Conta/MercadoPagoConfig";
import PixManualConfig from "./Conta/PixManualConfig";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistema,
} from "../../Sistema/configSistema";
import ProjectLoadingFallback from "../../Geral/ProjectLoadingFallback";

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
    return <ProjectLoadingFallback text="Carregando..." />;
  }

  return (
    <div className="menu-panel-stack menu-properties">
      <h2 className="menu-panel-main-title">Propriedades</h2>

      <div className="menu-panel-block">
        <div className="menu-panel-header">
          <h3 className="menu-panel-title">Integracoes</h3>
          <button onClick={() => setIntegracoesAbertas((prev) => !prev)}>
            {integracoesAbertas ? "Fechar Integracoes" : "Abrir Integracoes"}
          </button>
        </div>
        {integracoesAbertas && (
          <div className="menu-panel-body">
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

      <div className="menu-panel-block">
        <div className="menu-panel-header">
          <h3 className="menu-panel-title">Conta</h3>
          <button onClick={() => setContaAberta((prev) => !prev)}>
            {contaAberta ? "Fechar Configuracoes da Conta" : "Abrir Configuracoes da Conta"}
          </button>
        </div>
        {contaAberta && (
          <div className="menu-panel-body">
            <ContaManager />
          </div>
        )}
      </div>
    </div>
  );
}

export default Propriedades;
