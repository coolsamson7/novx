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

// ─── debug ───────────────────────────────────────────────────────────────────

let renderCounters: Record<string, number> = {};
let prevPropsMap:   Record<string, any>    = {};
let prevStateMap:   Record<string, any>    = {};

// ─── types ───────────────────────────────────────────────────────────────────

export interface FeatureOutletOptions {
  id: string;
}

interface FeatureOutletState {
  Loaded?: React.ComponentClass<any>;
  loading: boolean;
  error?: Error;
}

// ─── FeatureOutlet ────────────────────────────────────────────────────────────

export class FeatureOutlet extends React.Component<
  FeatureOutletOptions,
  FeatureOutletState
> {
  static contextType = EnvironmentContext;
  declare context: Environment;

  public environment?: Environment;
  public component: any;

  // ── static component cache shared across all instances ──────────────────────
  // Once a feature's component has been loaded it is stored here so subsequent
  // mounts of the same feature start in the loaded state — no loading phase,
  // no white flash.
  private static componentCache = new Map<string, any>();

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
  state: FeatureOutletState = (() => {
    const cached = FeatureOutlet.componentCache.get(this.props.id);
    if (cached) {
      console.log(`%c[FeatureOutlet] ${this.props.id} — cache HIT, no loading phase`, 'color:#22c55e');
      return {
        loading: false,
        Loaded:  cached?.default ?? cached,
        error:   undefined,
      };
    }
    console.log(`%c[FeatureOutlet] ${this.props.id} — cache MISS, will load`, 'color:#f59e0b');
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
    // Already loaded from cache — nothing to do, no setState needed.
    if (!this.state.loading) return;

    const feature = this.getFeature();

    try {
      await this.runLoaders(feature);

      // Store in cache so the next mount of this feature is instant.
      FeatureOutlet.componentCache.set(this.props.id, this.component);
      console.log(`%c[FeatureOutlet] ${this.props.id} — stored in cache`, 'color:#22c55e');

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
    renderCounters[id] = (renderCounters[id] ?? 0) + 1;
    const count = renderCounters[id];

    const prevProps = prevPropsMap[id] ?? {};
    const prevState = prevStateMap[id] ?? {};

    const changedProps = Object.keys(this.props).filter(
      k => (this.props as any)[k] !== prevProps[k]
    );
    const changedState = Object.keys(this.state).filter(
      k => (this.state as any)[k] !== prevState[k]
    );

    console.group(`[FeatureOutlet] ${id} render #${count}`);
    if (changedProps.length)  console.log('changed props:', changedProps);
    if (changedState.length)  console.log('changed state:', changedState);
    if (!changedProps.length && !changedState.length)
      console.warn('⚠️ no props/state changed — context change or StrictMode');
    console.log(`loading=${this.state.loading}  cached=${FeatureOutlet.componentCache.has(id)}`);
    console.groupEnd();

    prevPropsMap[id] = { ...this.props };
    prevStateMap[id] = { ...this.state };
    // ── end debug ─────────────────────────────────────────────────────────────

    const { Loaded, error, loading } = this.state;
    const feature = this.getFeature();
    const env = this.environment ?? this.context;

    return (
      <div style={{ position: 'relative', height: '100%' }}>
        <DelayedSpinner active={loading} />
        {/*
          Keep the subtree mounted with visibility:hidden while loading so
          React doesn't thrash children. Once loaded flip to visible —
          no layout shift, no white flash.
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
  hasError: boolean;
  error?: Error;
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