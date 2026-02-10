/**
 * Gridly — Clear Space Generator
 * 
 * Creates a padding boundary around the logo with measurement
 * lines, arrows, and "X" labels showing the clear space zone.
 */

const GridlyClearSpace = (() => {

    /**
     * Generate clear space diagram.
     * 
     * @param {number[]} bounds - [left, top, right, bottom] geometric bounds
     * @param {string} unitType - "width" | "height" | "stroke"
     * @param {number} opacity - Clear space opacity (0–100)
     * @returns {object} The clear space group item
     */
    function generate(bounds, unitType, opacity) {
        const doc = GridlyLayers.getDoc();
        const layer = GridlyLayers.prepareClearSpaceLayer();
        const rect = GridlyUtils.boundsToRect(bounds);

        const strokeColor = GridlyUtils.clearSpaceColor();
        const labelColor = GridlyUtils.annotationColor();
        const strokeWidth = 0.5;
        const aiOpacity = GridlyUtils.opacityToAI(opacity);

        // --- Calculate unit X ---
        let unitX;
        switch (unitType) {
            case "height":
                unitX = rect.height * 0.15;
                break;
            case "stroke":
                unitX = estimateStrokeWidth(doc) || rect.width * 0.1;
                break;
            case "width":
            default:
                unitX = rect.width * 0.15;
                break;
        }

        // Minimum clear space
        unitX = Math.max(unitX, 4);

        const items = [];

        // --- Outer padding boundary (dashed rectangle) ---
        const padTop = rect.top + unitX;
        const padLeft = rect.left - unitX;
        const padWidth = rect.width + unitX * 2;
        const padHeight = rect.height + unitX * 2;

        const padRect = doc.pathItems.rectangle(padTop, padLeft, padWidth, padHeight);
        padRect.stroked = true;
        padRect.strokeColor = strokeColor;
        padRect.strokeWidth = 0.75;
        padRect.strokeDashes = [4, 3];
        padRect.filled = false;
        padRect.opacity = aiOpacity;
        padRect.move(layer, ElementPlacement.PLACEATEND);
        items.push(padRect);

        // --- Inner bounding box (logo bounds) ---
        const innerRect = doc.pathItems.rectangle(
            rect.top, rect.left, rect.width, rect.height
        );
        innerRect.stroked = true;
        innerRect.strokeColor = strokeColor;
        innerRect.strokeWidth = 0.5;
        innerRect.strokeDashes = [2, 2];
        innerRect.filled = false;
        innerRect.opacity = aiOpacity;
        innerRect.move(layer, ElementPlacement.PLACEATEND);
        items.push(innerRect);

        // --- Measurement lines (top, right, bottom, left) ---
        const measurements = [
            // Top measurement
            {
                from: [rect.centerX, rect.top],
                to: [rect.centerX, padTop],
                labelPos: [rect.centerX + 4, rect.top + unitX / 2]
            },
            // Right measurement
            {
                from: [rect.right, rect.centerY],
                to: [rect.right + unitX, rect.centerY],
                labelPos: [rect.right + unitX / 2 - 3, rect.centerY - 4]
            },
            // Bottom measurement
            {
                from: [rect.centerX, rect.bottom],
                to: [rect.centerX, rect.bottom - unitX],
                labelPos: [rect.centerX + 4, rect.bottom - unitX / 2]
            },
            // Left measurement
            {
                from: [rect.left, rect.centerY],
                to: [rect.left - unitX, rect.centerY],
                labelPos: [rect.left - unitX / 2 - 3, rect.centerY - 4]
            }
        ];

        measurements.forEach((m) => {
            // Measurement line
            const line = doc.pathItems.add();
            line.setEntirePath([m.from, m.to]);
            line.stroked = true;
            line.strokeColor = labelColor;
            line.strokeWidth = 0.5;
            line.filled = false;
            line.opacity = aiOpacity;
            line.move(layer, ElementPlacement.PLACEATEND);
            items.push(line);

            // Arrow caps (small perpendicular lines at each end)
            const arrowItems = drawArrowCaps(doc, m.from, m.to, labelColor, aiOpacity, layer);
            items.push(...arrowItems);

            // "X" label
            const label = doc.textFrames.add();
            label.contents = "X";
            label.textRange.characterAttributes.size = 7;
            label.textRange.characterAttributes.fillColor = labelColor;
            label.position = m.labelPos;
            label.opacity = aiOpacity;
            label.move(layer, ElementPlacement.PLACEATEND);
            items.push(label);
        });

        // --- Corner marks (small L-shaped marks at padding corners) ---
        const cornerSize = unitX * 0.3;
        const corners = [
            // Top-left
            [[padLeft, padTop], [padLeft + cornerSize, padTop], [padLeft, padTop - cornerSize]],
            // Top-right
            [[padLeft + padWidth, padTop], [padLeft + padWidth - cornerSize, padTop], [padLeft + padWidth, padTop - cornerSize]],
            // Bottom-right
            [[padLeft + padWidth, padTop - padHeight], [padLeft + padWidth - cornerSize, padTop - padHeight], [padLeft + padWidth, padTop - padHeight + cornerSize]],
            // Bottom-left
            [[padLeft, padTop - padHeight], [padLeft + cornerSize, padTop - padHeight], [padLeft, padTop - padHeight + cornerSize]]
        ];

        corners.forEach((corner) => {
            // Horizontal mark
            const hMark = doc.pathItems.add();
            hMark.setEntirePath([corner[0], corner[1]]);
            hMark.stroked = true;
            hMark.strokeColor = labelColor;
            hMark.strokeWidth = 0.75;
            hMark.filled = false;
            hMark.opacity = aiOpacity;
            hMark.move(layer, ElementPlacement.PLACEATEND);
            items.push(hMark);

            // Vertical mark
            const vMark = doc.pathItems.add();
            vMark.setEntirePath([corner[0], corner[2]]);
            vMark.stroked = true;
            vMark.strokeColor = labelColor;
            vMark.strokeWidth = 0.75;
            vMark.filled = false;
            vMark.opacity = aiOpacity;
            vMark.move(layer, ElementPlacement.PLACEATEND);
            items.push(vMark);
        });

        // Group all items
        const group = doc.groupItems.add();
        group.name = "Clear Space";
        group.move(layer, ElementPlacement.PLACEATEND);
        for (let i = 0; i < items.length; i++) {
            items[i].move(group, ElementPlacement.PLACEATEND);
        }

        // Lock layer
        layer.locked = true;

        return group;
    }

    /**
     * Draw small perpendicular arrow cap lines at each end of a measurement.
     */
    function drawArrowCaps(doc, from, to, color, opacity, layer) {
        const items = [];
        const capSize = 3;

        // Determine if line is horizontal or vertical
        const isVertical = Math.abs(from[0] - to[0]) < 0.1;

        if (isVertical) {
            // Horizontal caps at each end
            [from, to].forEach((pt) => {
                const cap = doc.pathItems.add();
                cap.setEntirePath([
                    [pt[0] - capSize, pt[1]],
                    [pt[0] + capSize, pt[1]]
                ]);
                cap.stroked = true;
                cap.strokeColor = color;
                cap.strokeWidth = 0.5;
                cap.filled = false;
                cap.opacity = opacity;
                cap.move(layer, ElementPlacement.PLACEATEND);
                items.push(cap);
            });
        } else {
            // Vertical caps at each end
            [from, to].forEach((pt) => {
                const cap = doc.pathItems.add();
                cap.setEntirePath([
                    [pt[0], pt[1] - capSize],
                    [pt[0], pt[1] + capSize]
                ]);
                cap.stroked = true;
                cap.strokeColor = color;
                cap.strokeWidth = 0.5;
                cap.filled = false;
                cap.opacity = opacity;
                cap.move(layer, ElementPlacement.PLACEATEND);
                items.push(cap);
            });
        }

        return items;
    }

    /**
     * Try to estimate the dominant stroke width from the selection.
     */
    function estimateStrokeWidth(doc) {
        try {
            const sel = doc.selection;
            if (sel && sel.length > 0) {
                const item = sel[0];
                if (item.stroked && item.strokeWidth > 0) {
                    return item.strokeWidth * 3; // Scale up for clear space
                }
                // Check children of groups
                if (item.typename === "GroupItem") {
                    for (let i = 0; i < Math.min(item.pageItems.length, 10); i++) {
                        const child = item.pageItems[i];
                        if (child.stroked && child.strokeWidth > 0) {
                            return child.strokeWidth * 3;
                        }
                    }
                }
            }
        } catch (e) {
            // Fall through to default
        }
        return null;
    }

    return { generate };
})();
