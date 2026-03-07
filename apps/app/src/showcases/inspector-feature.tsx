

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

import { Environment } from "@novx/core";
import { EnvironmentContext, Feature, FeatureMetadata, FeatureRegistry } from "@novx/portal";
import React from "react";
import { useMemo, useState } from "react";

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
  id: "inspector",
  parent: "showcases",
  path: "/inspector",
  icon: "home",
  description: "inspector",
  tags: ["showcase"],
  permissions: [],
  features: [],
  visibility: ["private", "public"]
})
export class InspectorPage extends React.Component {
  static contextType = EnvironmentContext

  declare context: Environment
  render() {
      const features = this.context.get(FeatureRegistry).finder().withoutParent().find()
      return <FeatureRegistryVisualizer features={features}/>
  }
}