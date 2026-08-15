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

/** Flat horizontal crossarm, 3 evenly spaced conductors — delta, cat-head, ground-peak types. */
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

/** Vertical (Danube) staggered, single circuit — 3 conductors zigzagging between sides at 3 heights. */
function staggeredSingleCircuit() {
  return [34, 54, 74].map((y, i) => {
    const x = i % 2 === 0 ? 72 : 28;
    return (
      <g key={y}>
        <Line x1={50} y1={y} x2={x} y2={y} />
        <Dot x={x} y={y} />
      </g>
    );
  });
}

/** Vertical (Danube) staggered, double circuit — one circuit's 3 conductors on each side, same 3 heights. */
function staggeredDoubleCircuit() {
  return [34, 54, 74].map((y) => (
    <g key={y}>
      <Line x1={50} y1={y} x2={28} y2={y} />
      <Line x1={50} y1={y} x2={72} y2={y} />
      <Dot x={28} y={y} />
      <Dot x={72} y={y} />
    </g>
  ));
}

function earthWires(count: 0 | 1 | 2) {
  if (count === 0) return null;
  if (count === 1) {
    return (
      <>
        <Line x1={50} y1={20} x2={50} y2={12} />
        <Dot x={50} y={12} />
      </>
    );
  }
  return (
    <>
      <Line x1={50} y1={20} x2={40} y2={12} />
      <Line x1={50} y1={20} x2={60} y2={12} />
      <Dot x={40} y={12} />
      <Dot x={60} y={12} />
    </>
  );
}

const EARTH_WIRE_COUNT: Record<string, 0 | 1 | 2> = {
  delta: 2,
  cat_head: 1,
  guyed_v: 1,
  single_ground_peak: 1,
  double_ground_peak: 2,
  vertical_staggered_no_peak: 0,
  vertical_staggered: 1,
  vertical_staggered_double_peak: 2,
};

function isVerticalStaggered(type: string) {
  return (
    type === 'vertical_staggered_no_peak' || type === 'vertical_staggered' || type === 'vertical_staggered_double_peak'
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

  const ewCount = EARTH_WIRE_COUNT[type] ?? 1;

  let tiers: React.ReactNode;
  if (isVerticalStaggered(type)) {
    tiers = isDoubleCircuit ? staggeredDoubleCircuit() : staggeredSingleCircuit();
  } else {
    const tierYs = isDoubleCircuit ? [40, 68] : [50];
    tiers = type === 'guyed_v' ? tierYs.map((y) => vTier(y)) : tierYs.map((y) => flatTier(y));
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
      {earthWires(ewCount)}
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
