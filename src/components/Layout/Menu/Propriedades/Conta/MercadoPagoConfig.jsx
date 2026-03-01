import { useEffect, useState } from "react";
import {
  desconectarMercadoPago,
  obterStatusMercadoPago,
  salvarMercadoPagoCredenciais,
} from "../../../Pagamentos/mercadoPagoApi";

function parseErroMercadoPago(err) {
  const code = err?.code || "";
  const details = err?.details || err?.customData?.details || "";
  const message = err?.message || "";

  if (code === "mercado-pago/unavailable") {
    return (
      details ||
      message ||
      "Mercado Pago indisponivel neste projeto. Use PIX manual ou um projeto com Functions habilitadas."
    );
  }
  if (code === "functions/not-found") {
    return "Functions nao encontradas. Rode: npm run functions:deploy";
  }
  if (code === "functions/unauthenticated") {
    return "Voce precisa estar logado para conectar o Mercado Pago.";
  }
  if (code === "functions/internal") {
    return details
      ? `Erro no Mercado Pago: ${details}`
      : "Falha interna ao validar token no Mercado Pago.";
  }
  if (code === "functions/invalid-argument") {
    return details || "Dados invalidos ao enviar token.";
  }

  return details || message || "Falha ao comunicar com Mercado Pago.";
}

export default function MercadoPagoConfig() {
  const [accessToken, setAccessToken] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [status, setStatus] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [carregandoStatus, setCarregandoStatus] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const indisponivelNoProjeto = status?.disponivel === false;

  const carregarStatus = async () => {
    setCarregandoStatus(true);
    setMensagem("");
    try {
      const data = await obterStatusMercadoPago();
      setStatus(data);
      if (data?.disponivel === false) {
        setMensagem(
          data?.motivo ||
            "Mercado Pago indisponivel neste projeto. Use PIX manual ou um projeto com Functions habilitadas."
        );
      }
    } catch (err) {
      setMensagem(parseErroMercadoPago(err));
    } finally {
      setCarregandoStatus(false);
    }
  };

  useEffect(() => {
    carregarStatus();
  }, []);

  const salvar = async () => {
    const tokenNormalizado = accessToken.trim();
    if (!tokenNormalizado) {
      alert("Informe o Access Token do Mercado Pago.");
      return;
    }
    if (
      !tokenNormalizado.startsWith("APP_USR-") &&
      !tokenNormalizado.startsWith("TEST-")
    ) {
      alert("Token invalido. Use o Access Token (APP_USR-... ou TEST-...).");
      return;
    }

    setSalvando(true);
    setMensagem("");
    try {
      await salvarMercadoPagoCredenciais({
        accessToken: tokenNormalizado,
        publicKey: publicKey.trim(),
      });
      setAccessToken("");
      await carregarStatus();
      setMensagem("Credenciais salvas com sucesso.");
    } catch (err) {
      setMensagem(parseErroMercadoPago(err));
    } finally {
      setSalvando(false);
    }
  };

  const desconectar = async () => {
    if (!status?.conectado) return;

    const confirmado = window.confirm(
      "Deseja desconectar sua conta do Mercado Pago?"
    );
    if (!confirmado) return;

    setDesconectando(true);
    setMensagem("");
    try {
      await desconectarMercadoPago();
      setAccessToken("");
      setPublicKey("");
      await carregarStatus();
      setMensagem("Mercado Pago desconectado.");
    } catch (err) {
      setMensagem(parseErroMercadoPago(err));
    } finally {
      setDesconectando(false);
    }
  };

  return (
    <div style={{ marginBottom: 20, padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
      <h3 style={{ marginTop: 0 }}>Mercado Pago</h3>
      <p style={{ margin: "4px 0 10px" }}>
        Conecte sua conta para receber pagamentos de blocos via PIX e cartao.
      </p>

      <p style={{ margin: "4px 0" }}>
        Status:{" "}
        <strong>
          {carregandoStatus
            ? "Verificando..."
            : indisponivelNoProjeto
              ? "Indisponivel neste projeto"
              : status?.conectado
              ? "Conectado"
              : "Nao conectado"}
        </strong>
      </p>
      {indisponivelNoProjeto ? (
        <p style={{ margin: "4px 0 10px" }}>
          Este projeto nao possui Cloud Functions disponiveis para Mercado Pago.
        </p>
      ) : null}

      <input
        type="password"
        placeholder="Access Token Mercado Pago"
        value={accessToken}
        onChange={(event) => setAccessToken(event.target.value)}
        style={{ width: "100%", marginTop: 8 }}
        disabled={indisponivelNoProjeto}
      />
      <input
        type="text"
        placeholder="Public Key (opcional)"
        value={publicKey}
        onChange={(event) => setPublicKey(event.target.value)}
        style={{ width: "100%", marginTop: 8 }}
        disabled={indisponivelNoProjeto}
      />

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button onClick={salvar} disabled={salvando || desconectando || indisponivelNoProjeto}>
          {salvando ? "Salvando..." : "Salvar credenciais"}
        </button>
        <button onClick={carregarStatus} disabled={carregandoStatus || salvando || desconectando}>
          Atualizar status
        </button>
        <button
          onClick={desconectar}
          disabled={!status?.conectado || salvando || carregandoStatus || desconectando}
        >
          {desconectando ? "Desconectando..." : "Desconectar"}
        </button>
      </div>

      {!!mensagem && <p style={{ marginTop: 10 }}>{mensagem}</p>}
    </div>
  );
}
