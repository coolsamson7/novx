/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * The Environment class is the central component of the dependency injection system.
 * It manages instances and their lifecycles.
 */

import { DecoratorDescriptor, MethodDescriptor, TypeDescriptor } from '../reflection';
import { TraceLevel, Tracer } from '../tracer';

/**
 * Scope interface representing how instance lifecycle is managed
 */
export interface Scope {
  get<T>(provider: AbstractInstanceProvider<T>, environment: Environment, argProvider: () => any[]): T;
}

/**
 * Abstract provider interface responsible for creating instances
 */
export abstract class AbstractInstanceProvider<T = any> {

  /**
   * Return the class which is responsible for creation (e.g. the injectable class)
   */
  getHost(): any {
    return this.constructor;
  }

  getModule() : string {
    return ""
  }

  /**
   * Return the type of the created instance
   */
  abstract getType(): { new(...args: any[]): T } | { prototype: any };

  /**
   * Return true if the provider will eagerly construct instances
   */
  abstract isEager(): boolean;

  /**
   * Return the scope name
   */
  abstract getScope(): string;

  /**
   * Return the types that this provider depends on (for constructor or setter injection)
   * The second element is the number of parameters that a construction injection will require
   */
  getDependencies(): [any[], number] {
    return [[], 1];
  }

  /**
   * Create a new instance
   * @param environment The Environment
   * @param args The required arguments
   */
  abstract create(environment: Environment, ...args: any[]): T;

  /**
   * Return a string representation of this provider
   */
  report(): string {
    return this.toString();
  }


  /**
   * Check for additional factories
   */
  checkFactories(): void { 
    // noop
  }
}


// Static registry of providers

export class Providers {
  static check: AbstractInstanceProvider<any>[] = [];
  static providers: Map<any, AbstractInstanceProvider<any>[]> = new Map();
  static resolved = false;

  static registerClass(module: string, clazz:  new (...args: any[]) => any,  eager = true,
  scope = "singleton"): void {
      Providers.register(new ClassInstanceProvider(module, clazz, eager, scope));
  }

  static register(provider: AbstractInstanceProvider<any>): void {
    const type = provider.getType();

    Providers.check.push(provider);

    const candidates = Providers.providers.get(type);
    if (!candidates) {
      Providers.providers.set(type, [provider]);
    }
    else {
      candidates.push(provider);
    }
  }

  static isRegistered(type: any): boolean {
    return Providers.providers.has(type);
  }

  static checkFactories(): void {
    for (const check of Providers.check) {
      check.checkFactories();
    }

    Providers.check = [];
  }

  static filter(
    environment: Environment,
    providerFilter: (provider: AbstractInstanceProvider<any>) => boolean
  ): Map<any, AbstractInstanceProvider<any>> {
    const cache: Map<any, AbstractInstanceProvider<any>> = new Map();

    Providers.checkFactories(); // Check for additional factories

    // Local helper functions

    function filterType(clazz: any): AbstractInstanceProvider<any> | null {
      let result = null;

      for (const provider of Providers.providers.get(clazz) || []) {
        if (providerApplies(provider)) {
          if (result !== null) {
            throw new ProviderCollisionException(
              `Type ${clazz.name || 'unknown'} already registered`,
              result,
              provider
            );
          }
          result = provider;
        }
      }

      return result;
    }

    function providerApplies(provider: AbstractInstanceProvider<any>): boolean {
      // Is it in the right module?

      if (!providerFilter(provider)) {
        return false;
      }

      return true;
    }

    function isInjectable(type: any): boolean {
      if (!type || type === Object) {
        return false;
      }

      return true;
    }

    function cacheProviderForType(provider: AbstractInstanceProvider<any>, type: any): void {
      const existingProvider = cache.get(type);

      if (!existingProvider) {
        cache.set(type, provider);
      }
      else {
        if (type === provider.getType()) {
          throw new ProviderCollisionException(
            `Type ${type.name || 'unknown'} already registered`,
            existingProvider,
            provider
          );
        }

        if (existingProvider.getType() !== type) {
          // Only overwrite if the existing provider is not specific
          if (existingProvider instanceof AmbiguousProvider) {
            (existingProvider as AmbiguousProvider<any>).addProvider(provider);
          } else {
            cache.set(type, new AmbiguousProvider(type, existingProvider, provider));
          }
        }
      }

      // recursion for base classes

      if (type.prototype) {
        const proto = Object.getPrototypeOf(type.prototype);
        if (proto && proto.constructor && isInjectable(proto.constructor)) {
          cacheProviderForType(provider, proto.constructor);
        }
      }
    }

    // filter conditional providers and fill base classes as well

    for (const [providerType] of Providers.providers) {
      const matchingProvider = filterType(providerType);

      // NEW! NO!!!!
      //if (environment.parent?.isRegisteredType(providerType))
      //    continue;

      if (matchingProvider) {
        cacheProviderForType(matchingProvider, providerType);
      }
    }

    // replace by EnvironmentInstanceProvider

    const mapped = new Map<AbstractInstanceProvider<any>, EnvironmentInstanceProvider<any>>();
    const result: Map<any, EnvironmentInstanceProvider<any>> = new Map();

    for (const [providerType, provider] of cache.entries()) {
      let environmentProvider = mapped.get(provider);

      if (!environmentProvider) {
        environmentProvider = new EnvironmentInstanceProvider(environment, provider);
        mapped.set(provider, environmentProvider);
      }

      result.set(providerType, environmentProvider);
    }

    // And resolve
    let providers: Map<any, AbstractInstanceProvider<any>> = result;

    if (environment.parent) {
      // Combine with parent providers
      providers = new Map([...environment.parent.getProviders(), ...providers]) ;
    }

    const providerContext = new ResolveContext(providers);

    for (const provider of mapped.values()) {
      provider.resolve(providerContext);
    }

    return result;
  }
}


/**
 * Base exception for all DI-related errors
 */
