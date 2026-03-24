# Logo Construction Grid Engine v3.0

Professional deterministic grid generator for Adobe Illustrator.

## 🚀 How to Use in Illustrator

1. Open Adobe Illustrator.
2. Open your logo artwork (Vector).
3. Go to **File > Scripts > Other Script...**
4. Select the `LogoGridGenerator.jsx` file from this folder.
5. Select the analysis options in the dialog:
   - **Bounding Box**: Generates the outer limits.
   - **Center Lines**: Generates the optical center axes.
   - **Alignment Axes**: (Deterministic) Detects major horizontal and vertical alignments.
   - **Fit Curve Circles**: (Mathematical) Fits geometric circles to your Bezier curves.
   - **Mark Anchors**: Highlights the construction points.
6. Click **Run Generation**.

## 🎨 Design System
The script uses a professional construction style:
- **Cyan (#00DBE9)**: Primary structural elements and circles.
- **Magenta (#FF51FA)**: Alignment and snap axes.
- **Stroke Weights**: Precise 0.25pt - 0.5pt lines.

## 📂 Web Dashboard (Optional)
If you want to use the web-based interactive preview, run:
```bash
npm install
npm run dev
```
And open `http://localhost:5173`. You can upload SVGs there for high-fidelity deterministic analysis.
