import { ShowcaseMeta } from "./feature-decorator";

export type ComponentLoader = () => Promise<{ default: React.ComponentClass<any> }>;

interface FeatureMeta {
  id: string;
  loader: ComponentLoader;
  parent?: string;
  fqn?: string; // fully qualified name
  showcase?: ShowcaseMeta
}

export class ComponentRegistry {
      private static map = new Map<string, ComponentLoader>();
      private static metaMap = new Map<string, FeatureMeta>();

      // register loader and parent info
      static register(
          name:   string,
          loader: ComponentLoader,
          opts?:  { parent?: string; showcase?: ShowcaseMeta }  // ← new
        ) {
          const meta: FeatureMeta = {
            id:       name,
            loader,
            parent:   opts?.parent,
            showcase: opts?.showcase,   // ← new
          };
          this.metaMap.set(name, meta);
        }

      // deferred FQN computation
      static computeFQNs() {
        for (const meta of this.metaMap.values()) {
          meta.fqn = this.resolveFQN(meta);
          // map the loader using FQN as the key
          this.map.set(meta.fqn, meta.loader);
        }

         this.metaMap.clear()
      }

      private static resolveFQN(meta: FeatureMeta): string {
        if (!meta.parent) return meta.id;
        const parentMeta = this.metaMap.get(meta.parent);
        if (!parentMeta) return meta.id; // fallback if parent not found
        return this.resolveFQN(parentMeta) + '.' + meta.id;
      }

      static get(name: string) {
          ComponentRegistry.computeFQNs()

        const loader = this.map.get(name);
        if (!loader) throw new Error(`Component ${name} not registered`);
        return loader;
      }

      static getMeta(name: string): FeatureMeta | undefined {
        return this.metaMap.get(name) ?? undefined;
      }

      // optional: get all feature metadata
      static getAllMeta(): FeatureMeta[] {
        return Array.from(this.metaMap.values());
      }
}