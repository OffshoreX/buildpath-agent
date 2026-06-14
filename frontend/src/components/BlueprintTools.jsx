/**
 * Blueprint-style engineering tool diagrams — single-stroke line art, the
 * stroke color and width come from CSS (.blueprint-tool). These are decorative
 * atmosphere placed in the empty space opposite each phase card; never
 * interactive, hidden on mobile. Six tools cycle by phase number.
 */

const svgProps = {
  className: 'blueprint-tool',
  viewBox: '0 0 200 200',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

function Caliper() {
  // Main beam with a scale, a fixed jaw left, a sliding jaw, and a depth rod.
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const x = 40 + i * 11
    const tall = i % 5 === 0
    return <line key={i} x1={x} y1={92} x2={x} y2={tall ? 82 : 87} />
  })
  return (
    <svg {...svgProps}>
      <rect x="34" y="92" width="148" height="12" rx="2" />
      {ticks}
      {/* fixed jaw (left) — upper and lower measuring faces */}
      <path d="M40 92 V58 M40 58 H30 M40 104 V138 M40 138 H30" />
      {/* sliding jaw */}
      <path d="M120 92 V66 M120 66 H112 M120 104 V132 M120 132 H112" />
      <circle cx="134" cy="98" r="6" />
      {/* depth rod extending from the beam end */}
      <line x1="182" y1="98" x2="194" y2="98" />
    </svg>
  )
}

function Microchip() {
  const pins = []
  for (let i = 0; i < 6; i++) {
    const y = 74 + i * 11
    pins.push(<line key={`l${i}`} x1="62" y1={y} x2="50" y2={y} />)
    pins.push(<line key={`r${i}`} x1="138" y1={y} x2="150" y2={y} />)
  }
  return (
    <svg {...svgProps}>
      <rect x="62" y="62" width="76" height="76" rx="3" />
      {/* orientation notch */}
      <path d="M92 62 a8 8 0 0 0 16 0" />
      {pins}
      {/* internal traces */}
      <rect x="78" y="84" width="44" height="32" rx="2" />
      <line x1="78" y1="100" x2="122" y2="100" />
      <line x1="100" y1="84" x2="100" y2="116" />
    </svg>
  )
}

function Gear() {
  const cx = 100
  const cy = 100
  const teeth = 12
  const outer = 64
  const root = 52
  let d = ''
  for (let i = 0; i < teeth * 2; i++) {
    const r = i % 2 === 0 ? outer : root
    const a = (Math.PI * i) / teeth
    const x = cx + r * Math.cos(a)
    const y = cy + r * Math.sin(a)
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `
  }
  d += 'Z'
  const spokes = Array.from({ length: 5 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2
    return (
      <line
        key={i}
        x1={cx + 22 * Math.cos(a)}
        y1={cy + 22 * Math.sin(a)}
        x2={cx + 44 * Math.cos(a)}
        y2={cy + 44 * Math.sin(a)}
      />
    )
  })
  return (
    <svg {...svgProps}>
      <path d={d} />
      <circle cx={cx} cy={cy} r="44" />
      <circle cx={cx} cy={cy} r="22" />
      <circle cx={cx} cy={cy} r="12" />
      {spokes}
    </svg>
  )
}

function Multimeter() {
  const cx = 100
  const cy = 108
  const r = 66
  // Ticks across the top arc (200deg -> 340deg).
  const ticks = Array.from({ length: 15 }, (_, i) => {
    const a = ((200 + (140 * i) / 14) * Math.PI) / 180
    const inner = i % 7 === 0 ? r - 14 : r - 8
    return (
      <line
        key={i}
        x1={cx + inner * Math.cos(a)}
        y1={cy + inner * Math.sin(a)}
        x2={cx + r * Math.cos(a)}
        y2={cy + r * Math.sin(a)}
      />
    )
  })
  const na = (288 * Math.PI) / 180 // needle angle
  return (
    <svg {...svgProps}>
      <circle cx={cx} cy={cy} r={r} />
      {ticks}
      <line x1={cx} y1={cy} x2={cx + (r - 18) * Math.cos(na)} y2={cy + (r - 18) * Math.sin(na)} />
      <circle cx={cx} cy={cy} r="4" />
    </svg>
  )
}

function Oscilloscope() {
  // Screen, faint internal graticule, and a sine trace.
  const x0 = 36
  const x1 = 164
  const points = Array.from({ length: 49 }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / 48
    const y = 100 - 24 * Math.sin(((x - x0) / (x1 - x0)) * Math.PI * 4)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
  const vlines = Array.from({ length: 3 }, (_, i) => {
    const x = 68 + i * 32
    return <line key={`v${i}`} x1={x} y1="58" x2={x} y2="142" opacity="0.5" />
  })
  return (
    <svg {...svgProps}>
      <rect x="32" y="56" width="136" height="88" rx="4" />
      {vlines}
      <line x1="36" y1="100" x2="164" y2="100" opacity="0.5" />
      <path d={points} />
    </svg>
  )
}

function BoltWrench() {
  // Hex bolt with a threaded shaft, an open-end wrench crossed over it.
  const cx = 86
  const cy = 80
  const r = 26
  let hex = ''
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * i) / 3 - Math.PI / 6
    hex += `${i === 0 ? 'M' : 'L'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)} `
  }
  hex += 'Z'
  const threads = Array.from({ length: 5 }, (_, i) => (
    <line key={i} x1="74" y1={104 + i * 8} x2="98" y2={104 + i * 8} />
  ))
  return (
    <svg {...svgProps}>
      <path d={hex} />
      <circle cx={cx} cy={cy} r="13" />
      {/* threaded shaft */}
      <path d="M74 102 V146 M98 102 V146 M74 146 H98" />
      {threads}
      {/* open-end wrench crossed diagonally */}
      <g transform="rotate(38 120 124)">
        <path d="M104 120 h44 v8 h-44 z" />
        <path d="M148 116 a10 10 0 0 1 0 16 l-6 -3 a6 6 0 0 0 0 -10 z" />
      </g>
    </svg>
  )
}

const TOOLS = [
  { Comp: Caliper, name: 'Caliper' },
  { Comp: Microchip, name: 'Microchip' },
  { Comp: Gear, name: 'Gear' },
  { Comp: Multimeter, name: 'Multimeter' },
  { Comp: Oscilloscope, name: 'Oscilloscope' },
  { Comp: BoltWrench, name: 'Bolt & Wrench' },
]
const ROTATIONS = [-6, 5, -3, 7, -8, 4] // "sketched on the page" tilt, by phase

// Tools cycle by phase number, so any length of roadmap is covered: phase 7
// returns to the caliper, phase 8 the microchip, and so on.
export default function BlueprintTool({ phaseNumber }) {
  const n = Math.max(1, phaseNumber || 1)
  // The tool is chosen by phase but never named — the figure reads as a generic
  // blueprint sheet marker, not a label for what's drawn.
  const { Comp } = TOOLS[(n - 1) % TOOLS.length]
  const rot = ROTATIONS[(n - 1) % ROTATIONS.length]
  return (
    <div className="serp-tool" style={{ '--rot': `${rot}deg` }} aria-hidden="true">
      <Comp />
      <span className="blueprint-fig">Fig. {n}</span>
    </div>
  )
}
