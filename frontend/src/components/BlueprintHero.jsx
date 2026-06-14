/**
 * A decorative blueprint that draws itself on load — a drafting compass sweeping
 * an arc across construction circles, in warm amber line art. Purely an accent
 * behind the hero; pointer-events: none. Each stroke uses pathLength="1" so the
 * stroke-dasharray draw works uniformly regardless of real path length; the
 * draw + reduced-motion behavior lives in CSS (.bh-stroke).
 */
export default function BlueprintHero() {
  return (
    <svg
      className="blueprint-hero"
      viewBox="0 0 400 400"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* construction circles */}
      <circle className="bh-stroke bh-d0" cx="200" cy="220" r="120" pathLength="1" />
      <circle className="bh-stroke bh-d1" cx="200" cy="220" r="78" pathLength="1" />
      {/* centre crosshair */}
      <path className="bh-stroke bh-d1" d="M200 196 V244 M176 220 H224" pathLength="1" />
      {/* the arc being swept by the compass pencil */}
      <path
        className="bh-stroke bh-arc bh-d4"
        d="M86 250 A120 120 0 0 1 150 116"
        pathLength="1"
      />
      {/* compass: hinge at top, pivot leg to centre, pencil leg to the arc */}
      <path className="bh-stroke bh-d2" d="M200 56 L200 220" pathLength="1" />
      <path className="bh-stroke bh-d3" d="M200 56 L150 116" pathLength="1" />
      {/* hinge + tips */}
      <circle className="bh-stroke bh-d2" cx="200" cy="56" r="9" pathLength="1" />
      <circle className="bh-stroke bh-dot bh-d4" cx="200" cy="220" r="3" pathLength="1" />
      <circle className="bh-stroke bh-dot bh-d4" cx="150" cy="116" r="3" pathLength="1" />
    </svg>
  )
}