export class DIException extends Error {
  constructor(message: string) {
    super(message);

    Object.setPrototypeOf(this, new.target.prototype); // Restore prototype chain (important when targeting ES5)
    this.name = this.constructor.name;
  }
}

/**
 * Exception raised during the registration of dependencies
 */
export class DIRegistrationException extends DIException {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Exception raised when there are multiple providers for the same type
 */
export class ProviderCollisionException extends DIRegistrationException {
  providers: AbstractInstanceProvider<any>[];

  constructor(message: string, ...providers: AbstractInstanceProvider<any>[]) {
    super(message);

    this.providers = providers;
  }

  override toString(): string {
    return `[${this.message} ${this.providers[1]} collides with ${this.providers[0]}]`;
  }
}

/**
 * Exception raised during the runtime
 */
export class DIRuntimeException extends DIException {
  constructor(message: string) {
    super(message);
  }
}

// scopes

/**
 * Registry for scope implementations
 */
export class Scopes {
  private static scopes: Record<string, any> = {};

  /**
   * Get a scope instance from the environment
   */
  static get(scopeName: string, environment: Environment): Scope {
    const scopeType = Scopes.scopes[scopeName];

    if (!scopeType) {
      throw new Error(`Unknown scope type ${scopeName}`);
    }

    return environment.get<Scope>(scopeType);
  }

  /**
   * Register a scope type with a name
   */
  static register(scopeType: any, name: string): void {
    Scopes.scopes[name] = scopeType;
  }
}


/**
 * Lifecycle phases that can be processed by lifecycle processors
 */
export enum Lifecycle {
  ON_INJECT = 0,
  ON_INIT = 1,
  ON_RUNNING = 2,
  ON_DESTROY = 3
}

/**
 * Base class for lifecycle processors
 */
export abstract class LifecycleProcessor {
  order = 0;

  constructor() {
    if (TypeDescriptor.forType(this.constructor as any).hasDecorator(order)) {
      this.order = TypeDescriptor.forType(this.constructor as any).getDecorator(order)?.arguments[0] || 0;
    }
  }

  /**
   * Process a lifecycle event
   */
  abstract processLifecycle(lifecycle: Lifecycle, instance: any, environment: Environment): any;

  /**
   * Process a lifecycle event asynchronously
   * Default implementation calls the sync version
   */
  async processLifecycleAsync(lifecycle: Lifecycle, instance: any, environment: Environment): Promise<any> {
    return this.processLifecycle(lifecycle, instance, environment);
  }
}

/**
 * Base class for custom post processors executed after object creation
 */
export abstract class PostProcessor extends LifecycleProcessor {
  abstract process(instance: any, environment: Environment): void;

  override processLifecycle(lifecycle: Lifecycle, instance: any, environment: Environment): any {
    if (lifecycle === Lifecycle.ON_INIT) {
      this.process(instance, environment);
    }
    return instance;
  }
}

/**
 * Lifecycle callable handler class
 */
export class LifecycleCallable {
  lifecycle: Lifecycle;
  order = 0;

  constructor(public decorator: any, lifecycle: Lifecycle) {
    this.lifecycle = lifecycle;

    if (TypeDescriptor.forType(this.constructor as any).hasDecorator(order)) {
      this.order = TypeDescriptor.forType(this.constructor as any).getDecorator(order)?.arguments[0] || 0;
    }

    AbstractCallableProcessor.register(this);
  }

  args(decorator: DecoratorDescriptor, method: MethodDescriptor, environment: Environment, instance?: any): any[] {
    return [];
  }
}

/**
 * Represents a method call during a lifecycle phase
 */
export class MethodCall {
  constructor(
    public method: MethodDescriptor,
    public decorator: DecoratorDescriptor,
    public lifecycleCallable: LifecycleCallable
  ) {}

  execute(instance: any, environment: Environment): any {
    const args = this.lifecycleCallable.args(this.decorator, this.method, environment, instance);

    return (instance as any)[this.method.name](...args);

    //return this.method.method.apply(instance, args);
  }

  async executeAsync(instance: any, environment: Environment): Promise<any> {
    const args = this.lifecycleCallable.args(this.decorator, this.method, environment, instance);

    return await (instance as any)[this.method.name](...args); //this.method.method.apply(instance, args);
  }

  // override

  toString(): string {
    return `MethodCall(${this.method.name})`;
  }
}

/**
 * Processor for method calls during lifecycle phases
 */
export class AbstractCallableProcessor extends LifecycleProcessor {
  // Static registry of callables
  private static callables: Map<any, LifecycleCallable> = new Map();
  private static cache: Map<any, Array<MethodCall[]>> = new Map();

  static register(callable: LifecycleCallable): void {
    AbstractCallableProcessor.callables.set(callable.decorator, callable);
  }

  static computeCallables(type: any): Array<MethodCall[]> {
    const result: Array<MethodCall[]> = [[], [], [], []];  // per lifecycle

    const descriptor = TypeDescriptor.forType(type)

    for ( const method of descriptor.getMethods()) {
        for (const decorator of method.decorators) {
            const callable = AbstractCallableProcessor.callables.get(decorator.decorator);
            if (callable) // any callable for this decorator?
                result[callable.lifecycle].push(
                    new MethodCall(method, decorator, callable))
            }
      }

    // Sort according to order

    for (let i = 0; i < 4; i++) {
      result[i].sort((a, b) => a.lifecycleCallable.order - b.lifecycleCallable.order);
    }

    return result;
  }

  static callablesFor(type: any): Array<MethodCall[]> {
    let callables = AbstractCallableProcessor.cache.get(type);

    if (!callables) {
      callables = AbstractCallableProcessor.computeCallables(type);
      AbstractCallableProcessor.cache.set(type, callables);
    }

    return callables;
  }

  constructor(private lifecycle: Lifecycle) {
    super();
  }

