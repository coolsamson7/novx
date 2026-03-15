import React from 'react';
import { useParams } from 'react-router-dom';

import { FeatureMetadata, FeatureRegistry } from './feature-registry';

import {
  ErrorManager,
  ErrorContext,
  Environment
} from '@novx/core';

import { FeatureDescriptor } from './model';
import { EnvironmentContext } from './environment';
import { ErrorDisplay } from './component/error-display';
import { HorizontalSpinner } from './component';

export type LoaderAction = 'bootstrap' | 'module' | 'component';

export type OutletLoaderType<T extends OutletLoader = OutletLoader> =
  new (...args: any[]) => T;

export abstract class OutletLoader {

  static loaders: OutletLoaderType[] = [];

  id: string;
  loading = false;

  constructor(id: string) {
    this.id = id;
  }

  isLoading() {
    return this.loading;
  }

  protected async exec(fn: () => Promise<void>) {
    this.loading = true;
    try {
      await fn();
    } finally {
      this.loading = false;
    }
  }

  abstract shouldRun(feature: FeatureMetadata, action: LoaderAction): boolean;
  abstract run(feature: FeatureMetadata, outlet: FeatureOutlet): Promise<void>;
}

// ─── cache entry ─────────────────────────────────────────────────────────────
//
// Stores both the component class AND the remote module's DI environment.
// For local features `environment` is undefined and the parent context is used.
// For federated features `environment` is the remote module's Environment so
// its own injectable services resolve correctly after a cache hit.

interface CachedFeature {
  component:    any;
  environment?: Environment;
}

// ─── types ───────────────────────────────────────────────────────────────────

export interface FeatureOutletOptions {
  id: string;
}

interface FeatureOutletState {
  Loaded?: React.ComponentClass<any>;
  loading: boolean;
  error?: Error;
}

// ─── debug helpers ────────────────────────────────────────────────────────────

const _renderCounters: Record<string, number> = {};
const _prevProps:      Record<string, any>    = {};
const _prevState:      Record<string, any>    = {};

// ─── FeatureOutlet ────────────────────────────────────────────────────────────

export class FeatureOutlet extends React.Component<
  FeatureOutletOptions,
  FeatureOutletState
