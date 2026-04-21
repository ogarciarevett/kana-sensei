import { useRef, useState, type PointerEvent } from 'react';
import { CANVAS_SIZE, resample, type Point, type Reference, type Stroke } from '../lib/strokes';

type Props = {
  strokes: Stroke[];
  onStrokesChange: (s: Stroke[]) => void;
  reference?: Reference;
  showReference?: boolean;
};

function pathFrom(points: Point[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M ${first.x.toFixed(2)} ${first.y.toFixed(2)} ` +
    rest.map(p => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
}

const MIN_POINT_DIST = 2;

export function StrokeCanvas({ strokes, onStrokesChange, reference, showReference }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawing, setDrawing] = useState<Point[] | null>(null);

  function getLocal(e: PointerEvent): Point | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_SIZE;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_SIZE;
    return { x, y };
  }

  function onDown(e: PointerEvent<SVGSVGElement>) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = getLocal(e);
    if (!p) return;
    setDrawing([p]);
  }

  function onMove(e: PointerEvent<SVGSVGElement>) {
    if (!drawing) return;
    const p = getLocal(e);
    if (!p) return;
    const last = drawing[drawing.length - 1];
    const dx = p.x - last.x, dy = p.y - last.y;
    if (dx * dx + dy * dy < MIN_POINT_DIST * MIN_POINT_DIST) return;
    setDrawing([...drawing, p]);
  }

  function onUp() {
    if (!drawing || drawing.length < 2) {
      setDrawing(null);
      return;
    }
    const resampled = resample(drawing, 32);
    onStrokesChange([...strokes, resampled]);
    setDrawing(null);
  }

  function undo() {
    if (strokes.length === 0) return;
    onStrokesChange(strokes.slice(0, -1));
  }

  function clear() {
    onStrokesChange([]);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 text-xs">
        <button onClick={undo} disabled={strokes.length === 0}
          className="rounded-md border border-neutral-300 px-3 py-1 disabled:opacity-40">
          Deshacer trazo
        </button>
        <button onClick={clear} disabled={strokes.length === 0}
          className="rounded-md border border-neutral-300 px-3 py-1 disabled:opacity-40">
          Borrar todo
        </button>
        <span className="ml-auto self-center text-neutral-500">
          Trazos: {strokes.length}{reference ? ` / ${reference.strokes.length}` : ''}
        </span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
        className="w-full aspect-square bg-white border border-neutral-300 rounded-md touch-none cursor-crosshair"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {/* Grid */}
        <g stroke="#e5e7eb" strokeWidth="1">
          <line x1={CANVAS_SIZE / 2} y1="0" x2={CANVAS_SIZE / 2} y2={CANVAS_SIZE} strokeDasharray="4 4" />
          <line x1="0" y1={CANVAS_SIZE / 2} x2={CANVAS_SIZE} y2={CANVAS_SIZE / 2} strokeDasharray="4 4" />
        </g>

        {/* Reference (faint, only when requested) */}
        {showReference && reference?.strokes.map((s, i) => (
          <path key={`ref-${i}`} d={pathFrom(s)}
            stroke="#d1d5db" strokeWidth="8" fill="none"
            strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {/* Committed user strokes */}
        {strokes.map((s, i) => (
          <path key={`u-${i}`} d={pathFrom(s)}
            stroke="#111827" strokeWidth="8" fill="none"
            strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {/* In-progress stroke */}
        {drawing && (
          <path d={pathFrom(drawing)}
            stroke="#111827" strokeWidth="8" fill="none"
            strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </div>
  );
}
