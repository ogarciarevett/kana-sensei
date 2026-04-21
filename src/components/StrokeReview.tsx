import type { Point, Reference, Stroke } from '../lib/strokes';
import { CANVAS_SIZE, verdictLabel, type DrawingVerdict } from '../lib/strokes';

type Props = {
  userStrokes: Stroke[];
  reference: Reference;
  verdict: DrawingVerdict;
};

function pathFrom(points: Point[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M ${first.x.toFixed(2)} ${first.y.toFixed(2)} ` +
    rest.map(p => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
}

function colorFor(status: DrawingVerdict['perStroke'][number]['status']): string {
  switch (status) {
    case 'pass':             return '#10b981';  // emerald-500
    case 'direction_wrong':  return '#f43f5e';  // rose-500
    case 'shape_off':        return '#f59e0b';  // amber-500
    case 'position_off':     return '#f59e0b';
  }
}

export function StrokeReview({ userStrokes, reference, verdict }: Props) {
  return (
    <div className="space-y-3">
      <svg
        viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
        className="w-full aspect-square bg-white border border-neutral-300 rounded-md"
      >
        {/* Reference, faint, behind everything */}
        {reference.strokes.map((s, i) => (
          <path key={`ref-${i}`} d={pathFrom(s)}
            stroke="#e5e7eb" strokeWidth="6" fill="none"
            strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {/* User strokes coloured by verdict */}
        {userStrokes.map((s, i) => (
          <path key={`u-${i}`} d={pathFrom(s)}
            stroke={colorFor(verdict.perStroke[i]?.status ?? 'pass')}
            strokeWidth="8" fill="none"
            strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {/* Numbered start-point markers from the reference */}
        {reference.strokes.map((s, i) => {
          const start = s[0];
          if (!start) return null;
          return (
            <g key={`n-${i}`}>
              <circle cx={start.x} cy={start.y} r="10" fill="#111827" />
              <text x={start.x} y={start.y + 4} textAnchor="middle"
                fontSize="12" fontWeight="600" fill="#fff">{i + 1}</text>
            </g>
          );
        })}
      </svg>

      {verdict.wrongCount ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
          Esperaba {verdict.wrongCount.expected} trazos, hiciste {verdict.wrongCount.got}.
          Revisa el orden y vuelve a intentarlo.
        </div>
      ) : (
        <ul className="text-sm space-y-1">
          {verdict.perStroke.map((v, i) => (
            <li key={i} style={{ color: colorFor(v.status) }}>
              {verdictLabel(v, i)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
