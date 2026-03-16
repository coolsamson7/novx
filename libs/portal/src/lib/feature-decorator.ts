import { ClientConstraints } from './model';
import React from 'react';

import { ComponentRegistry } from './component-registry';
import { TraceLevel, Tracer } from '@novx/core';

export interface ShowcaseAsset {
  type:     'css' | 'scss' | 'ts' | 'tsx' | 'json' | 'md' | 'html'
  label:    string
  // relative path from the feature source file — loaded via ?raw at startup
  path?:     string
  // populated by ShowcaseRegistry after loading — do not set manually
  content?: string
  // for public/ or CDN assets that can't use ?raw — fetched at runtime
  url?:     string
}

export interface ShowcaseMeta {
  title?:       string
  description?: string
  group?:       string   // sidebar grouping
  order?:       number   // sort within group
  docs?:        string   // raw markdown string — load via path?raw in decorator
  tags?:        string[]
  assets?:      ShowcaseAsset[]
}


/**
 * possible feature options
 */
export interface FeatureOptions {
  /**
   * the id
   */
  id: string;
  /**
   * optional icon name
   */
  icon?: string;
  /**
   * optional array of permissions that this feature requires
   */
  permissions?: string[];
  /**
   * description of the feature
   */
  description?: string;
  /**
   * any tags that can be used to categorize features
   */
  tags?: string[];
  /**
   * optional array of feature flags that this feature requires
   */
  features?: string[];
  /**
   * determines the required session status - `public` referes to a non existing session -  for this feature. 
   */
  visibility?: ('public' | 'private')[];
  /**
   * list of i18n namespaces that the feature will preload when rendered
   */
  preloadI18n?: string[];
  /**
   * optional i18n key that contains trarnslations for the label
   */
  i18n?: string;
  /**
   * a label
   */
  label?: string;
  /**
   * the route
   */
  path?: string;
  /**
   * optional parent feature id in case of chld features
   */
  parent?: string;
  /**
   * the required {@link ClientConstraints} that this feature requires
   */
  clients?: ClientConstraints;

   showcase?:    ShowcaseMeta
}

/**
 * decorator that marks a class as a feature
 * @param opts the {@link FeatureOptions}
 */
export function Feature(opts: FeatureOptions) {
  return function <T extends { new (...args: any[]): React.Component<any> }>(
    cls: T,
  ) {
    let fqn = opts.id;
    if (opts.parent) fqn = opts.parent + '.' + fqn;

    if (Tracer.ENABLED)
      Tracer.Trace('portal', TraceLevel.HIGH, 'register feature {0}', fqn);

    // is done via the deployment manager featureRegistry.register([featureMeta]);

    ComponentRegistry.register(opts.id, async () => ({ default: cls }), {
        parent: opts.parent ,
        showcase: opts.showcase
        });

    // done

    return cls;
  };
}