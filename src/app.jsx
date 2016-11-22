'use strict';

import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.css';
import Promise from 'bluebird';
import React from 'react'; // eslint-disable-line no-unused-vars
import ReactDOM from 'react-dom';
import WebFont from 'webfontloader';

import './app.css';
import { AppConstants } from './appConstants';
import { ServerWithHistoricalData } from './data/serverWithHistoricalData';
import { SimpleServer } from './data/simpleServer';
import TrafficFlow from './components/trafficFlow';

// Used in serverWithHistoricalData.js
Promise.config({
  cancellation: true
});

function fontsActive () {
  const backend = new SimpleServer();
  // const backend = new ServerWithHistoricalData(AppConstants.backendUrl);
  ReactDOM.render(
    <TrafficFlow backend={backend} />,
    document.getElementById('traffic')
  );
}

// Only load the app once we have the webfonts.
// This is necessary since we use the fonts for drawing on Canvas'...

// imports are loaded and elements have been registered

WebFont.load({
  custom: {
    families: ['Source Sans Pro:n3,n4,n6,n7'],
    urls: ['/fonts/source-sans-pro.css']
  },
  active: fontsActive
});
