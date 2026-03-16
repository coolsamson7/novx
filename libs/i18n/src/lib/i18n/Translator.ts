import { Observable } from "rxjs"

/**
 * <code>Translations</code> simply is a JS any object that contains values on any level
 */
export type Translations = any

/**
 * the possible event types
 */
export type EventType = "initial" | "load-namespace" | "switch-locale"

/**
 * fired by the translator
 */
export interface Event {
    /**
     * the event type.
     */
    type: EventType

    /**
     * additional properties of the individual events
     */
    [prop: string]: any
}

/**
 * A <code>Translator</code> is responsible to load and fetch i18n values given keys that consist of a namespace and a path.
 */
export class Translator {
  /**
     * an observable that will emit events whenever a namespace is loaded...
     */
    events(): Observable<Event> {
      throw Error("ocuh");
  }

    /**
     * make sure that the specified namespaces are laoded
     * @param namespaces list of namespaces
     */
    checkAndLoadNamespaces(...namespaces: string[]): Promise<void>{
      throw Error('ocuh');
    }

    /**
     * return an observable containing the translated key or the transformed key in case of missing values
     * @param key the translation key
     */
    translate$(key: string, params?: any): Promise<string>{
      throw Error('NYI');
    }

    /**
     * return the i18n value or the transformed key in case of missing values
     * @param key
     */
    translate(key: string, params?: any): string{
      throw Error('NYI');
    }

    /**
     * return an observable containing all values for the specific namespace
     * @param namespace
     */
    findTranslationFor$(namespace: string): Promise<Translations>{
      throw Error('ocuh');
    }

    /**
     * return all values for the specific namespace, assuming that they have been already loaded
     * @param namespace
     */
    findTranslationFor(namespace: string): Translations{
      throw Error('ocuh');
    }
}
