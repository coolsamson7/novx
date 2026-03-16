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

const base = document.querySelector('base')?.getAttribute('href') || "/"

// ─── PrivateRoute ─────────────────────────────────────────────────────────────

const PrivateRoute: React.FC<{
  feature: FeatureMetadata;
  loginPath?: string;
  children: React.ReactNode;
}> = ({ feature, loginPath, children }) => {
  const [sessionManager] = useInject(SessionManager);
  const location = useLocation();

  const [hasSession, setHasSession] = React.useState(sessionManager.hasSession());
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const sub = sessionManager.events$.subscribe(() => {
      setHasSession(sessionManager.hasSession());
    });
    return () => sub.unsubscribe();
  }, [sessionManager]);

  React.useEffect(() => {
    if (hasSession) return;
    if (location.pathname !== feature.path) return;

    sessionStorage.setItem('intendedRoute', location.pathname);

    if (!loginPath) {
      sessionManager.openSession({}).catch((err: any) => {
        setError(err.message || 'Login failed');
      });
    }
  }, [hasSession, location.pathname]);

  if (!hasSession) {
    if (loginPath) return <Navigate to={loginPath} replace />;
    return <div>🔐 Verifying authentication...</div>;
  }

  if (error) return <div>⚠️ {error}</div>;

  return <>{children}</>;
};

// ─── types ───────────────────────────────────────────────────────────────────

export type RouteObjectWithFeature = RouteObject & {
  $feature: FeatureMetadata;
  children?: RouteObjectWithFeature[];
}

export type FeatureChangeListener = (feature: FeatureMetadata) => void;

// ─── RouteChangeNotifier ─────────────────────────────────────────────────────

@injectable()
export class RouteChangeNotifier {
  private listeners = new Set<(location: any) => void>();

  subscribe(listener: (location: any) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(location: any) {
    for (const listener of this.listeners) {
      try { listener(location); }
      catch (err) { console.error("Route listener failed", err); }
    }
  }
}

// ─── RouteChangeListener ─────────────────────────────────────────────────────

const RouteChangeListener: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [notifier] = useInject(RouteChangeNotifier);

  React.useEffect(() => {
    notifier.notify(location);
  }, [location]);

  return <>{children}</>;
};

// ─── RoutesWrapper ───────────────────────────────────────────────────────────
//
// Defined at module level — stable component type identity across renders.
// Rebuilds routes atomically on session open/close.

const RoutesWrapper: React.FC<{ manager: RouterManager }> = ({ manager }) => {
  const [sessionManager] = useInject(SessionManager);

  const [sessionKey, setSessionKey] = React.useState(0);  // ← forces full remount

  const [routes, setRoutes] = React.useState<RouteObjectWithFeature[]>(() => {
    manager.root = manager.computeRoot();
    return manager.buildRouteObjects(manager.root);
  });

  React.useEffect(() => {
    const sub = sessionManager.events$.subscribe((event) => {
      if (event.type === "closed" || event.type === "opened") {
        manager.invalidateRouteCache();
        manager.root = manager.computeRoot();
        setRoutes(manager.buildRouteObjects(manager.root));
        setSessionKey(k => k + 1);  // ← bumping this remounts the entire route tree
      }
    });
    return () => sub.unsubscribe();
  }, [sessionManager]);

  return <RoutesInner key={sessionKey} routes={routes} />;
};

// Separate component so the key applies to useRoutes, not to the effect
const RoutesInner: React.FC<{ routes: RouteObjectWithFeature[] }> = ({ routes }) => {
  return useRoutes(routes);
};

// ─── RouterManager ───────────────────────────────────────────────────────────

@injectable()
export class RouterManager {
  routeObjects: RouteObjectWithFeature[] = [];

  private featureListeners = new Set<FeatureChangeListener>();