  override processLifecycle(lifecycle: Lifecycle, instance: any, environment: Environment): any {
    if (lifecycle === this.lifecycle) {
      const callables = AbstractCallableProcessor.callablesFor(instance.constructor);

      for (const callable of callables[lifecycle]) {
        callable.execute(instance, environment);
      }
    }

    return instance;
  }

  override async processLifecycleAsync(lifecycle: Lifecycle, instance: any, environment: Environment): Promise<any> {
    if (lifecycle === this.lifecycle) {
      const callables = AbstractCallableProcessor.callablesFor(instance.constructor);

      for (const callable of callables[lifecycle]) {
        await callable.executeAsync(instance, environment);
      }
    }

    return instance;
  }
}




// decorators

/**
 * Set the order priority for lifecycle processors
 */
export function order(prio = 0): ClassDecorator {
  return (target: any) => {
    TypeDescriptor.forType(target).addDecorator(order, prio);

    return target;
  };
}

/**
 * Mark a class as injectable
 */
 export interface InjectableOptions {
   eager?: boolean;
   scope?: string;
   module?: string;
   location?: string
 }

export function injectable(options: InjectableOptions = {}): ClassDecorator {
  return (target: any) => {
    const { eager = true, scope = "singleton", module = ""} = options;

    TypeDescriptor.forType(target).addDecorator(injectable, eager, scope);

    Providers.registerClass(module, target, eager, scope);

    return target;
  };
}


/**
 * Mark a method as a factory method
 */

 export interface CreateOptions {
    eager?: boolean;
    scope?: string;
 }

export function create(options: CreateOptions = {}): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const { eager = true, scope = "singleton" } = options;

    const typeDescriptor = TypeDescriptor.forType(target.constructor);

    typeDescriptor.addMethodDecorator(target, propertyKey.toString(), create as any, eager, scope);

    return descriptor;
  };
}

/**
 * Methods annotated with @on_init will be called when the instance is created
 */
export function onInit(): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const typeDescriptor = TypeDescriptor.forType(target.constructor);

    typeDescriptor.addMethodDecorator(target, propertyKey.toString(), onInit as any);

    return descriptor;
  };
}

/**
 * Methods annotated with @on_running will be called when the container is up and running
 */
export function onRunning(): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const typeDescriptor = TypeDescriptor.forType(target.constructor);

    typeDescriptor.addMethodDecorator(target, propertyKey.toString(), onRunning as any);

    return descriptor;
  };
}

/**
 * Methods annotated with @on_destroy will be called when the instance is destroyed
 */
export function onDestroy(): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const typeDescriptor = TypeDescriptor.forType(target.constructor);

    typeDescriptor.addMethodDecorator(target, propertyKey.toString(), onDestroy as any);

    return descriptor;
  };
}





export interface ModuleOptions {
  /**
   * the name of the module, or "" if not supplied
   */
   name?: string;
   /**
    * optional list iof imported moudes
    */
   imports?: any[];
   // internal actually
   register?: boolean;
   type?: any;
   accepts?: Set<string>
}

/**
 * Base class for module classes.
 */
export class Module {
  static resolved = false
  static byType: Map<any, ModuleOptions> = new Map();
  static byName: Map<string, ModuleOptions> = new Map();

  static register(target: any, options: ModuleOptions) {
    Module.byType.set(target, options)
    if (options.name)
        Module.byName.set(options.name, options)

  
    Module.resolved = false;
  }

  static resolve() {
    if (!Module.resolved) {
      Module.resolved = true;

      const cache = new Map<any, Set<string>>();

      // local function

      const collect = (type: any, visiting: Set<any>): Set<string> => {
        if (cache.has(type))
          return cache.get(type)!;

        if (visiting.has(type))
          return new Set<string>(); // break cycle

        const options = Module.byType.get(type)!;

        visiting.add(type);

        const result = new Set<string>();

        result.add(options.name!);

        for (const importedType of options.imports!) {
          for (const name of collect(importedType, visiting))
            result.add(name);
        }

        visiting.delete(type);

        // cache

        cache.set(type, result);

        return result;
      };

      // go

      for (const [type, options] of Module.byType.entries())
        options.accepts = collect(type, new Set());
    } // if
  }

  // protected

  getName() : string {
      return Module.byType.get(this.constructor)!.name!
  }

  getImports() : any[] {
      return Module.byType.get(this.constructor)!.imports || []
  }
}

/**
 * registers the corresponding class as a moudle that is the basis for instance creation.
 * @param options moudle options
 * @returns 
 */
export function module(options: ModuleOptions = {}): ClassDecorator {
  return (target: any) => {
    options.type = target

    if (!options.imports)
        options.imports = []

     if (!options.name)
        options.name = ""

    Module.register(target, options)

    TypeDescriptor.forType(target).addDecorator(module, options);

    if (options.register !== false) {
        Providers.registerClass(options.name, target, true);

        TypeDescriptor.forType(target).addDecorator(injectable);
    }

    return target;
  };
}

/**
 * Methods annotated with @inject will be called with the required dependencies injected
 */
export function inject(): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const typeDescriptor = TypeDescriptor.forType(target.constructor);

    typeDescriptor.addMethodDecorator(target, propertyKey.toString(), inject as any);

    return descriptor;
  };
}


/**
 * Define a scope
 */
export function scope(name: string, register = true): ClassDecorator {
  return (target: any) => {
     TypeDescriptor.forType(target).addDecorator(scope);

     Scopes.register(target, name);

     if (register) {
       Providers.registerClass("boot", target, true, "request");
    }

    return target;
  };
}

// annotation

/**
 * Base class for resolving annotated parameter values
 */
export abstract class AnnotationResolver<T = any> {
  // static datat

  private static resolvers: Map<any, AnnotationResolver> = new Map();

  // static functions

    static register(resolver: AnnotationResolver): void {
      AnnotationResolver.resolvers.set(resolver.annotationType, resolver);
    }

