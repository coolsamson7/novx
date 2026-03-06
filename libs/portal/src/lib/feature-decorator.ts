import { ClientConstraints } from './model';
import React from 'react';

import { ComponentRegistry } from './component-registry';
import { TraceLevel, Tracer } from '@novx/core';

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

    ComponentRegistry.register(fqn, async () => ({ default: cls }));

    // done

    return cls;
  };
}