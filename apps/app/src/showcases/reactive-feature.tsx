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
  visibility: ["private", "public"]
})
class ReactiveFeature extends React.Component {
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
