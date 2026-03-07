import React from 'react';

import { Feature } from '@novx/portal';

@Feature({
  id: "environment",
  path: "environment",
  parent: "showcases",
  icon: "home",
  description: "environment",
  tags: ["showcase"],
  permissions: [],
  features: [],
  visibility: ["private", "public"]
})
class EnvironmentFeature extends React.Component {
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
