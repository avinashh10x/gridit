import { parse } from 'svgson';
import { parseSVG as parsePath, Command } from 'svg-path-parser';
import Bezier from 'bezier-js';

export interface Point { x: number; y: number }
export interface Line { x1: number; y1: number; x2: number; y2: number; type: 'v' | 'h' | 'd' }
export interface Circle { cx: number; cy: number; r: number }

export async function analyzeLogo(svgString: string) {
  const json = await parse(svgString);
  const elements = extractElements(json);
  
  let points: Point[] = [];
  let lines: Line[] = [];
  let segments: any[] = [];

  elements.forEach(el => {
    if (el.name === 'path') {
      const commands = parsePath(el.attributes.d);
      let cur: Point = { x: 0, y: 0 };
      let start: Point = { x: 0, y: 0 };

      commands.forEach((cmd: any) => {
        const next = processCommand(cmd, cur, start);
        if (next.points) points.push(...next.points);
        if (next.segments) segments.push(...next.segments);
        cur = next.cur;
        if (cmd.code === 'M') start = cur;
      });
    } else if (el.name === 'rect') {
       const x = parseFloat(el.attributes.x || '0');
       const y = parseFloat(el.attributes.y || '0');
       const w = parseFloat(el.attributes.width || '0');
       const h = parseFloat(el.attributes.height || '0');
       points.push({x, y}, {x:x+w, y}, {x, y:y+h}, {x:x+w, y:y+h});
    }
  });

  // Calculate Bounds
  const xValues = points.map(p => p.x);
  const yValues = points.map(p => p.y);
  const bounds = {
    x: Math.min(...xValues),
    y: Math.min(...yValues),
    width: Math.max(...xValues) - Math.min(...xValues),
    height: Math.max(...yValues) - Math.min(...yValues)
  };

  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2
  };

  // Detect Alignment Lines (Deterministic)
  const alignmentLines = detectAlignments(points, bounds);
  const circles = detectCircles(segments);
  
  // Clean up duplicate/noisy anchors
  const anchors = points.filter((p, i) => points.findIndex(p2 => Math.abs(p2.x - p.x) < 0.1 && Math.abs(p2.y - p.y) < 0.1) === i);

  return {
    bounds,
    center,
    lines: alignmentLines,
    circles,
    anchors
  };
}

function extractElements(node: any): any[] {
  let found: any[] = [];
  if (['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline'].includes(node.name)) {
    found.push(node);
  }
  if (node.children) {
    node.children.forEach((child: any) => {
      found.push(...extractElements(child));
    });
  }
  return found;
}

function processCommand(cmd: any, cur: Point, start: Point) {
  let points: Point[] = [];
  let segments: any[] = [];
  let nextCur = { ...cur };

  switch (cmd.code) {
    case 'M':
      nextCur = { x: cmd.x, y: cmd.y };
      points.push(nextCur);
      break;
    case 'L':
      nextCur = { x: cmd.x, y: cmd.y };
      points.push(nextCur);
      segments.push({ type: 'line', start: cur, end: nextCur });
      break;
    case 'H':
      nextCur = { x: cmd.x, y: cur.y };
      points.push(nextCur);
      segments.push({ type: 'line', start: cur, end: nextCur });
      break;
    case 'V':
      nextCur = { x: cur.x, y: cmd.y };
      points.push(nextCur);
      segments.push({ type: 'line', start: cur, end: nextCur });
      break;
    case 'C':
      nextCur = { x: cmd.x, y: cmd.y };
      points.push(nextCur);
      segments.push({ type: 'cubic', start: cur, cp1: {x: cmd.x1, y: cmd.y1}, cp2: {x: cmd.x2, y: cmd.y2}, end: nextCur });
      break;
    case 'Q':
      nextCur = { x: cmd.x, y: cmd.y };
      points.push(nextCur);
      segments.push({ type: 'quadratic', start: cur, cp: {x: cmd.x1, y: cmd.y1}, end: nextCur });
      break;
    case 'Z':
      nextCur = start;
      segments.push({ type: 'line', start: cur, end: nextCur });
      break;
  }

  return { cur: nextCur, points, segments };
}

