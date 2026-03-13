import { FeatureMetadata } from '../feature-registry';

import { Tracer, TraceLevel, injectable } from '@novx/core';

import { Translator } from '@novx/i18n';
import { LoaderAction, OutletLoader } from '../feature-outlet';

@injectable()
export class I18NLoader extends OutletLoader {
  static {
      OutletLoader.loaders.push(I18NLoader)
  }

  constructor(private translator: Translator) {
    super('i18n');
  }

  shouldRun(feature: FeatureMetadata, action: LoaderAction): boolean {
    return action === 'component' && feature.preloadI18n !== undefined && feature.preloadI18n.length > 0;
  }

  async run(feature: FeatureMetadata) : Promise<void> {
    return this.exec(async () => {
      Tracer.Trace(
        'portal.feature-outlet',
        TraceLevel.HIGH,
        `Loading i18n namespaces for feature '${feature.id}': ${feature.preloadI18n!.join(', ')}`
      );

      await this.translator.checkAndLoadNamespaces(...feature.preloadI18n!);
    });
  }
}
