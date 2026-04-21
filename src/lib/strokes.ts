/**
 * Stroke-order grading for hiragana, katakana, and kanji.
 *
 * Reference data comes from KanjiVG (public/kanjivg/<cp>.svg), fetched and
 * parsed lazily in the browser. No ML, no server round-trip — pure geometry:
 * direction cosine, mean-distance shape match, and centroid position.
 *
 * All strokes are normalised to N=32 points inside a 256×256 box so the
 * grader is resolution-agnostic.
 */
import type { Grade } from './types';

export type Point = { x: number; y: number };
export type Stroke = Point[];
export type Reference = { strokes: Stroke[]; viewBox: number };

export type StrokeVerdict =
  | { status: 'pass' }
  | { status: 'direction_wrong' }
  | { status: 'shape_off'; score: number }
  | { status: 'position_off'; score: number };

export type DrawingVerdict = {
  perStroke: StrokeVerdict[];
  wrongCount?: { expected: number; got: number };
  suggested: Grade;
};

// ── Tuning knobs ──────────────────────────────────────────────────────
export const CANVAS_SIZE = 256;
const SAMPLES_DEFAULT = 32;
const SAMPLES_HIGH_STROKE = 40;
const DIRECTION_COSINE_THRESHOLD = 0.25; // > this = same direction
const SHAPE_DISTANCE_THRESHOLD = 0.18;   // mean point distance / canvas diagonal
const POSITION_THRESHOLD = 0.22;         // centroid distance / canvas size

// ── Pure geometry helpers ─────────────────────────────────────────────
function dist(a: Point, b: Point): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function centroid(s: Stroke): Point {
  let x = 0, y = 0;
  for (const p of s) { x += p.x; y += p.y; }
  return { x: x / s.length, y: y / s.length };
}

function directionVector(s: Stroke): Point {
  const start = s[0];
  const end = s[s.length - 1];
  return { x: end.x - start.x, y: end.y - start.y };
}

function cosine(a: Point, b: Point): number {
  const la = Math.sqrt(a.x * a.x + a.y * a.y);
  const lb = Math.sqrt(b.x * b.x + b.y * b.y);
  if (la === 0 || lb === 0) return 0;
  return (a.x * b.x + a.y * b.y) / (la * lb);
}

export function resample(points: Point[], n = SAMPLES_DEFAULT): Stroke {
  if (points.length === 0) return [];
  if (points.length === 1) return Array(n).fill(points[0]);

  // Cumulative arc lengths.
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + dist(points[i - 1], points[i]));
  }
  const total = cum[cum.length - 1];
  if (total === 0) return Array(n).fill(points[0]);

  const step = total / (n - 1);
  const out: Stroke = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const target = i * step;
    while (j < cum.length - 1 && cum[j + 1] < target) j++;
    const seg = cum[j + 1] - cum[j] || 1;
    const t = (target - cum[j]) / seg;
    const a = points[j];
    const b = points[Math.min(j + 1, points.length - 1)];
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

// ── Codepoint helper ──────────────────────────────────────────────────
export function codepointFor(char: string): string {
  const cp = char.codePointAt(0);
  if (cp === undefined) throw new Error(`no codepoint for ${char}`);
  return cp.toString(16).padStart(5, '0');
}

// ── Reference loading + caching ───────────────────────────────────────
const referenceCache = new Map<string, Promise<Reference>>();

export function loadReference(char: string): Promise<Reference> {
  const existing = referenceCache.get(char);
  if (existing) return existing;
  const p = (async (): Promise<Reference> => {
    const cp = codepointFor(char);
    const r = await fetch(`/kanjivg/${cp}.svg`);
    if (!r.ok) throw new Error(`no stroke data for ${char} (${cp})`);
    const svgText = await r.text();
    return parseSvg(svgText);
  })();
  referenceCache.set(char, p);
  // If the fetch fails, don't cache the rejection forever.
  p.catch(() => referenceCache.delete(char));
  return p;
}

