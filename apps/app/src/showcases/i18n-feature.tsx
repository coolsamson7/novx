import React from 'react';

import { Feature } from '@novx/portal';

@Feature({
  id: "i18n",
  path: "i18n",
  parent: "showcases",
  description: "i18n",
  tags: ["showcase"],
  permissions: [],
  features: [],
  visibility: ["private", "public"]
})
class I18NFeature extends React.Component {
  render() {
    return <div  style={{
        fontSize: '32px',
        fontWeight: 'bold',
        margin: '24px',
        textAlign: 'center'
      }}>
      I18N
    </div>;
  }
}
