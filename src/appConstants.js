'use strict';
import keymirror from 'keymirror';
import { Duration } from 'js-joda';

export default {
  ActionTypes: keymirror({
    TRAFFIC_DATA_RECEIVED: null,
    SERVER_ACTION: null,
    VIEW_ACTION: null,

    UPDATE_FILTER: null,
    RESET_FILTERS: null,
    CLEAR_FILTERS: null
  }),
  dateTimeSlider: {
    timeBetweenMinAndMaxExcl: Duration.ofHours(48),
    selectionGranularityInMinutes: 5
  },
  // backendUrl: "http://dcspa15l.unix.anz:9998/",
  backendUrl: "http://localhost:9998/",
};
