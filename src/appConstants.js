'use strict';

import keymirror from 'keymirror';

const AppConstants = {
  ActionTypes: keymirror({
    TRAFFIC_DATA_RECEIVED: null,
    SERVER_ACTION: null,
    VIEW_ACTION: null,

    UPDATE_FILTER: null,
    RESET_FILTERS: null,
    CLEAR_FILTERS: null
  })
};

export default AppConstants;
