const STROKE = '#8fa3c8';
const DOT = '#00d4aa';

function Pole() {
  return <line x1={50} y1={92} x2={50} y2={20} stroke={STROKE} strokeWidth={2} />;
}

function Dot({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={3.5} fill={DOT} />;
}

function Arm({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={STROKE} strokeWidth={2} />;
}

function diagramFor(type: string) {
  switch (type) {
    case 'delta':
      return (
        <>
          <Pole />
          <Arm x1={50} y1={45} x2={50} y2={25} />
          <Arm x1={22} y1={45} x2={78} y2={45} />
          <Dot x={50} y={25} />
          <Dot x={22} y={45} />
          <Dot x={78} y={45} />
        </>
      );
    case 'cat_head':
      return (
        <>
          <Pole />
          <Arm x1={50} y1={35} x2={50} y2={20} />
          <Arm x1={20} y1={35} x2={80} y2={35} />
          <Dot x={50} y={20} />
          <Dot x={30} y={35} />
          <Dot x={50} y={35} />
          <Dot x={70} y={35} />
        </>
      );
    case 'vertical_staggered':
      return (
        <>
          <Pole />
          <Dot x={50} y={20} />
          <Arm x1={50} y1={35} x2={28} y2={35} />
          <Dot x={28} y={35} />
          <Arm x1={50} y1={55} x2={72} y2={55} />
          <Dot x={72} y={55} />
          <Arm x1={50} y1={75} x2={28} y2={75} />
          <Dot x={28} y={75} />
        </>
      );
    case 'guyed_v':
      return (
        <>
          <line x1={50} y1={92} x2={50} y2={40} stroke={STROKE} strokeWidth={2} />
          <line x1={50} y1={60} x2={16} y2={92} stroke={STROKE} strokeWidth={1.2} strokeDasharray="3 3" />
          <line x1={50} y1={60} x2={84} y2={92} stroke={STROKE} strokeWidth={1.2} strokeDasharray="3 3" />
          <Arm x1={50} y1={40} x2={50} y2={22} />
          <Arm x1={30} y1={40} x2={70} y2={40} />
          <Dot x={50} y={22} />
          <Dot x={30} y={40} />
          <Dot x={70} y={40} />
        </>
      );
    case 'single_ground_peak':
      return (
        <>
          <Pole />
          <Arm x1={50} y1={45} x2={50} y2={20} />
          <Arm x1={25} y1={45} x2={75} y2={45} />
          <Dot x={50} y={20} />
          <Dot x={25} y={45} />
          <Dot x={50} y={45} />
          <Dot x={75} y={45} />
        </>
      );
    case 'double_ground_peak':
      return (
        <>
          <Pole />
          <Arm x1={35} y1={45} x2={30} y2={20} />
          <Arm x1={65} y1={45} x2={70} y2={20} />
          <Arm x1={25} y1={45} x2={75} y2={45} />
          <Dot x={30} y={20} />
          <Dot x={70} y={20} />
          <Dot x={25} y={45} />
          <Dot x={50} y={45} />
          <Dot x={75} y={45} />
        </>
      );
    default:
      return (
        <>
          <Pole />
          <text x={50} y={45} textAnchor="middle" fontSize="16" fill={STROKE}>
            ?
          </text>
        </>
      );
  }
}

interface TowerHeadPreviewProps {
  type: string;
}

export function TowerHeadPreview({ type }: TowerHeadPreviewProps) {
  return (
    <svg viewBox="0 0 100 100" className="tower-head-preview" aria-hidden="true">
      {diagramFor(type)}
    </svg>
  );
}
