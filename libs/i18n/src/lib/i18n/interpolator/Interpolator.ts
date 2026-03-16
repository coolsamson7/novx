
import { PlaceholderParser } from "./Parser"
import { FormatterRegistry } from "../../format"
import { StringBuilder, LRUCache } from '@novx/core';

/**
 * @ignore
 */
export interface Format {
    format: string
    parameters?: { [key: string]: any }
}
/**
 * @ignore
 */
export interface Placeholder {
    name: string
    format?: Format
}

interface Text {
    start: number
    end: number
}

type Chunk = Placeholder | Text

const isText = (chunk: Chunk): chunk is Text => {
    return (chunk as Text).start !== undefined
}

/**
 * The service <code>Interpolator</code> is a tiny templating engine that will replace placeholders by real values.
 * The replacements can refer to specific formatters that can respect specific formatting options.
 *
 */
export class Interpolator {
    // instance data

    cache: LRUCache<(locale: Intl.Locale, parameters: any) => string> = new LRUCache()
    useCaching = true
    parser = new PlaceholderParser()

    // private

    private interpolator(input: string): (locale: Intl.Locale, parameters: any) => string {
        let interpolator = this.cache.get(input)
        if (!interpolator) interpolator = this.cache.put(input, this.compile(input))

        return interpolator
    }

    private compile(input: string): (locale: Intl.Locale, parameters: any) => string {
        const components: Chunk[] = []

        let start = 0
        let index = input.indexOf("{")
        if (index >= 0) {
            while (index >= 0) {
                // add up to first bracket

                components.push({ start: start, end: index })

                start = index
                index = input.indexOf("}", index + 1)

                // add bracket

                const placeholder = input.substring(start, index + 1)
                components.push(this.parser.parse(placeholder))

                // next

                start = index + 1
                index = input.indexOf("{", start)
            } // while

            // add end

            components.push({ start: start, end: input.length })
        } else {
            components.push({ start: 0, end: input.length })
        }

        return (locale: Intl.Locale, parameters: any): string => {
            const builder = new StringBuilder()

            for (const element of components) {
                if (isText(element)) builder.append(input.substring(element.start, element.end))
                else {
                    let parameter = parameters[element.name]

                    if (parameter == undefined) throw new Error("unknown parameter " + element.name)

                    // either we get a literal value of a Format with {value: .. format: parameters...}

                    let type: string
                    let formatParams = undefined

                    // supplied format

                    if (parameter.format !== undefined) {
                        type = parameter.format
                        formatParams = parameter.parameters
                        parameter = parameter.value
                    }

                    // from spec
                    else if (element.format) {
                        type = element.format.format
                        formatParams = element.format.parameters
                    }

                    // from value
                    else {
                        if (parameter instanceof Date) type = "date"
                        else type = typeof parameters[element.name] //
                    }

                    builder.append(FormatterRegistry.format(type, parameter, locale, formatParams))
                }
            } // for

            return builder.toString()
        }
    }

    // public

    interpolate(input: string, locale: Intl.Locale, parameters: any): string {
        if (this.useCaching) return this.interpolator(input)(locale, parameters)

        let start = 0
        let index = input.indexOf("{")
        if (index >= 0) {
            const builder = new StringBuilder()

            while (index >= 0) {
                // add up to first bracket

                builder.append(input.substring(start, index))

                start = index
                index = input.indexOf("}", index + 1)

                // add bracket

                builder.append(this.interpolatePlaceholder(input.substring(start, index + 1), locale, parameters))

                // next

                start = index + 1
                index = input.indexOf("{", start)
            } // while

            // add end

            builder.append(input.substring(start))

            // done

            return builder.toString()
        } else return input
    }

    interpolatePlaceholder(input: string, locale: Intl.Locale, parameters: any): string {
        const placeholder = this.parser.parse(input)

        return FormatterRegistry.format(
            placeholder.format!.format,
            parameters[placeholder.name],
            locale,
            placeholder.format!.parameters
        )
    }
}
