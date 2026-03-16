import { BehaviorSubject, forkJoin, from, Observable } from "rxjs"


import { AbstractCachingTranslator } from "./AbstractCachingTranslator"
import { LocaleManager, OnLocaleChange } from "../../locale"
import { MissingTranslationHandler } from "../MissingTranslationHandler"
import { I18NLoader } from "../I18NLoader"
import { Translations } from "../Translator"
import { Event } from "../Translator"
import { tap } from "rxjs/operators"
import { Interpolator } from "../interpolator"

/**
 * the {@link StandardTranslator} is a caching translator that delegates loading requests to a {@link I18NLoader}
 */
export class StandardTranslator extends AbstractCachingTranslator implements OnLocaleChange {
    // instance data

    override locale: Intl.Locale
    private event: BehaviorSubject<Event> = new BehaviorSubject<Event>({ type: "initial" })

    // constructor

    constructor(private loader: I18NLoader, missingTranslationHandler: MissingTranslationHandler, localeManager: LocaleManager) {
        super(missingTranslationHandler, new Interpolator())


        // start with current locale

        this.locale = localeManager.getLocale()

        // subscribe to locale manager

        localeManager.subscribe(this, 0)
    }

    // public

   override  events(): Observable<Event> {
        return this.event
    }

    async loadNamespace(namespace: string): Promise<Translations> {
        //this.logger!.info(`loading namespace '${namespace}' for locale '${this.locale.baseName}'`)

        return this.loader.loadNamespace(this.locale, namespace).then((translations) => {
            //this.logger!.info(`cache namespace '${namespace}' for locale '${this.locale.baseName}'`)

            this.cachedNamespaces[namespace] = translations

            if (!this.reloading) this.event.next({ type: "load-namespace", namespace: namespace })
        })
    }

    override async checkAndLoadNamespaces(...namespaces: string[]): Promise<void> {
        for (const namespace of namespaces) if (!this.cachedNamespaces[namespace]) await this.loadNamespace(namespace)
    }

    // override

    override translate$(key: string, params?: any): Promise<string> {
        const { namespace } = this.extractNamespace(key)

        const translations = this.cachedNamespaces[namespace]

        if (translations) return Promise.resolve(this.translate(key, params))
        else return this.loadNamespace(namespace).then((translations) => Promise.resolve(this.translate(key)))
    }

    override findTranslationFor$(namespace: string): Promise<Translations> {
        const translations = this.cachedNamespaces[namespace]
        if (translations) 
            return Promise.resolve(translations)
        else 
            return this.loadNamespace(namespace)
    }

    // implement OnLocaleChange

    /**
     * @inheritDoc
     */
    onLocaleChange(locale: Intl.Locale): Observable<any> {
        this.locale = locale

        const namespaces = this.cachedNamespaces
        this.cachedNamespaces = {}

        // reload all namespaces

        this.reloading = true
        return forkJoin(Object.keys(namespaces).map((n) => from(this.loadNamespace(n)))).pipe(
            tap(() => {
                this.reloading = false
                this.event.next({ type: "switch-locale", locale: locale })
            })
        )
    }
}
