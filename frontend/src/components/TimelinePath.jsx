/**
 * The lighting system, serpentine edition. One full-height SVG overlay draws
 * a continuous S-curve down the center of the roadmap:
 *
 *   segments   — cubic beziers between consecutive nodes with vertical
 *                tangents (control points at the segment's vertical midpoint),
 *                so the path snakes smoothly left and right. Segment i carries
 *                the lighting state of phase i: completed glows, the current
 *                segment carries the traveling orb, upcoming stays dark, and
 *                the first upcoming segment after the current one fades the
 *                light into the dark via a userSpace gradient.
 *   connectors — short horizontal lines from each card's inner edge to its
 *                node, in the phase's own state color.
 *   nodes      — sit on the curve's apex beside their card: filled + check
 *                (completed), filled + pulsing halo (current), outline
 *                (upcoming).
 *   orb        — SVG animateMotion along the current segment, top to bottom,
 *                fading out at the end and restarting. Hidden entirely under
 *                prefers-reduced-motion.
 *
 * Geometry (node positions, card edges, container size) is measured by
 * RoadmapView and passed in; below 768px the same code draws a straight
 * left-hand rail instead of the S-curve.
 */
export default function TimelinePath({ geometry, statuses }) {
  if (!geometry || geometry.nodes.length === 0) return null
  const { width, height, nodes } = geometry

  const segments = []
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i]
    const b = nodes[i + 1]
    const midY = (a.y + b.y) / 2
    segments.push({
      d: `M ${a.x} ${a.y} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}`,
      status: statuses[i],
      startY: a.y,
    })
  }

  const currentSegment = segments.find((seg) => seg.status === 'current')
  // The segment right after the lit one: light bleeds into the dark.
  const bleedIndex = segments.findIndex(
    (seg, i) => i > 0 && seg.status === 'upcoming' && segments[i - 1].status === 'current'
  )

  return (
    <svg
      className="timeline-svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {bleedIndex !== -1 && (
        <defs>
          <linearGradient
            id="tl-bleed"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1={segments[bleedIndex].startY}
            x2="0"
            y2={segments[bleedIndex].startY + 90}
          >
            <stop offset="0" stopColor="#d4a24c" />
            <stop offset="1" stopColor="#3d362e" />
          </linearGradient>
        </defs>
      )}

      {segments.map((seg, i) => (
        <path
          key={i}
          d={seg.d}
          className={`tl-seg seg-${seg.status}`}
          style={i === bleedIndex ? { stroke: 'url(#tl-bleed)', filter: 'none' } : undefined}
        />
      ))}

      {nodes.map((node, i) => (
        <line
          key={i}
          x1={node.edgeX}
          y1={node.y}
          x2={node.x}
          y2={node.y}
          className={`tl-connector seg-${statuses[i]}`}
        />
      ))}

      {nodes.map((node, i) => (
        <g key={i} transform={`translate(${node.x} ${node.y})`}>
          {statuses[i] === 'current' && <circle r="8" className="tl-halo" />}
          <circle r="8" className={`tl-node-circle tl-node-${statuses[i]}`} />
          {statuses[i] === 'completed' && (
            <path d="M -3.5 0.2 L -1 2.8 L 4 -2.8" className="tl-check" />
          )}
        </g>
      ))}

      {currentSegment && (
        <g className="tl-orb">
          <circle r="8" className="tl-orb-glow" />
          <circle r="3.2" className="tl-orb-core" />
          <animateMotion dur="3s" repeatCount="indefinite" path={currentSegment.d} />
          <animate
            attributeName="opacity"
            values="1;1;0"
            keyTimes="0;0.85;1"
            dur="3s"
            repeatCount="indefinite"
          />
        </g>
      )}
    </svg>
  )
}
