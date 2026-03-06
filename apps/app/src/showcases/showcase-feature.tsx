import React from 'react';

import {  Feature } from '@novx/portal';

@Feature({
  id: "showcase",
  i18n: "showcase",
  path: "/showcase",
  icon: "home",
  description: "showcase",
  tags: ["menu", "showcase"],
  permissions: [],
  features: [],
  visibility: ["private", "public"]
})
class ShowcaseFeature extends React.Component {
  render() {
    return <div  style={{
        fontSize: '32px',
        fontWeight: 'bold',
        margin: '24px',
        textAlign: 'center'
      }}>
      Showcase
    </div>;
  }
}
