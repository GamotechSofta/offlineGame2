/**
 * Custom entry when running Expo from repo root. Avoids "Unable to resolve ../../App".
 * To prevent "PlatformConstants could not be found", prefer: npm run mobile  or  ./start-mobile.sh
 */
import { registerRootComponent } from 'expo';
import App from './mobile/App';

registerRootComponent(App);
