'use strict';

import _ from 'lodash';
import EventEmitter from 'events';

import AppDispatcher from '../appDispatcher';
import AppConstants from '../appConstants';

const CHANGE_EVENT = 'change';

const defaultFilters = {
  rps: { value: -1 }
};

const noFilters = {
  rps: { value: -1 }
};

const store = {
  filters: {
    rps: {
      name: 'rps',
      type: 'connection',
      passes: (object, value) => object.volumeTotal >= value,
      value: -1
    }
  },
  states: {
    rps: [
      {
        name: 'high',
        value: 1000
      },
      {
        name: ' ',
        value: 300
      },
      {
        name: ' ',
        value: 5
      },
      {
        name: 'all',
        value: -1
      }
    ]
  }
};

const resetDefaults = function () {
  _.merge(store.filters, defaultFilters);
};

const clearFilters = function () {
  _.merge(store.filters, noFilters);
};

resetDefaults();

class FilterStore extends EventEmitter {
  constructor () {
    super();
    this.requests = {};

    AppDispatcher.register((payload) => {
      const action = payload.action;
      switch (action.actionType) {
      case AppConstants.ActionTypes.UPDATE_FILTER:
        this.updateFilters(action.data);
        this.emit(CHANGE_EVENT);
        break;
      case AppConstants.ActionTypes.RESET_FILTERS:
        resetDefaults();
        this.emit(CHANGE_EVENT);
        break;
      case AppConstants.ActionTypes.CLEAR_FILTERS:
        clearFilters();
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

  getFilters () {
    return store.filters;
  }

  getFiltersArray () {
    return _.map(store.filters, filter => _.clone(filter));
  }

  getStates () {
    return store.states;
  }

  getChangedFilters () {
    return _.filter(store.filters, filter => filter.value !== defaultFilters[filter.name].value);
  }

  getStepFromValue (name) {
    const index = _.findIndex(store.states[name], step => step.value === store.filters[name].value);
    if (index === -1) {
      return _.findIndex(store.states[name], step => step.value === defaultFilters[name].value);
    }
    return index;
  }

  updateFilters (filters) {
    Object.keys(filters).forEach((filter) => {
      store.filters[filter].value = filters[filter];
    });
  }

  isDefault () {
    return _.every(store.filters, filter => filter.value === defaultFilters[filter.name].value);
  }

  isClear () {
    return _.every(store.filters, filter => filter.value === noFilters[filter.name].value);
  }
}

const filterStore = new FilterStore();

export default filterStore;
