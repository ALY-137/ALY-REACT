export default function SpriteSheetLoginTransition({
  mostrarLogin,
  spriteUrl,
  children,
}) {
  return (
    <div id="login" className="sprite-loader-transition-shell" aria-live="polite">
      <div className={`sprite-loader-layer ${mostrarLogin ? "sprite-loader-layer-hidden" : ""}`}>
        <div
          className="loader-cherry"
          aria-hidden="true"
          style={spriteUrl ? { backgroundImage: `url("${spriteUrl}")` } : undefined}
        />
      </div>
      <div className={`sprite-login-content-layer containerLogin ${mostrarLogin ? "fadeIn" : ""}`}>
        {children}
      </div>
    </div>
  );
}
