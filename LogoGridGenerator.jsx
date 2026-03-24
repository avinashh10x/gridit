/**
 * PRODUCTION-LEVEL LOGO CONSTRUCTION GRID ENGINE
 * Version: 3.2 (Reliable Persistent Window)
 * 
 * Analyzes selected vector artwork in Adobe Illustrator and generates 
 * a professional construction grid. Persists for iterative editing.
 */

(function () {
    try {
        if (app.documents.length === 0) {
            alert("Please open an Illustrator document first.");
            return;
        }

        var doc = app.activeDocument;

        // --- Configuration ---
        var CONFIG = {
            cyan: (function() { var c = new RGBColor(); c.red = 0; c.green = 219; c.blue = 233; return c; })(),
            magenta: (function() { var c = new RGBColor(); c.red = 255; c.green = 81; c.blue = 250; return c; })(),
            black: (function() { var c = new RGBColor(); c.red = 0; c.green = 0; c.blue = 0; return c; })(),
            strokeThin: 0.25,
            strokeMed: 0.5,
            snapThreshold: 1.0
        };

        // --- Helpers (Defined before use for stability) ---
        function avg(a) { 
            var s = 0; 
            for(var i=0; i<a.length; i++) s += a[i]; 
            return s / a.length; 
        }

        function extractGeometry(items, pts, segs) {
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                if (it.typename === "GroupItem") extractGeometry(it.pageItems, pts, segs);
                else if (it.typename === "PathItem") {
                    var pp = it.pathPoints;
                    for (var j = 0; j < pp.length; j++) {
                        pts.push({x: pp[j].anchor[0], y: pp[j].anchor[1]});
                        if (j < pp.length - 1 || it.closed) {
                            segs.push({p1: pp[j], p2: pp[(j + 1) % pp.length]});
                        }
                    }
                } else if (it.typename === "CompoundPathItem") extractGeometry(it.pathItems, pts, segs);
            }
        }

        function detectClusters(vals, threshold) {
            var s = vals.sort(function(a,b){return a-b});
            var c = []; if (s.length === 0) return c;
            var cur = [s[0]];
            for (var i=1; i<s.length; i++) {
                if (s[i]-s[i-1] < threshold) cur.push(s[i]);
                else { c.push(avg(cur)); cur = [s[i]]; }
            }
            c.push(avg(cur)); return c;
        }

        function getBezierPoint(t, p1, cp1, cp2, p2) {
            var x = Math.pow(1-t,3)*p1[0] + 3*Math.pow(1-t,2)*t*cp1[0] + 3*(1-t)*Math.pow(t,2)*cp2[0] + Math.pow(t,3)*p2[0];
            var y = Math.pow(1-t,3)*p1[1] + 3*Math.pow(1-t,2)*t*cp1[1] + 3*(1-t)*Math.pow(t,2)*cp2[1] + Math.pow(t,3)*p2[1];
            return [x, y];
        }

        function findCircleCenter(pa, pb, pc) {
            var x1=pa[0],y1=pa[1],x2=pb[0],y2=pb[1],x3=pc[0],y3=pc[1];
            var D = 2*(x1*(y2-y3)+x2*(y3-y1)+x3*(y1-y2));
            if (Math.abs(D)<0.001) return null;
            var ux = ((x1*x1+y1*y1)*(y2-y3)+(x2*x2+y2*y2)*(y3-y1)+(x3*x3+y3*y3)*(y1-y2))/D;
            var uy = ((x1*x1+y1*y1)*(x3-x2)+(x2*x2+y2*y2)*(x1-x3)+(x3*x3+y3*y3)*(x2-x1))/D;
            return {x:ux, y:uy};
        }

        function dist(p1,p2) { return Math.sqrt(Math.pow(p1[0]-p2[0],2)+Math.pow(p1[1]-p2[1],2)); }

        // --- UI Setup ---
        // Using "dialog" for maximum compatibility across Illustrator versions, 
        // but not closing it on "Run" click allows it to persist.
        var win = new Window("dialog", "GRIDIT Engine v3.2", undefined, {closeButton: false});
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 15;
        win.margins = 20;

        var headerGrp = win.add("group");
        headerGrp.alignment = "fill";
        var title = headerGrp.add("statictext", undefined, "LOGO CONSTRUCTION GRID ENGINE");
        title.graphics.font = ScriptUI.newFont("Helvetica-Bold", 14);
        
        var closeBtn = headerGrp.add("button", [0, 0, 25, 25], "X");
        closeBtn.alignment = ["right", "top"];
        closeBtn.onClick = function() { win.close(); };

        var optionsPanel = win.add("panel", undefined, "DETERMINISTIC ANALYSIS");
        optionsPanel.alignChildren = "left";
        optionsPanel.margins = 15;

        var chkBounds = optionsPanel.add("checkbox", undefined, "Generate Bounding Box (Cyan)"); chkBounds.value = true;
        var chkCenter = optionsPanel.add("checkbox", undefined, "Generate Center Lines (Cyan)"); chkCenter.value = true;
        var chkAlign = optionsPanel.add("checkbox", undefined, "Extract Alignment Axes (Magenta)"); chkAlign.value = true;
        var chkCircles = optionsPanel.add("checkbox", undefined, "Fit Curve Circles (Cyan)"); chkCircles.value = true;
        var chkAnchors = optionsPanel.add("checkbox", undefined, "Mark Anchor Points"); chkAnchors.value = true;

        var runBtn = win.add("button", undefined, "Run Generation");
        
        var gridGroup = null;

        runBtn.onClick = function() {
            var activeDoc = app.activeDocument;
            var sel = activeDoc.selection;
            
            if (!sel || sel.length === 0) {
                alert("Please select the logo artwork to analyze.");
                return;
            }

            // 1. Clear Old Grid by searching name
            try {
                var oldGrids = activeDoc.groupItems;
                for (var g = oldGrids.length - 1; g >= 0; g--) {
                    if (oldGrids[g].name === "GRIDIT_INSTANCE") {
                        oldGrids[g].remove();
                    }
                }
            } catch(e) {}

            // 2. Extract Geometry
            var points = [];
            var segments = [];
            extractGeometry(sel, points, segments);
            if (points.length === 0) return;

            // 3. Setup Grid Structure
            var gridLayer;
            try { gridLayer = activeDoc.layers.getByName("Construction Grid"); } catch(e) { gridLayer = activeDoc.layers.add(); gridLayer.name = "Construction Grid"; }
            gridGroup = gridLayer.groupItems.add();
            gridGroup.name = "GRIDIT_INSTANCE";

            // 4. Calculate Global Bounds
            var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (var i = 0; i < points.length; i++) {
                if (points[i].x < minX) minX = points[i].x;
                if (points[i].x > maxX) maxX = points[i].x;
                if (points[i].y < minY) minY = points[i].y;
                if (points[i].y > maxY) maxY = points[i].y;
            }

            var bounds = { left: minX, right: maxX, top: maxY, bottom: minY, width: maxX - minX, height: maxY - minY };
            var center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };

            // 5. Alignment Clustering
            var xCoords = [], yCoords = [];
            for (var i = 0; i < points.length; i++) { xCoords.push(points[i].x); yCoords.push(points[i].y); }
            var axesX = detectClusters(xCoords, CONFIG.snapThreshold);
            var axesY = detectClusters(yCoords, CONFIG.snapThreshold);

            // 6. Draw Grid Elements
            function drawLine(x1, y1, x2, y2, color, weight, dash) {
                var l = gridGroup.pathItems.add();
                l.setEntirePath([[x1, y1], [x2, y2]]);
                l.stroked = true; l.filled = false; l.strokeColor = color; l.strokeWidth = weight;
                if (dash) l.strokeDashes = [2, 2];
            }

            function drawCircle(cx, cy, r) {
                var c = gridGroup.pathItems.ellipse(cy + r, cx - r, r * 2, r * 2);
                c.stroked = true; c.filled = false; c.strokeColor = CONFIG.cyan; c.strokeWidth = CONFIG.strokeThin;
            }

            if (chkBounds.value) {
                drawLine(bounds.left, bounds.top, bounds.right, bounds.top, CONFIG.cyan, CONFIG.strokeMed, true);
                drawLine(bounds.right, bounds.top, bounds.right, bounds.bottom, CONFIG.cyan, CONFIG.strokeMed, true);
                drawLine(bounds.right, bounds.bottom, bounds.left, bounds.bottom, CONFIG.cyan, CONFIG.strokeMed, true);
                drawLine(bounds.left, bounds.bottom, bounds.left, bounds.top, CONFIG.cyan, CONFIG.strokeMed, true);
            }

            if (chkCenter.value) {
                drawLine(center.x, bounds.top + 20, center.x, bounds.bottom - 20, CONFIG.cyan, CONFIG.strokeMed, false);
                drawLine(bounds.left - 20, center.y, bounds.right + 20, center.y, CONFIG.cyan, CONFIG.strokeMed, false);
            }

            if (chkAlign.value) {
                for (var i = 0; i < axesX.length; i++) drawLine(axesX[i], bounds.top, axesX[i], bounds.bottom, CONFIG.magenta, CONFIG.strokeThin, false);
                for (var i = 0; i < axesY.length; i++) drawLine(bounds.left, axesY[i], bounds.right, axesY[i], CONFIG.magenta, CONFIG.strokeThin, false);
            }

            if (chkCircles.value) {
                for (var i = 0; i < segments.length; i++) {
                    var s = segments[i];
                    var p1 = s.p1.anchor, p2 = s.p2.anchor;
                    var cp1 = s.p1.rightDirection, cp2 = s.p2.leftDirection;
                    if (cp1[0] !== p1[0] || cp1[1] !== p1[1] || cp2[0] !== p2[0] || cp2[1] !== p2[1]) {
                        var mid = getBezierPoint(0.5, p1, cp1, cp2, p2);
                        var cCenter = findCircleCenter(p1, mid, p2);
                        if (cCenter) {
                            var radius = dist(p1, [cCenter.x, cCenter.y]);
                            if (radius > 5 && radius < 2000) drawCircle(cCenter.x, cCenter.y, radius);
                        }
                    }
                }
            }

            if (chkAnchors.value) {
                for (var i = 0; i < points.length; i++) {
                    var p = points[i];
                    var r = gridGroup.pathItems.rectangle(p.y + 0.75, p.x - 0.75, 1.5, 1.5);
                    r.filled = true; r.fillColor = CONFIG.black; r.stroked = true; r.strokeColor = CONFIG.cyan; r.strokeWidth = 0.5;
                }
            }

            app.redraw();
        };

        win.show();

    } catch (err) {
        alert("Engine Error: " + err.message);
    }

})();