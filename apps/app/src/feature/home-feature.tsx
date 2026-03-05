import React from "react";

import {  action, command, computed, Controller, EnvironmentContext, Feature, FeatureMetadata, observable, reactive, useLocalEnvironment, useObserver } from '@novx/portal';

import { useState, useMemo } from "react";
import { Environment, injectable } from "@novx/core";
import { DemoView } from "./demo";

// TEST

@injectable({scope: "environment"})
@reactive
class Counter extends Controller {

  @observable count = 0

  @computed
  get double() { return this.count * 2 }

  @command({name: "increment"})
  async increment() {
    await new Promise(r => setTimeout(r, 1200))
    this.count++
  }

  @command()
  async decrement() {
    await new Promise(r => setTimeout(r, 1200))
    this.count--
  }

  @command()
  reset() { this.count = 0 }
}

// ─── View ─────────────────────────────────────────────────────────────────────

export const CounterView = () => {
  useObserver()
  const counter = useLocalEnvironment().get(Counter)
  const busy = !counter.isEnabled("increment")

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=Syne+Mono&display=swap');

        .cv-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0a0a0a;
          font-family: 'Syne', sans-serif;
        }

        .cv-card {
          position: relative;
          width: 340px;
          background: #111;
          border: 1px solid #222;
          border-radius: 2px;
          padding: 40px 36px 36px;
          overflow: hidden;
        }

        .cv-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, #ff3c00, #ff9500, #ff3c00);
          background-size: 200% 100%;
          animation: cv-shimmer 2s linear infinite;
        }

        @keyframes cv-shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }

        .cv-label {
          font-size: 10px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: #444;
          margin-bottom: 32px;
        }

        .cv-count {
          font-size: 88px;
          font-weight: 800;
          line-height: 1;
          color: #f5f5f5;
          font-variant-numeric: tabular-nums;
          transition: color 0.3s;
          margin-bottom: 6px;
        }

        .cv-count.busy { color: #2a2a2a; }

        .cv-double {
          font-family: 'Syne Mono', monospace;
          font-size: 13px;
          color: #ff3c00;
          margin-bottom: 28px;
          letter-spacing: 0.5px;
        }

        .cv-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          padding: 4px 10px 4px 8px;
          border-radius: 2px;
          border: 1px solid;
          font-family: 'Syne Mono', monospace;
          transition: all 0.3s;
          margin-bottom: 32px;
        }

        .cv-chip.ready  { color: #4ade80; border-color: #4ade8040; background: #4ade8008; }
        .cv-chip.busy   { color: #ff9500; border-color: #ff950040; background: #ff950008; }

        .cv-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: currentColor;
        }

        .cv-dot.busy { animation: cv-pulse 0.8s ease-in-out infinite alternate; }

        @keyframes cv-pulse {
          from { opacity: 1;   transform: scale(1);   }
          to   { opacity: 0.3; transform: scale(0.7); }
        }

        .cv-actions {
          display: grid;
          grid-template-columns: 1fr 1fr 40px;
          gap: 8px;
        }

        .cv-btn {
          height: 44px;
          border: 1px solid #2a2a2a;
          border-radius: 2px;
          background: transparent;
          font-family: 'Syne', sans-serif;
          font-size: 20px;
          cursor: pointer;
          transition: all 0.15s;
          color: #f5f5f5;
          background: #181818;
          position: relative;
          overflow: hidden;
        }

        .cv-btn.small {
          font-size: 14px;
          letter-spacing: 1px;
          color: #666;
        }

        .cv-btn:not(:disabled):hover        { border-color: #ff3c00; color: #ff3c00; background: #ff3c0008; }
        .cv-btn:not(:disabled):active       { transform: scale(0.97); }
        .cv-btn:disabled                    { opacity: 0.2; cursor: not-allowed; }

        .cv-progress {
          position: absolute;
          bottom: 0; left: 0;
          height: 2px;
          background: #ff9500;
          animation: cv-progress 1.2s linear forwards;
        }

        @keyframes cv-progress {
          from { width: 0% }
          to   { width: 100% }
        }
      `}</style>

      <div className="cv-root">
        <div className="cv-card">

          <div className="cv-label">counter.tsx</div>

          <div className={`cv-count ${busy ? "busy" : ""}`}>
            {counter.count}
          </div>

          <div className="cv-double">×2 = {counter.double}</div>

          <div className={`cv-chip ${busy ? "busy" : "ready"}`}>
            <span className={`cv-dot ${busy ? "busy" : ""}`} />
            {busy ? "executing…" : "ready"}
          </div>

          <div className="cv-actions">
            <button
              className="cv-btn"
              disabled={busy}
              onClick={() => counter.decrement()}
            >
              −
              {busy && <span className="cv-progress" />}
            </button>

            <button
              className="cv-btn"
              disabled={busy}
              onClick={counter.increment}
            >
              +
              {busy && <span className="cv-progress" />}
            </button>

            <button
              className="cv-btn small"
              disabled={busy}
              onClick={() => counter.execute("reset")}
              title="reset"
            >
              ↺
            </button>
          </div>

        </div>
      </div>
    </>
  )
}

// TEST

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function flattenFeatures(
  features: FeatureMetadata[],
  map: Map<string, FeatureMetadata> = new Map(),
  parent: FeatureMetadata | null = null
): Map<string, FeatureMetadata> {
  for (const f of features) {
    const entry: FeatureMetadata = {
      ...f,
      parent: parent?.id,
    };

    map.set(f.id, entry);

    if (f.children?.length) {
      flattenFeatures(f.children, map, f);
    }
  }

  return map;
}

const TAG_COLORS: Record<string, string> = {
  core: "#6366f1",
  nav: "#0ea5e9",
  admin: "#f59e0b",
  default: "#64748b",
};

function tagColor(tag: string): string {
  return TAG_COLORS[tag] ?? TAG_COLORS.default;
}

function visibilityBadge(vis: string[] = ["public"]) {
  if (vis.includes("public") && vis.includes("private"))
    return { label: "public + private", color: "#10b981" };
  if (vis.includes("private"))
    return { label: "private", color: "#8b5cf6" };
  return { label: "public", color: "#0ea5e9" };
}

// ─────────────────────────────────────────────────────────────────────────────
// FeatureNode
// ─────────────────────────────────────────────────────────────────────────────

interface FeatureNodeProps {
  feature: FeatureMetadata;
  depth?: number;
  onSelect: (f: FeatureMetadata) => void;
  selected: FeatureMetadata | null;
}

function FeatureNode({
  feature,
  depth = 0,
  onSelect,
  selected,
}: FeatureNodeProps) {
  const [open, setOpen] = useState<boolean>(depth < 2);
  const hasChildren = !!feature.children?.length;
  const isSelected = selected?.id === feature.id;
  const vis = visibilityBadge(feature.visibility);

  return (
    <div style={{ marginLeft: depth === 0 ? 0 : 20 }}>
      <div
        onClick={() => {
          onSelect(feature);
          if (hasChildren) setOpen((o) => !o);
        }}
        style={{
          padding: "6px 10px",
          marginBottom: 4,
          borderRadius: 6,
          cursor: "pointer",
          background: isSelected ? "#1e293b" : "#0f172a",
          border: isSelected ? "1px solid #6366f1" : "1px solid #1e293b",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong>{feature.id}</strong>

          <span
            style={{
              fontSize: 11,
              padding: "2px 6px",
              borderRadius: 999,
              background: vis.color,
              color: "#fff",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {vis.label}
          </span>
        </div>
      </div>

      {hasChildren && open &&
        feature.children!.map((child) => (
          <FeatureNode
            key={child.id}
            feature={child}
            depth={depth + 1}
            onSelect={onSelect}
            selected={selected}
          />
        ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail Panel
// ─────────────────────────────────────────────────────────────────────────────

interface DetailPanelProps {
  feature: FeatureMetadata | null;
}

function DetailPanel({ feature }: DetailPanelProps) {
  if (!feature) return <div>Select a feature</div>;

  return (
    <div>
      <h3>{feature.label ?? feature.id}</h3>
      <pre>{JSON.stringify(feature, null, 2)}</pre>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────

interface FeatureRegistryVisualizerProps {
  features?: FeatureMetadata[];
}

export default function FeatureRegistryVisualizer({
  features = [],
}: FeatureRegistryVisualizerProps) {
  const [selected, setSelected] = useState<FeatureMetadata | null>(null);
  const [query, setQuery] = useState<string>("");

  const featuresMap = useMemo(
    () => flattenFeatures(features),
    [features]
  );

  const roots = useMemo(
    () => features.filter((f) => !f.parent),
    [features]
  );

  return (
    <div style={{ display: "flex", height: "100vh", background: "#080f1a", color: "#fff" }}>
      <div style={{ width: "50%", padding: 20, overflowY: "auto" }}>


        {roots.map((f) => (
          <FeatureNode
            key={f.id}
            feature={f}
            onSelect={setSelected}
            selected={selected}
          />
        ))}
      </div>

      <div style={{ width: "50%", padding: 20, borderLeft: "1px solid #1e293b" }}>
        <DetailPanel feature={selected} />
      </div>
    </div>
  );
}

const styles = {
  container: { padding: 20, textAlign: 'center' },
  title: { fontSize: 32, fontWeight: 'bold' },
  subtitle: { fontSize: 18, color: '#666' },
  button: { marginTop: 20, padding: '10px 20px', fontSize: 16 },
};

@Feature({
  id: "home",
  i18n: "home",
  path: "/",
  icon: "home",
  description: "home",
  tags: ["menu"],
  permissions: [],
  features: [],
  visibility: ["private", "public"]
})
export class HomePage extends React.Component {
  static contextType = EnvironmentContext;
  declare context: Environment;

  render() { //return <div> <CounterView/> <DemoView/></div>
      //return <CounterView/>
      return <DemoView/>
     //return  <FeatureRegistryVisualizer features={this.context.get(FeatureRegistry).filter((f) => f.parent == undefined)}></FeatureRegistryVisualizer>
  }
}