import React from 'react';

import {  EnvironmentContext, Feature, I18N, I18NContext, useI18N } from '@novx/portal';
import { Environment } from '@novx/core';
import { Translator } from '@novx/i18n';

@Feature({
  id: "hello",
  i18n: "hello",
  path: "/hello",
  icon: "home",
  description: "hello",
  tags: ["menu"],
  permissions: [],
  features: [],
  visibility: ["private", "public"]
})
class HelloFeature extends React.Component {
  static contextType = I18NContext
   declare context: I18N;

  render() {
    const { tr } = this.context

    return <div  style={{
        fontSize: '32px',
        fontWeight: 'bold',
        margin: '24px',
        textAlign: 'center'
      }}>
      {tr("portal:hello.label")}
    </div>;
  }
}
