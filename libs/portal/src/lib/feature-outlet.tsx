import React, { Suspense } from 'react';
import { useParams } from 'react-router-dom';

import { FeatureMetadata, FeatureRegistry } from './feature-registry';

import { ErrorManager, ErrorContext, Tracer, TraceLevel, Environment } from '@novx/core';
import { FeatureDescriptor } from './model';
import { EnvironmentContext } from './environment';
import { ErrorDisplay } from './component/error-display';
import { HorizontalSpinner } from './component';

export type LoaderAction = 'bootstrap' | 'module' | 'component';

export type OutletLoaderType<T extends OutletLoader = OutletLoader> =
  new (...args: any[]) => T;

export abstract class OutletLoader {
  // static data

  static loaders : OutletLoaderType[] = []

  // instance data

  id: string;
  loading = false;

  // constructor

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
      }
      finally {
        this.loading = false;
      }
  }

  // abstract

  abstract shouldRun(feature: FeatureMetadata, action: LoaderAction): boolean;

  abstract run(feature: FeatureMetadata, outlet: FeatureOutlet): Promise<void>;
}

/**
 * Renders the UI associated with a specific feature.
 *
 * The component resolves the feature implementation dynamically
 * using the provided `featureId`.
 *
 * @example
 * ```tsx
 * <FeatureOutlet featureId="user-profile" />
 * ```
 */
export class FeatureOutlet extends React.Component<{ featureId: string }> {
  state: {
    feature?: FeatureMetadata;
    Loaded?: React.ComponentClass<any>;
    loadingLoaders: OutletLoader[];
    error?: Error;
  } = {
    loadingLoaders: [],
  };

  static contextType = EnvironmentContext

  declare context: Environment

  environment?: Environment; // optional child environment for remote modules

  allLoaders(environment: Environment): OutletLoader[] {
    return OutletLoader.loaders.map(loaderType => environment.get(loaderType))
  }

  component: any; // resolved component


  private async runLoaders(feature: FeatureMetadata) {
    const active = OutletLoader.loaders
       .map(loaderType => this.context.get(loaderType))
       .filter(loader => loader.shouldRun(feature, 'component'));

    this.setState({ loadingLoaders: active });

    await Promise.all(active.map(loader => loader.run(feature, this)));

    this.setState({ loadingLoaders: [] });
  }

  private isLoading() {
    return this.state.loadingLoaders.some(l => l.isLoading());
  }

  // lifecycle

  async componentDidMount() {
    const featureRegistry = this.context.get(FeatureRegistry);
    const feature = featureRegistry.get(this.props.featureId) as FeatureMetadata;

    try {
      await this.runLoaders(feature);

      Tracer.Trace(
        'portal.feature-outlet',
        TraceLevel.HIGH,
        `Loaded feature component '${feature.component}' for feature '${feature.id}'`
      );

      this.setState({
        feature,
        Loaded: this.component?.default ?? this.component,
      });
    } catch (err) {
      Tracer.Trace(
        'portal.feature-outlet',
        TraceLevel.HIGH,
        `Failed to load feature '${feature.id}': ${(err as Error).message}`
      );
      this.setState({ feature, error: err as Error });
    }
  }

  // override

  render() {
    const { feature, Loaded, error } = this.state;

    const env = this.environment ?? this.context;

    return (
      <div style={{ position: 'relative', height: '100%' }}>
        <HorizontalSpinner active={this.isLoading()} />

        <FeatureErrorBoundary feature={feature} error={error}>
          {Loaded && (
            <Suspense fallback={<HorizontalSpinner />}>
              <EnvironmentContext.Provider value={env}>
                   <LoadedWrapper Component={Loaded} feature={feature} />
              </EnvironmentContext.Provider>
            </Suspense>
          )}
        </FeatureErrorBoundary>
      </div>
    );
  }
}

// Helpers        

const LoadedWrapper: React.FC<{Component: React.ComponentClass<any>; feature?: FeatureDescriptor}> = ({ Component, feature }) => {
  const params = useParams();

  return <Component {...params} feature={feature} />;
};

// Error boundary                                                    

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
  state: FeatureErrorBoundaryState = {
    hasError: false,
    error: undefined,
    errorInfo: undefined,
  };

    static contextType = EnvironmentContext

  declare context: Environment

  static getDerivedStateFromError(error: Error): Partial<FeatureErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ errorInfo: info });

    const errorManager = this.context.get(ErrorManager);

    const ctx: ErrorContext = {
      $type: 'feature',
      featureId: this.props.feature?.id,
      featureLabel: this.props.feature?.label,
      featureComponent: this.props.feature?.component,
      componentStack: info.componentStack,
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

    return this.props.children ?? <HorizontalSpinner />;
  }
}
