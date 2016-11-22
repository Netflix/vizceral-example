/* eslint no-restricted-syntax: 0 */

'use strict';

import React from 'react';

import Notices from './notices';

import './detailsPanel.css';

class DetailsPanelConnection extends React.Component {
  constructor (props) {
    super(props);
    this.state = {
      connection: props.connection,
      region: props.region
    };
  }

  componentWillReceiveProps (nextProps) {
    const newState = {
      region: nextProps.region,
      connection: nextProps.connection
    };

    this.setState(newState);
  }

  render () {
    const connection = this.state.connection;
    const notices = (connection && connection.notices) || [];

    return (
      <div className="details-panel">
        <div className="subsection">
          <div className="details-panel-title">{connection.getName()}
          </div>
          <div className="details-panel-close" onClick={this.props.closeCallback}>
            <span className="glyphicon glyphicon-remove" aria-hidden="true"></span>
          </div>
        </div>
        <Notices notices={notices} />
      </div>
    );
  }
}

DetailsPanelConnection.propTypes = {
  closeCallback: React.PropTypes.func.isRequired,
  connection: React.PropTypes.object.isRequired,
  nodeClicked: React.PropTypes.func,
  region: React.PropTypes.string
};

DetailsPanelConnection.defaultProps = {
  nodeClicked: () => {},
  region: ''
};

export default DetailsPanelConnection;
