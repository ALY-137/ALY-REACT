import { useEffect, useMemo, useState } from "react";
import { obterStatusMercadoPago, obterStatusPixManual } from "../Pagamentos/mercadoPagoApi";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistema,
  obterRotulosBloco,
} from "../Sistema/configSistema";

const OPCOES_VISIBILIDADE = [
  { value: "publico", label: "Publico" },
  { value: "publico_restritivo", label: "Publico restritivo" },
  { value: "privado", label: "Privado (autenticado)" },
  { value: "exclusivo_assinante", label: "Exclusivo assinante" },
  { value: "exclusivo_comprador", label: "Exclusivo comprador" },
];

const capitalizar = (texto = "") =>
  texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "";

const normalizarMetodosPagamentoBloco = (bloco = {}, fallback = {}) => {
  const metodos = bloco?.metodosPagamento || bloco?.metodosPagamentoPermitidos || {};
  return {
    mercadoPago:
      typeof metodos?.mercadoPago === "boolean"
        ? metodos.mercadoPago
        : Boolean(fallback?.mercadoPago),
    pixManual:
      typeof metodos?.pixManual === "boolean"
        ? metodos.pixManual
        : Boolean(fallback?.pixManual),
  };
};

export default function EditorBloco({
  bloco,
  imagensEditor = [],
  onSalvar,
  onExcluir,
  salvando = false,
  excluindo = false,
}) {
  const [aberto, setAberto] = useState(false);
  const [visibilidade, setVisibilidade] = useState(bloco?.visibilidade || "publico");
  const [valorCompra, setValorCompra] = useState(
    bloco?.precoCentavos ? (Number(bloco.precoCentavos) / 100).toFixed(2) : ""
  );
  const [permitirMercadoPagoLive, setPermitirMercadoPagoLive] = useState(
    () => normalizarMetodosPagamentoBloco(bloco, { mercadoPago: true }).mercadoPago
  );
  const [permitirPixManualLive, setPermitirPixManualLive] = useState(
    () => normalizarMetodosPagamentoBloco(bloco, { pixManual: true }).pixManual
  );
  const [indicesRemovidos, setIndicesRemovidos] = useState([]);
  const [novasImagens, setNovasImagens] = useState([]);
  const [mpConectado, setMpConectado] = useState(null);
  const [pixManualConectado, setPixManualConectado] = useState(null);
  const [pixManualQrsDisponiveis, setPixManualQrsDisponiveis] = useState([]);
  const [mercadoPagoSistemaHabilitado, setMercadoPagoSistemaHabilitado] = useState(
    DEFAULT_SISTEMA_CONFIG.mercadoPagoHabilitado
  );
  const [pixManualSistemaHabilitado, setPixManualSistemaHabilitado] = useState(
    DEFAULT_SISTEMA_CONFIG.pixManualHabilitado
  );
  const [nomeBlocoSingular, setNomeBlocoSingular] = useState(
    DEFAULT_SISTEMA_CONFIG.nomeBlocoSingular
  );
  const [nomeBlocoPlural, setNomeBlocoPlural] = useState(
    DEFAULT_SISTEMA_CONFIG.nomeBlocoPlural
  );

  useEffect(() => {
    setVisibilidade(bloco?.visibilidade || "publico");
    setValorCompra(bloco?.precoCentavos ? (Number(bloco.precoCentavos) / 100).toFixed(2) : "");
    const metodosPagamento = normalizarMetodosPagamentoBloco(bloco, {
      mercadoPago: true,
      pixManual: true,
    });
    setPermitirMercadoPagoLive(metodosPagamento.mercadoPago);
    setPermitirPixManualLive(metodosPagamento.pixManual);
    setIndicesRemovidos([]);
    setNovasImagens([]);
    setMpConectado(null);
    setPixManualConectado(null);
  }, [bloco?.id, bloco?.visibilidade, bloco?.precoCentavos]);

  useEffect(() => {
    let cancelado = false;

    async function carregarNomenclatura() {
      try {
        const configSistema = await obterConfigSistema();
        if (cancelado) return;
        const rotulosBloco = obterRotulosBloco(configSistema);
        setNomeBlocoSingular(rotulosBloco?.singular || DEFAULT_SISTEMA_CONFIG.nomeBlocoSingular);
        setNomeBlocoPlural(rotulosBloco?.plural || DEFAULT_SISTEMA_CONFIG.nomeBlocoPlural);
      } catch {
        if (cancelado) return;
        setNomeBlocoSingular(DEFAULT_SISTEMA_CONFIG.nomeBlocoSingular);
        setNomeBlocoPlural(DEFAULT_SISTEMA_CONFIG.nomeBlocoPlural);
      }
    }

    carregarNomenclatura();
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (!aberto) return;

    let cancelado = false;

    async function carregarStatusMercadoPago() {
      let moduloMercadoPagoAtivo = DEFAULT_SISTEMA_CONFIG.mercadoPagoHabilitado;
      let moduloPixManualAtivo = DEFAULT_SISTEMA_CONFIG.pixManualHabilitado;
      try {
        const configSistema = await obterConfigSistema();
        moduloMercadoPagoAtivo = configSistema?.mercadoPagoHabilitado !== false;
        moduloPixManualAtivo = configSistema?.pixManualHabilitado !== false;
      } catch {
        // Mantem fallback local.
      }

      if (!cancelado) {
        setMercadoPagoSistemaHabilitado(moduloMercadoPagoAtivo);
        setPixManualSistemaHabilitado(moduloPixManualAtivo);
      }

      if (moduloMercadoPagoAtivo) {
        try {
          const status = await obterStatusMercadoPago();
          if (!cancelado) {
            setMpConectado(Boolean(status?.conectado));
          }
        } catch {
          if (!cancelado) {
            setMpConectado(false);
          }
        }
      } else if (!cancelado) {
        setMpConectado(false);
      }

      if (moduloPixManualAtivo) {
        try {
          const statusPix = await obterStatusPixManual();
          if (!cancelado) {
            const pixManualDisponivel = Boolean(
              statusPix?.chavePix || statusPix?.conectado
            );
            setPixManualConectado(pixManualDisponivel);
            setPixManualQrsDisponiveis(Array.isArray(statusPix?.qrs) ? statusPix.qrs : []);
          }
        } catch {
          if (!cancelado) {
            setPixManualConectado(false);
            setPixManualQrsDisponiveis([]);
          }
        }
      } else if (!cancelado) {
        setPixManualConectado(false);
        setPixManualQrsDisponiveis([]);
      }
    }

    carregarStatusMercadoPago();
    return () => {
      cancelado = true;
    };
  }, [aberto]);

  const metodoPagamentoCompradorDisponivel =
    (mercadoPagoSistemaHabilitado && mpConectado === true) ||
    (pixManualSistemaHabilitado && pixManualConectado === true);
  const mercadoPagoDisponivelParaLive = Boolean(mercadoPagoSistemaHabilitado && mpConectado);
  const pixManualDisponivelParaLive = Boolean(
    pixManualSistemaHabilitado && pixManualConectado === true
  );
  const blocoTemMetodosPagamentoExplicitos = Boolean(
    bloco?.metodosPagamento &&
      (
        typeof bloco.metodosPagamento?.mercadoPago === "boolean" ||
        typeof bloco.metodosPagamento?.pixManual === "boolean"
      )
  );

  useEffect(() => {
    if (!aberto || bloco?.tipo !== "live" || blocoTemMetodosPagamentoExplicitos) return;
    setPermitirMercadoPagoLive(mercadoPagoDisponivelParaLive);
    setPermitirPixManualLive(pixManualDisponivelParaLive);
  }, [
    aberto,
    bloco?.tipo,
    blocoTemMetodosPagamentoExplicitos,
    mercadoPagoDisponivelParaLive,
    pixManualDisponivelParaLive,
  ]);

  useEffect(() => {
    const visibilidadeExclusiva =
      visibilidade === "exclusivo_assinante" || visibilidade === "exclusivo_comprador";

    if (!metodoPagamentoCompradorDisponivel && visibilidadeExclusiva) {
      setVisibilidade("publico");
      setValorCompra("");
    }
  }, [metodoPagamentoCompradorDisponivel, visibilidade]);

  const isExclusivoComprador = visibilidade === "exclusivo_comprador";
  const pixManualValoresDisponiveis = Array.isArray(pixManualQrsDisponiveis)
    ? [...pixManualQrsDisponiveis]
        .map((item) => ({
          valorCentavos: Number(item?.valorCentavos) || 0,
          titulo: String(item?.titulo || "").trim(),
        }))
        .filter((item) => item.valorCentavos > 0)
        .sort((a, b) => a.valorCentavos - b.valorCentavos)
    : [];
  const usarValoresPixManual =
    isExclusivoComprador &&
    pixManualSistemaHabilitado &&
    pixManualConectado === true &&
    pixManualValoresDisponiveis.length > 0;
  const nomeBlocoSingularCapitalizado = capitalizar(nomeBlocoSingular);

  const opcoesVisibilidade = useMemo(() => {
    if (metodoPagamentoCompradorDisponivel) return OPCOES_VISIBILIDADE;

    const opcoesBase = OPCOES_VISIBILIDADE.filter(
      (opcao) =>
        opcao.value !== "exclusivo_assinante" &&
        opcao.value !== "exclusivo_comprador"
    );

    if (!opcoesBase.some((opcao) => opcao.value === visibilidade)) {
      const opcaoAtual = OPCOES_VISIBILIDADE.find((opcao) => opcao.value === visibilidade);
      if (opcaoAtual) {
        return [opcaoAtual, ...opcoesBase];
      }
    }

    return opcoesBase;
  }, [metodoPagamentoCompradorDisponivel, visibilidade]);

  const parseValorCompraEmCentavos = (valorTexto) => {
    const normalizado = String(valorTexto || "").replace(",", ".").trim();
    if (!normalizado) return null;
    const valorNumerico = Number(normalizado);
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) return null;
    return Math.round(valorNumerico * 100);
  };

  const formatarPreco = (precoCentavos, moeda = "BRL") => {
    const valorNumerico = Number(precoCentavos);
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) return null;
    try {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: moeda || "BRL",
      }).format(valorNumerico / 100);
    } catch {
      return `R$ ${(valorNumerico / 100).toFixed(2)}`;
    }
  };

  useEffect(() => {
    if (!usarValoresPixManual) return;
    const valoresPermitidos = new Set(
      pixManualValoresDisponiveis.map((item) => String(item.valorCentavos))
    );
    if (valoresPermitidos.has(String(valorCompra || ""))) return;
    setValorCompra(String(pixManualValoresDisponiveis[0]?.valorCentavos || ""));
  }, [usarValoresPixManual, pixManualValoresDisponiveis, valorCompra]);

  const handleToggleRemover = (index) => {
    setIndicesRemovidos((prev) =>
      prev.includes(index) ? prev.filter((item) => item !== index) : [...prev, index]
    );
  };

  const removerNovaImagem = (index) => {
    setNovasImagens((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const imagensAtivas = useMemo(
    () => imagensEditor.filter((item) => !indicesRemovidos.includes(item.index)),
    [imagensEditor, indicesRemovidos]
  );

  const handleSalvar = async () => {
    const precoCentavos = isExclusivoComprador
      ? usarValoresPixManual
        ? Number(valorCompra) || null
        : parseValorCompraEmCentavos(valorCompra)
      : null;

    if (isExclusivoComprador && !precoCentavos) {
      alert(`Informe um valor valido para ${nomeBlocoSingular} exclusivo de comprador.`);
      return;
    }

    if (
      bloco?.tipo === "live" &&
      isExclusivoComprador &&
      !permitirMercadoPagoLive &&
      !permitirPixManualLive
    ) {
      alert("Selecione ao menos um metodo de pagamento para a live.");
      return;
    }

    if (!imagensAtivas.length && !novasImagens.length) {
      alert(`O ${nomeBlocoSingular} precisa ter ao menos uma imagem.`);
      return;
    }

    const salvou = await onSalvar({
      visibilidade,
      precoCentavos: precoCentavos || null,
      moeda: precoCentavos ? "BRL" : null,
      metodosPagamento:
        bloco?.tipo === "live"
          ? visibilidade === "exclusivo_comprador"
            ? {
                mercadoPago: Boolean(permitirMercadoPagoLive),
                pixManual: Boolean(permitirPixManualLive),
              }
            : {
                mercadoPago: true,
                pixManual: true,
              }
          : undefined,
      removerIndices: indicesRemovidos,
      novasImagens,
    });

    if (salvou !== false) {
      setAberto(false);
      setIndicesRemovidos([]);
      setNovasImagens([]);
    }
  };

  const handleCancelar = () => {
    setVisibilidade(bloco?.visibilidade || "publico");
    setValorCompra(bloco?.precoCentavos ? (Number(bloco.precoCentavos) / 100).toFixed(2) : "");
    const metodosPagamento = normalizarMetodosPagamentoBloco(bloco, {
      mercadoPago: true,
      pixManual: true,
    });
    setPermitirMercadoPagoLive(metodosPagamento.mercadoPago);
    setPermitirPixManualLive(metodosPagamento.pixManual);
    setIndicesRemovidos([]);
    setNovasImagens([]);
    setAberto(false);
  };

  const bloqueado = salvando || excluindo;

  return (
    <div style={{ marginTop: 8, borderTop: "1px solid #ddd", paddingTop: 8 }}>
      {!aberto ? (
        <button onClick={() => setAberto(true)} disabled={bloqueado}>
          {`Editar ${nomeBlocoSingular}`}
        </button>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={visibilidade}
            onChange={(event) => setVisibilidade(event.target.value)}
            disabled={bloqueado}
          >
            {opcoesVisibilidade.map((opcao) => (
              <option key={opcao.value} value={opcao.value}>
                {opcao.label}
              </option>
            ))}
          </select>

          {!mercadoPagoSistemaHabilitado && !pixManualSistemaHabilitado ? (
            <p style={{ margin: "4px 0", fontSize: 12, color: "#666", width: "100%" }}>
              Metodos de pagamento desativados em PROPRIEDADES DO SISTEMA.
            </p>
          ) : !metodoPagamentoCompradorDisponivel && (
            <p style={{ margin: "4px 0", fontSize: 12, color: "#666", width: "100%" }}>
              {`Conecte o Mercado Pago ou configure PIX manual para habilitar visibilidade exclusiva para assinantes/compradores de ${nomeBlocoPlural}.`}
            </p>
          )}

          {isExclusivoComprador && (
            <>
              {bloco?.tipo === "live" ? (
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
                  <strong>Metodos permitidos nesta live</strong>
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={permitirMercadoPagoLive}
                      disabled={!mercadoPagoDisponivelParaLive || bloqueado}
                      onChange={(event) => setPermitirMercadoPagoLive(event.target.checked)}
                    />
                    <span>
                      Mercado Pago
                      {!mercadoPagoDisponivelParaLive ? " (indisponivel)" : ""}
                    </span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={permitirPixManualLive}
                      disabled={!pixManualDisponivelParaLive || bloqueado}
                      onChange={(event) => setPermitirPixManualLive(event.target.checked)}
                    />
                    <span>
                      PIX manual
                      {!pixManualDisponivelParaLive ? " (indisponivel)" : ""}
                    </span>
                  </label>
                </div>
              ) : null}
              {usarValoresPixManual ? (
                <select
                  value={valorCompra}
                  onChange={(event) => setValorCompra(event.target.value)}
                  disabled={bloqueado}
                >
                  {pixManualValoresDisponiveis.map((item) => (
                    <option key={item.valorCentavos} value={item.valorCentavos}>
                      {item.titulo
                        ? `${item.titulo} - ${formatarPreco(item.valorCentavos)}`
                        : formatarPreco(item.valorCentavos)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Valor (R$)"
                  value={valorCompra}
                  onChange={(event) => setValorCompra(event.target.value)}
                  disabled={bloqueado}
                />
              )}
              {pixManualSistemaHabilitado &&
              pixManualConectado === true &&
              !pixManualValoresDisponiveis.length ? (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "#666", width: "100%" }}>
                  Configure ao menos um QR por valor no PIX manual para compra automatica por valor.
                </p>
              ) : null}
            </>
          )}

          <div style={{ width: "100%" }}>
            <p style={{ margin: "6px 0" }}>{`Imagens atuais do ${nomeBlocoSingular}`}</p>
            {!imagensEditor.length && <p style={{ margin: "6px 0" }}>Nenhuma imagem cadastrada.</p>}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {imagensEditor.map((imagem) => {
                const removida = indicesRemovidos.includes(imagem.index);
                return (
                  <div
                    key={`${bloco?.id}-${imagem.index}`}
                    style={{
                      opacity: removida ? 0.4 : 1,
                      border: "1px solid #ccc",
                      borderRadius: 4,
                      padding: 6,
                    }}
                  >
                    {imagem.displayUrl ? (
                      <img
                        src={imagem.displayUrl}
                        alt=""
                        style={{ width: 96, height: 96, objectFit: "cover", display: "block" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 96,
                          height: 96,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#efefef",
                          color: "#555",
                        }}
                      >
                        Sem preview
                      </div>
                    )}
                    <button
                      onClick={() => handleToggleRemover(imagem.index)}
                      disabled={bloqueado}
                      style={{ marginTop: 6, color: removida ? "#0a7f2f" : "red" }}
                    >
                      {removida ? "Desfazer remocao" : "Remover"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ width: "100%" }}>
            <p style={{ margin: "10px 0 6px" }}>Adicionar imagens</p>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(event) => {
                const arquivos = Array.from(event.target.files || []);
                if (!arquivos.length) return;
                setNovasImagens((prev) => [...prev, ...arquivos]);
                event.target.value = "";
              }}
              disabled={bloqueado}
            />
            {!!novasImagens.length && (
              <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {novasImagens.map((arquivo, index) => (
                  <button
                    key={`${arquivo.name}-${arquivo.lastModified}-${index}`}
                    onClick={() => removerNovaImagem(index)}
                    disabled={bloqueado}
                    style={{ color: "red" }}
                  >
                    Remover: {arquivo.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleSalvar} disabled={bloqueado}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>
          <button onClick={handleCancelar} disabled={bloqueado}>
            Cancelar
          </button>
          <button onClick={onExcluir} disabled={bloqueado} style={{ color: "red" }}>
            {excluindo ? "Excluindo..." : `Excluir ${nomeBlocoSingularCapitalizado}`}
          </button>
        </div>
      )}
    </div>
  );
}
