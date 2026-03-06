# Portal

## Introduction

Portal implements a react portal framework supporting microfrontends vastly simplifying implementation efforts since a number of technical challenges every application has to solve are already part of the framework.
- integration of a DI solution
- centralized error handling ( including error boundaries )
- session handling
- i18n integration
- meta-data based approach that allows for
    - filtering of available features according to authentication, authorization or other aspects ( e.g. feature flags )
    - automatic router configuration according to the metadata
    - dynamic navigation features that are based on the meta-data and custom rules
    - feature outlets that cover both local and federated components and allow for custom async preloading logic ( e.g. i18n loading )
- custom application configurations with support for both client and server side logic

While the framework supports enterprise portals with dynamic microfrontends - and server side configuration mechanisms - as one extreme it also covers small local only applications without significant coding and rampup overhead, making it a one-size-fits-all framework.

The main idea for most of the mechanisms is that modules expose meta-data of "what is inside", by annotating available "features" ( named components used internally or part of the routing ) with special decorators that can be parsed and extracted.

```ts
@Feature({
  id: 'public-navigation',
  label: 'Navigation',
  visibility: ["public"],
  features: ["feature-a"],
  permissions: []
  tags: ['portal'],
  path: '/'
})
export class PublicNavigationFeature extends React.Component {
    ...
}
```

A parser - as part of the build - will locate those features and generate a `manifest.json`.

```json
{
  "id": "shell",
  "label": "Shell",
  "version": "1.0.0",
  "moduleName": "ApplicationModule",
  "sourceFile": "apps/shell/src/main.tsx",
  "description": "Shell",
  "features": [
     {
      "id": "public-navigation",
      "label": "Navigation",
      "path": "",
      "visibility": [
        "public"
      ],
      "tags": [
        "portal"
      ],
      "features": [
        "feature-a"
      ],
      "permissions": [
      ],
      "component": "PublicNavigationFeature",
      "sourceFile": "apps/shell/src/PublicNavigation.tsx",
      "children": []
    },
    ...
  ],
  ...
}
```

which can either be used locally or registered via a server component.

Let's see how to boot an application. First thing we need to do is to setup the di container and add a couple of instances
inside of the main "module"
```ts

import manifest from './manifest.json';

@Module({
  id: 'shell',
  label: 'Shell',
  version: '1.0.0',
  description: 'Shell',
  name: '',
})
export class ApplicationModule extends AbstractModule {
  @create()
  createSessionManager() : SessionManager<any,any> {
    return new SessionManager(new DummyAuthentication()); // for now, would be OIDC in reality
  }

  @create()
  createDeploymentManager(featureRegistry: FeatureRegistry) : DeploymentManager {
      return new DeploymentManager(
        featureRegistry: featureRegistry,
        loader: new EmptyDeploymentLoader(), // only local, so far 
        localManifest: manifest as Manifest // that's the local generated manifest.json
      );
  }

  // lifecycle

  @onRunning()
  async onRunning(featureRegistry: FeatureRegistry, deploymentManager: DeploymentManager, sessionManager: SessionManager<any,any>, routerManager: RouterManager) {
      // load deployment

      await deploymentManager.loadDeployment({
          application: "portal",
          client: deploymentManager.clientInfo(),
      });

      // the root if the router will be a feature with tag "portal" and the correct visibility

      routerManager.setRoot(featureRegistry.finder()
        .withTag('portal')
        .matchingSession(sessionManager.hasSession()) // we typically define two separate root pages, a public and a private!
        .findOne());

      // restore existing session
        
      await sessionManager.init();
    }
}

// create environment

export const createEnvironment = async () : Promise<Environment> => {
    const environment = new Environment({module: ApplicationModule})

    await environment.start()

    return environment
}
```

The crucial parts are
- the `DeploymentManager` which is responsible to compute a merged `manifest.json`. Since we are still completely local,
  it will only return the local `manifest.json`
- A `FeatureRegistry` collects all features and will be filled with the gathered information of the deployment manager.  Since it knows about all registered components - local or remote -
  a `<FeatureOutlet>` component is now available that renders any registered feature by name, which is the basis for a number of mechanisms.
- The `RoutingManager` will compute dynamic routes based on the provided features and a handpicked "root" feature
  The routing logic will simply pick all features that have a defined "path" and add them as children - inserting a feature outlet - to the desired
  root feature, which in this case has a defined tag "portal" and has a visibility property that matches the current session state.

Launching the application is now just a couple lines of code.

```ts
const environment = await createEnvironment();

const root = createRoot(document.getElementById('root')!);
root.render(
    <EnvironmentContext.Provider value={environment}>
      <App />
    </EnvironmentContext.Provider>
    );
```

while the application

```ts
export class App extends React.Component {
    routerManager!: RouterManager;

    static contextType = EnvironmentContext

    declare context: Environment

    async componentDidMount() { 
        this.routerManager = this.context.get(RouterManager);
    }

    override render() {
        return (
            this.routerManager.renderRouter()
        );
    }
}
```

simply delegates to rendering to the defined routes. So what is the root?
Well, a specific feature which acts as the main page typically offering navigation possibilities ( as a side bar ).

The interesting part, is that since we already have the complete meta-data available, we dont need to hardcode the navigation entries anymore,
but can rely on a couple of conventions to list the available routes.

Example:

```ts
const features = featureRegistry.finder()
    .withPath()
    .withoutParent()
    .matchingSession(sessionManager.hasSession())
    .withTag('menu')
    .find();
```

In this case all features, that have the corresponding visibility status matching the session state and have a tag "menu", will be listed
as corresponding `<Link>`s.

Isn't that awsome?

Ok, but we promised microfrontends as well, were are they?

Federated modules will take a similar approach, by defining a root module, exposing a `manifest.json`, etc.
The main application will only need to change the corresponding deployment loader to integrate it.
```ts
  return new RemoteDeploymentLoader([
        { name: 'microfrontend', url: 'http://localhost:3001' },
      ]);
```
In this case, the manifest is fetched dynamically from the known url and merged with the local manifest.

This is good enough for a local environment used for development purposes, in production the logic would be handed over to a
server component that is aware of different microfrontends and configurations also including more sophisticated logic to filter
features according to feature flags, etc.

## Showcase

A showcase app shows a shell and a microfreontend.

<img width="2634" height="1852" alt="image" src="https://github.com/user-attachments/assets/b5886a58-2e9a-4196-b0ae-d60f62587fcc" />

## Wiki

More detailed information can be found [here](https://github.com/coolsamson7/novx/wiki/Portal)

## API Docs

The complete APIs can be found [here](http://ernstandreas.de/novx/)
