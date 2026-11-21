export function SceneLoading() {
  return (
    <div className="scene-loading" role="status" aria-live="polite">
      <svg viewBox="0 0 200 200" width="180" height="180" aria-hidden="true" className="scene-loading-mark">
        <circle cx="100" cy="100" r="52" fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1" />
        <ellipse cx="100" cy="100" rx="88" ry="34" fill="none" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1" />
        <ellipse
          cx="100"
          cy="100"
          rx="88"
          ry="34"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.5"
          strokeWidth="1.5"
          className="scene-loading-sweep"
          strokeLinecap="round"
        />
        <circle cx="100" cy="100" r="18" fill="currentColor" fillOpacity="0.1" />
        <circle cx="100" cy="100" r="18" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
      </svg>
      <span className="sr-only">Loading the discovery scene</span>
    </div>
  );
}