  // Cache keyed by `featureId:hasSession`.
  //
  // Reusing the same JSX element reference across navigations prevents React
  // from unmounting and remounting FeatureOutlet instances — which was the
  // root cause of the white-flash / flicker on every child route change.
  //
  // The cache is invalidated (cleared) whenever session state changes so
  // that private-route wrappers are rebuilt with the correct session context.
  private routeCache = new Map<string, RouteObjectWithFeature>();

  computeRoot: () => FeatureMetadata = () => ({ id: "", component: "" });
  root: FeatureMetadata = this.computeRoot();

  constructor(
    private featureRegistry: FeatureRegistry,
    private sessionManager: SessionManager
  ) {}

  // ── public ──────────────────────────────────────────────────────────────────

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
      try { listener(feature); }
      catch (err) { console.error('FeatureChangeListener failed', err); }
    }
  }

  /**
   * Clear the route element cache.
   * Must be called before rebuilding routes after a session change so that
   * PrivateRoute / plain-FeatureOutlet elements are recreated with the
   * correct hasSession value.
   */
  public invalidateRouteCache() {
    this.routeCache.clear();
  }

  // ── private: route building ──────────────────────────────────────────────────

  /**
   * Return a cached RouteObjectWithFeature for `feature`, or build and cache
   * a new one.  The cache key includes `hasSession` so that the correct
   * element variant (with or without PrivateRoute) is used after login/logout.
   */
  private buildOrReuse(
    feature: FeatureMetadata,
    hasSession: boolean,
    loginPath?: string
  ): RouteObjectWithFeature {
    const cacheKey = `${feature.id}:${hasSession}`;
    const cached = this.routeCache.get(cacheKey);
    if (cached) return cached;

    const isPrivate =
      feature.visibility &&
      feature.visibility.includes('private') &&
      !feature.visibility.includes('public');

    const element = (isPrivate && !hasSession) ? (
      <PrivateRoute feature={feature} loginPath={loginPath}>
        <FeatureOutlet id={feature.id} />
      </PrivateRoute>
    ) : (
      <FeatureOutlet id={feature.id} />
    );

    const routePath = (feature.path || '').replace(/^\//, '');

    const route: RouteObjectWithFeature = {
      path: routePath,
      element,
      $feature: feature,
      children: (feature.children || []).map(c =>
        this.buildOrReuse(c, hasSession, loginPath)
      ),
    };

    this.routeCache.set(cacheKey, route);
    return route;
  }

  // Stable catch-all element — created once, never recreated.
  private readonly errorRoute: RouteObjectWithFeature = {
    path: '*',
    element: <ErrorPage />,
    $feature: { id: '__error', component: '' },
  };

  public buildRouteObjects(root: FeatureMetadata): RouteObjectWithFeature[] {
    if (Tracer.ENABLED)
      Tracer.Trace('portal', TraceLevel.HIGH, 'building routes');

    const hasSession = this.sessionManager.hasSession();

    const loginFeature = new FeatureFinder(this.featureRegistry)
      .withTag("login")
      .findOptional();
    const loginPath = loginFeature?.path ?? undefined;

    // Top-level features: has a path, no parent, not tagged "portal"
    const features = this.featureRegistry.filter((feature) => (
      feature !== root &&
      feature.path !== undefined &&
      feature.parent == undefined &&
      !(feature.tags || []).includes("portal")
    ));

    const rootRoute = this.buildOrReuse(root, hasSession, loginPath);

    this.routeObjects = [
      {
        path: root.path || '',
        element: rootRoute.element,
        $feature: root,
        children: [
          ...features.map(f => this.buildOrReuse(f, hasSession, loginPath)),
          this.errorRoute,
        ],
      },
    ];

    if (Tracer.ENABLED)
      Tracer.Trace(
        'portal',
        TraceLevel.HIGH,
        'route tree: {0}',
        JSON.stringify(
          this.routeObjects,
          (key, value) => key === 'element' ? '[React Element]' : value,
          2,
        )
      );

    return this.routeObjects;
  }

  public renderRouter() {
    return (
      <BrowserRouter basename={base}>
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