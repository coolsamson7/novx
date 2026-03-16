import React from 'react';

import { EnvironmentContext, Feature, useEnvironment, useI18N } from '@novx/portal';
import './environment-feature.scss';
import { Translator } from '@novx/i18n';
import { Environment } from '@novx/core';

function EnvironmentContent() {
  const environment = useEnvironment()
  const translator = environment.get(Translator)

  const { tr } = useI18N()!

  console.log(tr("fpp"))

  return (
    <div className="environment-content">
      <p>This is where you can render additional environment information.</p>
      <ul>
        <li>Version</li>
        <li>API status</li>
        <li>Feature flags</li>
        <li>Debug information</li>
      </ul>
    </div>
  );
}

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
  static contextType = EnvironmentContext

  declare context: Environment

  // implement

  override componentDidMount(): void {
      //this.translator = this.context.get(Translator)
  }

  override render() {
    return (
      <div className="environment-feature">
        Environment
        <EnvironmentContent />
      </div>
    );
  }
}

export default EnvironmentFeature;