'use strict';

import AppDispatcher from '../appDispatcher';
import AppConstants from '../appConstants';

export default {
  updateExcludedEdgeNodes: excludedEdgeNodes => {
    AppDispatcher.handleAction({
      actionType: AppConstants.ActionTypes.UPDATE_EXCLUDED_EDGE_NODES,
      data: excludedEdgeNodes
    });
  },
  emptyExcludedEdgeNodes: () => {
    AppDispatcher.handleAction({
      actionType: AppConstants.ActionTypes.EMPTY_EXCLUDED_EDGE_NODES
    });
  }
};
