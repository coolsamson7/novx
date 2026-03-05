/* eslint-disable @typescript-eslint/no-this-alias */

import React from "react"
import { injectable, TypeDescriptor } from "@novx/core"

/* -------------------- Observable / Reaction -------------------- */

type ReactionFn = () => void
let currentReaction: Reaction | null = null

export class ObservableValue<T = any> {
  private observers = new Set<Reaction>()
  constructor(private value: T) {}

  get(): T {
    if (currentReaction) {
      this.observers.add(currentReaction)
      currentReaction.dependencies.add(this)
    }
    return this.value
  }

  set(newValue: T) {
    if (this.value === newValue) return
    this.value = newValue
    this.observers.forEach((r) => r.schedule())
  }

  removeObserver(r: Reaction) {
    this.observers.delete(r)
  }
}

class Reaction {
  dependencies = new Set<ObservableValue>()
  private scheduled = false

  constructor(private fn: ReactionFn, autoRun = true) {
    if (autoRun) this.run()
  }

  run() {
    this.cleanup()
    currentReaction = this
    try {
      this.fn()
    } finally {
      currentReaction = null
    }
  }

  schedule() {
    if (batchDepth > 0) {
      pendingReactions.add(this)
      return
    }

    if (!this.scheduled) {
      this.scheduled = true
      queueMicrotask(() => {
        this.scheduled = false
        this.run()
      })
    }
  }

  cleanup() {
    this.dependencies.forEach((dep) => dep.removeObserver(this))
    this.dependencies.clear()
  }
}

export function autorun(fn: ReactionFn) {
  return new Reaction(fn)
}

/* -------------------- Transaction / Batch -------------------- */

let batchDepth = 0
const pendingReactions = new Set<Reaction>()

export function transaction(fn: () => void): void {
  batchDepth++
  try {
    fn()
  } finally {
    batchDepth--
    if (batchDepth === 0) {
      const snapshot = [...pendingReactions]
      pendingReactions.clear()
      for (const r of snapshot) r.run()
    }
  }
}

/* -------------------- Decorators -------------------- */

export function observable(target: any, propertyKey: string | symbol) {
  TypeDescriptor.forType(target.constructor).addPropertyDecorator(
    target,
    propertyKey.toString(),
    observable
  )
}

export function computed(
  target: any,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor
) {
  TypeDescriptor.forType(target.constructor).addMethodDecorator(
    target,
    propertyKey.toString(),
    computed
  )
  return descriptor
}

export function action(
  target: any,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor
) {
  TypeDescriptor.forType(target.constructor).addMethodDecorator(
    target,
    propertyKey.toString(),
    action
  )
  return descriptor
}

export function reactive(target: any) {
  TypeDescriptor.forType(target).addDecorator(reactive)
  return target
}

/* -------------------- Reactive PostProcessor -------------------- */

@injectable({ module: "boot" })
export class ReactivePostProcessor {
  process(instance: any) {
    const descriptor = TypeDescriptor.forType(instance.constructor)
    if (descriptor.hasDecorator(reactive)) {
      this.makeObservables(instance, descriptor)
      this.makeComputed(instance, descriptor)
    }
  }

  private makeObservables(instance: any, descriptor: TypeDescriptor<any>) {
    for (const field of descriptor.getFields()) {
      if (!field.hasDecorator(observable)) continue
      const observableValue = new ObservableValue(instance[field.name])
      Object.defineProperty(instance, field.name, {
        get() {
          return observableValue.get()
        },
        set(v) {
          observableValue.set(v)
        },
        enumerable: true,
        configurable: true,
      })
    }
  }

  private makeComputed(instance: any, descriptor: TypeDescriptor<any>) {
    for (const method of descriptor.getMethods((m) => m.hasDecorator(computed))) {
      let cached: any
      const reaction = new Reaction(() => {
        cached = instance[method.name]()
      })
      Object.defineProperty(instance, method.name, {
        get() {
          return cached
        },
        enumerable: true,
        configurable: true,
      })
    }
  }
}


/* -------------------- React Hook -------------------- */

export function useObserver(): void {
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0)
  const reactionRef = React.useRef<Reaction | null>(null)

  if (reactionRef.current === null) {
    reactionRef.current = new Reaction(() => forceUpdate(), false)
  }

  const reaction = reactionRef.current
  reaction.cleanup()

  const prevReaction = currentReaction
  currentReaction = reaction

  // Reset after all synchronous observable reads
  queueMicrotask(() => {
    currentReaction = prevReaction
  })

  React.useEffect(() => () => reactionRef.current?.cleanup(), [])
}