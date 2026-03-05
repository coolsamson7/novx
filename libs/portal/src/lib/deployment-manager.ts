
import { FeatureMetadata } from './feature-registry';
import { ClientInfo, Deployment, DeploymentRequest } from './model';
import type { Manifest } from './model';

import { TraceLevel, Tracer } from '@novx/core';
import { detectClient } from './client-detector';
import { FeatureRegistry } from './feature-registry';
import { FilterContext, ManifestProcessor } from './manifest-filter';
import { ComponentRegistry } from './component-registry';

export abstract class DeploymentLoader {
  abstract load(request: DeploymentRequest): Promise<Deployment>;
}

export function toWebpackContextKey(path: string): string {
  // normalize slashes (important on Windows)
  const normalized = path.replace(/\\/g, '/');

  const srcIndex = normalized.lastIndexOf('/src/');
  if (srcIndex === -1) {
    throw new Error(`Path does not contain /src/: ${path}`);
  }

  const relative = normalized.slice(srcIndex + '/src/'.length);

  return `./${relative}`;
}

export interface DeploymentManagerOptions {
  featureRegistry: FeatureRegistry,
  loader: DeploymentLoader,
  localManifest: Manifest,

  processor?: ManifestProcessor,
  hasPermission?: (permission: string) => boolean,
  hasFeature?: (feature: string) => boolean,
}

export class DeploymentManager {
  // instance data

  deployment?: Deployment;

  private featureRegistry: FeatureRegistry
  private loader: DeploymentLoader
  private localManifest: Manifest
  private processor?: ManifestProcessor

  // constructor

  constructor(options : DeploymentManagerOptions) {
    this.featureRegistry = options.featureRegistry
    this.loader = options.loader
    this.localManifest = options.localManifest

    this.processor = options.processor
    this.hasPermissionFn = options.hasPermission ?? ((permission: string) => true)
    this.hasFeatureFn = options.hasPermission ?? ((feature: string) => true)
  }

  checkLazyFeatures(module: string, context : __WebpackModuleApi.RequireContext) {
      if ( Tracer.ENABLED)
         Tracer.Trace("portal", TraceLevel.HIGH, "check lazy features for {0}", module)

      const manifest = this.getModule(module);

      for (const feature of manifest.features || [] as FeatureMetadata[])
          if (feature.lazy) {
            const key = toWebpackContextKey(feature.sourceFile!)

            if ( context.keys().includes(key))
                try {
                     if ( Tracer.ENABLED)
                         Tracer.Trace("portal", TraceLevel.HIGH, "register lazy feature {0}", feature.id)

                     ComponentRegistry.register(feature.id, async () => {
                        if ( Tracer.ENABLED)
                             Tracer.Trace("portal", TraceLevel.HIGH, "load lazy feature {0}", feature.id)

                         const mod = await context(key);
                        return mod; // { default: React.lazy(() => Promise.resolve(mod)) };
                     });
                }
                catch (e) {
                  console.warn(`failed to load lazy feature ${feature.id}:`, e);
                }
            else console.warn(`no matching webpack component for  ${feature.id}:`);
      } // for
  }

  // public

  loaded(module: string) {
    if (this.deployment && this.deployment.modules[module])
      this.getModule(module).loaded = true;
  }

  getDeployment(): Deployment {
    if ( this.deployment )
      return this.deployment;

    throw new Error('deployment not loaded yet');
  }

  getModule(module: string): Manifest {
    const manifest = this.getDeployment().modules[module]
    if (manifest)
      return manifest;

    throw new Error(`module ${module} not found`);
  }

  clientInfo(): ClientInfo {
    return detectClient();
  }

  async loadDeployment(request: DeploymentRequest): Promise<Deployment> {
    if (Tracer.ENABLED)
      Tracer.Trace(
        'portal',
        TraceLevel.HIGH,
        'load deployment for application {0}',
        request.application,
      );

    this.deployment = await this.loader.load(request);

    // add local features

    this.deployment.modules[this.localManifest.id!] = this.localManifest;

    // apply manifest processor if available

    if (this.processor) {
      const filterContext: FilterContext = {
        clientInfo: this.clientInfo(),
        hasPermission: this.hasPermissionFn || (() => true),
        hasFeature: this.hasFeatureFn || (() => true),
      };

      for (const moduleName in this.deployment.modules) {
        const module = this.deployment.modules[moduleName];
        this.deployment.modules[moduleName] = this.processor.process(module, filterContext);
      }
    }

    this.deployment.modules[this.localManifest.id!].loaded = true;

    // copy module / uri

    for (const moduleName in this.deployment.modules) {
      const module = this.deployment.modules[moduleName];

      for (const feature of module.features as FeatureMetadata[]) {
        // copy module / uri

        feature.uri = module.uri;
        // Use the module key from the deployment (moduleName), not the module.module property
        // The moduleName is the webpack module federation container name
        feature.module = moduleName;

        // check label

        if (!feature.label) feature.label = feature.id;
      }
    }

    // merge all features from deployment

    const features = Object.values(this.deployment.modules).flatMap(
      (m) => m.features,
    );

    // register features in the registry

    this.featureRegistry.register(...features);

    // done

    console.log('### deployment ', this.deployment);

    return this.deployment;
  }
}