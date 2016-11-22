'use strict';

import React from 'react';

class DisplayOptions extends React.Component {
  constructor (props) {
    super(props);
    this.state = {
      allowDraggingOfNodes: false,
      showLabels: true,
      dateTimeSliderVisibility: 'auto'
    };
  }

  componentWillReceiveProps (nextProps) {
    this.setState(nextProps.options);
  }

  _onCheckBoxChanged(event) {
    let checkBox = event.target;
    let statePropName = checkBox.id;
    let newState = {};
    newState[statePropName] = checkBox.checked;
    this.setState(newState);
    this.props.changedCallback(newState);
  }

  _onDateTimeSliderVisibilityChanged(event) {
    let newState = {
      dateTimeSliderVisibility: event.target.value,
    };
    this.setState(newState);
    this.props.changedCallback(newState);
  }

  render () {
    const allowDraggingOfNodes = this.state.allowDraggingOfNodes;
    const showLabels = this.state.showLabels;
    return (
      <div>
        <div>
          <input type="checkbox" id="allowDraggingOfNodes" checked={allowDraggingOfNodes} onChange={event => this._onCheckBoxChanged(event)}/>
          <label htmlFor="allowDraggingOfNodes">Allow dragging nodes</label>
        </div>
        <div>
          <input id="showLabels" type="checkbox" checked={showLabels} onChange={event => this._onCheckBoxChanged(event)}/>
          <label htmlFor="showLabels">Show Labels</label>
        </div>
        <div style={{whiteSpace: 'nowrap'}}>
          <label htmlFor="dateTimeSliderVisibility">Timeline slider visibility</label>
          <select value={this.state.dateTimeSliderVisibility} id="dateTimeSliderVisibility" onChange={event => this._onDateTimeSliderVisibilityChanged(event)}>
            <option value="auto">Auto</option>
            <option value="collapsed">Collapsed</option>
            <option value="visible">Visible</option>
          </select>
        </div>
      </div>
    );
  }
}

DisplayOptions.propTypes = {
  options: React.PropTypes.object.isRequired,
  changedCallback: React.PropTypes.func.isRequired
};

export default DisplayOptions;
