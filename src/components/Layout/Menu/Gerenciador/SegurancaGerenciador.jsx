import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../../../hooks/auth/useAuth";
import { seforAdm } from "../../../Scripts/verificacoes/verificaAdm";
import {
  normalizarIpsPermitidosGerenciador,
  obterConfigSegurancaGerenciador,
  salvarConfigSegurancaGerenciador,
} from "../../Sistema/gerenciadorSistemasApi";
import ProjectLoadingFallback from "../../Geral/ProjectLoadingFallback";

const CONFIG_INICIAL = {
  bloqueioIpAtivo: false,
  modoObservacao: true,
  ipsPermitidos: [],
  bloquearSemIp: true,
  registrarTentativas: true,
  ipAtual: "",
};

function formatarListaIps(value = []) {
  return normalizarIpsPermitidosGerenciador(value).join("\n");
}

export default function SegurancaGerenciador() {
  const { user, loading } = useAuth();
  const [config, setConfig] = useState(CONFIG_INICIAL);
  const [ipsInput, setIpsInput] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const usuarioAdmin = Boolean(user && seforAdm(user));

  const ipsNormalizados = useMemo(
    () => normalizarIpsPermitidosGerenciador(ipsInput),
    [ipsInput]
  );

  useEffect(() => {
    let ativo = true;

    const carregar = async () => {
      if (loading) return;
      if (!usuarioAdmin) {
        setCarregando(false);
        return;
      }

      setCarregando(true);
      setErro("");

      try {
        const data = await obterConfigSegurancaGerenciador();
        if (!ativo) return;
        const proximaConfig = {
          ...CONFIG_INICIAL,
          ...(data || {}),
          ipsPermitidos: normalizarIpsPermitidosGerenciador(data?.ipsPermitidos),
        };
        setConfig(proximaConfig);
        setIpsInput(formatarListaIps(proximaConfig.ipsPermitidos));
      } catch (error) {
        if (!ativo) return;
        console.error("Erro ao carregar seguranca do gerenciador:", error);
        setErro("Nao foi possivel carregar a seguranca do gerenciador.");
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    void carregar();

    return () => {
      ativo = false;
    };
  }, [loading, usuarioAdmin]);

  const atualizarCampo = (campo, valor) => {
    setConfig((prev) => ({
      ...prev,
      [campo]: valor,
    }));
    setMensagem("");
    setErro("");
  };

  const adicionarIpAtual = () => {
    const ipAtual = String(config.ipAtual || "").trim();
    if (!ipAtual) {
      setErro("Nao foi possivel detectar o IP atual.");
      return;
    }

    const proximos = normalizarIpsPermitidosGerenciador([
      ...ipsNormalizados,
      ipAtual,
    ]);
    setIpsInput(formatarListaIps(proximos));
    setMensagem(`IP atual adicionado: ${ipAtual}`);
  };

  const salvar = async (event) => {
    event.preventDefault();
    const ipsPermitidos = normalizarIpsPermitidosGerenciador(ipsInput);

    if (config.bloqueioIpAtivo && !config.modoObservacao && !ipsPermitidos.length) {
      setErro("Inclua ao menos um IP permitido antes de ativar o bloqueio real.");
      return;
    }

    setSalvando(true);
    setErro("");
    setMensagem("");

    try {
      const resultado = await salvarConfigSegurancaGerenciador({
        ...config,
        ipsPermitidos,
      });
      const proximaConfig = {
        ...CONFIG_INICIAL,
        ...(resultado || {}),
        ipsPermitidos: normalizarIpsPermitidosGerenciador(resultado?.ipsPermitidos || ipsPermitidos),
      };
      setConfig(proximaConfig);
      setIpsInput(formatarListaIps(proximaConfig.ipsPermitidos));
      setMensagem("Seguranca do gerenciador atualizada.");
    } catch (error) {
      console.error("Erro ao salvar seguranca do gerenciador:", error);
      setErro(error?.message || "Nao foi possivel salvar a seguranca do gerenciador.");
    } finally {
      setSalvando(false);
    }
  };

  if (loading || carregando) {
    return <ProjectLoadingFallback text="Carregando seguranca..." />;
  }

  if (!usuarioAdmin) {
    return (
      <section className="menu-panel-stack">
        <h2>Seguranca do Gerenciador</h2>
        <p>Acesso permitido apenas para owner.</p>
      </section>
    );
  }

  return (
    <section className="menu-panel-stack">
      <div>
        <h2>Seguranca do Gerenciador</h2>
        <p>
          Configure a primeira barreira antes da tela de login do projeto gerenciador.
        </p>
      </div>

      <form
        onSubmit={salvar}
        style={{ display: "grid", gap: 14, maxWidth: 760 }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={config.bloqueioIpAtivo === true}
            onChange={(event) => atualizarCampo("bloqueioIpAtivo", event.target.checked)}
          />
          Ativar filtro por IP antes do login
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={config.modoObservacao === true}
            onChange={(event) => atualizarCampo("modoObservacao", event.target.checked)}
          />
          Modo observacao: registrar tentativas sem bloquear
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={config.bloquearSemIp !== false}
            onChange={(event) => atualizarCampo("bloquearSemIp", event.target.checked)}
          />
          Bloquear se o IP nao puder ser identificado
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={config.registrarTentativas !== false}
            onChange={(event) => atualizarCampo("registrarTentativas", event.target.checked)}
          />
          Registrar tentativas permitidas e bloqueadas
        </label>

        <div>
          <label htmlFor="ipsPermitidosGerenciador" style={{ display: "block", marginBottom: 6 }}>
            IPs permitidos
          </label>
          <textarea
            id="ipsPermitidosGerenciador"
            value={ipsInput}
            onChange={(event) => {
              setIpsInput(event.target.value);
              setMensagem("");
              setErro("");
            }}
            placeholder={"Ex:\n203.0.113.10\n203.0.113.*\n203.0.113.0/24"}
            rows={8}
            style={{ width: "100%" }}
          />
          <p style={{ marginTop: 6, opacity: 0.75 }}>
            Aceita IP exato, wildcard IPv4 simples e CIDR IPv4. O bloqueio real so deve ser
            ativado depois de confirmar seu IP na lista.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" onClick={adicionarIpAtual} disabled={salvando}>
            Adicionar meu IP atual
          </button>
          <span style={{ opacity: 0.8 }}>
            IP detectado: <code>{config.ipAtual || "nao identificado"}</code>
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="submit" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar seguranca"}
          </button>
        </div>

        {erro ? <p style={{ color: "#ff6b6b", margin: 0 }}>{erro}</p> : null}
        {mensagem ? <p style={{ color: "#63d471", margin: 0 }}>{mensagem}</p> : null}
      </form>
    </section>
  );
}