function parseSvg(svgText: string): Reference {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const root = doc.documentElement;
  const vbAttr = root.getAttribute('viewBox') || '0 0 109 109';
  const vbSize = Math.max(Number(vbAttr.split(/\s+/)[2] || 109), 1);

  // Collect strokes — KanjiVG paths have ids like "kvg:04E2D-s1". We sort
  // by the trailing stroke index.
  const paths = Array.from(doc.querySelectorAll('path'))
    .filter(p => {
      const id = p.getAttribute('id') || '';
      return /kvg:[^-]+-s\d+$/.test(id);
    })
    .sort((a, b) => {
      const ai = Number((a.getAttribute('id') || '').split('-s')[1]);
      const bi = Number((b.getAttribute('id') || '').split('-s')[1]);
      return ai - bi;
    });

  const scale = CANVAS_SIZE / vbSize;
  const sampleCount = paths.length > 10 ? SAMPLES_HIGH_STROKE : SAMPLES_DEFAULT;
  const strokes: Stroke[] = paths.map(p => samplePath(p, scale, sampleCount));

  return { strokes, viewBox: vbSize };
}

function samplePath(pathEl: Element, scale: number, n: number): Stroke {
  // Reuse the parsed path element via a detached SVGPathElement in the document.
  const ns = 'http://www.w3.org/2000/svg';
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', pathEl.getAttribute('d') || '');
  const total = (path as SVGPathElement).getTotalLength();
  if (total === 0) {
    const p = (path as SVGPathElement).getPointAtLength(0);
    return Array(n).fill({ x: p.x * scale, y: p.y * scale });
  }
  const out: Stroke = [];
  for (let i = 0; i < n; i++) {
    const pt = (path as SVGPathElement).getPointAtLength((i / (n - 1)) * total);
    out.push({ x: pt.x * scale, y: pt.y * scale });
  }
  return out;
}

// ── Grading ───────────────────────────────────────────────────────────
export function gradeStroke(user: Stroke, ref: Stroke): StrokeVerdict {
  // Normalise to matching sample count.
  const n = Math.min(user.length, ref.length);
  const u = user.length === n ? user : resample(user, n);
  const r = ref.length === n ? ref : resample(ref, n);

  // 1. Direction.
  const du = directionVector(u);
  const dr = directionVector(r);
  if (cosine(du, dr) < DIRECTION_COSINE_THRESHOLD) {
    return { status: 'direction_wrong' };
  }

  // 2. Shape — mean per-point distance, normalised by canvas diagonal.
  let sumDist = 0;
  for (let i = 0; i < n; i++) sumDist += dist(u[i], r[i]);
  const meanDist = sumDist / n;
  const diag = Math.SQRT2 * CANVAS_SIZE;
  const shapeScore = meanDist / diag;
  if (shapeScore > SHAPE_DISTANCE_THRESHOLD) {
    return { status: 'shape_off', score: shapeScore };
  }

  // 3. Position — centroid distance, normalised by canvas size.
  const posScore = dist(centroid(u), centroid(r)) / CANVAS_SIZE;
  if (posScore > POSITION_THRESHOLD) {
    return { status: 'position_off', score: posScore };
  }

  return { status: 'pass' };
}

export function gradeDrawing(userStrokes: Stroke[], ref: Reference): DrawingVerdict {
  if (userStrokes.length !== ref.strokes.length) {
    return {
      perStroke: [],
      wrongCount: { expected: ref.strokes.length, got: userStrokes.length },
      suggested: 'again'
    };
  }

  const perStroke = userStrokes.map((u, i) => gradeStroke(u, ref.strokes[i]));

  let passCount = 0;
  let directionWrong = 0;
  let minorOff = 0;
  for (const v of perStroke) {
    if (v.status === 'pass') passCount++;
    else if (v.status === 'direction_wrong') directionWrong++;
    else minorOff++;
  }

  let suggested: Grade;
  if (passCount === perStroke.length) {
    suggested = 'easy';
  } else if (directionWrong === 0 && minorOff <= 1) {
    suggested = 'good';
  } else if (directionWrong === 1 || minorOff <= 2) {
    suggested = 'hard';
  } else {
    suggested = 'again';
  }

  return { perStroke, suggested };
}

// ── User-facing labels (Spanish) ──────────────────────────────────────
export function verdictLabel(v: StrokeVerdict, index: number): string {
  const n = index + 1;
  switch (v.status) {
    case 'pass':             return `Trazo ${n}: correcto.`;
    case 'direction_wrong':  return `Trazo ${n}: dirección invertida.`;
    case 'shape_off':        return `Trazo ${n}: forma o ángulo diferente.`;
    case 'position_off':     return `Trazo ${n}: posición desplazada.`;
  }
}
