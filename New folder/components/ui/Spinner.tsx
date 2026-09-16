// v3.0 — Responsiveness pass. A small inline spinner for busy buttons and
// loading states, so "something is happening" is visible the instant a
// click registers, not just once the network round trip finishes. Uses
// currentColor so it always matches whatever text color it's dropped
// into (a secondary button, a danger button, muted loading text, ...).
export function Spinner({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="v2-spinner"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
