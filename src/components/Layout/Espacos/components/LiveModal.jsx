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
  liveCameraAtiva = false,
  liveCameraErro = "",
  liveCameraVideoRef,
  liveCameraStream = null,
  currentUidAutenticado = "",
  liveCameraRemotaStatus = "",
  liveCameraRemotaAtiva = false,
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
  if (!aberto) return null;

  const isMobile = typeof window !== "undefined" && window.innerWidth <= 860;

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
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "stretch",
      }}
    >
      <div
        className="live-modal__surface"
        onClick={(event) => event.stopPropagation()}
        style={{
          position: "relative",
          width: "100vw",
          height: "100dvh",
          overflow: "hidden",
        }}
      >
        {ehVideoDireto ? (
          <video
            className="live-modal__media"
            src={liveUrl}
            controls
            autoPlay
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              background: "#000",
            }}
          />
        ) : (
          <iframe
            className="live-modal__media"
            title={titulo || "Live"}
            src={embedUrl || liveUrl}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              background: "#000",
            }}
          />
        )}

        <button
          className="live-modal__close"
          type="button"
          onClick={onClose}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 3,
            cursor: "pointer",
          }}
        >
          Fechar live
        </button>

        <div
          className="live-modal__chat"
          style={{
            position: "absolute",
            right: 12,
            top: isMobile ? "auto" : 12,
            bottom: 12,
            width: isMobile ? "calc(100% - 24px)" : "min(360px, 34vw)",
            height: isMobile ? "45dvh" : "calc(100% - 24px)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 2,
          }}
        >
          <div className="live-modal__header">
            <strong className="live-modal__title">Chat da live</strong>
          </div>

          {usuarioPodeControlarCameraLive ? (
            <div className="live-modal__toolbar">
              <span className="live-modal__toolbar-label">Camera do criador</span>
              <button type="button" onClick={alternarCameraLive}>
                {liveCameraAtiva ? "Desligar camera" : "Ligar camera"}
              </button>
            </div>
          ) : null}

          {liveCameraErro ? (
            <p className="live-modal__error">{liveCameraErro}</p>
          ) : null}

          {liveCameraAtiva ? (
            <div className="live-modal__camera-section">
              <video
                className="live-modal__camera"
                ref={(node) => {
                  if (typeof liveCameraVideoRef === "function") {
                    liveCameraVideoRef(node);
                    return;
                  }
                  if (liveCameraVideoRef && "current" in liveCameraVideoRef) {
                    liveCameraVideoRef.current = node;
                  }
                  const stream = liveCameraStream;
                  if (!node || !stream) return;
                  try {
                    if (node.srcObject !== stream) {
                      node.srcObject = stream;
                    }
                    node.setAttribute("playsinline", "true");
                    node.setAttribute("autoplay", "true");
                    node.muted = true;
                    node.play().catch(() => {});
                  } catch {
                    // no-op
                  }
                }}
                autoPlay
                muted
                playsInline
              />
            </div>
          ) : null}

          {!usuarioPodeControlarCameraLive && currentUidAutenticado ? (
            <div className="live-modal__camera-section">
              <div className="live-modal__camera-toolbar">
                <span className="live-modal__toolbar-label">Camera ao vivo do criador</span>
                <span className="live-modal__toolbar-status">
                  {liveCameraRemotaStatus || "Aguardando..."}
                </span>
              </div>

              {liveCameraRemotaAtiva ? (
                <video
                  className="live-modal__camera"
                  ref={(node) => {
                    if (typeof liveCameraRemotaVideoRef === "function") {
                      liveCameraRemotaVideoRef(node);
                      return;
                    }
                    if (liveCameraRemotaVideoRef && "current" in liveCameraRemotaVideoRef) {
                      liveCameraRemotaVideoRef.current = node;
                    }
                    const stream = liveCameraRemotaStream;
                    if (!node || !stream) return;
                    try {
                      if (node.srcObject !== stream) {
                        node.srcObject = stream;
                      }
                      node.setAttribute("playsinline", "true");
                      node.setAttribute("autoplay", "true");
                      node.play().catch(() => {});
                    } catch {
                      // no-op
                    }
                  }}
                  autoPlay
                  muted
                  playsInline
                />
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
