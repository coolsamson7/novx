import { injectable, TypeDescriptor, Invocation, around, methods  } from "@novx/core"

import { ObservableValue, transaction } from "../reactive"

export class CommandDescriptor {
  // instance datac

  private _enabled = new ObservableValue(true)

  // constructor

  constructor(
    public readonly name: string, 
    public readonly method: Function,
    public readonly label?: string,
    public readonly i18n?: string,
    public readonly shortcut?: string 
  ) {}

  // public

  get enabled() { return this._enabled.get() }
  set enabled(v: boolean) { this._enabled.set(v) }
}

// @command decorator

export interface CommandOptions {
  name?: string
  label?: string
  i18n?: string
  shortcut?: string
}

export function command(options: CommandOptions = {}) {
  return function (
    target: any,
    propertyKey: string | symbol,
    _descriptor: PropertyDescriptor
  ) {
    TypeDescriptor
      .forType(target.constructor)
      .addMethodDecorator(target, propertyKey.toString(), command, options)
  }
}

// Controller

export abstract class Controller {
  // instance data

  private _commands = new Map<string, CommandDescriptor>()

   // constructor

  constructor() {
    const descriptor = TypeDescriptor.forType(this.constructor as any)

    for (const method of descriptor.getMethods((m) => m.hasDecorator(command))) {
      const decorator = method.getDecorator(command)!

      const options : CommandOptions = decorator.arguments[0]
      const name = options.name ?? method.name

      this._commands.set(
        name,
        new CommandDescriptor(
          name,
          method.method,
          options.label,
          options.i18n,
          options?.shortcut
        )
      )
    }
  }

  execute(name: string, ...args: any[]): any {
    return (this as any)[name](...args)
  }

  enable(name: string, state = true) { this._command(name).enabled = state }
  isEnabled(name: string): boolean   { return this._command(name).enabled }

  // private

  private _command(name: string): CommandDescriptor {
    const cmd = this._commands.get(name)
    if (!cmd) 
      throw new Error(`Unknown command "${name}"`)

    return cmd
  }
}

// aspects

@injectable({module: "boot"})
export class CommandAspects {
  @around(methods().decoratedWith(command as any).thatAreSync())
  around(invocation: Invocation): any {
    const ctrl = invocation.target as Controller
    const name = invocation.method().name

    ctrl.enable(name, false)
    try {
      return transaction(() => invocation.proceed())
    }
    finally {
      ctrl.enable(name)
    }
  }

  @around(methods().decoratedWith(command as any).thatAreAsync())
  async aroundAsync(invocation: Invocation): Promise<any> {
    const ctrl = invocation.target as Controller
    const name = invocation.method().name

    ctrl.enable(name, false)
    try {
      const result = await invocation.proceed()

      transaction(() => { /* noop */})

      return result
    }
    finally {
      ctrl.enable(name)
    }
  }
}