function detectAlignments(points: Point[], bounds: any): Line[] {
  const lines: Line[] = [];
  const threshold = 1.0; // Snapping threshold

  // Group X and Y coordinates
  const xCoords = points.map(p => p.x);
  const yCoords = points.map(p => p.y);

  const uniqueX = getClusters(xCoords, threshold);
  const uniqueY = getClusters(yCoords, threshold);

  uniqueX.forEach(x => {
    lines.push({ x1: x, y1: bounds.y, x2: x, y2: bounds.y + bounds.height, type: 'v' });
  });

  uniqueY.forEach(y => {
    lines.push({ x1: bounds.x, y1: y, x2: bounds.x + bounds.width, y2: y, type: 'h' });
  });

  return lines;
}

function getClusters(vals: number[], threshold: number) {
  const sorted = [...vals].sort((a, b) => a - b);
  const clusters: number[] = [];
  if (sorted.length === 0) return clusters;

  let currentCluster = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] < threshold) {
      currentCluster.push(sorted[i]);
    } else {
      clusters.push(currentCluster.reduce((a, b) => a + b) / currentCluster.length);
      currentCluster = [sorted[i]];
    }
  }
  clusters.push(currentCluster.reduce((a, b) => a + b) / currentCluster.length);
  return clusters;
}

function detectCircles(segments: any[]): Circle[] {
  const circles: Circle[] = [];
  
  segments.forEach(seg => {
    if (seg.type === 'cubic' || seg.type === 'quadratic') {
      // Very basic circular estimation
      // In a real production tool, we'd use least squares fitting on sampled points
      const b = seg.type === 'cubic' 
        ? new Bezier(seg.start.x, seg.start.y, seg.cp1.x, seg.cp1.y, seg.cp2.x, seg.cp2.y, seg.end.x, seg.end.y)
        : new Bezier(seg.start.x, seg.start.y, seg.cp.x, seg.cp.y, seg.end.x, seg.end.y);
      
      // Sample 3 points to find a circle passing through them
      const p1 = b.get(0);
      const p2 = b.get(0.5);
      const p3 = b.get(1);

      const center = findCircleCenter(p1, p2, p3);
      if (center) {
        const radius = Math.sqrt(Math.pow(p1.x - center.x, 2) + Math.pow(p1.y - center.y, 2));
        // Check confidence: how far is a middle point from the radius?
        const pMid = b.get(0.25);
        const d = Math.sqrt(Math.pow(pMid.x - center.x, 2) + Math.pow(pMid.y - center.y, 2));
        if (Math.abs(d - radius) < 0.5 && radius > 5) {
           circles.push({ cx: center.x, cy: center.y, r: radius });
        }
      }
    }
  });

  // Deduplicate circles
  return circles.filter((c, i) => circles.findIndex(c2 => 
    Math.abs(c2.cx - c.cx) < 2 && Math.abs(c2.cy - c.cy) < 2 && Math.abs(c2.r - c.r) < 2
  ) === i);
}

function findCircleCenter(p1: any, p2: any, p3: any) {
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;

  const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
  if (Math.abs(D) < 0.001) return null;

  const ux = ((x1 * x1 + y1 * y1) * (y2 - y3) + (x2 * x2 + y2 * y2) * (y3 - y1) + (x3 * x3 + y3 * y3) * (y1 - y2)) / D;
  const uy = ((x1 * x1 + y1 * y1) * (x3 - x2) + (x2 * x2 + y2 * y2) * (x1 - x3) + (x3 * x3 + y3 * y3) * (x2 - x1)) / D;

  return { x: ux, y: uy };
}
