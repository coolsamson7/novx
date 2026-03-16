import React, { useState } from "react";
import { injectable, onRunning } from "@novx/core";
import {
  Feature,
  FeatureRegistry,
  useEnvironment,
} from "@novx/portal";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import type { ShowcaseAsset } from "@novx/portal";

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
    min-width: 0;
  }

  /* Topbar */
  .sc-topbar {
    height: 44px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    padding: 0 1rem;
    border-bottom: 1px solid var(--border);
    gap: 0.4rem;
    background: var(--surface);
    overflow: hidden;
  }

  .sc-breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: var(--muted);
    flex-shrink: 0;
  }

  .sc-breadcrumb span { color: var(--text); font-weight: 500; }
  .sc-breadcrumb-sep  { opacity: 0.3; }

  /* Asset tabs — scrollable row */
  .sc-asset-tabs {
    display: flex;
    align-items: center;
    gap: 2px;
    overflow-x: auto;
    flex: 1;
    padding: 0 0.5rem;
    scrollbar-width: none;
  }

  .sc-asset-tabs::-webkit-scrollbar { display: none; }

  .sc-topbar-actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
    border-left: 1px solid var(--border);
    padding-left: 0.75rem;
    margin-left: 0.25rem;
  }

  .sc-tab-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.6rem;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
    font-family: var(--sans);
    font-size: 0.72rem;
    cursor: pointer;
    transition: all 0.12s;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .sc-tab-btn:hover  { color: var(--text); border-color: var(--border-hi); background: rgba(255,255,255,0.03); }
  .sc-tab-btn.active { color: var(--accent); border-color: rgba(74,222,128,0.25); background: var(--accent-dim); }

  .sc-tab-type {
    font-size: 0.6rem;
    opacity: 0.5;
    font-family: var(--mono);
  }

  /* Description bar */
  .sc-desc-bar {
    padding: 6px 20px;
    font-size: 0.78rem;
    color: var(--muted);
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    flex-shrink: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

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

  .sc-body.code-only .sc-code-pane {
    height: 100%;
    border-top: none;
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

  .sc-code-toolbar-dots { display: flex; gap: 5px; margin-right: 0.25rem; }

  .sc-code-dot { width: 8px; height: 8px; border-radius: 50%; }
  .sc-code-dot-r { background: #ff5f57; }
  .sc-code-dot-y { background: #febc2e; }
  .sc-code-dot-g { background: #28c840; }

  .sc-code-filename {
    font-family: var(--mono);
    font-size: 0.7rem;
    color: var(--muted);
  }

  .sc-code-lang {
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

  /* Docs pane */
  .sc-docs-pane {
    flex: 1;
    overflow: auto;
    padding: 1.5rem 2rem;
    max-width: 720px;
  }

  .sc-docs-pane h1 { font-size: 1.4rem; font-weight: 500; margin: 0 0 1rem; color: var(--text); }
  .sc-docs-pane h2 { font-size: 1.1rem; font-weight: 500; margin: 1.5rem 0 0.5rem; color: var(--text); }
  .sc-docs-pane h3 { font-size: 0.95rem; font-weight: 500; margin: 1rem 0 0.4rem; color: var(--text); }
  .sc-docs-pane p  { font-size: 0.875rem; line-height: 1.75; color: var(--muted); margin: 0 0 0.75rem; }
  .sc-docs-pane code {
    font-family: var(--mono);
    font-size: 0.8rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 1px 5px;
    color: var(--accent);
  }
  .sc-docs-pane strong { color: var(--text); font-weight: 500; }
  .sc-docs-pane ul { padding-left: 1.25rem; margin: 0 0 0.75rem; }
  .sc-docs-pane li { font-size: 0.875rem; line-height: 1.75; color: var(--muted); }

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

  /* Animations */
  @keyframes fadeSlide {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .sc-preview-inner, .sc-code-scroll, .sc-docs-pane {
    animation: fadeSlide 0.18s ease both;
  }
`;

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

const IconDoc = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 1h6l3 3v7a1 1 0 01-1 1H2a1 1 0 01-1-1V2a1 1 0 011-1z" />
    <path d="M8 1v3h3M3 6h6M3 8.5h4" strokeLinecap="round" />
  </svg>
);

/* ---------------------------
   ShowcaseRegistry

   Assets are loaded statically via require('!!raw-loader!./file') in the
   @Feature decorator — no dynamic loading here. This service only reads
   what is already present in feature.showcase and handles lazy fetching
   of url-based assets (public/ or CDN) in the component.
--------------------------- */
@injectable()
export class ShowcaseRegistry {

  @onRunning()
  async startup(featureRegistry: FeatureRegistry) {
    const showcases = featureRegistry.finder().withTag("showcase").find();

    for (const showcase of showcases) {
      // load docs
      if (showcase.showcase?.docs) {
        const content = await this.loadFile(showcase.showcase.docs);
        if (content && showcase.showcase) showcase.showcase.docs = content;
      }

      // load assets with a path
      if (showcase.showcase?.assets) {
        for (const asset of showcase.showcase.assets) {
          if (asset.path && !asset.content && !asset.url) {
            asset.content = await this.loadFile(asset.path) ?? '';
          }
        }
      }

      // legacy fallback — no showcase meta, just load sourceFile
      if (!showcase.showcase && showcase.sourceFile) {
        const content = await this.loadSourceFile(showcase.sourceFile);
        if (content) {
          showcase.showcase = {
            assets: [{
              type:    'tsx',
              label:   showcase.sourceFile.split('/').pop() ?? 'source.tsx',
              path:    showcase.sourceFile,
              content,
            }]
          };
        }
      }
    }
  }

  private async loadFile(filename: string): Promise<string | undefined> {
    try {
      const mod = await import(`./showcases/${filename}?raw`);
      return mod.default ?? mod;
    } catch {
      return undefined;
    }
  }

  private async loadSourceFile(manifestPath: string): Promise<string | undefined> {
    try {
      const prefix = 'src/showcases/';
      const idx    = manifestPath.indexOf(prefix);
      if (idx === -1) return undefined;
      const filename = manifestPath.slice(idx + prefix.length);
      return this.loadFile(filename);
    } catch {
      return undefined;
    }
  }

  getAssets(featureId: string, featureRegistry: FeatureRegistry): ShowcaseAsset[] {
    try {
      return featureRegistry.get(featureId)?.showcase?.assets ?? [];
    } catch {
      return [];
    }
  }

  getDocs(featureId: string, featureRegistry: FeatureRegistry): string | undefined {
    try {
      return featureRegistry.get(featureId)?.showcase?.docs;
    } catch {
      return undefined;
    }
  }
}

/* ---------------------------
   ShowcasePage
--------------------------- */

@Feature({
  id: "showcases",
  label: "Showcases",
  path: "/showcases",
  tags: ["menu"],
  visibility: ["public"],
})
export class ShowcasePage extends React.Component {
  render() { return <ShowcasePageContent />; }
}

/* ---------------------------
   Types
--------------------------- */

// 'preview' | 'docs' | number (index into assets array)
type ActiveTab = 'preview' | 'docs' | number;
type ViewMode  = 'preview' | 'split' | 'code';

/* ---------------------------
   ShowcasePageContent
--------------------------- */

const ShowcasePageContent: React.FC = () => {
  const env              = useEnvironment();
  const featureRegistry  = env.get(FeatureRegistry);
  const showcaseRegistry = env.get(ShowcaseRegistry);

  const showcases = featureRegistry.finder().withTag("showcase").find();
  const location  = useLocation();
  const navigate  = useNavigate();

  const selectedId       = location.pathname.split("/")[2] || undefined;
  const selectedShowcase = showcases.find(s => s.path === selectedId);

  const assets  = selectedShowcase
    ? showcaseRegistry.getAssets(selectedShowcase.id, featureRegistry)
    : [];
  const docs    = selectedShowcase
    ? showcaseRegistry.getDocs(selectedShowcase.id, featureRegistry)
    : undefined;
  const hasDocs = !!docs;

  const [view,      setView]      = useState<ViewMode>('split');
  const [activeTab, setActiveTab] = useState<ActiveTab>('preview');

  // reset active tab when navigating to a different showcase
  React.useEffect(() => {
    setActiveTab('preview');
  }, [selectedId]);

  // lazily fetch url-based assets — cleared when showcase changes
  const [urlContents, setUrlContents] = React.useState<Record<number, string>>({});

  React.useEffect(() => {
    setUrlContents({});
  }, [selectedId]);

  React.useEffect(() => {
    assets.forEach((asset, i) => {
      if (asset.url && urlContents[i] === undefined) {
        fetch(asset.url)
          .then(r => r.text())
          .then(text => setUrlContents(prev => ({ ...prev, [i]: text })))
          .catch(()  => setUrlContents(prev => ({
            ...prev,
            [i]: `// failed to load ${asset.url}`,
          })));
      }
    });
  }, [selectedId, assets]);

  const getAssetContent = (asset: ShowcaseAsset, index: number): string => {
    if (asset.content) return asset.content;
    if (asset.url)     return urlContents[index] ?? 'Loading…';
    return '';
  };

  const selectedLabel = selectedShowcase?.showcase?.title
    || selectedShowcase?.label
    || selectedShowcase?.id
    || '';

  // which asset index to show in the code pane
  const activeAssetIndex: number | null =
    typeof activeTab === 'number' ? activeTab
    : assets.length > 0          ? 0
    : null;

  const activeAsset = activeAssetIndex !== null ? assets[activeAssetIndex] : null;

  const showPreview = (activeTab === 'preview' || typeof activeTab === 'number')
    && (view === 'split' || view === 'preview');

  const showCode = !!activeAsset
    && activeTab !== 'docs'
    && (view === 'split' || view === 'code');

  const showDocs = activeTab === 'docs' && hasDocs;

  const bodyClass = [
    'sc-body',
    view === 'code' && !showDocs ? 'code-only' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <style>{styles}</style>
      <div className="sc-root">

        {/* ── Sidebar ── */}
        <aside className="sc-sidebar">
          <div className="sc-sidebar-header">
            <div className="sc-logo">
              <div className="sc-logo-mark"><IconBox /></div>
              <span className="sc-logo-text">Showcase</span>
            </div>
            <span className="sc-badge">{showcases.length} components</span>
          </div>

          <p className="sc-sidebar-section-label">Components</p>

          <div className="sc-sidebar-list">
            {showcases.map(s => (
              <div
                key={s.id}
                className={`sc-item ${s.path === selectedId ? 'active' : ''}`}
                onClick={() => navigate(`/showcases/${s.path}`)}
              >
                <span className="sc-item-dot" />
                {s.label || s.id}
              </div>
            ))}
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="sc-main">

          {/* ── Topbar ── */}
          <div className="sc-topbar">

            {/* Breadcrumb */}
            <div className="sc-breadcrumb">
              Showcases
              <span className="sc-breadcrumb-sep">/</span>
              <span>{selectedLabel || '—'}</span>
            </div>

            {/* Asset tabs — Preview, Docs, per-file */}
            {selectedId && (
              <div className="sc-asset-tabs">
                <button
                  className={`sc-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
                  onClick={() => setActiveTab('preview')}
                >
                  <IconEye /> Preview
                </button>

                {hasDocs && (
                  <button
                    className={`sc-tab-btn ${activeTab === 'docs' ? 'active' : ''}`}
                    onClick={() => setActiveTab('docs')}
                  >
                    <IconDoc /> Docs
                  </button>
                )}

                {assets.map((asset, i) => (
                  <button
                    key={i}
                    className={`sc-tab-btn ${activeTab === i ? 'active' : ''}`}
                    onClick={() => setActiveTab(i)}
                  >
                    <span className="sc-tab-type">{asset.type}</span>
                    {asset.label}
                  </button>
                ))}
              </div>
            )}

            {/* View mode toggle — Preview / Split / Code */}
            <div className="sc-topbar-actions">
              <button
                className={`sc-tab-btn ${view === 'preview' ? 'active' : ''}`}
                onClick={() => setView('preview')}
                title="Preview only"
              >
                <IconEye />
              </button>
              <button
                className={`sc-tab-btn ${view === 'split' ? 'active' : ''}`}
                onClick={() => setView('split')}
                title="Split view"
              >
                <IconSplit />
              </button>
              <button
                className={`sc-tab-btn ${view === 'code' ? 'active' : ''}`}
                onClick={() => setView('code')}
                title="Code only"
              >
                <IconCode />
              </button>
            </div>
          </div>

          {/* ── Description bar ── */}
          {selectedShowcase?.showcase?.description && (
            <div className="sc-desc-bar">
              {selectedShowcase.showcase.description}
            </div>
          )}

          {/* ── Body ── */}
          {selectedId ? (
            <div className={bodyClass}>

              {/* Docs pane */}
              {showDocs && (
                <div className="sc-docs-pane" key={selectedId + '-docs'}>
                  <MarkdownPane content={docs!} />
                </div>
              )}

              {/* Live preview */}
              {showPreview && (
                <div className="sc-preview-pane">
                  <span className="sc-preview-label">Live preview</span>
                  <div className="sc-preview-inner" key={selectedId + '-preview'}>
                    <Outlet />
                  </div>
                </div>
              )}

              {/* Code pane */}
              {showCode && activeAsset && (
                <div className="sc-code-pane">
                  <div className="sc-code-toolbar">
                    <div className="sc-code-toolbar-dots">
                      <div className="sc-code-dot sc-code-dot-r" />
                      <div className="sc-code-dot sc-code-dot-y" />
                      <div className="sc-code-dot sc-code-dot-g" />
                    </div>
                    <span className="sc-code-filename">{activeAsset.label}</span>
                    <span className="sc-code-lang">{activeAsset.type.toUpperCase()}</span>
                    <CopyButton content={getAssetContent(activeAsset, activeAssetIndex!)} />
                  </div>
                  <div
                    className="sc-code-scroll"
                    key={selectedId + '-code-' + activeAssetIndex}
                  >
                    <pre className="sc-code">
                      {getAssetContent(activeAsset, activeAssetIndex!)}
                    </pre>
                  </div>
                </div>
              )}

              {/* No source available */}
              {!showDocs && (view === 'split' || view === 'code') && !activeAsset && (
                <div className="sc-empty" style={{ flex: 1 }}>
                  <div className="sc-empty-icon"><IconCode /></div>
                  <span>No source available</span>
                </div>
              )}

            </div>
          ) : (
            <div className="sc-empty">
              <div className="sc-empty-icon"><IconBox /></div>
              <span>Select a component from the sidebar</span>
            </div>
          )}

        </main>
      </div>
    </>
  );
};

/* ---------------------------
   CopyButton
--------------------------- */

const CopyButton: React.FC<{ content: string }> = ({ content }) => {
  const [copied, setCopied] = React.useState(false);

  const copy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={copy}
      style={{
        marginLeft: 'auto',
        padding: '2px 8px',
        fontSize: '11px',
        background: 'var(--surface)',
        border: '1px solid var(--border-hi)',
        borderRadius: '3px',
        color: copied ? 'var(--accent)' : 'var(--muted)',
        cursor: 'pointer',
        fontFamily: 'var(--mono)',
        transition: 'color 0.15s',
      }}
    >
      {copied ? 'copied!' : 'copy'}
    </button>
  );
};

/* ---------------------------
   MarkdownPane
   Basic renderer — swap for a proper md library if needed.
--------------------------- */

const MarkdownPane: React.FC<{ content: string }> = ({ content }) => {
  const html = React.useMemo(() => {
    return content
      .replace(/^### (.+)$/gm,   '<h3>$1</h3>')
      .replace(/^## (.+)$/gm,    '<h2>$1</h2>')
      .replace(/^# (.+)$/gm,     '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g,     '<code>$1</code>')
      .replace(/^- (.+)$/gm,     '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
      .replace(/\n\n/g,          '</p><p>')
      .replace(/^(?!<[hul])/,    '<p>')
      .replace(/(?<![>])$/,      '</p>');
  }, [content]);

  return (
    <div dangerouslySetInnerHTML={{ __html: html }} />
  );
};