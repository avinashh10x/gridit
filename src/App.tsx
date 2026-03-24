import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Settings, Upload, Download, Maximize, Circle, Square, Minus, Layers, Layout, ChevronRight, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeLogo, Point, Line, Circle as GridCircle, Point as GridPoint } from './lib/GeometryEngine';

// --- Types ---
interface AnalysisResults {
  bounds: { x: number; y: number; width: number; height: number };
  center: GridPoint;
  lines: Line[];
  circles: GridCircle[];
  anchors: GridPoint[];
}

// --- Main Component ---
export default function App() {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [showGrid, setShowGrid] = useState({
    bounds: true,
    center: true,
    lines: true,
    circles: true,
    anchors: true
  });
  
  useEffect(() => {
    if (svgContent) {
      analyzeLogo(svgContent).then(setResults);
    }
  }, [svgContent]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSvgContent(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleExport = () => {
    if (!results) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `construction-grid-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const viewBox = useMemo(() => {
    if (!results) return "0 0 500 500";
    const padding = Math.max(results.bounds.width, results.bounds.height) * 0.2;
    return `${results.bounds.x - padding} ${results.bounds.y - padding} ${results.bounds.width + padding * 2} ${results.bounds.height + padding * 2}`;
  }, [results]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ 
        height: '60px', 
        borderBottom: '1px solid var(--outline-variant)', 
        backgroundColor: 'var(--surface-container)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '0 24px' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '6px', borderRadius: '4px', background: 'var(--primary)', color: 'black' }}>
            <Activity size={20} />
          </div>
          <span style={{ fontWeight: 600, letterSpacing: '-0.02em', fontSize: '18px' }}>GRIDIT <span style={{ opacity: 0.5 }}>v1.0</span></span>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => {
              fetch('/test-logo.svg').then(r => r.text()).then(setSvgContent);
            }}
            style={{ 
              padding: '8px 16px', 
              borderRadius: '4px', 
              background: 'var(--surface-container-high)',
              border: '1px solid var(--outline-variant)',
              color: 'var(--on-surface)',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            USE SAMPLE
          </button>
          <label style={{ 
            cursor: 'pointer',
            padding: '8px 16px', 
            borderRadius: '4px', 
            background: 'var(--surface-container-highest)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 500
          }}>
            <Upload size={14} />
            UPLOAD SVG
            <input type="file" accept=".svg" hidden onChange={handleUpload} />
          </label>
          <button 
            disabled={!results}
            onClick={handleExport}
            style={{ 
              padding: '8px 16px', 
              borderRadius: '4px', 
              background: results ? 'var(--primary)' : 'var(--surface-container-high)',
              color: results ? 'black' : 'var(--on-surface-variant)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              cursor: results ? 'pointer' : 'not-allowed'
            }}>
            <Download size={14} />
            EXPORT JSON
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar Left: Stats */}
        <aside style={{ width: '280px', borderRight: '1px solid var(--outline-variant)', background: 'var(--surface-container-low)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <section>
            <h3 style={{ fontSize: '11px', color: 'var(--on-surface-variant)', letterSpacing: '0.1em', marginBottom: '16px' }}>EXTRACTION DATA</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <StatRow label="Width" value={results ? `${results.bounds.width.toFixed(1)}px` : "0"} />
              <StatRow label="Height" value={results ? `${results.bounds.height.toFixed(1)}px` : "0"} />
              <StatRow label="Alignments" value={results ? results.lines.length.toString() : "0"} />
              <StatRow label="Circles" value={results ? results.circles.length.toString() : "0"} />
            </div>
          </section>

          <section>
            <h3 style={{ fontSize: '11px', color: 'var(--on-surface-variant)', letterSpacing: '0.1em', marginBottom: '16px' }}>LOG</h3>
            <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', fontFamily: 'monospace' }}>
              {results ? "Deterministic analysis complete." : "Ready for input..."}
            </div>
          </section>
        </aside>

        {/* Central Canvas */}
        <section style={{ flex: 1, position: 'relative', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.1, pointerEvents: 'none', backgroundImage: 'radial-gradient(var(--on-surface-variant) 0.5px, transparent 0.5px)', backgroundSize: '32px 32px' }}></div>
          
          <div id="canvas-container" style={{ position: 'relative', width: '90%', height: '90%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {!svgContent ? (
              <div style={{ textAlign: 'center', color: 'var(--on-surface-variant)' }}>
                <Upload size={48} strokeWidth={1} style={{ marginBottom: '16px' }} />
                <p>Drag or Upload SVG to begin analysis</p>
              </div>
            ) : (
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  {/* Original Logo with Fade */}
                  <div 
                    dangerouslySetInnerHTML={{ __html: svgContent }} 
                    style={{ position: 'absolute', inset: 0, opacity: 0.2, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.3s' }}
                  />
                  
                  {/* Construction Grid Overlay */}
                  <svg viewBox={viewBox} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                    {results && (
                      <>
                        {/* Bounding Box */}
                        {showGrid.bounds && (
                          <rect 
                            x={results.bounds.x} 
                            y={results.bounds.y} 
                            width={results.bounds.width} 
                            height={results.bounds.height} 
                            fill="none" 
                            stroke="var(--primary)" 
                            strokeWidth="0.5" 
                            strokeDasharray="2 2"
                          />
                        )}

                        {/* Alignment Lines */}
                        {showGrid.lines && results.lines.map((l, i) => (
                          <line 
                            key={`l-${i}`}
                            x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                            stroke="var(--secondary)" 
                            strokeWidth="0.25"
                            strokeOpacity="0.4"
                          />
                        ))}

                        {/* Center Lines */}
                        {showGrid.center && (
                          <>
                            <line 
                              x1={results.bounds.x - 20} y1={results.center.y} 
                              x2={results.bounds.x + results.bounds.width + 20} y2={results.center.y} 
                              stroke="var(--primary)" strokeWidth="0.5"
                            />
                            <line 
                              x1={results.center.x} y1={results.bounds.y - 20} 
                              x2={results.center.x} y2={results.bounds.y + results.bounds.height + 20} 
                              stroke="var(--primary)" strokeWidth="0.5"
                            />
                          </>
                        )}

                        {/* Circles */}
                        {showGrid.circles && results.circles.map((c, i) => (
                          <circle 
                            key={`c-${i}`}
                            cx={c.cx} cy={c.cy} r={c.r}
                            fill="none" stroke="var(--primary)" strokeWidth="0.25"
                          />
                        ))}

                        {/* Anchors */}
                        {showGrid.anchors && results.anchors.map((p, i) => (
                          <rect 
                            key={`p-${i}`}
                            x={p.x - 1} y={p.y - 1} width="2" height="2"
                            fill="black" stroke="var(--primary)" strokeWidth="0.5"
                          />
                        ))}
                      </>
                    )}
                  </svg>
                </div>
            )}
          </div>
        </section>

        {/* Sidebar Right: Controls */}
        <aside style={{ width: '300px', borderLeft: '1px solid var(--outline-variant)', background: 'var(--surface-container-low)', padding: '24px' }}>
          <h3 style={{ fontSize: '11px', color: 'var(--on-surface-variant)', letterSpacing: '0.1em', marginBottom: '24px' }}>DETERMINISTIC GRID CONTROLS</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
             <ToggleRow active={showGrid.bounds} onClick={() => setShowGrid(prev => ({ ...prev, bounds: !prev.bounds }))} icon={<Square size={14}/>} label="Bounding Box" />
             <ToggleRow active={showGrid.center} onClick={() => setShowGrid(prev => ({ ...prev, center: !prev.center }))} icon={<Layout size={14}/>} label="Center Lines" />
             <ToggleRow active={showGrid.lines} onClick={() => setShowGrid(prev => ({ ...prev, lines: !prev.lines }))} icon={<Minus size={14}/>} label="Alignment Lines" />
             <ToggleRow active={showGrid.circles} onClick={() => setShowGrid(prev => ({ ...prev, circles: !prev.circles }))} icon={<Circle size={14}/>} label="Curve Circles" />
             <ToggleRow active={showGrid.anchors} onClick={() => setShowGrid(prev => ({ ...prev, anchors: !prev.anchors }))} icon={<Maximize size={14}/>} label="Anchor Points" />
          </div>

          <div style={{ marginTop: '40px' }}>
             <h3 style={{ fontSize: '11px', color: 'var(--on-surface-variant)', letterSpacing: '0.1em', marginBottom: '16px' }}>SYSTEM SETTINGS</h3>
             <SettingsPanel />
          </div>
        </aside>
      </main>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
      <span style={{ color: 'var(--on-surface-variant)' }}>{label}</span>
      <span style={{ fontWeight: 500, fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}

function ToggleRow({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <div 
      onClick={onClick}
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '12px', 
        background: 'var(--surface-container)', 
        cursor: 'pointer',
        border: '1px solid var(--outline-variant)',
        marginBottom: '8px',
        borderRadius: '4px',
        transition: 'all 0.2s ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: active ? 1 : 0.5 }}>
        <div style={{ color: active ? 'var(--primary)' : 'inherit' }}>{icon}</div>
        <span style={{ fontSize: '13px', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ 
        width: '32px', 
        height: '16px', 
        borderRadius: '8px', 
        background: active ? 'var(--primary)' : 'var(--outline-variant)',
        position: 'relative',
        transition: 'all 0.2s ease'
      }}>
        <div style={{ 
          width: '12px', 
          height: '12px', 
          borderRadius: '50%', 
          background: active ? 'black' : '#acabaa', 
          position: 'absolute', 
          top: '2px', 
          left: active ? '18px' : '2px',
          transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}></div>
      </div>
    </div>
  );
}

function SettingsPanel() {
  return (
    <div style={{ background: 'var(--surface-container)', padding: '16px', borderRadius: '4px', border: '1px solid var(--outline-variant)' }}>
       <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '12px' }}>
            <span style={{ color: 'var(--on-surface-variant)' }}>Optimization:</span>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button style={{ flex: 1, padding: '4px', fontSize: '10px', background: 'var(--primary)', color: 'black', border: 'none', borderRadius: '2px' }}>PRECISE</button>
              <button style={{ flex: 1, padding: '4px', fontSize: '10px', background: 'var(--surface-container-high)', border: '1px solid var(--outline-variant)', color: 'var(--on-surface)', borderRadius: '2px' }}>SIMPLE</button>
            </div>
          </div>
          <div style={{ fontSize: '12px' }}>
            <span style={{ color: 'var(--on-surface-variant)' }}>Confidence Threshold:</span>
            <input type="range" style={{ width: '100%', marginTop: '8px' }} />
          </div>
       </div>
    </div>
  )
}
