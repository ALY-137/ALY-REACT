import RitualLoaderSymbol from "../../Projects/LoginTransitions/RitualLoaderSymbol";
import {
  DEFAULT_SISTEMA_CONFIG,
  obterConfigSistemaCacheLocal,
} from "../Sistema/configSistema";
import { temaSistemaUsaLoginRitual } from "../Temas/themesRegistry";

export default function ProjectLoadingFallback({
  text = "",
  inline = false,
  ariaLive = "polite",
}) {
  const configSistema = obterConfigSistemaCacheLocal() || DEFAULT_SISTEMA_CONFIG;
  const loginLoadingSpriteUrl = String(configSistema?.loginLoadingSpriteUrl || "").trim();
  const temaSistemaEfetivo = String(
    configSistema?.temaPadraoSistema || DEFAULT_SISTEMA_CONFIG.temaPadraoSistema
  )
    .trim()
    .toUpperCase();
  const usarTransicaoSprite = Boolean(loginLoadingSpriteUrl);
  const usarTransicaoRitual = !usarTransicaoSprite && temaSistemaUsaLoginRitual(temaSistemaEfetivo);

  if (usarTransicaoSprite) {
    return (
      <div
        className={`sprite-loader-layer ${inline ? "sprite-loader-layer-inline" : ""}`.trim()}
        aria-live={ariaLive}
      >
        <div
          className="loader-cherry"
          aria-hidden="true"
          style={loginLoadingSpriteUrl ? { backgroundImage: `url("${loginLoadingSpriteUrl}")` } : undefined}
        />
        {text ? <p className="project-loading-fallback__text">{text}</p> : null}
      </div>
    );
  }

  if (usarTransicaoRitual) {
    return (
      <div className="project-loading-fallback project-loading-fallback--ritual" aria-live={ariaLive}>
        <div className="ritual-loader-layer">
          <RitualLoaderSymbol />
        </div>
        {text ? <p className="project-loading-fallback__text">{text}</p> : null}
      </div>
    );
  }

  return (
    <div className="project-loading-fallback" aria-live={ariaLive}>
      <div className="system-loading-indicator">
        <div className="system-loading-dot" aria-hidden="true" />
      </div>
      {text ? <p className="project-loading-fallback__text">{text}</p> : null}
    </div>
  );
}
