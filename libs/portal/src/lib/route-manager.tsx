import {injectable} from "@novx/core";
import React from "react";
import {BrowserRouter, RouteObject, useLocation, useRoutes, Navigate} from "react-router-dom";
import { FeatureRegistry, FeatureFinder } from './feature-registry';

import type { FeatureMetadata } from './feature-registry';

import { FeatureOutlet } from "./feature-outlet";
import { TraceLevel, Tracer } from '@novx/core';
import { SessionManager } from './session/session-manager';
import { useInject } from "./environment";
import { ErrorPage } from "./component/error-page";

// guard for private routes

const PrivateRoute: React.FC<{ feature: FeatureMetadata; loginPath?: string; children: React.ReactNode }> = ({ feature, loginPath, children }) => {
  const [sessionManager] = useInject(SessionManager);
  const location = useLocation();

  const [hasSession, setHasSession] = React.useState(
    sessionManager.hasSession()
  );

  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const sub = sessionManager.events$.subscribe(() => {
      setHasSession(sessionManager.hasSession());
    });

    return () => sub.unsubscribe();
  }, [sessionManager]);

  React.useEffect(() => {

    const isActive = location.pathname === feature.path;

    if (!hasSession && isActive) {

      sessionStorage.setItem('intendedRoute', location.pathname);

      // If there is no internal login page, fall back to OIDC
      if (!loginPath) {
        sessionManager.openSession().catch((err: any) => {
          setError(err.message || 'Login failed');
        });
      }
    }

  }, [hasSession, feature.id, location.pathname]);

  if (!hasSession) {

    // Internal login page available
    if (loginPath) {
      return <Navigate to={loginPath} replace />;
    }

    return <div>🔐 Verifying authentication...</div>;
  }

  if (error) {
    return <div>⚠️ {error}</div>;
  }

  return <>{children}</>;
};

export type RouteObjectWithFeature = RouteObject & {
  $feature: FeatureMetadata;
  children?: RouteObjectWithFeature[];
}

export type FeatureChangeListener = (feature: FeatureMetadata) => void;

@injectable()
export class RouteChangeNotifier {
  private listeners = new Set<(location: any) => void>();

  subscribe(listener: (location: any) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(location: any) {
    for (const listener of this.listeners) {
      try {
        listener(location);
      } catch (err) {
        console.error("Route listener failed", err);
      }
    }
  }
}

const RouteChangeListener: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [notifier] = useInject(RouteChangeNotifier);

  React.useEffect(() => {
    notifier.notify(location);
  }, [location]);

  return <>{children}</>;
};

/* ======================================================
 * RoutesWrapper — defined at module level so its type is
 * stable across renders (no remount on login/logout).
 * Holds the route tree in React state so updates are
 * atomic: rebuild + re-render happen in one batch.
 * ====================================================== */

const RoutesWrapper: React.FC<{ manager: RouterManager }> = ({ manager }) => {
  const [sessionManager] = useInject(SessionManager);

  // Initialise with the current root's route tree
  const [routes, setRoutes] = React.useState<RouteObjectWithFeature[]>(() => {
    manager.root = manager.computeRoot();
    return manager.buildRouteObjects(manager.root);
  });

  React.useEffect(() => {
    sessionManager.events$.subscribe((event) => {
      if ( event.type == "closed" || event.type == "opened" ) {
          // Recompute root (may differ after login / logout)
          manager.root = manager.computeRoot();
          // Rebuild and push into state atomically
          setRoutes(manager.buildRouteObjects(manager.root));
      }
    });
  }, [sessionManager]);

  return useRoutes(routes);
};

/* ======================================================
 * RouterManager
 * ====================================================== */

@injectable()
export class RouterManager {
  // instance data — made accessible to RoutesWrapper above

  routeObjects: RouteObjectWithFeature[] = [];
  private featureListeners = new Set<FeatureChangeListener>();

  computeRoot: () => FeatureMetadata = () => ({
    id: "",
    component: ""
  });

  root: FeatureMetadata = this.computeRoot()

  // constructor

  constructor(private featureRegistry: FeatureRegistry, private sessionManager: SessionManager) {
  }

  // public

  setRoot(root: () => FeatureMetadata) {
    this.computeRoot = root;
    this.root = root();
  }

  onFeatureChange(listener: FeatureChangeListener): () => void {
    this.featureListeners.add(listener);
    return () => this.featureListeners.delete(listener);
  }

  emitFeatureChange(feature: FeatureMetadata) {
    for (const listener of this.featureListeners) {
      try {
        listener(feature);
      } catch (err) {
        console.error('FeatureChangeListener failed', err);
      }
    }
  }

  // Public so RoutesWrapper can call it directly
  public buildRouteObjects(root: FeatureMetadata): RouteObjectWithFeature[] {
    if (Tracer.ENABLED)
      Tracer.Trace('portal', TraceLevel.HIGH, 'building routes');

    const hasSession = this.sessionManager.hasSession()

    // Find login feature by tag

    const loginFeature = new FeatureFinder(this.featureRegistry).withTag("login").findOptional();

    const loginPath = loginFeature?.path ?? undefined;

    const features = this.featureRegistry.filter((feature) =>(
                feature !== root &&
                feature.path !== undefined &&
                feature.parent == undefined &&
                !(feature.tags || []).includes("portal")));

    const build = (feature: FeatureMetadata): RouteObjectWithFeature => {
      const isPrivate = feature.visibility && feature.visibility.includes('private') && !feature.visibility.includes('public');

      const element = (isPrivate && !hasSession) ? (
        <PrivateRoute feature={feature} loginPath={loginPath}>
          <FeatureOutlet featureId={feature.id} />
        </PrivateRoute>
      ) : (
        <FeatureOutlet featureId={feature.id} />
      );

      // Strip leading slash from path to make it relative for nested routes
      const routePath = (feature.path || '').replace(/^\//, '');

      return {
        path: routePath,
        element: element,
        $feature: feature,
        children: (feature.children || []).map(build),
      };
    };

    this.routeObjects = [
      {
        path: root.path || '',
        element: <FeatureOutlet key={root.id} featureId={root.id} />,
        $feature: root,
        children: [
          ...features.map(build),
          // Catch-all error route for undefined paths
          {
            path: '*',
            element: <ErrorPage />,
            $feature: root,
          },
        ],
      },
    ];

    console.log(
      '### Route tree:',
      JSON.stringify(
        this.routeObjects,
        (key, value) => {
          if (key === 'element') return '[React Element]';
          return value;
        },
        2,
      ),
    );

    return this.routeObjects;
  }

  public renderRouter() {
    return (
      <BrowserRouter>
        <RouteChangeListener>
          <RoutesWrapper manager={this} />
        </RouteChangeListener>
      </BrowserRouter>
    );
  }

  public getRouteObjects(): RouteObjectWithFeature[] {
    if (this.routeObjects.length === 0)
      this.buildRouteObjects(this.root);

    return this.routeObjects;
  }
}