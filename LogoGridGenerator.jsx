/**
 * LogoGridGenerator.jsx
 * A production-ready Illustrator ExtendScript to generate professional logo construction grids.
 * 
 * Usage:
 * 1. Place this file in:
 *    - Mac: /Applications/Adobe Illustrator [Year]/Presets.localized/en_US/Scripts
 *    - Windows: C:\Program Files\Adobe\Adobe Illustrator [Year]\Presets\en_US\Scripts
 * 2. Restart Illustrator, or run manually via File > Scripts > Other Script...
 * 3. Select your vector artwork and run the script.
 */

(function () {
    // 1. Basic validations
    if (app.documents.length === 0) {
        alert("Please open a document and select a logo or vector object.");
        return;
    }

    var doc = app.activeDocument;
    var sel = doc.selection;

    if (!sel || sel.length === 0) {
        alert("Please select a logo or vector object.");
        return;
    }

    // Filter out rasters and text out of the selection
    for (var i = 0; i < sel.length; i++) {
        var item = sel[i];
        if (item.typename === "RasterItem") {
            alert("Raster images are not supported. Please select vector artwork or trace the image first.");
            return;
        }
        if (item.typename === "TextFrame") {
            alert("Text objects are not supported natively. Please outline text first (Type > Create Outlines).");
            return;
        }
    }

    // 2. UI Dialog
    var win = new Window("dialog", "Logo Grid Generator");
    win.alignChildren = "fill";

    // Settings Panel
    var settingsPanel = win.add("panel", undefined, "Grid Settings");
    settingsPanel.alignChildren = "left";
    settingsPanel.margins = 15;

    // Density Setting
    var densityGrp = settingsPanel.add("group");
    densityGrp.add("statictext", undefined, "Grid Density (divisions):");
    var densityDrop = densityGrp.add("dropdownlist", undefined, ["4", "8", "12", "16"]);
    densityDrop.selection = 1; // Default to 8

    // Padding Setting
    var padGrp = settingsPanel.add("group");
    padGrp.add("statictext", undefined, "Safe Area Padding (%):");
    var padInput = padGrp.add("edittext", undefined, "10");
    padInput.characters = 5;

    // Guides Toggle
    var guideGrp = settingsPanel.add("group");
    var guideCheck = guideGrp.add("checkbox", undefined, "Convert grid to Guides");
    guideCheck.value = false; // Default false for better visual stylings unless requested

    // Buttons
    var btnGrp = win.add("group");
    btnGrp.alignment = "center";
    var btnCancel = btnGrp.add("button", undefined, "Cancel", {name: "cancel"});
    var btnOk = btnGrp.add("button", undefined, "Generate", {name: "ok"});

    var canceled = true;
    btnCancel.onClick = function () {
        win.close();
    };
    btnOk.onClick = function () {
        canceled = false;
        win.close();
    };

    win.show();

    if (canceled) return;

    // 3. Process Settings
    var density = parseInt(densityDrop.selection.text, 10);
    var paddingPercent = parseFloat(padInput.text);
    if (isNaN(paddingPercent)) paddingPercent = 10;
    var makeGuides = guideCheck.value;

    // 4. Geometry Extraction
    // Function to calculate overall geometric bounds of possibly nested compound/group items
    function getCompoundBounds(items) {
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        function processBounds(arr) {
            for (var i = 0; i < arr.length; i++) {
                var item = arr[i];
                if (item.typename === "GroupItem") {
                    processBounds(item.pageItems);
                } else if (item.geometricBounds) {
                    var b = item.geometricBounds; // [left, top, right, bottom]
                    if (b[0] < minX) minX = b[0];
                    if (b[1] > maxY) maxY = b[1]; // top is higher Y in illustrator math
                    if (b[2] > maxX) maxX = b[2];
                    if (b[3] < minY) minY = b[3];
                }
            }
        }
        processBounds(items);
        return {
            left: minX,
            top: maxY,
            right: maxX,
            bottom: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    var bounds = getCompoundBounds(sel);
    if (!isFinite(bounds.left) || bounds.width <= 0 || bounds.height <= 0) {
        alert("Failed to calculate bounds. Please ensure standard vector objects are selected.");
        return;
    }

    // Calculate paddings
    var padValueX = bounds.width * (paddingPercent / 100);
    var padValueY = bounds.height * (paddingPercent / 100);
    
    // Snap outer padded rectangle to approximate integer points for cleaner grids
    var pLeft = Math.floor(bounds.left - padValueX);
    var pRight = Math.ceil(bounds.right + padValueX);
    var pTop = Math.ceil(bounds.top + padValueY);
    var pBottom = Math.floor(bounds.bottom - padValueY);
    
    var pWidth = pRight - pLeft;
    var pHeight = pTop - pBottom;
    var cX = Math.round((pLeft + pRight) / 2);
    var cY = Math.round((pTop + pBottom) / 2);

    // Anchor finding
    var rawAnchorsX = [];
    var rawAnchorsY = [];

    function extractAnchors(items) {
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.typename === "GroupItem") {
                extractAnchors(item.pageItems);
            } else if (item.typename === "CompoundPathItem") {
                extractAnchors(item.pathItems);
            } else if (item.typename === "PathItem" && item.pathPoints) {
                for (var j = 0; j < item.pathPoints.length; j++) {
                    var pt = item.pathPoints[j].anchor;
                    // Keep anchors strictly inside padded bounds to prevent crazy outliers
                    rawAnchorsX.push(pt[0]);
                    rawAnchorsY.push(pt[1]);
                }
            }
        }
    }
    
    extractAnchors(sel);

    // 5. Grid Setup
    var gridLayerName = "Logo Construction Grid";
    var gridLayer;
    try {
        gridLayer = doc.layers.getByName(gridLayerName);
    } catch(e) {
        gridLayer = doc.layers.add();
        gridLayer.name = gridLayerName;
    }
    
    // Layer positioning at the top
    gridLayer.zOrder(ZOrderMethod.BRINGTOFRONT);

    // Colors
    var mainColor, subColor, anchorColor;
    if (doc.documentColorSpace === DocumentColorSpace.CMYK) {
        mainColor = new CMYKColor();
        mainColor.cyan = 80; mainColor.magenta = 10; mainColor.yellow = 0; mainColor.black = 0;
        
        subColor = new CMYKColor();
        subColor.cyan = 40; subColor.magenta = 0; subColor.yellow = 0; subColor.black = 0;

        anchorColor = new CMYKColor();
        anchorColor.cyan = 20; anchorColor.magenta = 10; anchorColor.yellow = 10; anchorColor.black = 10;
    } else {
        mainColor = new RGBColor();
        mainColor.red = 0; mainColor.green = 120; mainColor.blue = 255;
        
        subColor = new RGBColor();
        subColor.red = 140; subColor.green = 190; subColor.blue = 255;
        
        anchorColor = new RGBColor();
        anchorColor.red = 150; anchorColor.green = 150; anchorColor.blue = 150;
    }

    // Tool function for line drawing
    function createLine(layer, x1, y1, x2, y2, color, strokeWidth, dashed) {
        var line = layer.pathItems.add();
        line.setEntirePath([[x1, y1], [x2, y2]]);
        line.filled = false;
        line.stroked = true;
        line.strokeColor = color;
        line.strokeWidth = strokeWidth;
        if (dashed) {
            line.strokeDashes = [3, 3];
        } else {
            line.strokeDashes = [];
        }
        if (makeGuides) {
            line.guides = true;
        }
        return line;
    }

    // 6. Deduplication Logic
    // We do not want 50 lines drawn on exact same or visually identical alignments.
    var xLinesToDraw = [];
    var yLinesToDraw = [];
    var TOLERANCE = 1.0; // 1 pt tolerance for deduplication

    function processLines(linesArray, val) {
        for (var i = 0; i < linesArray.length; i++) {
            if (Math.abs(linesArray[i].pos - val) < TOLERANCE) return false;
        }
        return true;
    }

    // 6a. Add Center Lines
    xLinesToDraw.push({ pos: cX, type: "main" });
    yLinesToDraw.push({ pos: cY, type: "main" });

    // 6b. Add Division Grids
    var stepX = pWidth / density;
    var stepY = pHeight / density;
    
    for (var i = 1; i < density; i++) {
        var dx = Math.round(pLeft + (i * stepX));
        var dy = Math.round(pBottom + (i * stepY));
        
        // Ensure no overlap with existing (Center) lines
        if (processLines(xLinesToDraw, dx)) {
            xLinesToDraw.push({ pos: dx, type: "div" });
        }
        if (processLines(yLinesToDraw, dy)) {
            yLinesToDraw.push({ pos: dy, type: "div" });
        }
    }

    // 6c. Add Anchors
    rawAnchorsX.sort(function(a,b){return a-b;});
    rawAnchorsY.sort(function(a,b){return a-b;});

    for (var i = 0; i < rawAnchorsX.length; i++) {
        var ax = rawAnchorsX[i];
        if (ax > pLeft + TOLERANCE && ax < pRight - TOLERANCE && processLines(xLinesToDraw, ax)) {
            xLinesToDraw.push({ pos: ax, type: "anchor" });
        }
    }
    for (var i = 0; i < rawAnchorsY.length; i++) {
        var ay = rawAnchorsY[i];
        if (ay > pBottom + TOLERANCE && ay < pTop - TOLERANCE && processLines(yLinesToDraw, ay)) {
            yLinesToDraw.push({ pos: ay, type: "anchor" });
        }
    }

    // 7. Grid Line Generation
    // Draw Padded Box
    var box = gridLayer.pathItems.rectangle(pTop, pLeft, pWidth, pHeight);
    box.filled = false;
    box.stroked = true;
    box.strokeColor = mainColor;
    box.strokeWidth = 0.5;
    box.strokeDashes = [];
    if (makeGuides) box.guides = true;
    
    // Draw pre-calculated X lines
    for (var i = 0; i < xLinesToDraw.length; i++) {
        var lX = xLinesToDraw[i];
        var xVal = lX.pos;
        if (lX.type === "main") {
            createLine(gridLayer, xVal, pTop, xVal, pBottom, mainColor, 0.5, false);
        } else if (lX.type === "div") {
            createLine(gridLayer, xVal, pTop, xVal, pBottom, subColor, 0.25, true);
        } else {
            createLine(gridLayer, xVal, pTop, xVal, pBottom, anchorColor, 0.25, true); // anchor grid
        }
    }

    // Draw pre-calculated Y lines
    for (var i = 0; i < yLinesToDraw.length; i++) {
        var lY = yLinesToDraw[i];
        var yVal = lY.pos;
        if (lY.type === "main") {
            createLine(gridLayer, pLeft, yVal, pRight, yVal, mainColor, 0.5, false);
        } else if (lY.type === "div") {
            createLine(gridLayer, pLeft, yVal, pRight, yVal, subColor, 0.25, true);
        } else {
            createLine(gridLayer, pLeft, yVal, pRight, yVal, anchorColor, 0.25, true); // anchor grid
        }
    }

    // 8. Deselect artwork to view grid purely
    doc.selection = null;

})();
