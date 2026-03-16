import { injectable } from "@novx/core"
import { FormatOptions, ValueFormatter } from "./ValueFormatter"

/**
 * The <code>FormatterRegistry</code> is the registry for known formatters and the main api for formatting requests.
 */
export class FormatterRegistry {
    // instance data

    static registry: { [type: string]: ValueFormatter<any, any> } = {}

    // public

    /**
     * format a given value.
     * @param type the formatter name
     * @param value the value
     * @param options formatter options
     */
    static format(type: string, value: any, locale: Intl.Locale, options: FormatOptions): string {
        const formatter = FormatterRegistry.registry[type]

        if (formatter)
            return formatter.format(locale, value, options)
        else
            throw new Error(`unknown formatter "${type}"`)
    }

    /**
     * register a specific formatter
     * @param type the formatter name
     * @param formatter the formatter
     */
    static register(type: string, formatter: ValueFormatter<any, any>) {
        this.registry[type] = formatter
    }
}


