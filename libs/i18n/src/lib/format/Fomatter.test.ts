import "reflect-metadata"

import { FormatterRegistry } from "./FormatterRegistry"

import "./formatter"

import { LocaleManager } from "../locale"
import { Environment, Module, module, create } from "@novx/core"


@module()
class TestModule extends Module {
    @create()
    localeManager() : LocaleManager {
        return  new LocaleManager({ locale: "en" })
    }
}

describe("Formatter", () => {
    let localeManager : LocaleManager
    let formatterRegistry : FormatterRegistry

    beforeAll(() => {
        const environment = new Environment({module: TestModule})

        localeManager = environment.get(LocaleManager);
    })

    it("should format numbers", () => {
        const value = FormatterRegistry.format("number", 47.11, localeManager.getLocale(), { style: "currency", currency: "EUR" })

        console.log(value)
    })
})
