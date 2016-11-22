'use strict';

import { Duration } from 'js-joda';
import keymirror from 'keymirror';

const AppConstants = {
  ActionTypes: keymirror({
    TRAFFIC_DATA_RECEIVED: null,
    SERVER_ACTION: null,
    VIEW_ACTION: null,

    UPDATE_FILTER: null,
    RESET_FILTERS: null,
    CLEAR_FILTERS: null
  }),
  backendUrl: 'http://localhost:9998/',
  dateTimeSlider: {
    timeBetweenMinAndMaxExcl: Duration.ofHours(24),
    selectionGranularityInMinutes: 5
  }
};

exports.AppConstants = AppConstants;