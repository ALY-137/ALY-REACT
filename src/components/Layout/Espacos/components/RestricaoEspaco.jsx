export default function RestricaoEspaco({
  visivel = false,
  avatarUrl = "",
  mensagem = "",
  estiloMensagem = undefined,
} = {}) {
  if (!visivel) return null;

  const avatar = String(avatarUrl || "").trim();

  return (
    <div className="espaco-restricao-wrapper">
      {avatar ? (
        <img
          src={avatar}
          alt="Avatar da mensagem"
          className="espaco-restricao-avatar"
        />
      ) : null}

      <div className="espaco-restricao-balao">
        {avatar ? (
          <span aria-hidden="true" className="espaco-restricao-balao-ponteiro" />
        ) : null}

        <div className="espaco-restricao-conteudo">
          <span aria-hidden="true" className="espaco-restricao-aviso-icon" />
          <p className="espaco-restricao-texto" style={estiloMensagem}>
            {mensagem || "Conteudo restrito."}
          </p>
        </div>
      </div>
    </div>
  );
}
