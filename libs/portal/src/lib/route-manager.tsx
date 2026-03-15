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

// ─── debug helper ────────────────────────────────────────────────────────────

const DBG = {
  group: (label: string) => console.group(`%c[RouteManager] ${label}`, 'color:#6366f1;font-weight:bold'),
  end:   () => console.groupEnd(),
  log:   (...args: any[]) => console.log('%c[RouteManager]', 'color:#6366f1', ...args),
  warn:  (...args: any[]) => console.warn('%c[RouteManager]', 'color:#f59e0b', ...args),
}

// ─── PrivateRoute ─────────────────────────────────────────────────────────────

const PrivateRoute: React.FC<{ feature: FeatureMetadata; loginPath?: string; children: React.ReactNode }> = ({ feature, loginPath, children }) => {
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
// Defined at module level — stable type identity across renders.

const RoutesWrapper: React.FC<{ manager: RouterManager }> = ({ manager }) => {
  const [sessionManager] = useInject(SessionManager);
  const renderCount = React.useRef(0);
  renderCount.current++;

  DBG.log(`RoutesWrapper render #${renderCount.current}`);

  const [routes, setRoutes] = React.useState<RouteObjectWithFeature[]>(() => {
    DBG.log('RoutesWrapper: initial state factory — building routes');
    manager.root = manager.computeRoot();
    return manager.buildRouteObjects(manager.root);
  });

  React.useEffect(() => {
    DBG.log('RoutesWrapper: subscribing to session events');

    const sub = sessionManager.events$.subscribe((event) => {
      DBG.log(`RoutesWrapper: session event "${event.type}"`);

      if (event.type === "closed" || event.type === "opened") {
        DBG.log('RoutesWrapper: rebuilding routes after session change');
        manager.invalidateRouteCache();
        manager.root = manager.computeRoot();
        setRoutes(manager.buildRouteObjects(manager.root));
      }
    });

    return () => {
      DBG.log('RoutesWrapper: unsubscribing from session events');
      sub.unsubscribe();
    };
  }, [sessionManager]);

  return useRoutes(routes);
};

// ─── RouterManager ───────────────────────────────────────────────────────────

@injectable()
export class RouterManager {
  routeObjects: RouteObjectWithFeature[] = [];

  private featureListeners = new Set<FeatureChangeListener>();

  // Cache keyed by `featureId:hasSession`.
  // Stable JSX element references prevent React from remounting FeatureOutlets
  // on every navigation — only invalidated on session change.
  private routeCache = new Map<string, RouteObjectWithFeature>();

  computeRoot: () => FeatureMetadata = () => ({ id: "", component: "" });
  root: FeatureMetadata = this.computeRoot();

  constructor(private featureRegistry: FeatureRegistry, private sessionManager: SessionManager) {}

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

  public invalidateRouteCache() {
    DBG.log(`invalidateRouteCache — clearing ${this.routeCache.size} entries`);
    this.routeCache.clear();
  }

  // ── private: route building ──────────────────────────────────────────────────

  private buildOrReuse(
    feature: FeatureMetadata,
    hasSession: boolean,
    loginPath?: string
  ): RouteObjectWithFeature {
    const cacheKey = `${feature.id}:${hasSession}`;
    const cached = this.routeCache.get(cacheKey);

    if (cached) {
      DBG.log(`  ✓ reuse  [${cacheKey}]  element identity: ${(cached.element as any)?._owner ?? 'n/a'}`);
      return cached;
    }

    DBG.warn(`  ✗ create [${cacheKey}]  — new JSX element will be created`);

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
      children: (feature.children || []).map(c => {
        DBG.log(`    building child: ${c.id} (parent=${c.parent})`);
        return this.buildOrReuse(c, hasSession, loginPath);
      }),
    };

    this.routeCache.set(cacheKey, route);
    return route;
  }

  public buildRouteObjects(root: FeatureMetadata): RouteObjectWithFeature[] {
    DBG.group(`buildRouteObjects (root="${root.id}", cache size=${this.routeCache.size})`);

    const hasSession = this.sessionManager.hasSession();
    DBG.log('hasSession:', hasSession);

    const loginFeature = new FeatureFinder(this.featureRegistry).withTag("login").findOptional();
    const loginPath = loginFeature?.path ?? undefined;

    // ── ALL features in registry ──────────────────────────────────────────────
    const allFeatures = this.featureRegistry.filter(() => true);
    DBG.group('All registered features:');
    allFeatures.forEach(f =>
      DBG.log(`  id="${f.id}"  parent="${f.parent ?? 'none'}"  path="${f.path ?? 'none'}"  children=${f.children?.length ?? 0}`)
    );
    DBG.end();

    // ── top-level features (no parent, has path, not portal) ─────────────────
    const features = this.featureRegistry.filter((feature) => (
      feature !== root &&
      feature.path !== undefined &&
      feature.parent == undefined &&
      !(feature.tags || []).includes("portal")
    ));

    DBG.group('Top-level features (will become direct children of root route):');
    features.forEach(f =>
      DBG.log(`  id="${f.id}"  path="${f.path}"  children=${f.children?.length ?? 0}`)
    );
    DBG.end();

    // ── check for children that leaked into top-level ────────────────────────
    const leakedChildren = features.filter(f => f.id.includes('.'));
    if (leakedChildren.length) {
      DBG.warn(
        '⚠️  POTENTIAL BUG: these features have dotted ids (suggesting they are children) ' +
        'but have no parent set — they will appear at root level AND as nested routes:',
        leakedChildren.map(f => f.id)
      );
    }

    // ── build the route tree ──────────────────────────────────────────────────
    DBG.log('Building route tree...');

    const rootRoute = this.buildOrReuse(root, hasSession, loginPath);

    this.routeObjects = [
      {
        path: root.path || '',
        element: rootRoute.element,
        $feature: root,
        children: [
          ...features.map(f => {
            DBG.log(`  top-level route: "${f.id}" → path="${(f.path || '').replace(/^\//, '')}"`);
            return this.buildOrReuse(f, hasSession, loginPath);
          }),
          this.errorRoute,
        ],
      },
    ];

    // ── dump final route structure ────────────────────────────────────────────
    DBG.group('Final route structure:');
    const dumpRoutes = (routes: RouteObjectWithFeature[], indent = 0) => {
      const pad = '  '.repeat(indent);
      routes.forEach(r => {
        DBG.log(`${pad}path="${r.path}"  feature="${r.$feature?.id}"  hasChildren=${r.children?.length ?? 0}`);
        if (r.children?.length) dumpRoutes(r.children as RouteObjectWithFeature[], indent + 1);
      });
    };
    dumpRoutes(this.routeObjects);
    DBG.end();

    DBG.log(`Cache now has ${this.routeCache.size} entries:`, [...this.routeCache.keys()]);
    DBG.end(); // buildRouteObjects group

    return this.routeObjects;
  }

  // Stable catch-all — created once, never recreated
  private readonly errorRoute: RouteObjectWithFeature = {
    path: '*',
    element: <ErrorPage />,
    $feature: { id: '__error', component: '' },
  };

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