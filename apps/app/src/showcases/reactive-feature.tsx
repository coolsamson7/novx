import React from 'react';

import { Feature } from '@novx/portal';

@Feature({
  id: "reactive",
  path: "reactive",
  parent: "showcases",
  description: "reactive",
  tags: ["showcase"],
  permissions: [],
  features: [],
  visibility: ["private", "public"],
  showcase: {
      title:       'Reactive',
      description: 'Observable values, computed properties and reactive controllers.',
      group:       'Core',
      order:       1,
      docs:      'reactive-feature.docs.md',
      assets: [
        {
          type:    'tsx',
          label:   'Source',
          path: 'reactive-feature.tsx',
        },
        {
          type:    'scss',
          label:   'Styles',
          path: 'reactive-feature.module.scss',
        },
        {
          type:  'json',
          label: 'i18n EN',
          url:   '/i18n/reactive/en.json',
        },
      ]
    }
})
class ReactiveFeature extends React.Component {
  render() {
    return <div  style={{
        fontSize: '32px',
        fontWeight: 'bold',
        margin: '24px',
        textAlign: 'center'
      }}>
      Reactive
    </div>;
  }
}