    static getResolver(annotationType: any): AnnotationResolver | undefined {
      return AnnotationResolver.resolvers.get(annotationType);
    }

  // constructor

  constructor(public annotationType: any) {
      AnnotationResolver.register(this)
  }

  /**
   * Return types this resolver depends on
   */
  dependencies(): any[] {
    return [];
  }

  /**
   * Resolve the actual value to inject
   * @param annotationValue The annotation instance
   * @param paramType The actual parameter type
   * @param environment The DI environment
   * @param deps Resolved dependencies from dependencies()
   */
  abstract resolve(annotationValue: any, paramType: any, environment: Environment, ...deps: any[]): T;
}


/**
 * Provider that resolves a parameter value based on annotation metadata
 */
export class AnnotationInstanceProvider<T> extends AbstractInstanceProvider<T> {
  private dependencies: any[] = [];

  constructor(
    private resolver: AnnotationResolver<T>,
    private annotationValue: any,
    private paramType: any
  ) {
    super();
  }

  override getType(): any {
    return this.paramType;
  }

  override getHost(): any {
    return this.resolver.constructor;
  }

  override isEager(): boolean {
    return false; // Resolved on-demand
  }

  override getScope(): string {
    return "request"; // Always resolve fresh
  }

  override getDependencies(): [any[], number] {
    const deps = this.resolver.dependencies();
    return [deps, deps.length];
  }

  resolve(context: any): void {
    /**
     * Resolve dependencies for this annotation provider
     */
    this.dependencies = [];
    for (const depType of this.resolver.dependencies()) {
      this.dependencies.push(depType);
    }
  }

  override create(environment: Environment, ...args: any[]): T {
    // args are the resolver's dependencies
    return this.resolver.resolve(this.annotationValue, this.paramType, environment, ...args);
  }

  override report(): string {
    return `Annotation(${this.annotationValue} -> ${this.paramType?.name || 'unknown'})`;
  }

  override toString(): string {
    return `AnnotationInstanceProvider(${this.annotationValue} -> ${this.paramType?.name || 'unknown'})`;
  }

  override checkFactories(): void {
    // No-op
  }
}


export class InstanceProvider<T> extends AbstractInstanceProvider<T> {
  protected paramProviders: Array<[AnnotationInstanceProvider<any> | 'environment' | null, any]> = [];
  protected paramProvidersInitialized = false;

  constructor(
    protected module: string,
    protected host: any,
    protected type: any,
    protected eager: boolean,
    protected scopeName: string
  ) {
    super()
  }

  override getModule() : string {
    return this.module
  }

  override getHost(): any {
    return this.host;
  }

  override getType(): any {
    return this.type;
  }

  override isEager(): boolean {
    return this.eager;
  }

  override getScope(): string {
    return this.scopeName;
  }

  override checkFactories(): void {
    // No-op base implementation
  }

  override getDependencies(): [any[], number] {
    return [[], 1];
  }

  override create(environment: Environment, ...args: any[]): T {
    throw new Error('Method not implemented in base class.');
  }

  protected processAnnotatedParams(annotatedParams: any[]): void {
    for (const param of annotatedParams) {
      let provider: [AnnotationInstanceProvider<any> | 'environment' | null, any] | null = null;

      // Check for Environment type - special case for automatic injection
      if (param.type === Environment) {
        provider = ['environment', Environment];
        this.paramProviders.push(provider);
        continue;
      }

      // Check for annotation metadata
      if (param.metadata && param.metadata.length) {
        for (const meta of param.metadata) {
          const resolver = AnnotationResolver.getResolver(meta.constructor);
          if (resolver) {
            const annotationProvider = new AnnotationInstanceProvider(resolver, meta, param.type);
            provider = [annotationProvider, param.type];
            break;
          }
        }
      }

      if (provider === null) {
        // Normal DI: store tuple (null, param_type)
        provider = [null, param.type];
      }

      this.paramProviders.push(provider);
    }
  }

  protected buildDependenciesFromParams(): any[] {
    const types: any[] = [];

    for (const entry of this.paramProviders) {
      if (entry) {
        const [provider, paramType] = entry;

        if (provider === 'environment') {
          // Environment type: no dependency needed, will inject current environment
          continue;
        }
        else if (provider) {
          // Annotation-based: add resolver's dependencies
          types.push(...provider.getDependencies()[0]);
        }
        else {
          // Normal DI: add parameter type directly
          types.push(paramType);
        }
      }
    }

    return types;
  }

  protected resolveParamValues(environment: Environment, args: any[], startIndex = 0): any[] {
    const finalArgs: any[] = [];
    let depIndex = startIndex;

    for (const [provider, _paramType] of this.paramProviders) {
      if (provider === 'environment') {
        // Environment type: inject current environment
        finalArgs.push(environment);
      }
      else if (provider !== null) {
        // Annotation-based: call provider to resolve the value
        const dependencies = provider.getDependencies()[0];
        const depCount = dependencies.length;
        const depArgs = args.slice(depIndex, depIndex + depCount);
        const value = provider.create(environment, ...depArgs);

        depIndex += depCount;
        finalArgs.push(value);
      }
      else {
        // Normal DI: use the dependency directly
        finalArgs.push(args[depIndex]);
        depIndex++;
      }
    }

    return finalArgs;
  }
}


class EnvironmentScopeInstanceProvider extends InstanceProvider<EnvironmentScope> {
    constructor() {
        super("boot", EnvironmentScopeInstanceProvider, EnvironmentScope, false, "request");
    }

    override create(_environment: Environment, ..._args: any[]): EnvironmentScope {
      return new EnvironmentScope();
    }
}

class SingletonScopeInstanceProvider extends InstanceProvider<SingletonScope> {
    constructor() {
        super("boot", SingletonScopeInstanceProvider, SingletonScope, false, "request");
    }

    override create(environment: Environment, ...args: any[]): SingletonScope {
      return new SingletonScope();
    }
}

