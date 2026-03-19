import RitualLoaderSymbol from "./RitualLoaderSymbol";

export default function RitualLoginTransition({ mostrarLogin, children }) {
  return (
    <div id="login" className="ritual-login-transition-shell" aria-live="polite">
      <div
        className={`ritual-loader-layer ${mostrarLogin ? "ritual-loader-layer-hidden" : ""}`}
      >
        <RitualLoaderSymbol />
      </div>
      <div
        className={`ritual-login-content-layer containerLogin ${mostrarLogin ? "fadeIn" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}
