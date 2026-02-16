import { useEffect, useState } from "react";
import { useAuth } from "../../../../hooks/auth/useAuth";
import { seforAdm } from "../../../Scripts/verificacoes/verificaAdm";
import { SYSTEM_THEMES } from "../../Temas/themesRegistry";
import {
  DEFAULT_SISTEMA_CONFIG,
  aplicarTemaNoBody,
  obterConfigSistema,
  salvarConfigSistemaAdmin,
} from "../../Sistema/configSistema";

function PropriedadesSistema() {
  const { user, loading } = useAuth();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [config, setConfig] = useState(DEFAULT_SISTEMA_CONFIG);

  useEffect(() => {
    let ativo = true;

    const carregar = async () => {
      if (loading) return;

      if (!user || !seforAdm(user)) {
        if (ativo) setCarregando(false);
        return;
      }

      setCarregando(true);
      setErro("");

      try {
        const configAtual = await obterConfigSistema();
        if (!ativo) return;
        setConfig(configAtual);
      } catch (error) {
        if (!ativo) return;
        setErro("Nao foi possivel carregar as configuracoes do sistema.");
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    carregar();

    return () => {
      ativo = false;
    };
  }, [loading, user]);

  const salvar = async () => {
    setSalvando(true);
    setMensagem("");
    setErro("");

    try {
      const configSalva = await salvarConfigSistemaAdmin(config);
      setConfig(configSalva);
      aplicarTemaNoBody(configSalva.temaPadraoSistema);
      setMensagem("Configuracoes salvas com sucesso.");
    } catch (error) {
      setErro("Falha ao salvar configuracoes. Verifique sua permissao de administrador.");
    } finally {
      setSalvando(false);
    }
  };

  const restaurarPadrao = () => {
    setMensagem("");
    setErro("");
    setConfig(DEFAULT_SISTEMA_CONFIG);
  };

  if (loading || carregando) {
    return <p>Carregando...</p>;
  }

  if (!user || !seforAdm(user)) {
    return (
      <div>
        <h2>PROPRIEDADES DO SISTEMA</h2>
        <p>Acesso restrito ao administrador.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>PROPRIEDADES DO SISTEMA</h2>
      <p>
        Defina o comportamento global do sistema. Tema de sistema e diferente
        do tema de skin.
      </p>

      <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Layout geral / padrao</h3>
        <p style={{ marginTop: 0 }}>
          Tema padrao do sistema (login e paginas gerais, fora de skins).
        </p>

        <label htmlFor="temaPadraoSistema">Tema padrao do sistema</label>
        <select
          id="temaPadraoSistema"
          value={config.temaPadraoSistema}
          onChange={(event) =>
            setConfig((prev) => ({
              ...prev,
              temaPadraoSistema: event.target.value,
            }))
          }
          style={{ width: "100%", marginTop: 8 }}
        >
          {SYSTEM_THEMES.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.label}
            </option>
          ))}
        </select>
        <p style={{ marginTop: 8, opacity: 0.8 }}>
          As skins podem usar outros temas, mesmo quando o sistema possui um
          tema padrao.
        </p>
      </div>

      <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Logo do login</h3>

        <label htmlFor="logoLoginUrl">URL da logo exibida no login</label>
        <input
          id="logoLoginUrl"
          type="text"
          value={config.logoLoginUrl}
          onChange={(event) =>
            setConfig((prev) => ({
              ...prev,
              logoLoginUrl: event.target.value,
            }))
          }
          placeholder="/logoNeon.png ou https://..."
          style={{ width: "100%", marginTop: 8 }}
        />

        <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
          <img
            src={config.logoLoginUrl || DEFAULT_SISTEMA_CONFIG.logoLoginUrl}
            alt="Preview da logo de login"
            style={{ maxWidth: 150, maxHeight: 150, objectFit: "contain" }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar configuracoes"}
        </button>
        <button onClick={restaurarPadrao} disabled={salvando}>
          Restaurar padrao
        </button>
      </div>

      {!!mensagem && <p style={{ marginTop: 10 }}>{mensagem}</p>}
      {!!erro && <p style={{ marginTop: 10 }}>{erro}</p>}

      <div style={{ marginTop: 16, opacity: 0.85 }}>
        <h4 style={{ marginBottom: 6 }}>Expansao futura</h4>
        <p style={{ marginTop: 0 }}>
          Aqui voce podera configurar regras de negocio, componentes ativos e
          limites do sistema sem precisar recriar a aplicacao.
        </p>
      </div>
    </div>
  );
}

export default PropriedadesSistema;
