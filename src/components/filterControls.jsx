'use strict';

import React from 'react';
import filterStore from './filterStore';
import filterActions from './filterActions';
import Stepper from './stepper';

import './controls.css';

class FilterControls extends React.Component {
  constructor (props) {
    super(props);
    this.state = {
      filters: filterStore.getFilters(),
      states: filterStore.getStates()
    };
  }

  componentDidMount () {
    filterStore.addChangeListener(this.onChange.bind(this));
  }

  componentWillUnmount () {
    filterStore.removeChangeListener(this.onChange.bind(this));
  }

  onChange () {
    this.setState({
      filters: filterStore.getFilters()
    });
  }

  rpsChanged (step) {
    filterActions.updateFilter({ rps: this.state.states.rps[step].value });
  }

  resetFilters () {
    filterActions.resetFilters();
  }

  render () {
    const defaultFilters = filterStore.isDefault();

    return (
        <div className="vizceral-controls-panel">
          <div className="vizceral-control">
            <span>RPS</span>
            <Stepper steps={this.state.states.rps} selectedStep={filterStore.getStepFromValue('rps')} changeCallback={(step) => { this.rpsChanged(step); }} />
          </div>
          <div className="vizceral-control">
            <button type="button" className="btn btn-default btn-block btn-xs" disabled={defaultFilters} onClick={this.resetFilters.bind(this)}>Reset Filters</button>
          </div>
        </div>
    );
  }
}

FilterControls.propTypes = {
};

export default FilterControls;