class RequestScopeInstanceProvider extends InstanceProvider<RequestScope> {
    constructor() {
        super("boot", RequestScopeInstanceProvider, RequestScope, false, "singleton");
    }

    override create(environment: Environment, ...args: any[]): RequestScope {
      return new RequestScope();
    }
}

/**
 * A ClassInstanceProvider creates instances of type T by calling the class constructor
 */
export class ClassInstanceProvider<T> extends InstanceProvider<T> {
  private params = 0;

  constructor(
    module: string,
    type: new (...args: any[]) => T,
    eager: boolean,
    scope = 'singleton',
  ) {
    super(module, type, type, eager, scope);
  }

  private initParamProviders(): void {
    if (this.paramProvidersInitialized) return;

    const typeDescriptor = TypeDescriptor.forType(this.type);
    const constructor = typeDescriptor.getConstructor();

    // For constructors, pass the class itself (not prototype) to getParamTypes

    const paramTypes = constructor ? constructor.paramTypes: [];
    this.params = paramTypes.length;

    // Process annotated parameters

    const annotatedParams = paramTypes.map((type: any, index: number) => ({
      type,
      metadata:
        (typeof Reflect !== 'undefined' && Reflect.getMetadata) ? Reflect.getMetadata('annotations', this.type, `param:${index}`) || [] : [],
    }));

    this.processAnnotatedParams(annotatedParams);
    this.paramProvidersInitialized = true;
  }

  override getDependencies(): [any[], number] {
    // Lazy init: compute paramProviders on first call
    this.initParamProviders();

    // Build dependency list using shared logic
    const types = this.buildDependenciesFromParams();

    return [types, this.params];
  }

  override create(environment: Environment, ...args: any[]): T {
    //console.debug(`${this} create class ${this.type.name}`);

    // If no paramProviders, use old simple logic

    if (!this.paramProviders.length) {
      return environment.created(new this.type(...args.slice(0, this.params)));
    }

    // Resolve parameter values using shared logic
    const finalArgs = this.resolveParamValues(environment, args);

    return environment.created(new this.type(...finalArgs));
  }

  override report(): string {
    return this.host.name;
  }

  override toString(): string {
    return `ClassInstanceProvider(${this.type.name})`;
  }

  override checkFactories(): void {
    for (const methodDescriptor of TypeDescriptor.forType(this.host).getMethods()) {
      const createDecorator = methodDescriptor.getDecorator(create);

      if (createDecorator) {
        const args = createDecorator.arguments || [];
        const eager = args[0] !== undefined ? args[0] : true;
        const scope = args[1] || "singleton";

        Providers.register(new FunctionInstanceProvider(
          this.getModule(),
          this.host,
          methodDescriptor.method,
          methodDescriptor.name,
          methodDescriptor.returnType,
          eager,
          scope
        ));
      }
    }
  }
}

class MethodInjectionProvider extends InstanceProvider<any> {
  private params = 0;

  constructor(
    private hostClass: any,
    private methodName: string
  ) {
    super("", hostClass, undefined, false, "request");
  }

  private initParamProviders(): void {
    if (this.paramProvidersInitialized) return;

    const descriptor = TypeDescriptor
      .forType(this.hostClass)
      .getMethod(this.methodName);

    const paramTypes = descriptor ? descriptor.paramTypes : [];
    this.params = paramTypes.length;

    const annotatedParams = paramTypes.map((type: any, index: number) => ({
      type,
      metadata:
        (typeof Reflect !== 'undefined' && Reflect.getMetadata)
          ? Reflect.getMetadata(
              'annotations',
              this.hostClass,
              `${this.methodName}:param:${index}`
            ) || []
          : [],
    }));

    this.processAnnotatedParams(annotatedParams);
    this.paramProvidersInitialized = true;
  }

  override getDependencies(): [any[], number] {
    this.initParamProviders();
    const types = this.buildDependenciesFromParams();
    return [types, this.params];
  }

  override create(environment: Environment, ...args: any[]): any {
    this.initParamProviders();
    return this.resolveParamValues(environment, args);
  }
}

/**
 * A FunctionInstanceProvider creates instances by calling methods annotated with @create
 */
export class FunctionInstanceProvider<T> extends InstanceProvider<T> {
  constructor(
    module: string,
    clazz: any,
    private method: any,
    private methodName: string,
    private returnType: any,
    eager = true,
    scope = 'singleton',
  ) {
    super(module, clazz, returnType, eager, scope);
  }

  private initParamProviders(): void {
    if (this.paramProvidersInitialized) return;

    const typeDescriptor = TypeDescriptor.forType(this.host);
    const methodDescriptor = typeDescriptor.getMethod(this.methodName);

    const paramTypes = methodDescriptor ? methodDescriptor.paramTypes : [];

    // Process annotated parameters

    const annotatedParams = paramTypes.map((type: any, index: number) => ({
      type,
      metadata:
        (typeof Reflect !== 'undefined' && Reflect.getMetadata) ? Reflect.getMetadata(
          'annotations',
          this.host,
          `${this.methodName}:param:${index}`,
        ) || [] : [],
    }));

    this.processAnnotatedParams(annotatedParams);
    this.paramProvidersInitialized = true;
  }

  override getDependencies(): [any[], number] {
    // Lazy init: compute paramProviders on first call

    this.initParamProviders();

    const types = [this.host]; // First dependency is always the host class instance

    // Build dependency list using shared logic

    types.push(...this.buildDependenciesFromParams());

    return [types, 1 + this.paramProviders.length];
  }

  override create(environment: Environment, ...args: any[]): T {
    //console.debug(`${this} create from method ${this.methodName}`);

    // If no paramProviders (no parameters), use args directly
    if (!this.paramProviders.length) {
      const instance = this.method.apply(args[0]); // args[0]=this

      return environment.created(instance);
    }

    // args[0] is the host instance (this)
    const hostInstance = args[0];

    // Resolve parameter values using shared logic (start_index=1 to skip host instance)
    const methodArgs = this.resolveParamValues(environment, args, 1);

    const instance = this.method.apply(hostInstance, methodArgs);

    return environment.created(instance);
  }

