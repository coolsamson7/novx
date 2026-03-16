import { useEffect, useMemo, useState } from "react"
import { Translator, Interpolator } from "@novx/i18n"
import { I18NContext } from "./i18n-context"
import { useInject } from "../environment"

/**
 * provider for i18n stuff
 */
export function I18NProvider(props: any) {
  // inject both services at once
  const [translator] = useInject(
    Translator
  )

  const [counter, setCounter] = useState(0)

  // stable translate function

  const translate = useMemo(() => {
      return (key: string, params?: any): string => {
        return translator.translate(key, params)
      }
  }, [translator, counter])

  useEffect(() => {
    const subscription = translator
      .events()
      .subscribe(() => {
        setCounter((c) => c + 1)
      })

    return () => {
      subscription.unsubscribe()
    }
  }, [translator])

  const contextValue = useMemo(
    () => ({
      tr: translate,
      translator,
      counter,
    }),
    [translate, translator, counter]
  )

  return (
    <I18NContext.Provider value={contextValue}>
      {props.children}
    </I18NContext.Provider>
  )
}
