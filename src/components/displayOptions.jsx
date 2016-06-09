'use strict';
import React from 'react';

class DisplayOptions extends React.Component {
  constructor (props) {
    super(props);
    this.state = {
      showLabels: true
    };
  }

  componentWillReceiveProps (nextProps) {
    this.setState(nextProps.options);
  }

  changeState (newState) {
    this.setState(newState);
    this.props.changedCallback(newState);
  }

  render () {
    const showLabels = this.state.showLabels;
    const showEdgeTable = this.state.showEdgeTable;

    return (
      <div>
        <div>
          <input type="checkbox" name="showLabels" value="labels" checked={showLabels} onChange={() => this.changeState({ showLabels: !showLabels })}/>
          <span style={{ cursor: 'default' }} onClick={() => this.changeState({ showLabels: !showLabels })}>Show Labels</span>
        </div>
        <div>
          <input type="checkbox" name="showEdgeTable" value="edgeTable" checked={showEdgeTable} onChange={() => this.changeState({ showEdgeTable: !showEdgeTable })}/>
          <span style={{ cursor: 'default' }} onClick={() => this.changeState({ showEdgeTable: !showEdgeTable })}>Show Edge Table</span>
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