  override report(): string {
    return `${this.host.name}.${this.methodName}() -> ${this.returnType ? this.returnType.name : 'unknown'}`;
  }

  override toString(): string {
    return `FunctionInstanceProvider(${this.host.name}.${this.methodName}() -> ${this.returnType ? this.returnType.name : 'unknown'})`;
  }
}

/**
 * AmbiguousProvider covers cases where fetching a class would lead to an ambiguity exception
 */
export class AmbiguousProvider<T> extends AbstractInstanceProvider<T> {
  private providers: AbstractInstanceProvider<T>[] = [];

  constructor(private typeClass: any, ...providers: AbstractInstanceProvider<T>[]) {
    super();

    this.providers = [...providers];
  }

  addProvider(provider: AbstractInstanceProvider<T>): void {
    this.providers.push(provider);
  }

  override getType(): any {
    return this.typeClass;
  }

  override isEager(): boolean {
    return false;
  }

  override getScope(): string {
    return "singleton";
  }

  override getDependencies(): [any[], number] {
    return [[], 1];
  }

  override create(environment: Environment, ...args: any[]): T {
    throw new DIRuntimeException(`Multiple candidates for type ${this.typeClass.name}`);
  }

  override report(): string {
    return "ambiguous: " + this.providers.map(p => p.report()).join(",");
  }

  override toString(): string {
    return `AmbiguousProvider(${this.typeClass.name})`;
  }

  override checkFactories(): void {
    // No-op
  }
}

/**
 * EnvironmentInstanceProvider wraps a provider within an environment
 */
export class EnvironmentInstanceProvider<T> extends AbstractInstanceProvider<T> {
  // instance data

  private scopeInstance: Scope;
  private provider: AbstractInstanceProvider<T>
  private dependencies: AbstractInstanceProvider<any>[] | null = null;

  // constructor

  constructor(public environment: Environment, provider: AbstractInstanceProvider<T>) {
    super();

     this.scopeInstance = environment.getScope(provider.getScope());

    if (provider instanceof EnvironmentInstanceProvider) {
      // inherit

      this.provider = (provider as any).provider
      this.dependencies = (provider as any).dependencies
    }
    else {
      this.provider = provider
     
    }
  }

  resolve(context: ResolveContext): void {
    if (this.dependencies === null) {
      this.dependencies = [];

      context.push(this);
      try {
        const [types] = this.provider.getDependencies();
        for (const type of types) {
          const provider = context.requireProvider(type) as EnvironmentInstanceProvider<any>;
          this.dependencies.push(provider);
          provider.resolve(context);
        }
      } 
      finally {
        context.pop();
      }
    }
  }

  override getType(): any {
    return this.provider.getType();
  }

  override isEager(): boolean {
    return this.provider.isEager();
  }

  override getScope(): string {
    return this.provider.getScope();
  }

  override getDependencies(): [any[], number] {
    return this.provider.getDependencies();
  }

  override report(): string {
    return this.provider.report();
  }

  override create(environment: Environment, ...args: any[]): T {
    if (!this.dependencies) {
      throw new DIRuntimeException("Provider dependencies not resolved");
    }

    return this.scopeInstance.get(
      this.provider,
      this.environment,
      () => this.dependencies!.map(provider => provider.create(environment))
    );
  }

  printTree(lines: string[], prefix = ""): void {
    if (!this.dependencies) return;

    const children = this.dependencies;
    const lastIndex = children.length - 1;

    lines.push(prefix + "+- " + this.report());

    for (let i = 0; i < children.length; i++) {
      const childPrefix = i === lastIndex ? prefix + "   " : prefix + "|  ";
      (children[i] as EnvironmentInstanceProvider<any>).printTree(lines, childPrefix);
    }
  }

  override toString(): string {
    return `EnvironmentInstanceProvider(${this.provider})`;
  }

  override checkFactories(): void {
    // No-op
  }
}

/**
 * Context class for resolving providers and detecting cycles
 */
class ResolveContext {
  private path: AbstractInstanceProvider<any>[] = [];

  constructor(private providers: Map<any, AbstractInstanceProvider<any>>) {}

  push(provider: AbstractInstanceProvider<any>): void {
    this.path.push(provider);
  }

  pop(): void {
    this.path.pop();
  }

  requireProvider(type: any): AbstractInstanceProvider<any> {
    const provider = this.providers.get(type) || null;

    if (provider === null) {
      throw new DIRegistrationException(`Provider for ${type.name || 'unknown'} is not defined`);
    }

    if (this.path.includes(provider)) {
      throw new DIRegistrationException(this.cycleReport(provider));
    }

    return provider;
  }

  private cycleReport(provider: AbstractInstanceProvider<any>): string {
    let cycle = "";
    let first = true;

    for (const p of this.path) {
      if (!first) {
        cycle += " -> ";
      }
      first = false;
      cycle += `${p.report()}`;
    }

    cycle += ` <> ${provider.report()}`;
    return cycle;
  }
}

/**
 * Environment configuration options
 */
interface EnvironmentOptions {
  /**
   * the module class which is the basis for instance creation
   */
  module?: any;
  /**
   * oprional parent environment
   */
  parent?: Environment
}

export enum EnvironmentState {
  created,
  running,
  destroyed
}

/**
 * Environment is the main DI container.
 */
export class Environment {
  // static data

  static instance: Environment | null = null;

  // instance data

  private type: any;
  private state = EnvironmentState.created
  private providers: Map<any, AbstractInstanceProvider<any>> = new Map();
  private lifecycleProcessors: LifecycleProcessor[] = [];
  private instances: any[] = [];
  parent: Environment | null;

  // constructor

