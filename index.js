import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';

global.Buffer = require('buffer').Buffer;
global.process = require('process');

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);