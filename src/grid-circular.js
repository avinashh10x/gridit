/**
 * Gridly — Circular Grid Generator
 * 
 * Generates concentric circles centered on the selected artwork,
 * with optional center crosshair marker.
 */

const GridlyCircular = (() => {

    /**
     * Generate a circular grid.
     * 
     * @param {number[]} bounds - [left, top, right, bottom] geometric bounds
     * @param {number} ringCount - Number of concentric circles (2–12)
     * @param {number} opacity - Grid opacity (0–100)
     * @param {boolean} showCenter - Whether to draw center crosshair
     * @returns {object} The grid group item
     */
    function generate(bounds, ringCount, opacity, showCenter) {
        const doc = GridlyLayers.getDoc();
        const layer = GridlyLayers.prepareGridLayer();
        const rect = GridlyUtils.boundsToRect(bounds);

        const strokeColor = GridlyUtils.gridColor();
        const strokeWidth = 0.5;
        const aiOpacity = GridlyUtils.opacityToAI(opacity);

        // Calculate center and max radius
        const cx = rect.centerX;
        const cy = rect.centerY;

        // Max radius = half diagonal of the bounding box
        const maxRadius = GridlyUtils.diagonal(rect.width, rect.height) / 2;
        const radiusStep = maxRadius / ringCount;

        const items = [];

        // --- Concentric circles ---
        for (let i = 1; i <= ringCount; i++) {
            const radius = radiusStep * i;
            const diameter = radius * 2;

            // Illustrator's ellipse() takes: top, left, width, height
            const ellipseTop = cy + radius;
            const ellipseLeft = cx - radius;

            const circle = doc.pathItems.ellipse(
                ellipseTop,
                ellipseLeft,
                diameter,
                diameter
            );
            circle.stroked = true;
            circle.strokeColor = strokeColor;
            circle.strokeWidth = strokeWidth;
            circle.filled = false;
            circle.opacity = aiOpacity;
            circle.move(layer, ElementPlacement.PLACEATEND);
            items.push(circle);
        }

        // --- Center crosshair ---
        if (showCenter) {
            const crossSize = maxRadius * 0.08;

            // Horizontal line
            const hLine = doc.pathItems.add();
            hLine.setEntirePath([
                [cx - crossSize, cy],
                [cx + crossSize, cy]
            ]);
            hLine.stroked = true;
            hLine.strokeColor = strokeColor;
            hLine.strokeWidth = 0.75;
            hLine.filled = false;
            hLine.opacity = aiOpacity;
            hLine.move(layer, ElementPlacement.PLACEATEND);
            items.push(hLine);

            // Vertical line
            const vLine = doc.pathItems.add();
            vLine.setEntirePath([
                [cx, cy - crossSize],
                [cx, cy + crossSize]
            ]);
            vLine.stroked = true;
            vLine.strokeColor = strokeColor;
            vLine.strokeWidth = 0.75;
            vLine.filled = false;
            vLine.opacity = aiOpacity;
            vLine.move(layer, ElementPlacement.PLACEATEND);
            items.push(vLine);

            // Small center dot
            const dotSize = 2;
            const dot = doc.pathItems.ellipse(
                cy + dotSize / 2,
                cx - dotSize / 2,
                dotSize,
                dotSize
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
        group.name = "Circular Grid";
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