  /**
   * Creates a new Environment instance
   *
   * @param options environment options
   */
  constructor(options: EnvironmentOptions = {}) {
    const { module, parent = null  } = options;

    Module.resolve();

    const addProvider = (type: any, provider: AbstractInstanceProvider<any>) => {
      if (Tracer.ENABLED)
         Tracer.Trace('di', TraceLevel.HIGH, 'add provider {0} for {1}', provider, type?.name || 'unknown');

      this.providers.set(type, provider);
    };

    if (Tracer.ENABLED)
       Tracer.Trace('di', TraceLevel.HIGH, 'create environment for {0}', module?.name || 'unknown');

    // Initialize

    this.type = module;
    this.parent = parent;

    // boot

    if (this.parent === null && module !== Boot) {
      this.parent = Boot.getEnvironment();
    }

    const start = performance.now();

    if (this.parent) {
      // inherit providers from parent

      for (const [providerType, inheritedProvider] of this.parent.providers) {
        let provider = inheritedProvider;

        if (inheritedProvider.getScope() === "environment") {
          // replace with own environment instance provider

          provider = new EnvironmentInstanceProvider(this,  inheritedProvider);
        }

        addProvider(providerType, provider);
      }

      // inherit processors unless they have environment scope

      for (const processor of this.parent.lifecycleProcessors) {
        const processorProvider = this.providers.get(processor.constructor as any);

        if (processorProvider && processorProvider.getScope() !== "environment") {
          this.lifecycleProcessors.push(processor);
        }
        else {
          this.get(processor.constructor as any); // create a new processor for this environment
        }
      }
    }
    else {
      // register core scopes

       this.providers.set(RequestScope,new RequestScopeInstanceProvider())
       this.providers.set(SingletonScope, new SingletonScopeInstanceProvider())
       this.providers.set(EnvironmentScope, new EnvironmentScopeInstanceProvider())
    }

    Environment.instance = this;

    // load providers

    if ( module )
      this.collectProvider(module);

    // create eager instances

    for (const provider of this.providers.values())
      if (provider.isEager() && (provider as EnvironmentInstanceProvider<any>).environment === this)
        provider.create(this);

    const end = performance.now();

    if (Tracer.ENABLED)
       Tracer.Trace('di', TraceLevel.HIGH, 'created environment for {0} in {1}ms, created {2} instances', module?.name || 'unknown', end - start, this.instances.length);
  }

  private collectProvider(module: any): void {
    const accepts =  Module.byType.get(module)!.accepts!

    // local function

    const filterProvider = (provider: AbstractInstanceProvider<any>): boolean => {
      return accepts.has(provider.getModule())
    };

    const filteredProviders = Providers.filter(this, filterProvider);

    this.providers = new Map([...this.providers, ...filteredProviders]);
  }

  /**
   * Check if a type is registered
   */
  isRegisteredType(type: any): boolean {
    const provider = this.providers.get(type);
    return !!provider && !(provider.constructor.name === 'AmbiguousProvider');
  }

  /**
   * Get all registered types matching a predicate
   */
  registeredTypes(predicate: (type: any) => boolean): any[] {
    const result: any[] = [];

    for (const provider of this.providers.values()) { // [...this.providers.values()]
      const type = provider.getType();
      if (predicate(type)) {
        result.push(type);
      }
    }

    return result;
  }

  /**
   * Execute lifecycle processors on an instance
   */
  executeProcessors<T>(lifecycle: Lifecycle, instance: T): T {
    for (const processor of this.lifecycleProcessors) {
      processor.processLifecycle(lifecycle, instance, this);
    }

    return instance;
  }

  /**
   * Execute lifecycle processors asynchronously
   */
  async executeProcessorsAsync<T>(lifecycle: Lifecycle, instance: T): Promise<T> {
    for (const processor of this.lifecycleProcessors) {
      await processor.processLifecycleAsync(lifecycle, instance, this);
    }

    return instance;
  }

  /**
   * Process a newly created instance
   */
  created<T>(instance: T): T {
    // remember lifecycle processors

    if (instance instanceof LifecycleProcessor) {
      this.lifecycleProcessors.push(instance);

      // Sort immediately

      this.lifecycleProcessors.sort((a, b) => a.order - b.order);
    }

    // remember instance

    this.instances.push(instance);

    // execute processors

    this.executeProcessors(Lifecycle.ON_INJECT, instance);
    this.executeProcessors(Lifecycle.ON_INIT, instance);

    return instance;
  }

  /**
   * Generate a report of the environment state
   */
  report(): string {
    const lines: string[] = [];

    lines.push(`Environment ${this.type?.name || 'unknown'}`);
    if (this.parent) {
      lines.push(`Parent: ${this.parent.type?.name || 'unknown'}`);
    }
    lines.push("");

    // Post processors

    lines.push("Processors:");
    for (const processor of this.lifecycleProcessors) {
      lines.push(`- ${processor.constructor.name}`);
    }
    lines.push("");

    // Providers

    lines.push("Providers:");
    for (const [_resultType, provider] of this.providers) {
      if (provider instanceof EnvironmentInstanceProvider) {
        if ((provider as any).environment === this) {
          //lines.push(`- ${typeName}: `);
          provider.printTree(lines)
        }
      }
    }
    lines.push("");

    // Instances

    lines.push("Instances:");
    const instanceCounts: Record<string, number> = {};

    for (const obj of this.instances) {
      const className = obj.constructor.name;
      instanceCounts[className] = (instanceCounts[className] || 0) + 1;
    }

    for (const [className, count] of Object.entries(instanceCounts)) {
      lines.push(`- ${className}: ${count}`);
    }

    return lines.join("\n");
  }

