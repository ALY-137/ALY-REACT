import { useEffect, useMemo, useState } from "react";
import { obterStatusMercadoPago } from "../Pagamentos/mercadoPagoApi";
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
  const [indicesRemovidos, setIndicesRemovidos] = useState([]);
  const [novasImagens, setNovasImagens] = useState([]);
  const [mpConectado, setMpConectado] = useState(null);
  const [mercadoPagoSistemaHabilitado, setMercadoPagoSistemaHabilitado] = useState(
    DEFAULT_SISTEMA_CONFIG.mercadoPagoHabilitado
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
    setIndicesRemovidos([]);
    setNovasImagens([]);
    setMpConectado(null);
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
      try {
        const configSistema = await obterConfigSistema();
        moduloMercadoPagoAtivo = configSistema?.mercadoPagoHabilitado !== false;
      } catch {
        // Mantem fallback local.
      }

      if (!cancelado) {
        setMercadoPagoSistemaHabilitado(moduloMercadoPagoAtivo);
      }

      if (!moduloMercadoPagoAtivo) {
        if (!cancelado) {
          setMpConectado(false);
        }
        return;
      }

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
    }

    carregarStatusMercadoPago();
    return () => {
      cancelado = true;
    };
  }, [aberto]);

  useEffect(() => {
    const visibilidadeExclusiva =
      visibilidade === "exclusivo_assinante" || visibilidade === "exclusivo_comprador";

    if ((!mercadoPagoSistemaHabilitado || mpConectado === false) && visibilidadeExclusiva) {
      setVisibilidade("publico");
      setValorCompra("");
    }
  }, [mercadoPagoSistemaHabilitado, mpConectado, visibilidade]);

  const isExclusivoComprador = visibilidade === "exclusivo_comprador";
  const nomeBlocoSingularCapitalizado = capitalizar(nomeBlocoSingular);

  const opcoesVisibilidade = useMemo(() => {
    if (mercadoPagoSistemaHabilitado && mpConectado === true) return OPCOES_VISIBILIDADE;

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
  }, [mercadoPagoSistemaHabilitado, mpConectado, visibilidade]);

  const parseValorCompraEmCentavos = (valorTexto) => {
    const normalizado = String(valorTexto || "").replace(",", ".").trim();
    if (!normalizado) return null;
    const valorNumerico = Number(normalizado);
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) return null;
    return Math.round(valorNumerico * 100);
  };

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
      ? parseValorCompraEmCentavos(valorCompra)
      : null;

    if (isExclusivoComprador && !precoCentavos) {
      alert(`Informe um valor valido para ${nomeBlocoSingular} exclusivo de comprador.`);
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

          {!mercadoPagoSistemaHabilitado ? (
            <p style={{ margin: "4px 0", fontSize: 12, color: "#666", width: "100%" }}>
              Mercado Pago desativado em PROPRIEDADES DO SISTEMA.
            </p>
          ) : mpConectado === false && (
            <p style={{ margin: "4px 0", fontSize: 12, color: "#666", width: "100%" }}>
              {`Conecte o Mercado Pago para habilitar visibilidade exclusiva para assinantes/compradores de ${nomeBlocoPlural}.`}
            </p>
          )}

          {isExclusivoComprador && (
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
