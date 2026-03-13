import { FeatureOutlet, LoaderAction, OutletLoader } from '../feature-outlet';
import { FeatureMetadata } from '../feature-registry';

import { AbstractModule } from '../module';

import { Tracer, TraceLevel, Environment, injectable } from '@novx/core';


// Webpack MF globals                                                  */

declare function __webpack_init_sharing__(scope: string): Promise<void>;
declare const __webpack_share_scopes__: { default: unknown };

@injectable()
export class RemoteComponentLoader extends OutletLoader {
  static {
      OutletLoader.loaders.push(RemoteComponentLoader)
  }

  // static data

  private static remoteEntryCache = new Set<string>();
  private static moduleCache = new Map<string, any>();
  private static environmentCache = new Map<string, Environment>();

  // static

  static async loadRemoteEntry(scope: string, url: string) {
      if (this.remoteEntryCache.has(url)) return;

      return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.onload = () => {
          this.remoteEntryCache.add(url);
          resolve();
        };
        script.onerror = () =>
          reject(new Error(`Failed to load remote entry ${url}`));
        document.head.appendChild(script);
      });
    }

    static async initializeRemote(scope: string) {
      await __webpack_init_sharing__('default');
      const remoteContainer = (window as any)[scope];
      if (!remoteContainer)
         throw new Error(`Remote container ${scope} not found`);

      if ( Tracer.ENABLED)
            Tracer.Trace("portal", TraceLevel.HIGH, "initialize remote module {0}", scope)

      await remoteContainer.init(__webpack_share_scopes__.default);
    }

    static async loadRemoteModule(scope: string, module: string, url?: string) {
       if ( Tracer.ENABLED)
         Tracer.Trace("portal", TraceLevel.HIGH, "load remote module {0}:{1}", scope, module)

      const key = `${scope}:${module}`; // e.g. mfe1:./Module
      if (this.moduleCache.has(key)) {
        return this.moduleCache.get(key);
      }

      if (url) await this.loadRemoteEntry(scope, `${url}/remoteEntry.js`);
      await this.initializeRemote(scope);

      const factory = await (window as any)[scope].get(
        module.startsWith('./') ? module : `./${module}`
      );

      const Module = factory();

      this.moduleCache.set(key, Module);

      return Module;
    }

  // constructor

  constructor(private environment: Environment) {
    super('remote-component');
  }

  shouldRun(feature: FeatureMetadata, action: LoaderAction): boolean {
    return (
      action === 'component' &&
      feature.module !== undefined &&
      feature.uri !== undefined
    );
  }

  async run(feature: FeatureMetadata, outlet: FeatureOutlet): Promise<void> {
    return this.exec(async () => {
      Tracer.Trace(
        'portal.feature-outlet',
        TraceLevel.HIGH,
        `Loading remote component '${feature.component}' from module '${feature.module}'`
      );

      const key = `${feature.module}`;

      AbstractModule.reset();

      await RemoteComponentLoader.loadRemoteModule(
          feature.module!,
          './Module',
          feature.uri!
      );

      // create new environment on demand

      let environment = RemoteComponentLoader.environmentCache.get(key);
      if (!environment) {
        const queue = AbstractModule.queue;

        // expect one module!

        if (queue.length !== 1) {
          throw Error("expected a single module");
        }

        const moduleClass = queue[0].moduleClass;

        environment = new Environment({
          module: moduleClass,
          parent: this.environment
        });

        await environment.start(); // will also run the module's setup

        RemoteComponentLoader.environmentCache.set(key, environment);
      } // if

      outlet.environment = environment;
      outlet.component = await RemoteComponentLoader.loadRemoteModule(
          feature.module!,
          `./${feature.component}`,
          feature.uri!
        );
      });
    }
}
