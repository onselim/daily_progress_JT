const STROKE = '#8fa3c8';
const DOT = '#00d4aa';

function Dot({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={3.2} fill={DOT} />;
}

function Line({
  x1,
  y1,
  x2,
  y2,
  dashed,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dashed?: boolean;
}) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={STROKE}
      strokeWidth={dashed ? 1.2 : 2}
      strokeDasharray={dashed ? '3 3' : undefined}
    />
  );
}

/** Flat horizontal crossarm, 3 evenly spaced conductors — used by cat-head and the ground-peak types. */
function flatTier(y: number) {
  return (
    <g key={y}>
      <Line x1={24} y1={y} x2={76} y2={y} />
      <Dot x={24} y={y} />
      <Dot x={50} y={y} />
      <Dot x={76} y={y} />
    </g>
  );
}

/** Triangular (delta) crossarm — the 2 outer conductors sit lower, the center one higher, forming a Δ. */
function deltaTier(y: number) {
  const apexY = y - 20;
  return (
    <g key={y}>
      <Line x1={50} y1={apexY} x2={26} y2={y} />
      <Line x1={50} y1={apexY} x2={74} y2={y} />
      <Dot x={26} y={y} />
      <Dot x={74} y={y} />
      <Dot x={50} y={apexY} />
    </g>
  );
}

/** V-braced crossarm — 2 conductors on the V ends + 1 at the pole. */
function vTier(y: number) {
  return (
    <g key={y}>
      <Line x1={50} y1={y} x2={26} y2={y - 16} />
      <Line x1={50} y1={y} x2={74} y2={y - 16} />
      <Dot x={26} y={y - 16} />
      <Dot x={74} y={y - 16} />
      <Dot x={50} y={y - 2} />
    </g>
  );
}

/** Vertical (Danube) staggered conductors, single-side per level; mirrored to both sides for double circuit. */
function staggeredTiers(levels: number[], mirrored: boolean) {
  return levels.map((y, i) => {
    if (mirrored) {
      return (
        <g key={y}>
          <Line x1={50} y1={y} x2={28} y2={y} />
          <Line x1={50} y1={y} x2={72} y2={y} />
          <Dot x={28} y={y} />
          <Dot x={72} y={y} />
        </g>
      );
    }
    const x = 50 + (i % 2 === 0 ? 22 : -22);
    return (
      <g key={y}>
        <Line x1={50} y1={y} x2={x} y2={y} />
        <Dot x={x} y={y} />
      </g>
    );
  });
}

function earthWires(double: boolean) {
  if (double) {
    return (
      <>
        <Line x1={50} y1={20} x2={40} y2={12} />
        <Line x1={50} y1={20} x2={60} y2={12} />
        <Dot x={40} y={12} />
        <Dot x={60} y={12} />
      </>
    );
  }
  return (
    <>
      <Line x1={50} y1={20} x2={50} y2={12} />
      <Dot x={50} y={12} />
    </>
  );
}

function diagramFor(type: string, isDoubleCircuit: boolean) {
  if (type === 'other') {
    return (
      <>
        <Line x1={50} y1={92} x2={50} y2={20} />
        <text x={50} y={58} textAnchor="middle" fontSize="20" fill={STROKE}>
          ?
        </text>
      </>
    );
  }

  const tierYs = isDoubleCircuit ? [40, 68] : [50];
  let tiers: React.ReactNode;

  switch (type) {
    case 'delta':
      tiers = tierYs.map((y) => deltaTier(y));
      break;
    case 'guyed_v':
      tiers = tierYs.map((y) => vTier(y));
      break;
    case 'vertical_staggered':
    case 'vertical_staggered_double_peak':
      tiers = staggeredTiers(isDoubleCircuit ? [30, 46, 62, 78] : [32, 52, 72], isDoubleCircuit);
      break;
    case 'cat_head':
    case 'single_ground_peak':
    case 'double_ground_peak':
    default:
      tiers = tierYs.map((y) => flatTier(y));
  }

  return (
    <>
      <Line x1={50} y1={92} x2={50} y2={20} />
      {type === 'guyed_v' && (
        <>
          <Line x1={50} y1={55} x2={18} y2={92} dashed />
          <Line x1={50} y1={55} x2={82} y2={92} dashed />
        </>
      )}
      {earthWires(type === 'double_ground_peak' || type === 'vertical_staggered_double_peak')}
      {tiers}
    </>
  );
}

interface TowerHeadPreviewProps {
  type: string;
  circuitType?: string;
}

export function TowerHeadPreview({ type, circuitType }: TowerHeadPreviewProps) {
  return (
    <svg viewBox="0 0 100 100" className="tower-head-preview" aria-hidden="true">
      {diagramFor(type, circuitType === 'double')}
    </svg>
  );
}