  /**
   * Start the environment by executing ON_RUNNING lifecycle phase
   */
  async start(): Promise<void> {
    if (this.state == EnvironmentState.created) {
      if (Tracer.ENABLED)
        Tracer.Trace('di', TraceLevel.HIGH, 'start environment {0}', this.type?.name || 'unknown');

      // execute ON_RUNNING phase for all instances (can be async)

      if (this.parent)
        await this.parent.start()

      for (const instance of this.instances) {
        await this.executeProcessorsAsync(Lifecycle.ON_RUNNING, instance);
      }

      this.state = EnvironmentState.running
    }
  }

  /**
   * Stop the environment by executing ON_DESTROY lifecycle phase
   */
  async stop(): Promise<void> {
    if (this.state == EnvironmentState.running) {
      if (Tracer.ENABLED)
          Tracer.Trace('di', TraceLevel.HIGH, 'stop environment {0}', this.type?.name || 'unknown');

      // Execute ON_DESTROY phase for all instances (in reverse order)

      for (let i = this.instances.length - 1; i >= 0; i--) {
        await this.executeProcessorsAsync(Lifecycle.ON_DESTROY, this.instances[i]);
      }

      this.instances = [];
      this.state = EnvironmentState.destroyed;
    }
  }

  supports(type: new(...args: any[]) => any) : boolean {
      return this.providers.get(type as any) !== undefined
  }

  /**
   * Get an instance of the specified type
   * @typeParam T the type
   * @param type the desired type
   * @returns the instance 
    */
  get<T>(type: new(...args: any[]) => T): T {
    const provider = this.providers.get(type as any);

    if (!provider) {
      const typeName = type?.name || 'unknown';

      throw new DIRuntimeException(`${typeName} is not supported`);
    }

    return provider.create(this) as T;
  }

  /**
   * Get providers (for internal use)
   */
  getProviders(): Map<any, AbstractInstanceProvider<any>> {
    return this.providers;
  }

  /**
   * Get a scope by name
   */
  getScope(scopeName: string): Scope {
    return Scopes.get(scopeName, this);
  }

  toString(): string {
    return `Environment(${this.type?.name || 'unknown'})`;
  }
}

// Boot "module"

/**
 * Bootstrap environment class
 */
@module({name: "boot", register: false})
export class Boot extends Module {
  private static environment: Environment | null = null;

  static getEnvironment(): Environment {
    if (!Boot.environment) {
      Boot.environment = new Environment({module: Boot});
    }

    return Boot.environment;
  }
}

// injectables

/**
 * Request scope - creates a new instance for each request
 */
@scope("request", false)
export class RequestScope implements Scope {
  get<T>(provider: AbstractInstanceProvider<T>, environment: Environment, argProvider: () => any[]): T {
    return provider.create(environment, ...argProvider());
  }
}

/**
 * Singleton scope - caches instances for reuse
 */
@scope("singleton", false)
export class SingletonScope implements Scope {
  // instance data

  private value : any = this

  get<T>(provider: AbstractInstanceProvider<T>, environment: Environment, argProvider: () => any[]): T {
     if (this.value === this)
          this.value = provider.create(environment, ...argProvider())

      return this.value
  }
}

/**
 * Environment scope - caches instances for the lifetime of the environment
 */
@scope("environment", false)
export class EnvironmentScope extends SingletonScope {
  // Inherits implementation from SingletonScope
}

// Concrete lifecycle processors

@injectable({module: "boot"})
@order(1)
export class OnInjectCallableProcessor extends AbstractCallableProcessor {
  constructor() {
    super(Lifecycle.ON_INJECT);
  }
}

@injectable({module: "boot"})
@order(2)
export class OnInitCallableProcessor extends AbstractCallableProcessor {
  constructor() {
    super(Lifecycle.ON_INIT);
  }
}

@injectable({module: "boot"})
@order(3)
export class OnRunningCallableProcessor extends AbstractCallableProcessor {
  constructor() {
    super(Lifecycle.ON_RUNNING);
  }
}

@injectable({module: "boot"})
@order(4)
export class OnDestroyCallableProcessor extends AbstractCallableProcessor {
  constructor() {
    super(Lifecycle.ON_DESTROY);
  }
}

// Lifecycle callables — defined below together with InjectLifecycleCallable

/**
 * Base for lifecycle callables that inject method parameters.
 * Shared by @inject, @onInit, @onRunning, @onDestroy.
 */
class InjectingLifecycleCallable extends LifecycleCallable {
  // 🔥 Cache per host class

  private static providerCache = new Map<string, MethodInjectionProvider>();

  protected getProvider(instance: any, method: MethodDescriptor): MethodInjectionProvider {
    const key = `${instance.constructor.name}:${method.name}`;

    let provider = InjectingLifecycleCallable.providerCache.get(key);

    if (!provider) {
      provider = new MethodInjectionProvider(
        instance.constructor,
        method.name
      );

      InjectingLifecycleCallable.providerCache.set(key, provider);
    }

    return provider;
  }

  override args(
    decorator: DecoratorDescriptor,
    method: MethodDescriptor,
    environment: Environment,
    instance?: any
  ): any[] {
    const provider = this.getProvider(instance, method);

    const [types] = provider.getDependencies();

    // Resolve through full DI graph

    const resolved = types.map(type => environment.get(type));

    return provider.create(environment, ...resolved);
  }
}

@injectable({module: "boot"})
export class InjectLifecycleCallable extends InjectingLifecycleCallable {
  constructor() {
    super(inject, Lifecycle.ON_INJECT);
  }
}

@injectable({module: "boot"})
export class OnInitLifecycleCallable extends InjectingLifecycleCallable {
  constructor() {
    super(onInit, Lifecycle.ON_INIT);
  }
}

@injectable({module: "boot"})
export class OnDestroyLifecycleCallable extends InjectingLifecycleCallable {
  constructor() {
    super(onDestroy, Lifecycle.ON_DESTROY);
  }
}

@injectable({module: "boot"})
export class OnRunningLifecycleCallable extends InjectingLifecycleCallable {
  constructor() {
    super(onRunning, Lifecycle.ON_RUNNING);
  }
}
