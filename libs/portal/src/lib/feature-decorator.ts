import { ClientConstraints } from './model';
import React from 'react';

import { ComponentRegistry } from './component-registry';
import { TraceLevel, Tracer } from '@novx/core';

export interface FeatureOptions {
  id: string;
  icon?: string;
  permissions?: string[];
  description?: string;
  tags?: string[];
  features?: string[];
  visibility?: ('public' | 'private')[];
  preloadI18n?: string[];
  i18n?: string;
  label?: string;
  path?: string;
  parent?: string;
  clients?: ClientConstraints;
}

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