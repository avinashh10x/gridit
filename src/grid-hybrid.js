/**
 * Gridly — Hybrid Grid Generator
 * 
 * Combines square + circular grids on the same layer.
 * Both grids are generated and grouped together.
 */

const GridlyHybrid = (() => {

    /**
     * Generate a hybrid grid (square + circular overlay).
     * 
     * @param {number[]} bounds - [left, top, right, bottom] geometric bounds
     * @param {number} density - Square grid divisions (2–20)
     * @param {number} ringCount - Number of concentric circles (2–12)
     * @param {number} opacity - Grid opacity (0–100)
     * @param {boolean} showCenter - Whether to draw center crosshair
     * @returns {object} The composite grid group
     */
    function generate(bounds, density, ringCount, opacity, showCenter) {
        const doc = GridlyLayers.getDoc();
        const rect = GridlyUtils.boundsToRect(bounds);

        // Clear the grid layer first
        GridlyLayers.clearLayer(GridlyLayers.GRID_LAYER_NAME);
        const layer = GridlyLayers.getOrCreateLayer(GridlyLayers.GRID_LAYER_NAME);

        const strokeColor = GridlyUtils.gridColor();
        const strokeWidth = 0.5;
        const aiOpacity = GridlyUtils.opacityToAI(opacity);

        const items = [];

        // --- Square Grid Lines ---
        const cellWidth = rect.width / density;
        const cellHeight = rect.height / density;
        const extend = Math.max(rect.width, rect.height) * 0.15;

        // Vertical lines
        for (let i = 0; i <= density; i++) {
            const x = rect.left + i * cellWidth;
            const line = doc.pathItems.add();
            line.setEntirePath([
                [x, rect.top + extend],
                [x, rect.bottom - extend]
            ]);
            line.stroked = true;
            line.strokeColor = strokeColor;
            line.strokeWidth = strokeWidth;
            line.filled = false;
            line.opacity = aiOpacity;
            line.move(layer, ElementPlacement.PLACEATEND);
            items.push(line);
        }

        // Horizontal lines
        for (let i = 0; i <= density; i++) {
            const y = rect.top - i * cellHeight;
            const line = doc.pathItems.add();
            line.setEntirePath([
                [rect.left - extend, y],
                [rect.right + extend, y]
            ]);
            line.stroked = true;
            line.strokeColor = strokeColor;
            line.strokeWidth = strokeWidth;
            line.filled = false;
            line.opacity = aiOpacity;
            line.move(layer, ElementPlacement.PLACEATEND);
            items.push(line);
        }

        // Bounding box outline
        const outline = doc.pathItems.rectangle(
            rect.top, rect.left, rect.width, rect.height
        );
        outline.stroked = true;
        outline.strokeColor = strokeColor;
        outline.strokeWidth = 0.75;
        outline.filled = false;
        outline.opacity = aiOpacity;
        outline.move(layer, ElementPlacement.PLACEATEND);
        items.push(outline);

        // --- Circular Grid ---
        const cx = rect.centerX;
        const cy = rect.centerY;
        const maxRadius = GridlyUtils.diagonal(rect.width, rect.height) / 2;
        const radiusStep = maxRadius / ringCount;

        for (let i = 1; i <= ringCount; i++) {
            const radius = radiusStep * i;
            const diameter = radius * 2;
            const circle = doc.pathItems.ellipse(
                cy + radius, cx - radius, diameter, diameter
            );
            circle.stroked = true;
            circle.strokeColor = strokeColor;
            circle.strokeWidth = strokeWidth;
            circle.filled = false;
            circle.opacity = aiOpacity;
            circle.move(layer, ElementPlacement.PLACEATEND);
            items.push(circle);
        }

        // Center marker
        if (showCenter) {
            const crossSize = maxRadius * 0.08;

            const hLine = doc.pathItems.add();
            hLine.setEntirePath([[cx - crossSize, cy], [cx + crossSize, cy]]);
            hLine.stroked = true;
            hLine.strokeColor = strokeColor;
            hLine.strokeWidth = 0.75;
            hLine.filled = false;
            hLine.opacity = aiOpacity;
            hLine.move(layer, ElementPlacement.PLACEATEND);
            items.push(hLine);

            const vLine = doc.pathItems.add();
            vLine.setEntirePath([[cx, cy - crossSize], [cx, cy + crossSize]]);
            vLine.stroked = true;
            vLine.strokeColor = strokeColor;
            vLine.strokeWidth = 0.75;
            vLine.filled = false;
            vLine.opacity = aiOpacity;
            vLine.move(layer, ElementPlacement.PLACEATEND);
            items.push(vLine);

            const dotSize = 2;
            const dot = doc.pathItems.ellipse(
                cy + dotSize / 2, cx - dotSize / 2, dotSize, dotSize
            );
            dot.stroked = false;
            dot.filled = true;
            dot.fillColor = strokeColor;
            dot.opacity = aiOpacity;
            dot.move(layer, ElementPlacement.PLACEATEND);
            items.push(dot);
        }

        // Group all items
        const group = doc.groupItems.add();
        group.name = "Hybrid Grid";
        group.move(layer, ElementPlacement.PLACEATEND);
        for (let i = 0; i < items.length; i++) {
            items[i].move(group, ElementPlacement.PLACEATEND);
        }

        // Lock layer
        layer.locked = true;

        return group;
    }

    return { generate };
})();
