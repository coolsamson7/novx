import { injectable} from "@novx/core";
import {FeatureDescriptor} from "./model";
import { LocaleManager, Translator } from '@novx/i18n';
import { of } from 'rxjs';
import { ComponentRegistry } from "./component-registry";
import { ShowcaseMeta } from "./feature-decorator";


/**
 * this is a derived interface of {@linlk FeatureDescriptor} adding technical aspects.
 */
export interface FeatureMetadata extends FeatureDescriptor {
    parent?: string;
    children?: FeatureMetadata[];
    uri?: string; // URI of remote container, if federated
    module?: string; // module name inside remote
    showcase?:  ShowcaseMeta
}

/**
 * A `FeatureRegistry` is a registry for {@link FeatureMetadata}s
 */
@injectable()
export class FeatureRegistry {
    // instance data

    protected features = new Map<string, FeatureMetadata>();

    // constructor

    constructor(localeManager: LocaleManager, private translator: Translator) {
      localeManager.subscribe({
          onLocaleChange: (locale) => {
            for (const feature of this.features.values())
              if (feature.i18n) {
                feature.label = translator.translate('portal:' + feature.i18n + ".label");
              }

            return of(void 0);
          } ,
        } ,
        5, // priority
      );
    }

    // public

    register(...features: FeatureMetadata[]) {
        // local function

        const register = (feature: FeatureMetadata, parent: FeatureMetadata | null = null ) => {
            // fix qualified name

            if (parent)
                feature.id = parent.id + "." + feature.id;

            if (!feature.showcase) {
                const meta = ComponentRegistry.getMeta(feature.id);
                if (meta?.showcase) feature.showcase = meta.showcase;
              }

            // register

            this.features.set(feature.id, feature);

            // i18n

            if ( feature.i18n && !feature.label) {
              feature.label = this.translator.translate('portal:' + feature.i18n + ".label");
            }

            // recursion

            if (feature.children)
                for (const child of feature.children)
                    register(child, feature);
        }

        features.forEach(f => register(f));
    }

    /**
     * 
     * @param f filter the features given a {@link FeatureFinderFilter}
     * @returns the resulting features
     */
    filter(f: FeatureFinderFilter): FeatureMetadata[] {
        return Array.from(this.features.values()).filter(f)
    }

    /**
     * return a {@link FeatureFinder} that can be used to filter features with a fluent language
     * @returns  the finder
     */
    finder(): FeatureFinder {
        return new FeatureFinder(this);
    }

    /**
     * Return a named feature
     * @param id the id
     * @returns  the feature
     */
    get(id: string) : FeatureMetadata {
        const f = this.features.get(id);
        if (!f)
           throw new Error(`Feature ${id} not found`);

        return f;
    }
}


export type FeatureFinderFilter = (feature: FeatureMetadata) => boolean

export class FeatureFinder {
  filter: FeatureFinderFilter[] = [];

  constructor(private registry: FeatureRegistry) {}

  // fluent

  withId(id: string): FeatureFinder {
    this.filter.push((feature) => feature.id == id);
    return this;
  }

  withoutParent(): FeatureFinder {
    this.filter.push((feature) => feature.parent == null);

    return this;
  }

  withPath(path: string | null = null): FeatureFinder {
    if (path) this.filter.push((feature) => feature.path == path);
    else this.filter.push((feature) => feature.path !== null);

    return this;
  }

  withTag(tag: string): FeatureFinder {
    this.filter.push((feature) => (feature.tags || []).includes(tag));
    return this;
  }

  matchesSession(session: boolean): FeatureFinder {
    if (session)
      // When user is logged in, show both 'public' and 'private' features
      this.filter.push((feature) => {
        const visibility = feature.visibility || ["public", "private"];
        return visibility.includes('public') || visibility.includes('private');
      });
    else
      // When user is NOT logged in, show only 'public' features
      this.filter.push((feature) =>
        (feature.visibility || ['public']).includes('public'),
      );

    return this;
  }

  withVisibility(visibility: "public" | "private"): FeatureFinder {
      this.filter.push((feature) => {
        return ( feature.visibility || ["public", "private"]).includes(visibility);
      });

      return this;
    }

  // find

  findOptional(): FeatureMetadata | undefined {
    const result = this.find();

    if (result.length == 1) 
      return result[0];

    else if (result.length == 0) 
      return undefined;

    else throw new Error(
        'expected 0 or 1 feature with filter' +
          this.filter +
          ', got ' +
          result.length,
      );
  }

  findOne(): FeatureMetadata {
    const result = this.find();

    if (result.length == 1) return result[0];
    else
      throw new Error(
        'expected 1 feature with filter' +
          this.filter +
          ', got ' +
          result.length,
      );
  }

  find(): FeatureMetadata[] {
    return this.registry.filter((feature) => {
      for (const filter of this.filter)
        if (!filter(feature)) {
            return false;
        }

      return true;
    });
  }
}