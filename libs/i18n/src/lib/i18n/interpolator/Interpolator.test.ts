import { Environment, module, create, Module } from "@novx/core"
import { LocaleManager } from "../../locale"
import { Interpolator } from "./Interpolator"

@module()
class TestModule extends Module {
    @create()
    localeManager() : LocaleManager {
        return  new LocaleManager({ locale: "en" })
    }
}


describe("interpolator", () => {
    let environment : Environment
    let localeManager : LocaleManager
    let interpolator: Interpolator = new Interpolator()

    beforeAll(() => {
        environment = new Environment({module: TestModule})
        localeManager = environment.get(LocaleManager)
    })

    it("should interpolate", () => {
        let value = interpolator.interpolate("Hello {world}!", localeManager.getLocale(), { world: "world" })

        expect(value).toBe("Hello world!")

        value = interpolator.interpolate("price: {price:number(style: 'currency', currency: 'EUR')}", localeManager.getLocale(), { price: 1 })

        expect(value).toBe("price: €1.00")
    })
})
