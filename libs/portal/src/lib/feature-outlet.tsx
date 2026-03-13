import React from 'react';
import { useParams } from 'react-router-dom';

import { FeatureMetadata, FeatureRegistry } from './feature-registry';

import {
  ErrorManager,
  ErrorContext,
  Tracer,
  TraceLevel,
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

/**
 * Feature outlet options
 */
export interface FeatureOutletOptions {
  id: string;
}

interface FeatureOutletState {
  Loaded?: React.ComponentClass<any>;
  loading: boolean;
  error?: Error;
}

export class FeatureOutlet extends React.Component<
  FeatureOutletOptions,
  FeatureOutletState
> {
  static contextType = EnvironmentContext;
  declare context: Environment;

  environment?: Environment;
  component: any;

  state: FeatureOutletState = {
    loading: true
  };

  private async runLoaders(feature: FeatureMetadata) {
    const loaders = OutletLoader.loaders
      .map(t => this.context.get(t))
      .filter(loader => loader.shouldRun(feature, 'component'));

    if (!loaders.length) return;
    await Promise.all(loaders.map(loader => loader.run(feature, this)));
  }

  async componentDidMount() {
    const featureRegistry = this.context.get(FeatureRegistry);
    const feature = featureRegistry.get(this.props.id);

    try {
      await this.runLoaders(feature);

      this.setState({
        Loaded: this.component?.default ?? this.component,
        loading: false
      });
    } catch (err) {
      this.setState({
        error: err as Error,
        loading: false
      });
    }
  }

  render() {
    const { Loaded, error, loading } = this.state;

    // FIX: derive synchronously — no intermediate undefined render
    const featureRegistry = this.context.get(FeatureRegistry);
    const feature = featureRegistry.get(this.props.id);

    console.log(this.props.id)

    const env = this.environment ?? this.context;

    return (
      <div style={{ position: 'relative', height: '100%' }}>
        <DelayedSpinner active={loading} />
        <FeatureErrorBoundary feature={feature} error={error}>
          {Loaded && (
            <EnvironmentContext.Provider value={env}>
              <LoadedWrapper Component={Loaded} feature={feature} />
            </EnvironmentContext.Provider>
          )}
        </FeatureErrorBoundary>
      </div>
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const LoadedWrapper: React.FC<{
  Component: React.ComponentClass<any>;
  feature?: FeatureDescriptor;
}> = ({ Component, feature }) => {
  const params = useParams();

  return <Component {...params} feature={feature} />;
};

/* -------------------------------------------------------------------------- */
/* Delayed Spinner                                                            */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Error Boundary                                                             */
/* -------------------------------------------------------------------------- */

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

  state: FeatureErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {

    this.setState({
      errorInfo: info
    });

    const errorManager = this.context.get(ErrorManager);

    const ctx: ErrorContext = {
      $type: 'feature',
      featureId: this.props.feature?.id,
      featureLabel: this.props.feature?.label,
      featureComponent: this.props.feature?.component,
      componentStack: info.componentStack
    };

    errorManager.handle(error, ctx);
  }

  render() {

    const displayError = this.state.error || this.props.error;
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