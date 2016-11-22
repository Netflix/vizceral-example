'use strict';

import _ from 'lodash';
import React from 'react';
import { Tooltip, OverlayTrigger } from 'react-bootstrap';

import './updateStatus.css';

function msToTimeAgo (ms) {
  if (!ms) { return 'Unknown'; }
  const secs = Math.round(ms / 1000);
  const hours = Math.floor(secs / (60 * 60));

  const dM = secs % (60 * 60);
  const minutes = Math.floor(dM / 60);

  const dS = dM % 60;
  const seconds = Math.ceil(dS);

  const timeAgo = [];
  if (hours > 0) {
    timeAgo.push(`${hours}h`);
  }
  if (hours > 0 || minutes > 0) {
    timeAgo.push(`${minutes}m`);
  }
  timeAgo.push(`${seconds}s`);
  // return { h: hours, m: minutes, s: seconds };
  return timeAgo.join(':');
}

class UpdateStatus extends React.Component {
  constructor (props) {
    super(props);
    this.state = {
      status: this.updateFreshness(props.status)
    };
  }

  updateFreshness (status) {
    const currentTime = Date.now() - this.props.baseOffset;
    _.each(status, (s) => {
      s.fresh = currentTime - (s.updated || 0) < this.props.warnThreshold;
    });
    return status;
  }

  componentDidMount () {
    this.timer = setInterval(this.update.bind(this), 100);
  }

  componentWillUnmount () {
    clearInterval(this.timer);
  }

  update () {
    this.setState({ status: this.updateFreshness(this.props.status) });
  }

  render () {
    const freshData = _.every(this.state.status, status => status.fresh);
    const glyphClass = `glyphicon glyphicon-refresh ${freshData ? 'severity0' : 'severity1'}`;
    const now = Date.now();

    const tooltip = (
      <Tooltip id="update-status">
        <p className="header">Data last refreshed</p>
        <table className="table table-condensed table-borderless">
          <tbody>
            {
              this.props.status.map(status =>
                (
                  <tr key={status.region}>
                    <td>{status.region}:</td>
                    <td><span className={status.fresh ? 'severity0' : 'severity1'}>{ msToTimeAgo(now - status.updated) }</span></td>
                  </tr>
                )
              )
            }
          </tbody>
        </table>
      </Tooltip>
    );
    return (
      <div className="update-status">
        <OverlayTrigger placement="bottom" overlay={tooltip}>
          <span className={glyphClass}></span>
        </OverlayTrigger>
      </div>
    );
  }
}

UpdateStatus.propTypes = {
  status: React.PropTypes.arrayOf(React.PropTypes.shape({
    region: React.PropTypes.string,
    updated: React.PropTypes.number
  })),
  warnThreshold: React.PropTypes.number,
  baseOffset: React.PropTypes.number
};

export default UpdateStatus;
