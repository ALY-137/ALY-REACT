export default function RitualLoaderSymbol() {
  return (
    <div className="ritual-loader-symbol" aria-hidden="true">
      <div className="ritual-loader-triangle ritual-loader-triangle-up" />
      <div className="ritual-loader-triangle ritual-loader-triangle-down" />
      <div className="ritual-loader-intersection" />
      <div className="ritual-loader-glow" />
      <svg
        className="ritual-loader-y"
        width="100"
        height="100"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <path className="ritual-loader-y-path" d="M20 20 L50 55 L80 20 M50 55 L50 85" />
      </svg>
    </div>
  );
}
