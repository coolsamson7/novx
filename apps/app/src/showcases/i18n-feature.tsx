import React from 'react';

import { EnvironmentContext, Feature } from '@novx/portal';
import { Translator } from '@novx/i18n';
import { Environment } from '@novx/core';

@Feature({
  id: "i18n",
  path: "i18n",
  parent: "showcases",
  description: "i18n",
  tags: ["showcase"],
  permissions: [],
  preloadI18n: ["showcases"],
  features: [],
  visibility: ["private", "public"],
  showcase: {
      title:       'I18N',
      description: 'translations.',
      group:       'Core',
      order:       1,
      docs:      'i18n-feature.md',
      assets: [
        {
          type:    'tsx',
          label:   'Source',
          path: 'i18n-feature.tsx',
        },
        {
          type:  'json',
          label: 'i18n EN',
          url:   '/i18n/showcases/en-US.json',
        },
      ]
    }
})
class I18NFeature extends React.Component {
    translator!: Translator;

    static contextType = EnvironmentContext

    declare context: Environment

    // implement

    componentDidMount(): void {
        this.translator = this.context.get(Translator)
    }

    render() {
        this.translator = this.context.get(Translator)

        const hello = this.translator.translate("showcases:hello_user.label", {user: "Andi"}) // todays_price
        const price = this.translator.translate("showcases:todays_price.label", { price: 1, today: new Date() })
       
        return <div  style={{
            fontSize: '32px',
            fontWeight: 'bold',
            margin: '24px',
            textAlign: 'center'
        }}>
        {hello} {price}
      </div>;
      }
}
