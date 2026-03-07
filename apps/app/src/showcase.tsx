import React, { useState } from "react";
import { injectable, onRunning } from "@novx/core";
import {
  Feature,
  FeatureRegistry,
  FeatureOutlet,
  useEnvironment,
} from "@novx/portal";

/* ---------------------------
   Styles
--------------------------- */

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500&display=swap');

  :root {
    --bg:        #0d0e11;
    --surface:   #13141a;
    --border:    #1f2028;
    --border-hi: #2a2c38;
    --text:      #e2e4ed;
    --muted:     #555869;
    --subtle:    #33364a;
    --accent:    #4ade80;
    --accent-dim:#1a3326;
    --code-bg:   #0a0b0d;
    --mono:      'IBM Plex Mono', monospace;
    --sans:      'IBM Plex Sans', sans-serif;
  }

  .sc-root {
    display: flex;
    height: 100vh;
    width: 100%;
    background: var(--bg);
    color: var(--text);
    font-family: var(--sans);
    overflow: hidden;
  }

  /* ── Sidebar ─────────────────────────────── */

  .sc-sidebar {
    width: 220px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border-right: 1px solid var(--border);
    overflow: hidden;
  }

  .sc-sidebar-header {
    padding: 1rem 1rem 0.75rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .sc-logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .sc-logo-mark {
    width: 20px; height: 20px;
    border-radius: 4px;
    background: var(--accent);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .sc-logo-mark svg { width: 10px; height: 10px; }

  .sc-logo-text {
    font-size: 0.72rem;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text);
  }

  .sc-badge {
    display: inline-block;
    font-family: var(--mono);
    font-size: 0.6rem;
    padding: 1px 6px;
    border-radius: 3px;
    background: var(--accent-dim);
    color: var(--accent);
    border: 1px solid rgba(74,222,128,0.15);
  }

  .sc-sidebar-section-label {
    padding: 0.85rem 1rem 0.35rem;
    font-size: 0.62rem;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .sc-sidebar-list {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 1rem;
  }

  .sc-sidebar-list::-webkit-scrollbar { width: 4px; }
  .sc-sidebar-list::-webkit-scrollbar-track { background: transparent; }
  .sc-sidebar-list::-webkit-scrollbar-thumb { background: var(--subtle); border-radius: 2px; }

  .sc-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 1rem;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 400;
    color: var(--muted);
    border-left: 2px solid transparent;
    transition: color 0.12s, background 0.12s, border-color 0.12s;
    user-select: none;
  }

  .sc-item:hover {
    color: var(--text);
    background: rgba(255,255,255,0.03);
  }

  .sc-item.active {
    color: var(--accent);
    background: var(--accent-dim);
    border-left-color: var(--accent);
    font-weight: 500;
  }

  .sc-item-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.5;
    flex-shrink: 0;
  }

  .sc-item.active .sc-item-dot { opacity: 1; }

  /* ── Main area ───────────────────────────── */

  .sc-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Topbar */
  .sc-topbar {
    height: 44px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    padding: 0 1.25rem;
    border-bottom: 1px solid var(--border);
    gap: 0.5rem;
    background: var(--surface);
  }

  .sc-breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: var(--muted);
  }

  .sc-breadcrumb span { color: var(--text); font-weight: 500; }
  .sc-breadcrumb-sep { opacity: 0.3; }

  .sc-topbar-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .sc-tab-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.7rem;
    border-radius: 5px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
    font-family: var(--sans);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.12s;
  }

  .sc-tab-btn:hover { color: var(--text); border-color: var(--border-hi); background: rgba(255,255,255,0.03); }
  .sc-tab-btn.active { color: var(--accent); border-color: rgba(74,222,128,0.25); background: var(--accent-dim); }

  /* Body */
  .sc-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Preview pane */
  .sc-preview-pane {
    flex: 1;
    overflow: auto;
    position: relative;
  }

  .sc-preview-label {
    position: absolute;
    top: 0.75rem;
    left: 1rem;
    font-size: 0.62rem;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    pointer-events: none;
    z-index: 1;
  }

  .sc-preview-inner {
    height: 100%;
    padding: 2.5rem 1.5rem 1.5rem;
    box-sizing: border-box;
  }

  /* Divider */
  .sc-divider {
    height: 1px;
    background: var(--border);
    flex-shrink: 0;
    position: relative;
  }

  .sc-divider-label {
    position: absolute;
    top: 50%;
    left: 1.25rem;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--bg);
    padding: 0 0.5rem;
    font-size: 0.62rem;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .sc-divider-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--accent);
  }

  /* Code pane */
  .sc-code-pane {
    height: 45%;
    flex-shrink: 0;
    background: var(--code-bg);
    border-top: 1px solid var(--border);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .sc-code-toolbar {
    display: flex;
    align-items: center;
    padding: 0 1rem;
    height: 36px;
    border-bottom: 1px solid var(--border);
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .sc-code-toolbar-dots {
    display: flex; gap: 5px; margin-right: 0.25rem;
  }

  .sc-code-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
  }

  .sc-code-dot-r { background: #ff5f57; }
  .sc-code-dot-y { background: #febc2e; }
  .sc-code-dot-g { background: #28c840; }

  .sc-code-filename {
    font-family: var(--mono);
    font-size: 0.7rem;
    color: var(--muted);
  }

  .sc-code-lang {
    margin-left: auto;
    font-family: var(--mono);
    font-size: 0.62rem;
    padding: 2px 6px;
    border-radius: 3px;
    background: var(--accent-dim);
    color: var(--accent);
    border: 1px solid rgba(74,222,128,0.12);
  }

  .sc-code-scroll {
    flex: 1;
    overflow: auto;
    padding: 1rem 1.25rem;
  }

  .sc-code-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
  .sc-code-scroll::-webkit-scrollbar-track { background: transparent; }
  .sc-code-scroll::-webkit-scrollbar-thumb { background: var(--subtle); border-radius: 2px; }

  .sc-code {
    font-family: var(--mono);
    font-size: 0.78rem;
    line-height: 1.7;
    color: #a9b1d6;
    margin: 0;
    white-space: pre;
    tab-size: 2;
  }

  /* Empty state */
  .sc-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: var(--muted);
    font-size: 0.85rem;
  }

  .sc-empty-icon {
    width: 40px; height: 40px;
    border-radius: 10px;
    border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 0.25rem;
  }

  /* Tab view (split vs stacked) */
  .sc-body.stacked .sc-preview-pane { flex: none; height: 50%; }
  .sc-body.split   .sc-code-pane    { height: 45%; }

  /* Animations */
  @keyframes fadeSlide {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .sc-preview-inner, .sc-code-scroll {
    animation: fadeSlide 0.2s ease both;
  }
`;

/* ---------------------------
   Showcase Registry
--------------------------- */

@injectable()
export class ShowcaseRegistry {
  private sources: Record<string, string> = {};

  @onRunning()
  async startup(featureRegistry: FeatureRegistry) {
    const showcases = featureRegistry.finder().withTag("showcase").find();
    for (const showcase of showcases) {
      const manifestPath = showcase.sourceFile!;
      const source = await this.getSource(manifestPath);
      if (source) this.sources[manifestPath] = source;
    }
  }

  async getSource(manifestPath: string): Promise<string | undefined> {
    try {
      const prefix = "src/showcases/";
      const idx = manifestPath.indexOf(prefix);
      if (idx === -1) return undefined;
      const relativePath = "./showcases/" + manifestPath.slice(idx + prefix.length);
      const mod = await import(`${relativePath}?raw`);
      return mod.default || mod;
    } catch {
      return undefined;
    }
  }

  getLoadedSource(manifestPath: string): string | undefined {
    return this.sources[manifestPath];
  }
}

/* ---------------------------
   Showcase Feature
--------------------------- */

@Feature({
  id: "showcases",
  label: "Showcases",
  path: "/showcases",
  tags: ["menu"],
  visibility: ["public"],
})
export class ShowcasePage extends React.Component {
  render() {
    return <ShowcasePageContent />;
  }
}

/* ---------------------------
   Icons
--------------------------- */

const IconBox = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1" y="1" width="10" height="10" rx="2" />
    <path d="M1 4.5h10" />
  </svg>
);

const IconCode = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M4 3L1 6l3 3M8 3l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconEye = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M1 6s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4z" strokeLinejoin="round" />
    <circle cx="6" cy="6" r="1.5" />
  </svg>
);

const IconSplit = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1" y="1" width="10" height="10" rx="1.5" />
    <path d="M1 6h10" />
  </svg>
);

/* ---------------------------
   Page Content
--------------------------- */

const ShowcasePageContent: React.FC = () => {
  const env = useEnvironment();
  const featureRegistry = env.get(FeatureRegistry);
  const showcaseRegistry = env.get(ShowcaseRegistry);

  const showcases = featureRegistry.finder().withTag("showcase").find();
  const [selectedId, setSelectedId] = useState(
    showcases.length > 0 ? showcases[0].id : ""
  );
  const [view, setView] = useState<"split" | "preview" | "code">("split");

  const selectedShowcase = showcases.find((s) => s.id === selectedId);
  const source = selectedShowcase?.sourceFile
    ? showcaseRegistry.getLoadedSource(selectedShowcase.sourceFile)
    : "";

  const selectedLabel = selectedShowcase?.label || selectedShowcase?.id || "";

  const showPreview = view === "split" || view === "preview";
  const showCode    = view === "split" || view === "code";

  return (
    <>
      <style>{styles}</style>
      <div className="sc-root">

        {/* ── Sidebar ── */}
        <aside className="sc-sidebar">
          <div className="sc-sidebar-header">
            <div className="sc-logo">
              <div className="sc-logo-mark">
                <IconBox />
              </div>
              <span className="sc-logo-text">Showcase</span>
            </div>
            <span className="sc-badge">{showcases.length} components</span>
          </div>

          <p className="sc-sidebar-section-label">Components</p>

          <div className="sc-sidebar-list">
            {showcases.map((s) => (
              <div
                key={s.id}
                className={`sc-item ${s.id === selectedId ? "active" : ""}`}
                onClick={() => setSelectedId(s.id)}
              >
                <span className="sc-item-dot" />
                {s.label || s.id}
              </div>
            ))}
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="sc-main">

          {/* Topbar */}
          <div className="sc-topbar">
            <div className="sc-breadcrumb">
              Showcases
              <span className="sc-breadcrumb-sep">/</span>
              <span>{selectedLabel || "—"}</span>
            </div>
            <div className="sc-topbar-actions">
              <button
                className={`sc-tab-btn ${view === "preview" ? "active" : ""}`}
                onClick={() => setView("preview")}
                title="Preview only"
              >
                <IconEye /> Preview
              </button>
              <button
                className={`sc-tab-btn ${view === "split" ? "active" : ""}`}
                onClick={() => setView("split")}
                title="Split view"
              >
                <IconSplit /> Split
              </button>
              <button
                className={`sc-tab-btn ${view === "code" ? "active" : ""}`}
                onClick={() => setView("code")}
                title="Code only"
              >
                <IconCode /> Code
              </button>
            </div>
          </div>

          {/* Body */}
          {selectedId ? (
            <div className={`sc-body ${view}`}>

              {/* Live preview */}
              {showPreview && (
                <div className="sc-preview-pane">
                  <span className="sc-preview-label">Live preview</span>
                  <div className="sc-preview-inner" key={selectedId + "-preview"}>
                    <FeatureOutlet id={selectedId} />
                  </div>
                </div>
              )}

              {/* Source code */}
              {showCode && source && (
                <div className="sc-code-pane">
                  <div className="sc-code-toolbar">
                    <div className="sc-code-toolbar-dots">
                      <div className="sc-code-dot sc-code-dot-r" />
                      <div className="sc-code-dot sc-code-dot-y" />
                      <div className="sc-code-dot sc-code-dot-g" />
                    </div>
                    <span className="sc-code-filename">
                      {selectedShowcase?.sourceFile?.split("/").pop() ?? "source.tsx"}
                    </span>
                    <span className="sc-code-lang">TSX</span>
                  </div>
                  <div className="sc-code-scroll" key={selectedId + "-code"}>
                    <pre className="sc-code">{source}</pre>
                  </div>
                </div>
              )}

              {/* Code selected but no source */}
              {showCode && !source && (
                <div className="sc-empty" style={{ flex: 1 }}>
                  <div className="sc-empty-icon">
                    <IconCode />
                  </div>
                  <span>No source available</span>
                </div>
              )}

            </div>
          ) : (
            <div className="sc-empty">
              <div className="sc-empty-icon">
                <IconBox />
              </div>
              <span>Select a component from the sidebar</span>
            </div>
          )}

        </main>
      </div>
    </>
  );
};