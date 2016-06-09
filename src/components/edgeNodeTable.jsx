'use strict';

import _ from 'lodash';
import React from 'react';
import numeral from 'numeral';

import trafficActions from './trafficActions';
import trafficStore from './trafficStore';

require('./edgeNodeTable.css');

class EdgeNodes extends React.Component {
  constructor (props) {
    super(props);
    const excludedNodes = trafficStore.getExcludedEdgeNodes();
    const data = this.generateData(props.regionGraphs);
    this.state = {
      regionGraphs: props.regionGraphs,
      data: data,
      excluded: excludedNodes
    };

    this.onSelectBound = this.onSelect.bind(this);
    this.onSelectAllBound = this.onSelectAll.bind(this);

    this.handleTrafficStoreChangedBound = this.handleTrafficStoreChanged.bind(this);
  }

  generateData (regionGraphs) {
    const data = _.reduce(regionGraphs, (result, regionalData) => {
      const globalConnections = _.filter(regionalData.connections, ['source.name', 'INTERNET']);
      _.each(globalConnections, connection => {
        result[connection.target.name] = result[connection.target.name] || { name: connection.target.name };
        result[connection.target.name].volumeTotal = result[connection.target.name].volumeTotal || 0;
        result[connection.target.name].volumeTotal += connection.getTotalVolume();
        result[connection.target.name].volumeDegraded = result[connection.target.name].volumeDegraded || 0;
        result[connection.target.name].volumeDegraded += connection.getDegradedVolume();
        result[connection.target.name].volumeError = result[connection.target.name].volumeError || 0;
        result[connection.target.name].volumeError += connection.getErrorVolume();

        const severity = connection.target.getSeverity();
        result[connection.target.name].severity = Math.max(severity, result[connection.target.name].severity || 0);
      });
      return result;
    }, {});

    const total = _.reduce(data, (result, connection) => {
      result += (connection.volumeTotal + connection.volumeDegraded + connection.volumeError);
      return result;
    }, 0);

    _.each(data, connection => {
      connection.totalRate = connection.volumeTotal / total;
      connection.errorRate = connection.volumeError / connection.volumeTotal;
      connection.degradedRate = connection.volumeDegraded / connection.volumeTotal;
    });

    return data;
  }

  componentDidMount () {
    trafficStore.addChangeListener(this.handleTrafficStoreChangedBound);
  }

  componentWillUnmount () {
    trafficStore.removeChangeListener(this.handleTrafficStoreChangedBound);
  }

  generateIncluded () {
    return _.reduce(Object.keys(this.state.data), (result, name) => {
      if (!this.state.excluded.get(name)) { result.push(name); }
      return result;
    }, []);
  }

  handleTrafficStoreChanged () {
    const excluded = trafficStore.getExcludedEdgeNodes();
    this.setState({ excluded: excluded });
  }

  componentWillReceiveProps (nextProps) {
    const newState = {};
    newState.regionGraphs = nextProps.regionGraphs;
    newState.data = this.generateData(newState.regionGraphs);
    this.setState(newState);
  }

  onSelect (event) {
    const name = event.target.value;
    let excluded;
    if (event.target.checked) {
      excluded = this.state.excluded.delete(name);
    } else {
      excluded = this.state.excluded.set(name, true);
    }
    trafficActions.updateExcludedEdgeNodes(excluded);
  }

  onSelectAll (event) {
    if (event.target.checked) {
      trafficActions.emptyExcludedEdgeNodes();
    } else {
      const excluded = this.state.excluded.withMutations(map => {
        _.each(this.state.data, (d, nodeName) => {
          map.set(nodeName, true);
        });
      });
      trafficActions.updateExcludedEdgeNodes(excluded);
    }
  }

  render () {
    // const selectOptions = {
    //   mode: 'checkbox',
    //   selected: this.generateIncluded(),
    //   onSelect: this.onSelectBound,
    //   onSelectAll: this.onSelectAllBound
    // };

    return (
      <div className="edge-nodes">
        <div className="panel-group" role="tablist">
          <div className="panel panel-default">
            <div className="panel-heading" role="tab">
              <h4 className="panel-title">
                EDGE NODES
              </h4>
            </div>
            <div role="tabpanel">
              <div className="panel-body">
                <div className="subsection edge-node-table">
                  <table class="table table-condensed">
                    <thead>
                      <tr>
                        <th><input type="checkbox" checked={this.state.excluded.count() === 0} onChange={this.onSelectAllBound}/></th>
                        <th>Name</th>
                        <th>% Traffic</th>
                        <th>Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {
                        _.values(this.state.data).map(row => {
                          const totalPercent = row.volumeTotal === 0 ? '0%' : numeral(row.totalRate).format('0.00%');
                          const totalNumber = numeral(row.volumeTotal).format('0,0');
                          const errors = numeral(row.volumeError || 0).format('0.[00]');
                          const total = numeral(row.volumeTotal || 0).format('0.[00]');
                          const errorPercent = row.volumeTotal === 0 ? '0%' : numeral(row.errorRate + row.degradedRate).format('0.00%');

                          return (<tr key={row.name}>
                            <td><input type="checkbox" defaultValue={row.name} checked={!this.state.excluded.get(row.name)} onChange={this.onSelectBound}/></td>
                            <td>{row.name}</td>
                            <td><span className={`severity${row.severity}`} title={totalNumber}>{totalPercent}</span></td>
                            <td><span className={`severity${row.severity}`} title={`${errors} / ${total}`}>{errorPercent}</span></td>
                          </tr>);
                        })
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

EdgeNodes.propTypes = {
  regionGraphs: React.PropTypes.object.isRequired
};

export default EdgeNodes;