> {
  static contextType = EnvironmentContext;
  declare context: Environment;

  // Written by OutletLoader implementations
  public environment?: Environment;
  public component: any;

  // ── static component cache ───────────────────────────────────────────────────
  //
  // Shared across all FeatureOutlet instances for the lifetime of the session.
  // Keyed by feature id.  Populated after a successful load so a cache entry
  // guarantees all loaders have already run successfully.
  private static componentCache = new Map<string, CachedFeature>();

  static clearCache() {
    FeatureOutlet.componentCache.clear();
  }

  // ── instance ─────────────────────────────────────────────────────────────────

  private feature?: FeatureMetadata;

  private getFeature(): FeatureMetadata {
    if (!this.feature) {
      const featureRegistry = this.context.get(FeatureRegistry);
      this.feature = featureRegistry.get(this.props.id);
    }
    return this.feature;
  }

  // Initialise state synchronously from cache so the very first render is
  // already in the loaded state when the component was visited before.
  // For federated features the remote Environment is also restored here so
  // the correct DI context is available before the first render.
  state: FeatureOutletState = (() => {
    const cached = FeatureOutlet.componentCache.get(this.props.id);
    if (cached) {
      console.log(
        `%c[FeatureOutlet] ${this.props.id} — cache HIT (federated=${!!cached.environment})`,
        'color:#22c55e'
      );
      // Restore the remote environment so render() picks it up immediately
      this.environment = cached.environment;
      return {
        loading: false,
        Loaded:  cached.component?.default ?? cached.component,
        error:   undefined,
      };
    }
    console.log(
      `%c[FeatureOutlet] ${this.props.id} — cache MISS, will load`,
      'color:#f59e0b'
    );
    return {
      loading: true,
      Loaded:  undefined,
      error:   undefined,
    };
  })();

  // ── loaders ──────────────────────────────────────────────────────────────────

  private async runLoaders(feature: FeatureMetadata) {
    const loaders = OutletLoader.loaders
      .map(t => this.context.get(t))
      .filter(loader => loader.shouldRun(feature, 'component'));

    if (!loaders.length) return;
    await Promise.all(loaders.map(loader => loader.run(feature, this)));
  }

  // ── lifecycle ─────────────────────────────────────────────────────────────────

  async componentDidMount() {
    // Cache hit — loaders already ran, environment already restored in state
    // initialiser above. Nothing to do.
    if (!this.state.loading) return;

    const feature = this.getFeature();

    try {
      await this.runLoaders(feature);

      // Store component + environment (undefined for local, Environment for remote).
      // The entry is only created after all loaders succeed so a cache hit always
      // means the feature is fully ready.
      FeatureOutlet.componentCache.set(this.props.id, {
        component:   this.component,
        environment: this.environment,
      });

      console.log(
        `%c[FeatureOutlet] ${this.props.id} — stored in cache (federated=${!!this.environment})`,
        'color:#22c55e'
      );

      this.setState({
        Loaded:  this.component?.default ?? this.component,
        loading: false,
      });
    } catch (err) {
      this.setState({
        error:   err as Error,
        loading: false,
      });
    }
  }

  // ── render ───────────────────────────────────────────────────────────────────

  render() {
    // ── debug ─────────────────────────────────────────────────────────────────
    const id = this.props.id;
    _renderCounters[id] = (_renderCounters[id] ?? 0) + 1;
    const count = _renderCounters[id];

    const changedProps = Object.keys(this.props).filter(
      k => (this.props as any)[k] !== (_prevProps[id] ?? {})[k]
    );
    const changedState = Object.keys(this.state).filter(
      k => (this.state as any)[k] !== (_prevState[id] ?? {})[k]
    );

    console.group(`[FeatureOutlet] ${id} render #${count}`);
    if (changedProps.length)  console.log('changed props:', changedProps);
    if (changedState.length)  console.log('changed state:', changedState);
    if (!changedProps.length && !changedState.length)
      console.warn('⚠️ no props/state changed — context change or StrictMode');
    console.log(
      `loading=${this.state.loading}  ` +
      `cached=${FeatureOutlet.componentCache.has(id)}  ` +
      `federated=${!!this.environment}`
    );
    console.groupEnd();

    _prevProps[id] = { ...this.props };
    _prevState[id] = { ...this.state };
    // ── end debug ─────────────────────────────────────────────────────────────

    const { Loaded, error, loading } = this.state;
    const feature = this.getFeature();

    // For federated features use the remote module's environment.
    // For local features fall back to the parent context.
    const env = this.environment ?? this.context;

    return (
      <div style={{ position: 'relative', height: '100%' }}>
        <DelayedSpinner active={loading} />
        {/*
          Keep the subtree mounted with visibility:hidden while loading so
          React doesn't thrash children. Once loaded flip to visible —
          no layout shift, no white flash.
          On cache hit loading is already false so this div is immediately visible.
        */}
        <div style={{ visibility: loading ? 'hidden' : 'visible', height: '100%' }}>
          <FeatureErrorBoundary feature={feature} error={error}>
            {Loaded && (
              <EnvironmentContext.Provider value={env}>
                <LoadedWrapper Component={Loaded} feature={feature} />
              </EnvironmentContext.Provider>
            )}
          </FeatureErrorBoundary>
        </div>
      </div>
    );
  }
}

// ─── LoadedWrapper ────────────────────────────────────────────────────────────

const LoadedWrapper: React.FC<{
  Component: React.ComponentClass<any>;
  feature?: FeatureDescriptor;
}> = ({ Component, feature }) => {
  const params = useParams();
  return <Component {...params} feature={feature} />;
};

// ─── DelayedSpinner ───────────────────────────────────────────────────────────

const DelayedSpinner: React.FC<{ active: boolean }> = ({ active }) => {
  const visible = useDelayedFlag(active, 300);
  return <HorizontalSpinner active={visible} />;
};

function useDelayedFlag(active: boolean, delay = 300) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [active, delay]);

  return visible;
}

// ─── FeatureErrorBoundary ─────────────────────────────────────────────────────

interface FeatureErrorBoundaryProps {
  feature?: FeatureDescriptor;
  error?: Error;
  children?: React.ReactNode;
}

interface FeatureErrorBoundaryState {
  hasError:   boolean;
  error?:     Error;
  errorInfo?: React.ErrorInfo;
}

class FeatureErrorBoundary extends React.Component<
  FeatureErrorBoundaryProps,
  FeatureErrorBoundaryState
> {
  static contextType = EnvironmentContext;
  declare context: Environment;

  state: FeatureErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ errorInfo: info });

    const errorManager = this.context.get(ErrorManager);

    const ctx: ErrorContext = {
      $type:            'feature',
      featureId:        this.props.feature?.id,
      featureLabel:     this.props.feature?.label,
      featureComponent: this.props.feature?.component,
      componentStack:   info.componentStack,
    };

    errorManager.handle(error, ctx);
  }

  render() {
    const displayError    = this.state.error || this.props.error;
    const shouldShowError = this.state.hasError || this.props.error;

    if (shouldShowError && displayError) {
      return (
        <ErrorDisplay
          error={displayError}
          errorInfo={this.state.errorInfo}
          feature={this.props.feature}
        />
      );
    }

    return this.props.children ?? null;
  }
}