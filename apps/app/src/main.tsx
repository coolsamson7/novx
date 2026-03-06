import { createRoot } from 'react-dom/client';

import { EnvironmentContext } from '@novx/portal';

import App from './app/App';
import { createEnvironment } from './module';

// make sure the decorators run

import './feature/hello-feature'
import './feature/world-feature'
import { HomePage } from './feature/home-feature'
import './navigation/private-navigation'
import './navigation/public-navigation'
import './navigation/login-feature'
import './showcases/showcase-feature'
import './showcases'
import './showcase'

const home = HomePage

// create environment

const environment = await createEnvironment();


const root = createRoot(document.getElementById('root')!);
root.render(
    <EnvironmentContext.Provider value={environment}>
      <App />
    </EnvironmentContext.Provider>
);