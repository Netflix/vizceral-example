'use strict';
import _ from 'lodash';
import React from 'react';
import numeral from 'numeral';

const nameFormatter = function (cell, row) {
  let className = 'glyphicon glyphicon-warning-sign';
  const mostSevereNotice = row.notices && row.notices.length > 0 && _.maxBy(row.notices, notice => notice.severity);
  if (mostSevereNotice) {
    className += ` severity${mostSevereNotice.severity}`;
  }

  const styles = {
    paddingLeft: '5px',
    opacity: row.disabled ? 0.3 : undefined
  };

  return (
    <span className={row.className} style={{ color: row.color }}>
      {cell}
      {
        mostSevereNotice ?
        <span style={styles} className={className} />
        : undefined
      }
    </span>);
};

class ConnectionList extends React.Component {
  constructor (props) {
    super(props);
    this.state = {
      connections: props.connections
    };
  }

  componentWillReceiveProps (nextProps) {
    this.setState({
      connections: nextProps.connections
    });
  }

  render () {
    const connectionRows = this.state.connections.map(connection => {
      const errors = connection.getErrorVolume();
      const total = connection.getTotalVolume();
      const disabled = !connection.isVisible();

      const classNames = [];
      if (disabled) {
        classNames.push('disabled');
      } else {
        const severity = connection.score;
        if (severity) { classNames.push(`severity${severity}`); }
      }

      return {
        name: this.props.direction === 'incoming' ? connection.source.getName() : connection.target.getName(),
        errorRate: errors / total || 0,
        errors: errors,
        total: total,
        className: classNames.join(' '),
        disabled: disabled,
        notices: connection.notices
      };
    }).sort((a, b) => {
      // Sort by error rate
      if (a.errorRate > b.errorRate) return -1;
      if (a.errorRate < b.errorRate) return 1;
      return 0;
    });

    return (
      connectionRows.length > 0 ?
      <div className="connection-list">
        <table class="table table-condensed" ref="connectionTable">
          <thead>
            <tr>
              <th data-unsortable="true" data-sort="serviceName">Cluster</th>
              <th data-sort="errorRate">Error Rate</th>
            </tr>
          </thead>
          <tbody>
            {connectionRows.map(row =>
              <tr key={row.name}>
                <td>{nameFormatter(row.name, row)}</td>
                <td><span className={row.className} data-error-rate={row.errorRate} style={{ color: row.color }} title={`${numeral(row.errors || 0).format('0.[00]')} / ${numeral(row.total || 0).format('0.[00]')}`}>{numeral(row.errorRate || 0).format('0.[00]%')}</span></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      : <span>None.</span>
    );
  }
}

ConnectionList.propTypes = {
  direction: React.PropTypes.string.isRequired,
  connections: React.PropTypes.array.isRequired
};

export default ConnectionList;
