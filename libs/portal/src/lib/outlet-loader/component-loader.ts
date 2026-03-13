import { FeatureMetadata } from '../feature-registry';
import { ComponentRegistry } from '../component-registry';

import { Tracer, TraceLevel, injectable } from '@novx/core';
import { FeatureOutlet, LoaderAction, OutletLoader } from '../feature-outlet';

@injectable()
export class LocalComponentLoader extends OutletLoader {
  static {
      OutletLoader.loaders.push(LocalComponentLoader)
  }

  constructor() {
    super('component');
  }

  shouldRun(feature: FeatureMetadata, action: LoaderAction): boolean {
    return action === 'component' && feature.uri == undefined;
  }

  async run(feature: FeatureMetadata, outlet: FeatureOutlet): Promise<void> {
    return this.exec(async () => {
      Tracer.Trace(
        'portal.feature-outlet',
        TraceLevel.HIGH,
        `Loading local component for feature '${feature.id}'`
      );

      const loader = ComponentRegistry.get(feature.id);
      outlet.component = await loader();
    });
  }
}

