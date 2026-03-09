import 'reflect-metadata';

import {
  AbstractModule,
  DeploymentManager,
  ServiceDeploymentLoader,
  RemoteDeploymentLoader,
  Module,
  Manifest,
  ManifestProcessor,
  FeatureRegistry,
  RouterManager,
  DeploymentLoader,
  EmptyDeploymentLoader,
  LocalComponentLoader,
  PortalService, RemoteComponentLoader, I18NLoader,
  SessionManager,
  Authentication,
  SvgSpriteRegistry,
  OIDCUser,
  Session,
  Controller,
  command,
  OIDCAuthentication,
} from '@novx/portal';

import { applicationConfig } from "./environments/environments"

import { AssetTranslationLoader, LocaleManager, LocalStorageLocaleBackingStore, Translator, TranslatorBuilder } from '@novx/i18n';


import {
  TraceLevel,
  Tracer,
  ConsoleTrace,
  ConfigurationManager,
  ValueConfigurationSource,
  catchError,
  Environment,
  create,
  onRunning,
  Trace,
  TraceEntry,
  TraceFormatter,
  injectable,
  config, module, Module as DIModule,
  around,
  Invocation,
  methods,
  ErrorManager
} from '@novx/core';

import {
  EndpointLocator,
  PatternEndpointLocator
} from '@novx/communication';

import manifest from './manifest.json';

// funny trace

export class FooterTrace extends Trace {
  static entries : TraceEntry[] = []
  
  // constructor

  constructor(messageFormat: string) {
    super(new TraceFormatter(messageFormat));
  }

  // implement Trace

  /**
   * @inheritDoc
   */
  trace(entry: TraceEntry): void {
       FooterTrace.entries.push(entry)

   // FooterTrace.entries = [...FooterTrace.entries, entry]
  }
}

export interface LoginRequest {
  user?: string,
  password?: string
}

/**
 * No-op authentication service that returns a dummy user.
 */
export class DummyAuthentication implements Authentication<LoginRequest, OIDCUser, any> {
   async login(request: LoginRequest): Promise<Session<OIDCUser, any>> {
    return {
      user: {
        id: request.user,
        username: request.user,
        email: request.user + '@example.com',
        roles: ['user'],
        given_name: '',
        family_name: '',
        email_verified: '',
        name: '',
        preferred_username: '',
        sub: ''
      },
      ticket: {},
      sessionLocals: {}
    }
   }
  
   async start(): Promise<Session<OIDCUser, any> | null> {
    return null;
   }
    
   async logout(): Promise<void> {
    // noop
   }
}

// tracing

new Tracer({
  enabled: true,
  trace: new FooterTrace('%d [%p]: %m %f\n'), // %f
  paths: {
    application: TraceLevel.FULL,
    di: TraceLevel.FULL,
    portal: TraceLevel.FULL,
  },
});

// application module

@module({name: "config"})
class ApplicationConfigModule extends DIModule {
  // some factories

  @create()
  createConfigurationManager() : ConfigurationManager {
      return new ConfigurationManager(
          new ValueConfigurationSource(applicationConfig),
      );
  }

  // aspects for commands

  @around(methods().decoratedWith(command as any).thatAreSync())
  around(invocation: Invocation): any {
     const ctrl = invocation.target as Controller
     const name = invocation.method().name

     const start = performance.now()

     try {
       return invocation.proceed()
     }
     finally {
       const duration = performance.now() - start
       console.log(`< ${name} finished in ${duration.toFixed(2)} ms`)
       ctrl.enable(name)
     }
  }

  @around(methods().decoratedWith(command as any).thatAreAsync())
  async aroundAsync(invocation: Invocation): Promise<any> {
     const ctrl = invocation.target as Controller
     const name = invocation.method().name

     const start = performance.now()
     try {
       return await invocation.proceed()
     }
     finally {
       const duration = performance.now() - start
       console.log(`< ${name} finished in ${duration.toFixed(2)} ms`)
     }
   }
}

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
    return new SessionManager(new DummyAuthentication() )
    /*return new SessionManager(new OIDCAuthentication({
       url: "http://localhost:8080",
       realm: "service",
       clientId: "service-browser"
    }));*/
  }

  @create()
  createLocaleManager() : LocaleManager {
    const e = ErrorManager
    return new LocaleManager({
      locale: "de-DE",
      supportedLocales: ["de-DE", "en-US"],
      backingStore: new LocalStorageLocaleBackingStore("language"),
    })
  }

  @create()
  createTranslator(localeManager: LocaleManager) : Translator {
    const base = process.env.PUBLIC_URL || '/';

    return new TranslatorBuilder()
      .loader(new AssetTranslationLoader({ path: `${base}i18n/` }))
      .localeManager(localeManager)
      .build()
  }

  @create()
  createDeploymentLoader(portalService: PortalService, @config("deployment", "local") deployment : string) : DeploymentLoader {
    if (deployment == 'service')
      return new ServiceDeploymentLoader(portalService);

    else if (deployment == 'microfrontend')
      return new RemoteDeploymentLoader(applicationConfig.deployments[deployment].remotes);

    else return new EmptyDeploymentLoader()
  }

  @create()
  createDeploymentManager(loader: DeploymentLoader, featureRegistry: FeatureRegistry) : DeploymentManager {
      return new DeploymentManager({
        featureRegistry: featureRegistry,
        loader: loader,
        localManifest: manifest as Manifest,
        processor: new ManifestProcessor({
          hasFeature: (feature) => true,
          hasPermission: (permission) => true
        })
      });
  }

  @create()
  createEndpointLocator(@config("server.url") server: string) : EndpointLocator {
      return new PatternEndpointLocator({
          match: '.*',
          url: server,
        })
  }

  // lifecycle

  @onRunning()
  async onRunning(featureRegistry: FeatureRegistry, deploymentManager: DeploymentManager, sessionManager: SessionManager<any,any>, routerManager: RouterManager, errorManager: ErrorManager) {
     // error handler
     
     errorManager.registerHandler(this)

     // load deployment

      await deploymentManager.loadDeployment({
          application: "portal",
          client: deploymentManager.clientInfo(),
      });

      // set root

      routerManager.setRoot(() => (featureRegistry.finder()
        .withTag('portal')
        .withVisibility(sessionManager.hasSession() ? "private" : "public")
        .findOne()
      ))
  }

  // error handlers

  @catchError()
  public handleError(error: Error) {
    console.log(error)
  }

  @catchError()
  public handleAnyError(error: any) {
    console.log(error)
  }

  // lifecycle methods

  async setup() : Promise<void>  {
    // setup tracer

    Tracer.Trace('application', TraceLevel.LOW, 'setup');

    // sprites

    this.get(SvgSpriteRegistry).registerAll("shell", import.meta.webpackContext(
        './icons',
         {
          recursive: false,
          regExp: /\.svg$/
        }
    ));

    // session manager

    await this.get(SessionManager).start();

    // done

    await super.setup();
  }
}

// import loaders

const loaders = [RemoteComponentLoader, LocalComponentLoader, I18NLoader]

// create environment

export const createEnvironment = async () : Promise<Environment> => {
    // environment just for configuration values

    const configEnvironment = new Environment({module: ApplicationConfigModule})
    await configEnvironment.start();

    // the real environment

    const environment = new Environment({
        module: ApplicationModule,
        parent: configEnvironment
    })

    console.log(environment.report())

    await environment.start()

    // done

    return environment
}