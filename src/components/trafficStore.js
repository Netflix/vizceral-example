'use strict';

import Immutable from 'immutable';

import AppDispatcher from '../appDispatcher';
import AppConstants from '../appConstants';
import EventEmitter from 'events';

const CHANGE_EVENT = 'change';

let store = Immutable.Map({
  excludedEdgeNodes: Immutable.Map()
});

class TrafficStore extends EventEmitter {
  constructor () {
    super();

    AppDispatcher.register(payload => {
      const action = payload.action;
      switch (action.actionType) {
      case AppConstants.ActionTypes.UPDATE_EXCLUDED_EDGE_NODES:
        this.updateExcludedEdgeNodes(action.data);
        this.emit(CHANGE_EVENT);
        break;
      case AppConstants.ActionTypes.EMPTY_EXCLUDED_EDGE_NODES:
        this.emptyExcludedEdgeNodes();
        this.emit(CHANGE_EVENT);
        break;
      default:
        return true;
      }
      return true;
    });
  }

  addChangeListener (cb) {
    this.on(CHANGE_EVENT, cb);
  }

  removeChangeListener (cb) {
    this.removeListener(CHANGE_EVENT, cb);
  }

  getExcludedEdgeNodes () {
    return store.get('excludedEdgeNodes');
  }

  updateExcludedEdgeNodes (excludedEdgeNodes) {
    store = store.set('excludedEdgeNodes', excludedEdgeNodes);
  }

  emptyExcludedEdgeNodes () {
    store = store.set('excludedEdgeNodes', store.get('excludedEdgeNodes').clear());
  }
}

const trafficStore = new TrafficStore();

export default trafficStore;
