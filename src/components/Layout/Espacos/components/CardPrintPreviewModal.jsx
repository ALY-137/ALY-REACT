import Card from "../../Objects/Objetos/Card";
import QRCodeImage from "../../../Funcionalidades/QRCode/QRCodeImage";

const CardPrintPreviewModal = ({
  previewImpressaoCard,
  previewImpressaoPopup,
  qrPrintsHistorico,
  qrPrintLeituras,
  qrPrintExcluindoId,
  qrPrintSelecionadoParaImpressao,
  podeGerenciar,
  ownerUserId,
  espacoId,
  cyberpinkSubtheme,
  onCloseHistory,
  onRefreshHistory,
  onDescricaoRegistroChange,
  onCreateQr,
  onOpenPrint,
  onToggleReadings,
  onDeleteQr,
  onClosePrint,
  onAddOnClick,
  onCardFragmentClick,
  formatarDataCurta,
  normalizarAddOnIds,
  normalizarAddOnSubthemes,
}) => {
  const cardAtual = previewImpressaoCard?.card || null;
  const historicoAberto = Boolean(previewImpressaoCard?.aberto && cardAtual);
  const impressaoAberta = Boolean(
    previewImpressaoPopup?.aberto && qrPrintSelecionadoParaImpressao && cardAtual
  );

  const renderHistorico = () => {
    if (!historicoAberto) return null;

    return (
      <div
        role="dialog"
        aria-modal="true"
        className="card-print-preview-modal"
        onClick={onCloseHistory}
      >
        <div
          className="card-print-preview-modal__content card-print-preview-modal__content--history"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="card-print-preview-modal__header">
            <div>
              <strong>Historico de Card Rastreaveis</strong>
              <p>
                Crie, acompanhe e selecione um card rastreavel para abrir a visualizacao de impressao.
              </p>
            </div>
            <button
              type="button"
              className="card-print-preview-modal__close"
              onClick={onCloseHistory}
              aria-label="Fechar historico de cards rastreaveis"
              title="Fechar"
            >
              <span className="card-print-preview-modal__close-icon" aria-hidden="true" />
            </button>
          </div>

          {podeGerenciar ? (
            <section className="card-print-history" aria-live="polite">
              <div className="card-print-history__toolbar">
                <span className="card-print-history__toolbar-label">
                  {`${qrPrintsHistorico.itens.length} registro(s) rastreavel(is)`}
                </span>
                <button
                  type="button"
                  className="card-print-history__button"
                  onClick={() =>
                    onRefreshHistory({
                      bloco: previewImpressaoCard.bloco,
                      card: previewImpressaoCard.card,
                    })
                  }
                  disabled={qrPrintsHistorico.loading}
                >
                  Atualizar
                </button>
              </div>

              <div className="card-print-history__creator">
                <label className="card-print-history__creator-field">
                  <span>Descricao do registro</span>
                  <textarea
                    value={previewImpressaoCard.descricaoRegistro || ""}
                    onChange={(event) => onDescricaoRegistroChange(event.target.value)}
                    rows={3}
                    maxLength={240}
                    placeholder="Ex.: impressao para processo seletivo front-end, feira de projetos, envio para cliente..."
                  />
                </label>

                <div className="card-print-history__creator-actions">
                  <button
                    type="button"
                    className="card-print-history__button"
                    onClick={onCreateQr}
                    disabled={previewImpressaoCard.criandoQr}
                  >
                    {previewImpressaoCard.criandoQr ? "Criando QR..." : "Criar card QR"}
                  </button>
                  <span className="card-print-history__creator-current">
                    {previewImpressaoCard.printId
                      ? `QR atual: ${previewImpressaoCard.printId}`
                      : "Ainda nao existe QR rastreavel criado nesta visualizacao."}
                  </span>
                </div>

                {previewImpressaoCard.urlQr ? (
                  <div className="card-print-history__creator-meta">
                    <span>{`URL do QR: ${previewImpressaoCard.urlQr}`}</span>
                  </div>
                ) : null}
              </div>

              {previewImpressaoCard.qrErro ? (
                <p className="card-print-history__error">{previewImpressaoCard.qrErro}</p>
              ) : null}

              {qrPrintsHistorico.loading ? (
                <p className="card-print-history__status">Carregando historico...</p>
              ) : qrPrintsHistorico.erro ? (
                <p className="card-print-history__error">{qrPrintsHistorico.erro}</p>
              ) : qrPrintsHistorico.itens.length ? (
                <div className="card-print-history__list">
                  {qrPrintsHistorico.itens.map((print) => {
                    const leituraState = qrPrintLeituras[print.id] || {};
                    const leituras = Array.isArray(leituraState.itens)
                      ? leituraState.itens
                      : [];
                    const totalLeituras = leituras.length || Number(print.totalLeituras || 0);

                    return (
                      <article className="card-print-history__item" key={print.id}>
                        <div className="card-print-history__item-main">
                          <strong>{print.cardNome || "Card impresso"}</strong>
                          <span>{`Print: ${print.printId || print.id}`}</span>
                          <span>{`Criado: ${formatarDataCurta(print.criadoEm)}`}</span>
                          <span>{`Descricao: ${
                            String(print.descricaoRegistro || "").trim() || "--"
                          }`}</span>
                          <span>{`URL QR: ${String(print.urlQr || "").trim() || "--"}`}</span>
                          <span>{`Leituras: ${totalLeituras || "--"}`}</span>
                        </div>
                        <div className="card-print-history__item-actions">
                          <button
                            type="button"
                            className="card-print-history__button"
                            onClick={() => onOpenPrint(print.id)}
                          >
                            Imprimir card
                          </button>
                          <button
                            type="button"
                            className="card-print-history__button"
                            onClick={() => onToggleReadings(print.id)}
                            disabled={leituraState.loading}
                          >
                            {leituraState.aberto ? "Ocultar" : "Ver leituras"}
                          </button>
                        </div>

                        <div className="card-print-history__delete-row">
                          <button
                            type="button"
                            className="card-print-history__button card-print-history__button--danger"
                            onClick={() => {
                              void onDeleteQr(print.id);
                            }}
                            disabled={qrPrintExcluindoId === print.id}
                          >
                            {qrPrintExcluindoId === print.id
                              ? "Excluindo card rastreavel..."
                              : "Excluir card rastreavel"}
                          </button>
                        </div>

                        {leituraState.aberto ? (
                          <div className="card-print-history__readings">
                            {leituraState.loading ? (
                              <p className="card-print-history__status">Carregando leituras...</p>
                            ) : leituraState.erro ? (
                              <p className="card-print-history__error">{leituraState.erro}</p>
                            ) : leituras.length ? (
                              leituras.map((leitura) => {
                                const localizacao = [
                                  leitura.city || leitura.cidade,
                                  leitura.uf || leitura.regionCode,
                                  leitura.country,
                                ]
                                  .map((item) => String(item || "").trim())
                                  .filter(Boolean)
                                  .join(" / ");
                                const identidade =
                                  leitura.navigationId ||
                                  leitura.hash ||
                                  leitura.visitorHash ||
                                  leitura.email ||
                                  leitura.uid ||
                                  "--";
                                const contaAutenticada = leitura.email || leitura.uid || "--";

                                return (
                                  <div
                                    className="card-print-history__reading"
                                    key={leitura.id}
                                  >
                                    <span>{`Data/Hora: ${formatarDataCurta(
                                      leitura.data || leitura.criadoEm
                                    )}`}</span>
                                    <span>{`IP: ${leitura.ip || "--"}`}</span>
                                    <span>{`Local: ${localizacao || "--"}`}</span>
                                    <span>{`Identificador de navegacao: ${identidade}`}</span>
                                    {Boolean(leitura.email || leitura.uid) ? (
                                      <span>{`Conta: ${contaAutenticada}`}</span>
                                    ) : null}
                                    <span>{`Rota: ${leitura.fullPath || leitura.path || "--"}`}</span>
                                  </div>
                                );
                              })
                            ) : (
                              <p className="card-print-history__status">
                                Nenhuma leitura registrada para este QR ainda.
                              </p>
                            )}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="card-print-history__status">
                  Nenhum QR rastreavel encontrado para este card ainda.
                </p>
              )}
            </section>
          ) : null}
        </div>
      </div>
    );
  };

  const renderImpressao = () => {
    if (!impressaoAberta) return null;

    return (
      <div
        role="dialog"
        aria-modal="true"
        className="card-print-preview-modal"
        onClick={onClosePrint}
      >
        <div
          className="card-print-preview-modal__content"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="card-print-preview-modal__header">
            <div>
              <strong>Imprimir card</strong>
              <p>
                {`Visualizacao do rastreavel ${
                  qrPrintSelecionadoParaImpressao.printId ||
                  qrPrintSelecionadoParaImpressao.id
                }.`}
              </p>
            </div>
            <div className="card-print-preview-modal__header-actions">
              <button
                type="button"
                className="card-print-history__button"
                onClick={() => window.print()}
              >
                Imprimir / PDF
              </button>
              <button
                type="button"
                className="card-print-preview-modal__close"
                onClick={onClosePrint}
                aria-label="Fechar visualizacao de impressao do card"
                title="Fechar"
              >
                <span className="card-print-preview-modal__close-icon" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="card-print-preview-modal__grid">
            <section className="card-print-preview-modal__section">
              <h3>Frente</h3>
              <div className="card-print-preview-front">
                <Card
                  id={previewImpressaoCard.card.id}
                  ownerUserId={ownerUserId}
                  espacoId={espacoId}
                  blocoId={previewImpressaoCard.bloco?.id || ""}
                  addOnIds={normalizarAddOnIds(previewImpressaoCard.card.addOnIds)}
                  addOnSubthemes={normalizarAddOnSubthemes(
                    previewImpressaoCard.card.addOnSubthemes,
                    previewImpressaoCard.card.addOnIds
                  )}
                  usaAddOnsGerenciador={
                    previewImpressaoCard.card?.usaAddOnsGerenciador === true
                  }
                  addOns={previewImpressaoCard.addOns}
                  aly137={previewImpressaoCard.card.aly137}
                  onAddOnClick={onAddOnClick}
                  onCardFragmentClick={onCardFragmentClick}
                  cyberpinkSubtheme={cyberpinkSubtheme}
                  nome={previewImpressaoCard.card.nome || "Card"}
                  descricaoExtra=""
                  nomeDescricao={previewImpressaoCard.card.nome || ""}
                  descricao={
                    previewImpressaoCard.card.descricaoPrevia ||
                    previewImpressaoCard.card.descricao ||
                    ""
                  }
                  linkExterno={previewImpressaoCard.card.linkExterno || ""}
                  imagem={previewImpressaoCard.imagem || "/logoNeon.png"}
                  idNome={`card-print-front-${previewImpressaoCard.card.id}`}
                  cardDescricaoDiv="cardDescricaoDiv"
                  cardNome="cardNome"
                  cardContainerDesktop="cardContainerDesktop"
                  cardCabecalho="cardCabecalho"
                  cardImagem="cardImagem"
                  cardDescricao="cardDescricao"
                  imgCard="imgCard"
                />
              </div>
            </section>

            <section className="card-print-preview-modal__section">
              <h3>Verso</h3>
              <div className="card-print-preview-back">
                <span className="card-print-preview-back__circuit-map" aria-hidden="true" />
                <div className="card-print-preview-back__qr">
                  <QRCodeImage
                    value={
                      qrPrintSelecionadoParaImpressao.urlQr ||
                      qrPrintSelecionadoParaImpressao.urlCard ||
                      previewImpressaoCard.urlQr ||
                      previewImpressaoCard.urlCard ||
                      previewImpressaoCard.url
                    }
                    size={116}
                    alt="QR code rastreavel da rota unica do card"
                    className="card-print-preview-back__qr-image"
                    color="var(--cyberpink-subtheme-card-surface-shadow)"
                    bgColor="var(--cyberpink-subtheme-text)"
                  />
                </div>
                <span className="card-print-preview-back__track-label">
                  {`QR rastreavel ${
                    qrPrintSelecionadoParaImpressao.printId ||
                    qrPrintSelecionadoParaImpressao.id
                  }`}
                </span>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {renderHistorico()}
      {renderImpressao()}
    </>
  );
};

export default CardPrintPreviewModal;
