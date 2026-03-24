import { useEffect, useMemo, useState } from "react";
import LoginButton from "../../Geral/LoginButton";

export default function LiveModal({
  aberto = false,
  onClose,
  ehVideoDireto = false,
  titulo = "Live",
  liveUrl = "",
  embedUrl = "",
  usuarioPodeControlarCameraLive = false,
  alternarCameraLive,
  alternarFonteCameraLive,
  girarCameraLive,
  liveCameraAtiva = false,
  liveCameraFacingMode = "user",
  liveCameraRotacaoGraus = 0,
  liveCameraErro = "",
  liveCameraVideoRef,
  liveCameraStream = null,
  currentUidAutenticado = "",
  liveCameraRemotaStatus = "",
  liveCameraRemotaAtiva = false,
  liveCameraRemotaRotacaoGraus = 0,
  liveCameraRemotaVideoRef,
  liveCameraRemotaStream = null,
  liveCriadorCameraAtiva = false,
  liveCameraRemotaErro = "",
  liveChatScrollRef,
  liveChatMensagens = [],
  liveChatErro = "",
  liveChatMensagem = "",
  setLiveChatMensagem,
  enviarMensagemLive,
}) {
  const [cameraTelaCheia, setCameraTelaCheia] = useState(false);
  const [midiaDiretaFalhou, setMidiaDiretaFalhou] = useState(false);

  const isMobile = typeof window !== "undefined" && window.innerWidth <= 860;
  const cameraLocalDisponivel = Boolean(usuarioPodeControlarCameraLive && liveCameraAtiva);
  const cameraRemotaDisponivel = Boolean(
    !usuarioPodeControlarCameraLive && currentUidAutenticado && liveCameraRemotaAtiva
  );
  const cameraDisponivel = cameraLocalDisponivel || cameraRemotaDisponivel;
  const rotacaoLocal = Number(liveCameraRotacaoGraus) || 0;
  const rotacaoRemota = Number(liveCameraRemotaRotacaoGraus) || 0;
  const liveUrlNormalizada = String(liveUrl || "").trim();
  const embedUrlNormalizada = String(embedUrl || "").trim();
  const iframeDisponivel = !ehVideoDireto && Boolean(embedUrlNormalizada);
  const exibirMidiaIncorporada =
    Boolean(ehVideoDireto && !midiaDiretaFalhou && liveUrlNormalizada) || iframeDisponivel;

  const cameraStage = useMemo(() => {
    if (cameraLocalDisponivel) {
      return {
        ref: liveCameraVideoRef,
        stream: liveCameraStream,
        muted: true,
      };
    }

    if (cameraRemotaDisponivel) {
      return {
        ref: liveCameraRemotaVideoRef,
        stream: liveCameraRemotaStream,
        muted: false,
      };
    }

    return null;
  }, [
    cameraLocalDisponivel,
    cameraRemotaDisponivel,
    liveCameraRemotaStream,
    liveCameraRemotaVideoRef,
    liveCameraStream,
    liveCameraVideoRef,
  ]);

  useEffect(() => {
    if (!aberto || !cameraDisponivel) {
      setCameraTelaCheia(false);
    }
  }, [aberto, cameraDisponivel]);

  useEffect(() => {
    setMidiaDiretaFalhou(false);
  }, [aberto, ehVideoDireto, liveUrlNormalizada, embedUrlNormalizada]);

  const conectarVideoAoStream = (node, stream, { muted = false } = {}) => {
    if (!node || !stream) return;
    try {
      if (node.srcObject !== stream) {
        node.srcObject = stream;
      }
      node.setAttribute("playsinline", "true");
      node.setAttribute("autoplay", "true");
      node.muted = Boolean(muted);
      node.play().catch(() => {});
    } catch {
      // no-op
    }
  };

  const aplicarRefVideo = (externalRef, node, stream, { muted = false } = {}) => {
    if (typeof externalRef === "function") {
      externalRef(node);
    } else if (externalRef && "current" in externalRef) {
      externalRef.current = node;
    }
    conectarVideoAoStream(node, stream, { muted });
  };

  const renderVideoCamera = ({
    className = "live-modal__camera",
    refExterno,
    stream = null,
    muted = false,
    rotationDeg = 0,
  }) => (
    <video
      className={className}
      ref={(node) => {
        aplicarRefVideo(refExterno, node, stream, { muted });
      }}
      style={{
        transform: `rotate(${Number(rotationDeg) || 0}deg)`,
      }}
      autoPlay
      muted={Boolean(muted)}
      playsInline
    />
  );

  if (!aberto) return null;

  return (
    <div
      className="live-modal"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99998,
        display: "flex",
        alignItems: "stretch",
        justifyContent: isMobile ? "stretch" : "flex-end",
        padding: cameraTelaCheia ? "0" : isMobile ? "12px" : "16px",
      }}
    >
      <div
        className={[
          "live-modal__surface",
          isMobile ? "is-mobile" : "",
          cameraTelaCheia ? "is-fullscreen" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={(event) => event.stopPropagation()}
      >
        {!cameraTelaCheia && exibirMidiaIncorporada ? (
          <div className="live-modal__media-pane">
            {ehVideoDireto ? (
              <video
                className="live-modal__media"
                src={liveUrlNormalizada}
                controls
                autoPlay
                playsInline
                onError={() => setMidiaDiretaFalhou(true)}
              />
            ) : (
              <iframe
                className="live-modal__media"
                title={titulo || "Live"}
                src={embedUrlNormalizada}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              />
            )}
          </div>
        ) : null}

        <button
          className="live-modal__close"
          type="button"
          onClick={onClose}
        >
          Fechar live
        </button>

        {cameraTelaCheia && cameraStage ? (
          <div className="live-modal__camera-stage">
            {renderVideoCamera({
              className: "live-modal__camera-stage-video",
              refExterno: cameraStage.ref,
              stream: cameraStage.stream,
              muted: cameraStage.muted,
              rotationDeg: cameraLocalDisponivel ? rotacaoLocal : rotacaoRemota,
            })}
          </div>
        ) : null}

        <div
          className={[
            "live-modal__chat",
            isMobile ? "live-modal__chat--mobile" : "",
            cameraTelaCheia ? "live-modal__chat--camera-full" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="live-modal__header">
            <strong className="live-modal__title">Chat da live</strong>
          </div>

          {usuarioPodeControlarCameraLive ? (
            <div className="live-modal__toolbar">
              <span className="live-modal__toolbar-label">Camera do criador</span>
              <div className="live-modal__toolbar-actions">
                <button
                  type="button"
                  className="live-modal__camera-toggle"
                  onClick={alternarFonteCameraLive}
                >
                  {String(liveCameraFacingMode || "").trim().toLowerCase() === "environment"
                    ? "Usar frontal"
                    : "Usar traseira"}
                </button>
                <button
                  type="button"
                  className="live-modal__camera-toggle"
                  onClick={girarCameraLive}
                >
                  Girar camera
                </button>
                {cameraLocalDisponivel ? (
                  <button
                    type="button"
                    className="live-modal__camera-toggle"
                    onClick={() => setCameraTelaCheia((estadoAtual) => !estadoAtual)}
                  >
                    {cameraTelaCheia ? "Miniatura" : "Tela cheia"}
                  </button>
                ) : null}
                <button type="button" onClick={alternarCameraLive}>
                  {liveCameraAtiva ? "Desligar camera" : "Ligar camera"}
                </button>
              </div>
            </div>
          ) : null}

          {liveCameraErro ? (
            <p className="live-modal__error">{liveCameraErro}</p>
          ) : null}

          {liveCameraAtiva ? (
            <div className="live-modal__camera-section">
              {!cameraTelaCheia
                ? renderVideoCamera({
                    refExterno: liveCameraVideoRef,
                    stream: liveCameraStream,
                    muted: true,
                    rotationDeg: rotacaoLocal,
                  })
                : (
                  <div className="live-modal__camera-placeholder live-modal__camera-placeholder--compact">
                    Camera exibida em tela cheia.
                  </div>
                )}
            </div>
          ) : null}

          {!usuarioPodeControlarCameraLive && currentUidAutenticado ? (
            <div className="live-modal__camera-section">
              <div className="live-modal__camera-toolbar">
                <span className="live-modal__toolbar-label">Camera ao vivo do criador</span>
                <div className="live-modal__toolbar-actions">
                  <span className="live-modal__toolbar-status">
                    {liveCameraRemotaStatus || "Aguardando..."}
                  </span>
                  {cameraRemotaDisponivel ? (
                    <button
                      type="button"
                      className="live-modal__camera-toggle"
                      onClick={() => setCameraTelaCheia((estadoAtual) => !estadoAtual)}
                    >
                      {cameraTelaCheia ? "Miniatura" : "Tela cheia"}
                    </button>
                  ) : null}
                </div>
              </div>

              {liveCameraRemotaAtiva ? (
                !cameraTelaCheia
                  ? renderVideoCamera({
                      refExterno: liveCameraRemotaVideoRef,
                      stream: liveCameraRemotaStream,
                      muted: false,
                      rotationDeg: rotacaoRemota,
                    })
                  : (
                    <div className="live-modal__camera-placeholder live-modal__camera-placeholder--compact">
                      Camera exibida em tela cheia.
                    </div>
                  )
              ) : (
                <div className="live-modal__camera-placeholder">
                  {liveCameraRemotaStatus ||
                    (liveCriadorCameraAtiva
                      ? "Criador com camera ativa. Conectando..."
                      : "Aguardando o criador ligar a camera.")}
                </div>
              )}
            </div>
          ) : null}

          {liveCameraRemotaErro ? (
            <p className="live-modal__error">{liveCameraRemotaErro}</p>
          ) : null}

          <div
            className="live-modal__messages"
            ref={liveChatScrollRef}
          >
            {!currentUidAutenticado ? (
              <div className="live-modal__login">
                <p className="live-modal__login-text">Faca login para participar do chat.</p>
                <LoginButton />
              </div>
            ) : liveChatMensagens.length ? (
              liveChatMensagens.map((mensagem) => {
                const minhaMensagem =
                  String(mensagem?.userUid || "").trim() ===
                  String(currentUidAutenticado || "").trim();
                return (
                  <div
                    key={mensagem.id}
                    className={[
                      "live-modal__message",
                      minhaMensagem
                        ? "live-modal__message--mine"
                        : "live-modal__message--other",
                    ].join(" ")}
                  >
                    {!minhaMensagem ? (
                      <p className="live-modal__author">
                        {mensagem.userRemetente || "Usuario"}
                      </p>
                    ) : null}
                    <p className="live-modal__text">
                      {mensagem.mensagem}
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="live-modal__empty">Nenhuma mensagem ainda.</p>
            )}
          </div>

          {!!liveChatErro && (
            <p className="live-modal__error">{liveChatErro}</p>
          )}

          <div
            className="live-modal__composer"
          >
            <input
              className="live-modal__input"
              type="text"
              value={liveChatMensagem}
              onChange={(event) => setLiveChatMensagem?.(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  enviarMensagemLive?.();
                }
              }}
              placeholder={currentUidAutenticado ? "Digite sua mensagem..." : "Faca login para enviar"}
              disabled={!currentUidAutenticado}
            />
            <button
              className="live-modal__send"
              type="button"
              onClick={enviarMensagemLive}
              disabled={!currentUidAutenticado}
            >
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
