// ================================================================
//  LOGO GRID KIT  v5.0  –  Adobe Illustrator ExtendScript
//
//  Professional logo construction grid generator.
//  Inspired by Akrivi / Behance-style branding grids.
//
//  Grid types:
//    1. Construction Lines   – bounding box, centre cross, edge lines
//    2. Key-Point Alignment  – H/V lines through every anchor cluster
//    3. Curve-Fit Circles    – circles fitted to each Bézier curve
//    4. Per-Shape Boxes      – bounding rects around each sub-shape
//    5. Golden Ratio         – φ subdivision overlays
//    6. Path Outline         – duplicated stroke outline of logo
//    7. Anchor Points        – dots + optional Bézier handles
//    8. Clearspace Zone      – safe area boundary
//    9. Angle Annotations    – angles of diagonal segments
//   10. Base Grid            – modular grid overlay
//
//  Usage:
//    Select logo → File > Scripts > LogoGridGenerator
//    Script scans, dialog appears, select grid types, Generate.
// ================================================================

#target illustrator

(function () {

    var VER  = "5.0";
    var NAME = "Logo Grid Kit";

    // ═══════════════════════════════════════════════
    //  COLOURS
    // ═══════════════════════════════════════════════
    var C = {
        red      : [200,  50,  60],
        blue     : [60,  120, 210],
        purple   : [130,  80, 200],
        gold     : [210, 165,  40],
        teal     : [40,  180, 180],
        green    : [60,  180, 100],
        pink     : [210,  70, 140],
        grey     : [120, 120, 130],
        darkGrey : [80,   80,  90],
        orange   : [230, 130,  40]
    };

    var WT = { hair: 0.15, thin: 0.25, mid: 0.5, thick: 0.75, bold: 1.0 };

    // Layer names
    var LYR = {
        constr    : "LGK-Construction",
        align     : "LGK-Alignment",
        curveFit  : "LGK-CurveFit",
        shapeBox  : "LGK-ShapeBoxes",
        golden    : "LGK-Golden",
        outline   : "LGK-Outline",
        anchors   : "LGK-Anchors",
        clear     : "LGK-Clearspace",
        angles    : "LGK-Angles",
        baseGrid  : "LGK-BaseGrid"
    };

    var ALL_KEYS = ["baseGrid","clear","golden","curveFit","shapeBox","align","constr","angles","outline","anchors"];

    // Persistent options
    var OPT = {
        constr: true, align: true, curveFit: true, shapeBox: true,
        golden: false, outline: true, anchors: true, clear: true,
        angles: false, baseGrid: false,
        handles: false, divs: 8, csMult: 1.5, numCircles: 6
    };


    // ═══════════════════════════════════════════════
    //  DRAWING PRIMITIVES
    // ═══════════════════════════════════════════════

    function mkRGB(r, g, b) {
        var c = new RGBColor();
        c.red = r; c.green = g; c.blue = b;
        return c;
    }

    function stk(item, col, w, op, dash) {
        item.stroked = true;
        item.filled  = false;
        item.strokeColor  = mkRGB(col[0], col[1], col[2]);
        item.strokeWidth  = w;
        item.opacity      = op;
        item.strokeDashes = dash ? [4, 3] : [];
    }

    function fil(item, col, op) {
        item.filled = true; item.stroked = false;
        item.fillColor = mkRGB(col[0], col[1], col[2]);
        item.opacity = op;
    }

    function ln(ly, x1, y1, x2, y2) {
        var p = ly.pathItems.add();
        p.setEntirePath([[x1, y1], [x2, y2]]);
        return p;
    }

    function rct(ly, left, bot, w, h) {
        return ly.pathItems.rectangle(bot + h, left, w, h);
    }

    function ell(ly, cx, cy, rx, ry) {
        return ly.pathItems.ellipse(cy + ry, cx - rx, rx * 2, ry * 2);
    }

    function circ(ly, cx, cy, r) {
        return ell(ly, cx, cy, r, r);
    }

    function dot(ly, cx, cy, r) {
        return circ(ly, cx, cy, r);
    }


    // ═══════════════════════════════════════════════
    //  LAYER HELPERS
    // ═══════════════════════════════════════════════

    function getLayer(name) {
        var doc = app.activeDocument;
        for (var i = 0; i < doc.layers.length; i++) {
            if (doc.layers[i].name === name) {
                doc.layers[i].locked = false;
                doc.layers[i].visible = true;
                return doc.layers[i];
            }
        }
        var nl = doc.layers.add();
        nl.name = name;
        return nl;
    }

    function killLayer(name) {
        var doc = app.activeDocument;
        for (var i = 0; i < doc.layers.length; i++) {
            if (doc.layers[i].name === name) {
                try {
                    doc.layers[i].locked = false;
                    doc.layers[i].visible = true;
                    doc.layers[i].remove();
                } catch (e) {}
                return;
            }
        }
    }

    function killAll() {
        for (var i = 0; i < ALL_KEYS.length; i++) killLayer(LYR[ALL_KEYS[i]]);
    }


    // ═══════════════════════════════════════════════
    //  SCAN:  Walk all paths + collect geometry data
    // ═══════════════════════════════════════════════

    function walkPaths(item, out) {
        if (!item) return;
        var t;
        try { t = item.typename; } catch (e) { return; }
        if (t === "PathItem") {
            out.push(item);
        } else if (t === "CompoundPathItem") {
            for (var a = 0; a < item.pathItems.length; a++) out.push(item.pathItems[a]);
        } else if (t === "GroupItem") {
            for (var b = 0; b < item.pageItems.length; b++) walkPaths(item.pageItems[b], out);
        }
    }

    // Collect top‐level sub‐shapes (for per-shape bounding boxes)
    function walkShapes(item, out) {
        if (!item) return;
        var t;
        try { t = item.typename; } catch (e) { return; }
        if (t === "PathItem" || t === "CompoundPathItem") {
            out.push(item);
        } else if (t === "GroupItem") {
            for (var b = 0; b < item.pageItems.length; b++) walkShapes(item.pageItems[b], out);
        }
    }

    function scanSelection() {
        var doc = app.activeDocument;
        var sel = doc.selection;
        if (!sel || sel.length === 0) return null;

        var items = (sel instanceof Array) ? sel : [sel];

        // ── Collect all paths (for anchors, outline, curves) ──
        var paths = [];
        for (var i = 0; i < items.length; i++) walkPaths(items[i], paths);

        // ── Collect top-level shapes (for per-shape bounding boxes) ──
        var shapes = [];
        for (var j = 0; j < items.length; j++) walkShapes(items[j], shapes);

        // ── Compute overall bounds ──
        var sources = (paths.length > 0) ? paths : items;
        var L = 1e9, R = -1e9, T = -1e9, B = 1e9;
        var found = 0;
        for (var k = 0; k < sources.length; k++) {
            try {
                var gb = sources[k].geometricBounds;
                if (gb[0] < L) L = gb[0];
                if (gb[1] > T) T = gb[1];
                if (gb[2] > R) R = gb[2];
                if (gb[3] < B) B = gb[3];
                found++;
            } catch (e) {}
        }
        if (found === 0 || (R - L) < 0.1 || (T - B) < 0.1) return null;

        var W = R - L, H = T - B;

        // ── Collect all anchor points ──
        var anchors = [];
        for (var p = 0; p < paths.length; p++) {
            try {
                var pts = paths[p].pathPoints;
                for (var q = 0; q < pts.length; q++) {
                    anchors.push({
                        x: pts[q].anchor[0],
                        y: pts[q].anchor[1],
                        lx: pts[q].leftDirection[0],
                        ly: pts[q].leftDirection[1],
                        rx: pts[q].rightDirection[0],
                        ry: pts[q].rightDirection[1]
                    });
                }
            } catch (e) {}
        }

        // ── Collect Bézier curve segments for circle fitting ──
        var curves = [];
        for (var p2 = 0; p2 < paths.length; p2++) {
            try {
                var pts2 = paths[p2].pathPoints;
                var numPts = pts2.length;
                var isClosed = (paths[p2].closed === true);
                var limit = isClosed ? numPts : numPts - 1;
                for (var q2 = 0; q2 < limit; q2++) {
                    var cur = pts2[q2];
                    var nxt = pts2[(q2 + 1) % numPts];
                    // Each segment: cur.anchor → cur.rightDirection → nxt.leftDirection → nxt.anchor
                    var ax = cur.anchor[0], ay = cur.anchor[1];
                    var bx = cur.rightDirection[0], by = cur.rightDirection[1];
                    var cx2 = nxt.leftDirection[0], cy2 = nxt.leftDirection[1];
                    var dx = nxt.anchor[0], dy = nxt.anchor[1];

                    // Is it a curve? (handles differ from anchors)
                    var isLine = (Math.abs(bx-ax)<0.1 && Math.abs(by-ay)<0.1 &&
                                  Math.abs(cx2-dx)<0.1 && Math.abs(cy2-dy)<0.1);
                    if (!isLine) {
                        curves.push({
                            p0x: ax, p0y: ay,
                            p1x: bx, p1y: by,
                            p2x: cx2, p2y: cy2,
                            p3x: dx, p3y: dy
                        });
                    }
                }
            } catch (e) {}
        }

        // ── Collect per-shape bounds ──
        var shapeBounds = [];
        for (var s = 0; s < shapes.length; s++) {
            try {
                var sb = shapes[s].geometricBounds;
                shapeBounds.push({
                    L: sb[0], T: sb[1], R: sb[2], B: sb[3],
                    W: sb[2] - sb[0], H: sb[1] - sb[3]
                });
            } catch (e) {}
        }

        return {
            L: L, T: T, R: R, B: B,
            W: W, H: H,
            CX: L + W / 2, CY: B + H / 2,
            paths: paths,
            shapes: shapes,
            shapeBounds: shapeBounds,
            anchors: anchors,
            curves: curves,
            count: found
        };
    }


    // ═══════════════════════════════════════════════
    //  MATH:  3-point circle fitting
    //  (ported from GeometryEngine.ts)
    // ═══════════════════════════════════════════════

    function bezierPoint(seg, t) {
        // Cubic Bézier at parameter t
        var u = 1 - t;
        var x = u*u*u*seg.p0x + 3*u*u*t*seg.p1x + 3*u*t*t*seg.p2x + t*t*t*seg.p3x;
        var y = u*u*u*seg.p0y + 3*u*u*t*seg.p1y + 3*u*t*t*seg.p2y + t*t*t*seg.p3y;
        return { x: x, y: y };
    }

    function fitCircle3pt(p1, p2, p3) {
        var x1 = p1.x, y1 = p1.y;
        var x2 = p2.x, y2 = p2.y;
        var x3 = p3.x, y3 = p3.y;
        var D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
        if (Math.abs(D) < 0.001) return null;

        var ux = ((x1*x1+y1*y1)*(y2-y3) + (x2*x2+y2*y2)*(y3-y1) + (x3*x3+y3*y3)*(y1-y2)) / D;
        var uy = ((x1*x1+y1*y1)*(x3-x2) + (x2*x2+y2*y2)*(x1-x3) + (x3*x3+y3*y3)*(x2-x1)) / D;

        var r = Math.sqrt((x1-ux)*(x1-ux) + (y1-uy)*(y1-uy));
        return { cx: ux, cy: uy, r: r };
    }

    function fitCircleToCurve(seg) {
        // Sample 3 points: t=0, t=0.5, t=1
        var p1 = bezierPoint(seg, 0);
        var p2 = bezierPoint(seg, 0.5);
        var p3 = bezierPoint(seg, 1);
        var fit = fitCircle3pt(p1, p2, p3);
        if (!fit) return null;

        // Validate: check how close a t=0.25 sample is to the circle
        var pMid = bezierPoint(seg, 0.25);
        var dMid = Math.sqrt((pMid.x - fit.cx)*(pMid.x - fit.cx) + (pMid.y - fit.cy)*(pMid.y - fit.cy));
        var err = Math.abs(dMid - fit.r);

        // Accept if error < 3% of radius and radius is meaningful
        if (err < fit.r * 0.15 && fit.r > 2 && fit.r < 5000) {
            return fit;
        }
        return null;
    }

    // Deduplicate circles that are very similar
    function dedupeCircles(circles, tol) {
        var out = [];
        for (var i = 0; i < circles.length; i++) {
            var dup = false;
            for (var j = 0; j < out.length; j++) {
                if (Math.abs(circles[i].cx - out[j].cx) < tol &&
                    Math.abs(circles[i].cy - out[j].cy) < tol &&
                    Math.abs(circles[i].r - out[j].r) < tol) {
                    dup = true; break;
                }
            }
            if (!dup) out.push(circles[i]);
        }
        return out;
    }


    // ═══════════════════════════════════════════════
    //  MATH:  Anchor clustering for alignment lines
    //  (ported from GeometryEngine.ts)
    // ═══════════════════════════════════════════════

    function cluster(values, threshold) {
        var sorted = values.slice().sort(function(a,b){return a-b;});
        var groups = [];
        if (sorted.length === 0) return groups;
        var cur = [sorted[0]];
        for (var i = 1; i < sorted.length; i++) {
            if (sorted[i] - sorted[i-1] < threshold) {
                cur.push(sorted[i]);
            } else {
                var sum = 0;
                for (var k = 0; k < cur.length; k++) sum += cur[k];
                groups.push(sum / cur.length);
                cur = [sorted[i]];
            }
        }
        var sum2 = 0;
        for (var k2 = 0; k2 < cur.length; k2++) sum2 += cur[k2];
        groups.push(sum2 / cur.length);
        return groups;
    }


    // ═══════════════════════════════════════════════
    //  MATH:  Angle between two line segments
    // ═══════════════════════════════════════════════

    function segmentAngle(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    }

    function dist(x1, y1, x2, y2) {
        return Math.sqrt((x2-x1)*(x2-x1) + (y2-y1)*(y2-y1));
    }


    // ═══════════════════════════════════════════════════════════
    //  GRID GENERATORS
    // ═══════════════════════════════════════════════════════════


    // ─── 1) CONSTRUCTION LINES ───────────────────────────────
    function genConstruction(bn) {
        killLayer(LYR.constr);
        var ly = getLayer(LYR.constr);
        var ext = Math.max(bn.W, bn.H) * 0.6;
        var col = C.red;

        // Bounding box
        stk(rct(ly, bn.L, bn.B, bn.W, bn.H), col, WT.mid, 70, false);

        // Edge extensions
        stk(ln(ly, bn.L, bn.T+ext, bn.L, bn.B-ext), col, WT.thin, 55, false);
        stk(ln(ly, bn.R, bn.T+ext, bn.R, bn.B-ext), col, WT.thin, 55, false);
        stk(ln(ly, bn.L-ext, bn.T, bn.R+ext, bn.T), col, WT.thin, 55, false);
        stk(ln(ly, bn.L-ext, bn.B, bn.R+ext, bn.B), col, WT.thin, 55, false);

        // Centre cross (stronger)
        stk(ln(ly, bn.CX, bn.T+ext, bn.CX, bn.B-ext), col, WT.thick, 80, false);
        stk(ln(ly, bn.L-ext, bn.CY, bn.R+ext, bn.CY), col, WT.thick, 80, false);

        // Diagonals
        var de = ext * 0.5;
        stk(ln(ly, bn.L-de, bn.B-de, bn.R+de, bn.T+de), C.grey, WT.thin, 35, false);
        stk(ln(ly, bn.L-de, bn.T+de, bn.R+de, bn.B-de), C.grey, WT.thin, 35, false);

        // Quarter lines
        stk(ln(ly, bn.L+bn.W*0.25, bn.T+ext*0.35, bn.L+bn.W*0.25, bn.B-ext*0.35), col, WT.hair, 40, false);
        stk(ln(ly, bn.L+bn.W*0.75, bn.T+ext*0.35, bn.L+bn.W*0.75, bn.B-ext*0.35), col, WT.hair, 40, false);
        stk(ln(ly, bn.L-ext*0.35, bn.B+bn.H*0.25, bn.R+ext*0.35, bn.B+bn.H*0.25), col, WT.hair, 40, false);
        stk(ln(ly, bn.L-ext*0.35, bn.B+bn.H*0.75, bn.R+ext*0.35, bn.B+bn.H*0.75), col, WT.hair, 40, false);
    }


    // ─── 2) KEY-POINT ALIGNMENT LINES ────────────────────────
    function genAlignment(bn) {
        killLayer(LYR.align);
        var ly  = getLayer(LYR.align);
        var ext = Math.max(bn.W, bn.H) * 0.45;
        var col = C.red;
        var threshold = Math.min(bn.W, bn.H) * 0.015;  // cluster tolerance
        if (threshold < 1) threshold = 1;

        // Collect all X and Y coordinates from anchors
        var xs = [], ys = [];
        for (var i = 0; i < bn.anchors.length; i++) {
            xs.push(bn.anchors[i].x);
            ys.push(bn.anchors[i].y);
        }

        var uniqueX = cluster(xs, threshold);
        var uniqueY = cluster(ys, threshold);

        // Draw vertical alignment lines through each X cluster
        for (var j = 0; j < uniqueX.length; j++) {
            var x = uniqueX[j];
            stk(ln(ly, x, bn.T + ext, x, bn.B - ext), col, WT.thin, 50, false);
        }

        // Draw horizontal alignment lines through each Y cluster
        for (var k = 0; k < uniqueY.length; k++) {
            var y = uniqueY[k];
            stk(ln(ly, bn.L - ext, y, bn.R + ext, y), col, WT.thin, 50, false);
        }
    }


    // ─── 3) CURVE-FIT CIRCLES ────────────────────────────────
    function genCurveFit(bn) {
        killLayer(LYR.curveFit);
        var ly = getLayer(LYR.curveFit);
        var col = C.grey;
        var dotCol = C.darkGrey;

        var allCircles = [];
        for (var i = 0; i < bn.curves.length; i++) {
            var fit = fitCircleToCurve(bn.curves[i]);
            if (fit) allCircles.push(fit);
        }

        // Deduplicate
        var tol = Math.min(bn.W, bn.H) * 0.02;
        if (tol < 1) tol = 1;
        var circles = dedupeCircles(allCircles, tol);

        // Draw each fitted circle
        for (var j = 0; j < circles.length; j++) {
            var cf = circles[j];
            stk(circ(ly, cf.cx, cf.cy, cf.r), col, WT.thin, 55, false);

            // Centre dot
            var dr = Math.max(Math.min(bn.W, bn.H) * 0.006, 0.8);
            fil(dot(ly, cf.cx, cf.cy, dr), dotCol, 70);

            // Small crosshair at centre
            var ch = cf.r * 0.08;
            if (ch < 1.5) ch = 1.5;
            stk(ln(ly, cf.cx - ch, cf.cy, cf.cx + ch, cf.cy), dotCol, WT.hair, 50, false);
            stk(ln(ly, cf.cx, cf.cy - ch, cf.cx, cf.cy + ch), dotCol, WT.hair, 50, false);
        }
    }


    // ─── 4) PER-SHAPE BOUNDING BOXES ────────────────────────
    function genShapeBoxes(bn) {
        killLayer(LYR.shapeBox);
        var ly  = getLayer(LYR.shapeBox);
        var col = C.blue;

        for (var i = 0; i < bn.shapeBounds.length; i++) {
            var sb = bn.shapeBounds[i];
            if (sb.W < 1 || sb.H < 1) continue;
            stk(rct(ly, sb.L, sb.B, sb.W, sb.H), col, WT.thin, 45, true);
        }
    }


    // ─── 5) GOLDEN RATIO ────────────────────────────────────
    function genGolden(bn) {
        killLayer(LYR.golden);
        var ly  = getLayer(LYR.golden);
        var col = C.gold;
        var phi = 1.6180339887;
        var gw  = bn.W / phi;
        var gh  = bn.H / phi;

        stk(rct(ly, bn.L, bn.B, bn.W, bn.H), col, WT.thin, 40, true);
        stk(ln(ly, bn.L+gw, bn.T, bn.L+gw, bn.B), col, WT.mid, 65, false);
        stk(ln(ly, bn.R-gw, bn.T, bn.R-gw, bn.B), col, WT.mid, 65, false);
        stk(ln(ly, bn.L, bn.T-gh, bn.R, bn.T-gh), col, WT.mid, 65, false);
        stk(ln(ly, bn.L, bn.B+gh, bn.R, bn.B+gh), col, WT.mid, 65, false);

        stk(rct(ly, bn.L, bn.T-gh, gw, gh),     col, WT.thin, 35, true);
        stk(rct(ly, bn.R-gw, bn.B, gw, gh),     col, WT.thin, 35, true);

        var gr = Math.min(bn.W, bn.H) / phi / 2;
        stk(circ(ly, bn.CX, bn.CY, gr), col, WT.mid, 60, false);
        stk(circ(ly, bn.CX, bn.CY, bn.W/2/phi), col, WT.thin, 40, true);
    }


    // ─── 6) PATH OUTLINE ────────────────────────────────────
    function genOutline(bn) {
        killLayer(LYR.outline);
        if (!bn.paths || bn.paths.length === 0) return;
        var ly = getLayer(LYR.outline);

        for (var i = 0; i < bn.paths.length; i++) {
            try {
                var d = bn.paths[i].duplicate(ly, ElementPlacement.PLACEATBEGINNING);
                d.filled = false;
                d.stroked = true;
                d.strokeColor  = mkRGB(C.pink[0], C.pink[1], C.pink[2]);
                d.strokeWidth  = 0.6;
                d.strokeDashes = [];
                d.opacity      = 65;
            } catch (e) {}
        }
    }


    // ─── 7) ANCHOR POINTS + HANDLES ─────────────────────────
    function genAnchors(bn) {
        killLayer(LYR.anchors);
        if (!bn.anchors || bn.anchors.length === 0) return;
        var ly = getLayer(LYR.anchors);
        var aR = Math.max(Math.min(bn.W, bn.H) * 0.008, 1.2);

        for (var i = 0; i < bn.anchors.length; i++) {
            var a = bn.anchors[i];

            if (OPT.handles) {
                // Left handle
                if (Math.abs(a.lx - a.x) > 0.1 || Math.abs(a.ly - a.y) > 0.1) {
                    stk(ln(ly, a.x, a.y, a.lx, a.ly), C.green, 0.4, 60, false);
                    fil(dot(ly, a.lx, a.ly, aR * 0.5), C.green, 60);
                }
                // Right handle
                if (Math.abs(a.rx - a.x) > 0.1 || Math.abs(a.ry - a.y) > 0.1) {
                    stk(ln(ly, a.x, a.y, a.rx, a.ry), C.green, 0.4, 60, false);
                    fil(dot(ly, a.rx, a.ry, aR * 0.5), C.green, 60);
                }
            }

            // Anchor square (small unfilled square for professional look)
            var sq = aR * 1.4;
            stk(rct(ly, a.x - sq/2, a.y - sq/2, sq, sq), C.blue, WT.mid, 85, false);
        }
    }


    // ─── 8) CLEARSPACE ZONE ─────────────────────────────────
    function genClearspace(bn) {
        killLayer(LYR.clear);
        var ly = getLayer(LYR.clear);
        var col = C.teal;
        var u = Math.min(bn.W, bn.H) / OPT.divs;
        if (u < 0.01) return;
        var pad = u * OPT.csMult;

        stk(rct(ly, bn.L, bn.B, bn.W, bn.H), col, WT.mid, 70, true);
        stk(rct(ly, bn.L-pad, bn.B-pad, bn.W+pad*2, bn.H+pad*2), col, WT.thick, 80, false);

        // Tick marks
        var tks = [
            [bn.L,bn.T, bn.L,bn.T+pad],       [bn.R,bn.T, bn.R,bn.T+pad],
            [bn.L,bn.B, bn.L,bn.B-pad],         [bn.R,bn.B, bn.R,bn.B-pad],
            [bn.L,bn.T, bn.L-pad,bn.T],         [bn.L,bn.B, bn.L-pad,bn.B],
            [bn.R,bn.T, bn.R+pad,bn.T],         [bn.R,bn.B, bn.R+pad,bn.B]
        ];
        for (var i = 0; i < tks.length; i++)
            stk(ln(ly, tks[i][0], tks[i][1], tks[i][2], tks[i][3]), col, WT.thin, 60, false);

        // Measurement arrow
        var ax = bn.CX;
        stk(ln(ly, ax, bn.T, ax, bn.T + pad), col, WT.mid, 80, false);
        var cl = pad * 0.1;
        stk(ln(ly, ax-cl, bn.T, ax+cl, bn.T),         col, WT.mid, 80, false);
        stk(ln(ly, ax-cl, bn.T+pad, ax+cl, bn.T+pad), col, WT.mid, 80, false);
    }


    // ─── 9) ANGLE ANNOTATIONS ──────────────────────────────
    function genAngles(bn) {
        killLayer(LYR.angles);
        var ly  = getLayer(LYR.angles);
        var col = C.grey;

        // For each pair of consecutive anchors, if the segment is diagonal, annotate the angle
        for (var p = 0; p < bn.paths.length; p++) {
            try {
                var pts = bn.paths[p].pathPoints;
                var np = pts.length;
                var closed = (bn.paths[p].closed === true);
                var lim = closed ? np : np - 1;

                for (var q = 0; q < lim; q++) {
                    var cur = pts[q].anchor;
                    var nxt = pts[(q+1) % np].anchor;
                    var dx = nxt[0] - cur[0], dy = nxt[1] - cur[1];
                    var len = Math.sqrt(dx*dx + dy*dy);
                    if (len < 2) continue;

                    // Only annotate non-axis-aligned segments
                    var ang = Math.atan2(dy, dx) * 180 / Math.PI;
                    var absAng = Math.abs(ang);
                    if (absAng < 3 || absAng > 177 ||
                        Math.abs(absAng - 90) < 3) continue;

                    // Draw small arc to indicate angle
                    var arcR = Math.min(len * 0.15, Math.min(bn.W, bn.H) * 0.06);
                    if (arcR < 3) arcR = 3;

                    // Small reference line (horizontal from start point)
                    stk(ln(ly, cur[0], cur[1], cur[0] + arcR * 1.3, cur[1]), col, WT.hair, 45, true);

                    // Arc approximation (small ellipse sector — we draw a small circle)
                    stk(circ(ly, cur[0], cur[1], arcR), col, WT.hair, 25, true);
                }
            } catch (e) {}
        }
    }


    // ─── 10) BASE GRID ──────────────────────────────────────
    function genBase(bn) {
        killLayer(LYR.baseGrid);
        var ly = getLayer(LYR.baseGrid);
        var u  = Math.min(bn.W, bn.H) / OPT.divs;
        if (u < 0.01) return;
        var pad = u * 2;
        var gL = bn.L-pad, gR = bn.R+pad, gT = bn.T+pad, gB = bn.B-pad;
        var col = C.blue;

        var ceil2 = function(v) { return Math.ceil(v / u) * u; };

        for (var x = ceil2(gL); x <= gR + 0.01; x += u) {
            var maj = Math.abs(x - bn.CX) < 0.5;
            stk(ln(ly, x, gT, x, gB), col,
                maj ? WT.thick : WT.hair,
                maj ? 70 : 25, false);
        }
        for (var y = ceil2(gB); y <= gT + 0.01; y += u) {
            var maj2 = Math.abs(y - bn.CY) < 0.5;
            stk(ln(ly, gL, y, gR, y), col,
                maj2 ? WT.thick : WT.hair,
                maj2 ? 70 : 25, false);
        }
        stk(ln(ly, bn.CX, gT, bn.CX, gB), col, WT.bold, 80, false);
        stk(ln(ly, gL, bn.CY, gR, bn.CY), col, WT.bold, 80, false);
    }


    // ═══════════════════════════════════════════════
    //  MASTER GENERATE / REMOVE
    // ═══════════════════════════════════════════════

    function generateAll(bn) {
        killAll();
        if (OPT.baseGrid)  genBase(bn);
        if (OPT.clear)     genClearspace(bn);
        if (OPT.golden)    genGolden(bn);
        if (OPT.curveFit)  genCurveFit(bn);
        if (OPT.shapeBox)  genShapeBoxes(bn);
        if (OPT.align)     genAlignment(bn);
        if (OPT.constr)    genConstruction(bn);
        if (OPT.angles)    genAngles(bn);
        if (OPT.outline)   genOutline(bn);
        if (OPT.anchors)   genAnchors(bn);
        app.redraw();
    }


    // ═══════════════════════════════════════════════
    //  UI DIALOG
    // ═══════════════════════════════════════════════

    function buildDialog(bn) {
        var d = new Window("dialog", NAME + "  v" + VER);
        d.orientation   = "column";
        d.alignChildren = ["fill", "top"];
        d.margins  = 20;
        d.spacing  = 6;
        d.preferredSize = [340, -1];

        // Header
        var hdr = d.add("statictext", undefined, "\u2605  " + NAME + "  v" + VER);
        hdr.alignment = ["center", "top"];
        hdr.graphics.font = ScriptUI.newFont("Arial", "BOLD", 15);

        // Scan info
        var info = d.add("statictext", undefined,
            "Scanned: " + Math.round(bn.W) + " \u00D7 " + Math.round(bn.H) +
            " pt   |   " + bn.paths.length + " paths   |   " +
            bn.anchors.length + " anchors   |   " + bn.curves.length + " curves");
        info.alignment = ["center", "top"];
        info.characters = 50;
        info.graphics.font = ScriptUI.newFont("Arial", "REGULAR", 10);

        d.add("panel").preferredSize.height = 1;

        // ── Grid toggles ──
        var gp = d.add("panel", undefined, "  Construction Grid Layers  ");
        gp.orientation   = "column";
        gp.alignChildren = ["fill", "top"];
        gp.margins  = [14, 18, 14, 10];
        gp.spacing  = 5;

        var chkConstr   = gp.add("checkbox", undefined, "\u271F   Construction Lines (bbox, centre, diagonals)");
        var chkAlign    = gp.add("checkbox", undefined, "\u2502   Key-Point Alignment Lines (per anchor)");
        var chkCurve    = gp.add("checkbox", undefined, "\u25CB   Curve-Fit Circles (fitted to each B\u00E9zier)");
        var chkShapeBox = gp.add("checkbox", undefined, "\u25A1   Per-Shape Bounding Boxes");
        var chkGolden   = gp.add("checkbox", undefined, "\u03C6   Golden Ratio Grid");
        var chkOutline  = gp.add("checkbox", undefined, "\u25CC   Path Outline Overlay");
        var chkAnchors  = gp.add("checkbox", undefined, "\u25A0   Anchor Points");
        var chkHandles  = gp.add("checkbox", undefined, "       \u21B3   B\u00E9zier Handles");
        var chkClear    = gp.add("checkbox", undefined, "\u25A2   Clearspace Zone");
        var chkAngles   = gp.add("checkbox", undefined, "\u2220   Angle Annotations");
        var chkBase     = gp.add("checkbox", undefined, "\u25A6   Base Modular Grid");

        chkConstr.value   = OPT.constr;
        chkAlign.value    = OPT.align;
        chkCurve.value    = OPT.curveFit;
        chkShapeBox.value = OPT.shapeBox;
        chkGolden.value   = OPT.golden;
        chkOutline.value  = OPT.outline;
        chkAnchors.value  = OPT.anchors;
        chkHandles.value  = OPT.handles;
        chkClear.value    = OPT.clear;
        chkAngles.value   = OPT.angles;
        chkBase.value     = OPT.baseGrid;

        d.add("panel").preferredSize.height = 1;

        // ── Settings ──
        var op = d.add("panel", undefined, "  Settings  ");
        op.orientation   = "column";
        op.alignChildren = ["fill", "top"];
        op.margins  = [14, 18, 14, 10];
        op.spacing  = 5;

        function optRow(p, label, val) {
            var r = p.add("group");
            r.alignment = ["fill", "center"];
            r.add("statictext", [0,0,180,20], label);
            return r.add("edittext", [0,0,60,24], String(val));
        }

        var edDivs    = optRow(op, "Grid Divisions:",          OPT.divs);
        var edCS      = optRow(op, "Clearspace Multiplier:",   OPT.csMult);

        d.add("panel").preferredSize.height = 1;

        // ── Select-all / Deselect-all ──
        var selRow = d.add("group");
        selRow.alignment = ["center", "top"];
        selRow.spacing = 10;

        var selAll = selRow.add("button", undefined, "Select All");
        var deAll  = selRow.add("button", undefined, "Deselect All");
        selAll.preferredSize = [120, 26];
        deAll.preferredSize  = [120, 26];

        selAll.onClick = function () {
            chkConstr.value = chkAlign.value = chkCurve.value = chkShapeBox.value = true;
            chkGolden.value = chkOutline.value = chkAnchors.value = chkClear.value = true;
            chkAngles.value = chkBase.value = true;
        };
        deAll.onClick = function () {
            chkConstr.value = chkAlign.value = chkCurve.value = chkShapeBox.value = false;
            chkGolden.value = chkOutline.value = chkAnchors.value = chkClear.value = false;
            chkHandles.value = chkAngles.value = chkBase.value = false;
        };

        // ── Action buttons ──
        var btnRow = d.add("group");
        btnRow.alignment = ["center", "top"];
        btnRow.spacing = 8;

        var genBtn    = btnRow.add("button", undefined, "\u2714  Generate Grids");
        var removeBtn = btnRow.add("button", undefined, "\u2715  Remove All");
        var closeBtn  = btnRow.add("button", undefined, "\u2716  Close");

        genBtn.preferredSize    = [140, 34];
        removeBtn.preferredSize = [105, 30];
        closeBtn.preferredSize  = [80, 30];
        genBtn.graphics.font = ScriptUI.newFont("Arial", "BOLD", 12);

        // ── Save state ──
        function save() {
            OPT.constr   = chkConstr.value;
            OPT.align    = chkAlign.value;
            OPT.curveFit = chkCurve.value;
            OPT.shapeBox = chkShapeBox.value;
            OPT.golden   = chkGolden.value;
            OPT.outline  = chkOutline.value;
            OPT.anchors  = chkAnchors.value;
            OPT.handles  = chkHandles.value;
            OPT.clear    = chkClear.value;
            OPT.angles   = chkAngles.value;
            OPT.baseGrid = chkBase.value;

            var nd = parseInt(edDivs.text, 10);
            OPT.divs = (isNaN(nd) || nd < 1) ? 8 : nd;
            var nc = parseFloat(edCS.text);
            OPT.csMult = (isNaN(nc) || nc < 0.1) ? 1.5 : nc;
        }

        genBtn.onClick = function () { save(); d.close(1); };
        removeBtn.onClick = function () { d.close(2); };
        closeBtn.onClick  = function () { save(); d.close(0); };

        return d;
    }


    // ═══════════════════════════════════════════════
    //  MAIN ENTRY
    // ═══════════════════════════════════════════════

    if (!app.documents.length) {
        alert(NAME + "\n\nPlease open a document first.");
        return;
    }

    var bn = scanSelection();
    if (!bn) {
        alert(NAME + "\n\nPlease select your logo artwork, then run this script.\n\n" +
              "Tips:\n\u2022 Select the entire logo group (Cmd+A)\n" +
              "\u2022 Make sure artwork is not locked\n" +
              "\u2022 Text must be outlined (Type \u2192 Create Outlines)");
        return;
    }

    // Dialog loop — re-opens after Generate or Remove
    var action;
    do {
        var dlg = buildDialog(bn);
        action = dlg.show();

        if (action === 1) {
            try {
                generateAll(bn);
            } catch (err) {
                alert("Error generating grids:\n" + err.toString() + "\nLine: " + err.line);
            }
        } else if (action === 2) {
            killAll();
            app.redraw();
        }
    } while (action !== 0);

})();