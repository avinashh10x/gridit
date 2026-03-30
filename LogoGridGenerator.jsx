// ================================================================
//  LOGO GRID KIT  v4.0  –  Adobe Illustrator ExtendScript
//  
//  Bulletproof approach:
//    1. Select your logo → File > Scripts > LogoGridGenerator
//    2. Script auto-scans selection
//    3. Dialog shows scan results + grid options
//    4. Click "Generate" → grids appear on canvas
//    5. Dialog re-opens so you can tweak & re-generate
//    6. Click "Close" when done
//
//  Works on ALL Illustrator versions (CC 2015+)
// ================================================================

// #target illustrator

(function () {

    // ═════════════════════════════════════════════════════════════
    //  CONFIG
    // ═════════════════════════════════════════════════════════════
    var VER  = "4.0";
    var NAME = "Logo Grid Kit";

    var COL = {
        grid     : [60,  140, 230],
        diag     : [100, 170, 240],
        circles  : [160,  80, 230],
        golden   : [230, 175,  40],
        anchor   : [230,  60,  60],
        handle   : [60,  200, 100],
        outline  : [230,  60, 160],
        clear    : [30,  200, 200]
    };

    var WT = { thin: 0.25, mid: 0.5, thick: 1.0 };

    var OP = {
        thin: 45, mid: 65, thick: 85,
        center: 90, diagonal: 35,
        anchor: 95, handle: 70,
        outline: 75
    };

    // Layer names
    var LYR = {
        base    : "LGK-Base",
        iso     : "LGK-Iso",
        constr  : "LGK-Construct",
        circles : "LGK-Circles",
        golden  : "LGK-Golden",
        outline : "LGK-Outline",
        anchors : "LGK-Anchors",
        clear   : "LGK-Clearspace"
    };

    var ALL_KEYS = ["base", "iso", "constr", "circles", "golden", "outline", "anchors", "clear"];

    // Persistent state across dialog re-opens
    var OPT = {
        base: true, iso: false, constr: true, circles: true,
        golden: false, outline: true, anchors: true, clear: true,
        handles: false, divs: 8, csMult: 1.0, numCircles: 6
    };


    // ═════════════════════════════════════════════════════════════
    //  DRAWING HELPERS
    // ═════════════════════════════════════════════════════════════

    function makeRGB(r, g, b) {
        var c = new RGBColor();
        c.red = r; c.green = g; c.blue = b;
        return c;
    }

    function setStroke(item, c, w, op, dash) {
        item.stroked = true;
        item.filled  = false;
        item.strokeColor  = makeRGB(c[0], c[1], c[2]);
        item.strokeWidth  = w;
        item.opacity      = op;
        item.strokeDashes = dash ? [3, 3] : [];
    }

    function setFill(item, c, op) {
        item.filled    = true;
        item.stroked   = false;
        item.fillColor = makeRGB(c[0], c[1], c[2]);
        item.opacity   = op;
    }

    function line(ly, x1, y1, x2, y2) {
        var p = ly.pathItems.add();
        p.setEntirePath([[x1, y1], [x2, y2]]);
        return p;
    }

    function rect(ly, left, bot, w, h) {
        return ly.pathItems.rectangle(bot + h, left, w, h);
    }

    function ellipse(ly, cx, cy, rx, ry) {
        return ly.pathItems.ellipse(cy + ry, cx - rx, rx * 2, ry * 2);
    }

    function dot(ly, cx, cy, r) {
        return ellipse(ly, cx, cy, r, r);
    }


    // ═════════════════════════════════════════════════════════════
    //  LAYER HELPERS
    // ═════════════════════════════════════════════════════════════

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

    function killAllGridLayers() {
        for (var i = 0; i < ALL_KEYS.length; i++) {
            killLayer(LYR[ALL_KEYS[i]]);
        }
    }


    // ═════════════════════════════════════════════════════════════
    //  SCAN SELECTION → BOUNDS
    // ═════════════════════════════════════════════════════════════

    function walkPaths(item, out) {
        if (!item) return;
        var t;
        try { t = item.typename; } catch (e) { return; }

        if (t === "PathItem") {
            out.push(item);
        } else if (t === "CompoundPathItem") {
            for (var a = 0; a < item.pathItems.length; a++) {
                out.push(item.pathItems[a]);
            }
        } else if (t === "GroupItem") {
            for (var b = 0; b < item.pageItems.length; b++) {
                walkPaths(item.pageItems[b], out);
            }
        }
        // skip TextFrames, rasters etc — use geometricBounds fallback
    }

    function scanSelection() {
        var doc = app.activeDocument;
        var sel = doc.selection;
        if (!sel || sel.length === 0) return null;

        var items = [];
        if (sel instanceof Array) {
            for (var s = 0; s < sel.length; s++) items.push(sel[s]);
        } else {
            items.push(sel);
        }

        // gather all descendant paths
        var paths = [];
        for (var i = 0; i < items.length; i++) {
            walkPaths(items[i], paths);
        }

        // compute bounds from paths first, fallback to top-level items
        var sources = (paths.length > 0) ? paths : items;

        var L =  1e9, R = -1e9, T = -1e9, B =  1e9;
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

        if (found === 0) return null;

        var W = R - L;
        var H = T - B;
        if (W < 0.1 || H < 0.1) return null;

        return {
            L: L, T: T, R: R, B: B,
            W: W, H: H,
            CX: L + W / 2,
            CY: B + H / 2,
            paths: paths,
            count: found
        };
    }


    // ═════════════════════════════════════════════════════════════
    //  GRID GENERATORS  — each fully standalone
    // ═════════════════════════════════════════════════════════════

    function ceil(v, u) { return Math.ceil(v / u) * u; }

    // ── BASE GRID ──
    function genBase(bn) {
        killLayer(LYR.base);
        var ly = getLayer(LYR.base);
        var u  = Math.min(bn.W, bn.H) / OPT.divs;
        if (u < 0.01) return;
        var pad = u * 2;
        var gL = bn.L - pad, gR = bn.R + pad;
        var gT = bn.T + pad, gB = bn.B - pad;

        for (var x = ceil(gL, u); x <= gR + 0.01; x += u) {
            var maj = Math.abs(x - bn.CX) < 0.5;
            setStroke(line(ly, x, gT, x, gB), COL.grid,
                      maj ? WT.thick : WT.thin, maj ? OP.center : OP.thin, false);
        }
        for (var y = ceil(gB, u); y <= gT + 0.01; y += u) {
            var maj2 = Math.abs(y - bn.CY) < 0.5;
            setStroke(line(ly, gL, y, gR, y), COL.grid,
                      maj2 ? WT.thick : WT.thin, maj2 ? OP.center : OP.thin, false);
        }
        setStroke(line(ly, bn.CX, gT, bn.CX, gB), COL.grid, WT.thick, OP.center, false);
        setStroke(line(ly, gL, bn.CY, gR, bn.CY), COL.grid, WT.thick, OP.center, false);
    }

    // ── ISOMETRIC ──
    function genIso(bn) {
        killLayer(LYR.iso);
        var ly = getLayer(LYR.iso);
        var u  = Math.min(bn.W, bn.H) / OPT.divs;
        if (u < 0.01) return;
        var pad = u * 3;
        var gL = bn.L-pad, gR = bn.R+pad, gT = bn.T+pad, gB = bn.B-pad;
        var ta = Math.tan(Math.PI / 3);
        var span = (gT - gB) / ta;

        for (var x = gL - span; x <= gR + span; x += u) {
            setStroke(line(ly, gL, gT-(gL-x)*ta, gR, gT-(gR-x)*ta), COL.grid, WT.thin, OP.thin, false);
            setStroke(line(ly, gL, gT+(gL-x)*ta, gR, gT+(gR-x)*ta), COL.grid, WT.thin, OP.thin, false);
        }
        for (var xv = bn.L-pad; xv <= bn.R+pad; xv += u) {
            setStroke(line(ly, xv, gT, xv, gB), COL.grid, WT.thin, OP.thin, false);
        }
    }

    // ── CONSTRUCTION LINES ──
    function genConstr(bn) {
        killLayer(LYR.constr);
        var ly  = getLayer(LYR.constr);
        var ext = Math.max(bn.W, bn.H) * 0.55;

        // bounding box
        setStroke(rect(ly, bn.L, bn.B, bn.W, bn.H), COL.grid, WT.mid, OP.mid, true);
        // edge extensions
        setStroke(line(ly, bn.L, bn.T+ext, bn.L, bn.B-ext), COL.grid, WT.thin, OP.mid, false);
        setStroke(line(ly, bn.R, bn.T+ext, bn.R, bn.B-ext), COL.grid, WT.thin, OP.mid, false);
        setStroke(line(ly, bn.L-ext, bn.T, bn.R+ext, bn.T), COL.grid, WT.thin, OP.mid, false);
        setStroke(line(ly, bn.L-ext, bn.B, bn.R+ext, bn.B), COL.grid, WT.thin, OP.mid, false);
        // centre cross
        setStroke(line(ly, bn.CX, bn.T+ext, bn.CX, bn.B-ext), COL.grid, WT.thick, OP.thick, false);
        setStroke(line(ly, bn.L-ext, bn.CY, bn.R+ext, bn.CY), COL.grid, WT.thick, OP.thick, false);
        // diagonals
        var de = ext * 0.4;
        setStroke(line(ly, bn.L-de, bn.B-de, bn.R+de, bn.T+de), COL.diag, WT.thin, OP.diagonal, false);
        setStroke(line(ly, bn.L-de, bn.T+de, bn.R+de, bn.B-de), COL.diag, WT.thin, OP.diagonal, false);
        // quarter lines
        setStroke(line(ly, bn.L+bn.W*0.25, bn.T+ext*0.3, bn.L+bn.W*0.25, bn.B-ext*0.3), COL.grid, WT.thin, OP.thin, false);
        setStroke(line(ly, bn.L+bn.W*0.75, bn.T+ext*0.3, bn.L+bn.W*0.75, bn.B-ext*0.3), COL.grid, WT.thin, OP.thin, false);
        setStroke(line(ly, bn.L-ext*0.3, bn.B+bn.H*0.25, bn.R+ext*0.3, bn.B+bn.H*0.25), COL.grid, WT.thin, OP.thin, false);
        setStroke(line(ly, bn.L-ext*0.3, bn.B+bn.H*0.75, bn.R+ext*0.3, bn.B+bn.H*0.75), COL.grid, WT.thin, OP.thin, false);
    }

    // ── CIRCLES ──
    function genCircles(bn) {
        killLayer(LYR.circles);
        var ly  = getLayer(LYR.circles);
        var inR = Math.min(bn.W, bn.H) / 2;
        var outR = Math.sqrt(bn.W*bn.W + bn.H*bn.H) / 2;
        var n = OPT.numCircles;

        for (var i = 1; i <= n; i++) {
            var r = inR * (i / n) * (outR / inR);
            setStroke(ellipse(ly, bn.CX, bn.CY, r, r), COL.circles, WT.thin, OP.thin+5, false);
        }
        setStroke(ellipse(ly, bn.CX, bn.CY, inR, inR),   COL.circles, WT.thick, 85, false);
        setStroke(ellipse(ly, bn.CX, bn.CY, outR, outR),  COL.circles, WT.mid,   60, true);
        setFill(dot(ly, bn.CX, bn.CY, Math.max(Math.min(bn.W,bn.H)*0.012, 1)), COL.circles, 90);
        setStroke(line(ly, bn.CX, bn.CY+outR*1.1, bn.CX, bn.CY-outR*1.1), COL.circles, WT.thin, 30, false);
        setStroke(line(ly, bn.CX-outR*1.1, bn.CY, bn.CX+outR*1.1, bn.CY), COL.circles, WT.thin, 30, false);
    }

    // ── GOLDEN RATIO ──
    function genGolden(bn) {
        killLayer(LYR.golden);
        var ly  = getLayer(LYR.golden);
        var phi = 1.6180339887;
        var gw  = bn.W / phi;
        var gh  = bn.H / phi;

        setStroke(rect(ly, bn.L, bn.B, bn.W, bn.H), COL.golden, WT.thin, 40, true);
        setStroke(line(ly, bn.L+gw, bn.T, bn.L+gw, bn.B), COL.golden, WT.mid, 75, false);
        setStroke(line(ly, bn.R-gw, bn.T, bn.R-gw, bn.B), COL.golden, WT.mid, 75, false);
        setStroke(line(ly, bn.L, bn.T-gh, bn.R, bn.T-gh),  COL.golden, WT.mid, 75, false);
        setStroke(line(ly, bn.L, bn.B+gh, bn.R, bn.B+gh),  COL.golden, WT.mid, 75, false);
        setStroke(rect(ly, bn.L, bn.T-gh, gw, gh),          COL.golden, WT.thin, 40, true);
        setStroke(rect(ly, bn.R-gw, bn.B, gw, gh),          COL.golden, WT.thin, 40, true);

        var gr = Math.min(bn.W, bn.H) / phi / 2;
        setStroke(ellipse(ly, bn.CX, bn.CY, gr, gr),             COL.golden, WT.mid, 70, false);
        setStroke(ellipse(ly, bn.CX, bn.CY, bn.W/2/phi, bn.W/2/phi), COL.golden, WT.thin, 45, true);
    }

    // ── OUTLINE ──
    function genOutline(bn) {
        killLayer(LYR.outline);
        if (!bn.paths || bn.paths.length === 0) return;
        var ly = getLayer(LYR.outline);
        for (var i = 0; i < bn.paths.length; i++) {
            try {
                var d = bn.paths[i].duplicate(ly, ElementPlacement.PLACEATBEGINNING);
                d.filled = false;
                d.stroked = true;
                d.strokeColor  = makeRGB(COL.outline[0], COL.outline[1], COL.outline[2]);
                d.strokeWidth  = 0.75;
                d.strokeDashes = [];
                d.opacity      = OP.outline;
            } catch (e) {}
        }
    }

    // ── ANCHORS ──
    function genAnchors(bn) {
        killLayer(LYR.anchors);
        if (!bn.paths || bn.paths.length === 0) return;
        var ly = getLayer(LYR.anchors);
        var aR = Math.max(Math.min(bn.W, bn.H) * 0.010, 1);
        var hR = aR * 0.55;

        for (var i = 0; i < bn.paths.length; i++) {
            try {
                var pts = bn.paths[i].pathPoints;
                for (var j = 0; j < pts.length; j++) {
                    var a  = pts[j].anchor;
                    var li = pts[j].leftDirection;
                    var ri = pts[j].rightDirection;
                    if (OPT.handles) {
                        if (Math.abs(li[0]-a[0])>0.01 || Math.abs(li[1]-a[1])>0.01) {
                            setStroke(line(ly, a[0], a[1], li[0], li[1]), COL.handle, 0.4, OP.handle, false);
                            setFill(dot(ly, li[0], li[1], hR), COL.handle, OP.handle);
                        }
                        if (Math.abs(ri[0]-a[0])>0.01 || Math.abs(ri[1]-a[1])>0.01) {
                            setStroke(line(ly, a[0], a[1], ri[0], ri[1]), COL.handle, 0.4, OP.handle, false);
                            setFill(dot(ly, ri[0], ri[1], hR), COL.handle, OP.handle);
                        }
                    }
                    setFill(dot(ly, a[0], a[1], aR), COL.anchor, OP.anchor);
                }
            } catch (e) {}
        }
    }

    // ── CLEARSPACE ──
    function genClear(bn) {
        killLayer(LYR.clear);
        var ly = getLayer(LYR.clear);
        var u  = Math.min(bn.W, bn.H) / OPT.divs;
        if (u < 0.01) return;
        var pad = u * OPT.csMult;

        setStroke(rect(ly, bn.L, bn.B, bn.W, bn.H),
                  COL.clear, WT.mid, 80, true);
        setStroke(rect(ly, bn.L-pad, bn.B-pad, bn.W+pad*2, bn.H+pad*2),
                  COL.clear, WT.thick, 85, false);

        // tick marks
        var tk = [
            [bn.L,bn.T,bn.L,bn.T+pad],     [bn.R,bn.T,bn.R,bn.T+pad],
            [bn.L,bn.B,bn.L,bn.B-pad],       [bn.R,bn.B,bn.R,bn.B-pad],
            [bn.L,bn.T,bn.L-pad,bn.T],       [bn.L,bn.B,bn.L-pad,bn.B],
            [bn.R,bn.T,bn.R+pad,bn.T],       [bn.R,bn.B,bn.R+pad,bn.B]
        ];
        for (var i = 0; i < tk.length; i++)
            setStroke(line(ly, tk[i][0], tk[i][1], tk[i][2], tk[i][3]), COL.clear, WT.thin, 65, false);

        // measurement
        var ax = bn.CX;
        setStroke(line(ly, ax, bn.T, ax, bn.T+pad), COL.clear, WT.mid, 85, false);
        var cl = pad * 0.08;
        setStroke(line(ly, ax-cl, bn.T, ax+cl, bn.T),         COL.clear, WT.mid, 85, false);
        setStroke(line(ly, ax-cl, bn.T+pad, ax+cl, bn.T+pad), COL.clear, WT.mid, 85, false);
    }


    // ═════════════════════════════════════════════════════════════
    //  MASTER GENERATE / REMOVE
    // ═════════════════════════════════════════════════════════════

    function generateAllSelected(bn) {
        killAllGridLayers();
        if (OPT.clear)   genClear(bn);
        if (OPT.golden)  genGolden(bn);
        if (OPT.circles) genCircles(bn);
        if (OPT.iso)     genIso(bn);
        if (OPT.base)    genBase(bn);
        if (OPT.constr)  genConstr(bn);
        if (OPT.outline) genOutline(bn);
        if (OPT.anchors) genAnchors(bn);
        app.redraw();
    }


    // ═════════════════════════════════════════════════════════════
    //  UI DIALOG  (re-opens after each action)
    // ═════════════════════════════════════════════════════════════

    function buildDialog(bn) {
        var d = new Window("dialog", NAME + "  v" + VER);
        d.orientation   = "column";
        d.alignChildren = ["fill", "top"];
        d.margins  = 18;
        d.spacing  = 8;

        // ── Header ──
        var hdr = d.add("statictext", undefined,
            "\u2605  " + NAME + "  v" + VER);
        hdr.alignment = ["center", "top"];
        hdr.graphics.font = ScriptUI.newFont("Arial", "BOLD", 15);

        // ── Scan info ──
        var info = d.add("statictext", undefined,
            "Scanned: " + Math.round(bn.W) + " \u00D7 " + Math.round(bn.H) +
            " pt   |   " + bn.paths.length + " path(s) found");
        info.alignment = ["center", "top"];
        info.graphics.font = ScriptUI.newFont("Arial", "REGULAR", 11);

        d.add("panel").preferredSize.height = 1;

        // ── Grid toggles ──
        var gp = d.add("panel", undefined, "  Select Grid Layers  ");
        gp.orientation   = "column";
        gp.alignChildren = ["fill", "top"];
        gp.margins  = [14, 18, 14, 10];
        gp.spacing  = 5;

        var chkBase    = gp.add("checkbox", undefined, "\u25A6   Base Grid");
        var chkIso     = gp.add("checkbox", undefined, "\u25B3   Isometric Grid (30/60\u00B0)");
        var chkConstr  = gp.add("checkbox", undefined, "\u271F   Construction Lines");
        var chkCircles = gp.add("checkbox", undefined, "\u25EF   Circle Grid");
        var chkGolden  = gp.add("checkbox", undefined, "\u03C6   Golden Ratio Grid");
        var chkOutline = gp.add("checkbox", undefined, "\u25CB   Path Outline Overlay");
        var chkAnchors = gp.add("checkbox", undefined, "\u25CF   Anchor Points");
        var chkHandles = gp.add("checkbox", undefined, "       \u21B3   B\u00E9zier Handles");
        var chkClear   = gp.add("checkbox", undefined, "\u25A1   Clearspace Zone");

        // Set values from persistent state
        chkBase.value    = OPT.base;
        chkIso.value     = OPT.iso;
        chkConstr.value  = OPT.constr;
        chkCircles.value = OPT.circles;
        chkGolden.value  = OPT.golden;
        chkOutline.value = OPT.outline;
        chkAnchors.value = OPT.anchors;
        chkHandles.value = OPT.handles;
        chkClear.value   = OPT.clear;

        d.add("panel").preferredSize.height = 1;

        // ── Options ──
        var op = d.add("panel", undefined, "  Settings  ");
        op.orientation   = "column";
        op.alignChildren = ["fill", "top"];
        op.margins  = [14, 18, 14, 10];
        op.spacing  = 5;

        function optRow(parent, label, val) {
            var row = parent.add("group");
            row.alignment = ["fill", "center"];
            row.add("statictext", [0,0,160,20], label);
            var ed = row.add("edittext", [0,0,60,24], String(val));
            return ed;
        }

        var edDivs    = optRow(op, "Grid Divisions:",          OPT.divs);
        var edCS      = optRow(op, "Clearspace Multiplier:",   OPT.csMult);
        var edCircles = optRow(op, "Circle Count:",            OPT.numCircles);

        d.add("panel").preferredSize.height = 1;

        // ── Select All / Deselect All ──
        var selRow = d.add("group");
        selRow.alignment = ["center", "top"];
        selRow.spacing = 10;

        var selAllBtn   = selRow.add("button", undefined, "Select All");
        var deselAllBtn = selRow.add("button", undefined, "Deselect All");
        selAllBtn.preferredSize   = [110, 26];
        deselAllBtn.preferredSize = [110, 26];

        selAllBtn.onClick = function () {
            chkBase.value = chkIso.value = chkConstr.value = chkCircles.value = true;
            chkGolden.value = chkOutline.value = chkAnchors.value = chkClear.value = true;
        };
        deselAllBtn.onClick = function () {
            chkBase.value = chkIso.value = chkConstr.value = chkCircles.value = false;
            chkGolden.value = chkOutline.value = chkAnchors.value = chkClear.value = false;
            chkHandles.value = false;
        };

        // ── Action buttons ──
        var btnRow = d.add("group");
        btnRow.alignment = ["center", "top"];
        btnRow.spacing = 8;

        var genBtn    = btnRow.add("button", undefined, "\u2714  Generate Grids");
        var removeBtn = btnRow.add("button", undefined, "\u2715  Remove All");
        var closeBtn  = btnRow.add("button", undefined, "\u2716  Close");

        genBtn.preferredSize    = [130, 32];
        removeBtn.preferredSize = [100, 30];
        closeBtn.preferredSize  = [80, 30];

        genBtn.graphics.font = ScriptUI.newFont("Arial", "BOLD", 12);

        // ── saveback function ──
        function saveState() {
            OPT.base    = chkBase.value;
            OPT.iso     = chkIso.value;
            OPT.constr  = chkConstr.value;
            OPT.circles = chkCircles.value;
            OPT.golden  = chkGolden.value;
            OPT.outline = chkOutline.value;
            OPT.anchors = chkAnchors.value;
            OPT.handles = chkHandles.value;
            OPT.clear   = chkClear.value;

            var nd = parseInt(edDivs.text, 10);
            OPT.divs = (isNaN(nd) || nd < 1) ? 8 : nd;

            var nc = parseFloat(edCS.text);
            OPT.csMult = (isNaN(nc) || nc < 0.1) ? 1.0 : nc;

            var nn = parseInt(edCircles.text, 10);
            OPT.numCircles = (isNaN(nn) || nn < 1) ? 6 : nn;
        }

        // ── Wire buttons ──
        genBtn.onClick = function () {
            saveState();
            d.close(1); // 1 = generate
        };

        removeBtn.onClick = function () {
            d.close(2); // 2 = remove
        };

        closeBtn.onClick = function () {
            saveState();
            d.close(0); // 0 = close
        };

        return d;
    }


    // ═════════════════════════════════════════════════════════════
    //  MAIN ENTRY
    // ═════════════════════════════════════════════════════════════

    if (!app.documents.length) {
        alert(NAME + "\n\nPlease open a document first.");
        return;
    }

    // ── Step 1: Scan selection ──
    var bn = scanSelection();
    if (!bn) {
        alert(NAME + "\n\nPlease select your logo artwork first,\nthen run this script again.\n\n" +
              "Tip: Select the entire logo (Cmd+A or click the group).");
        return;
    }

    // ── Step 2: Show dialog in a loop ──
    var action;
    do {
        var dlg = buildDialog(bn);
        action = dlg.show();

        if (action === 1) {
            // Generate selected grids
            try {
                generateAllSelected(bn);
            } catch (err) {
                alert("Grid generation error:\n" + err.toString() + "\nLine: " + err.line);
            }
            // Dialog will re-open so user can tweak and re-generate
        }
        else if (action === 2) {
            // Remove all grid layers
            killAllGridLayers();
            app.redraw();
            // Dialog re-opens
        }
        // action === 0 → Close, exit loop

    } while (action !== 0);

})();