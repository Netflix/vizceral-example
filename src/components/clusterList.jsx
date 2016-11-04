'use strict';
import _ from 'lodash';
import React from 'react';
import { OverlayTrigger, Popover } from 'react-bootstrap';
import { FlexTable, FlexColumn, SortDirection } from 'react-virtualized';
import numeral from 'numeral';
import 'react-virtualized/styles.css';

const nameRenderer = function (data) {
  return (<span className={data.rowData.className} title={data.rowData.name}>{data.rowData.name}</span>);
};

const errorRenderer = function (data) {
  return (
    <span className={data.rowData.className} title={`${numeral(data.rowData.errors || 0).format('0.[00]')} / ${numeral(data.rowData.total || 0).format('0.[00]')}`}>{numeral(data.rowData.errorRate || 0).format('0.[00]%')}</span>
  );
};

const totalRenderer = function (data) {
  return (
    <span className={data.rowData.className} title={numeral(data.rowData.total || 0).format('0.[00]')}>{numeral(data.rowData.totalPercent || 0).format('0.[00]%')}</span>
  );
};

const sorters = {
  name: (a, b) => {
    if (a.disabled && !b.disabled) { return 1; }
    if (!a.disabled && b.disabled) { return -1; }
    if (a.name < b.name) { return 1; }
    if (a.name > b.name) { return -1; }
    return 0;
  },
  errorRate: (a, b) => {
    if (a.disabled && !b.disabled) { return 1; }
    if (!a.disabled && b.disabled) { return -1; }
    if (a.errorRate < b.errorRate) { return 1; }
    if (a.errorRate > b.errorRate) { return -1; }
    return 0;
  },
  totalPercent: (a, b) => {
    if (a.disabled && !b.disabled) { return 1; }
    if (!a.disabled && b.disabled) { return -1; }
    if (a.total < b.total) { return 1; }
    if (a.total > b.total) { return -1; }
    return 0;
  }
};

class ClusterList extends React.Component {
  constructor (props) {
    super(props);
    this.state = {
      clusters: props.clusters,
      sortBy: 'totalPercent',
      sortDirection: SortDirection.ASC
    };

    this.linkPopover = (cluster) => {
      const atlasBackend = this.props.region ? `&backend=http:%2F%2Fatlas-main.${this.props.region}.prod.netflix.net:7001` : '';
      const atlasLink = `http://atlasui.prod.netflix.net/ui/graph?g.q=nf.cluster,${cluster.name},:eq,name,RequestStats-all-requests-_Num,:re,:and,:sum,(,name,),:by&g.e=now-1m&g.s=e-3h&g.tz=US%2FPacific&mode=png&vsplit=520px&sel=expr.0.0${atlasBackend}`;
      const spinnakerRegion = this.props.region ? `&reg=${this.props.region}` : '';
      const spinnakerLink = `https://spinnaker.prod.netflix.net/#/applications/${cluster.app}/clusters?acct=prod&q=cluster:${cluster.name}${spinnakerRegion}`;
      return (
        <Popover id="links-popover">
          <div className="links-popover-title">OPEN IN</div>
          <div className="links-popover-link"><a href={atlasLink} target="_blank">Atlas UI</a></div>
          <div className="links-popover-link"><a href={spinnakerLink} target="_blank">Spinnaker</a></div>
        </Popover>
      );
    };


    this.linkRenderer = data =>
      (data.rowData.app ? (
        <OverlayTrigger trigger="click" rootClose placement="bottom" overlay={this.linkPopover({ app: data.rowData.app, name: data.rowData.name })}>
          <div className={data.rowData.className} style={{ display: 'inline-block', cursor: 'pointer' }}><span className="glyphicon glyphicon-share"></span></div>
        </OverlayTrigger>
        ) : undefined);
  }

  componentWillReceiveProps (nextProps) {
    this.setState({
      clusters: nextProps.clusters
    });
  }

  render () {
    const headerHeight = 30;
    let estimatedRowHeight = 25;
    const maxTableHeight = 300;
    const trafficTotal = _.sum(_.flatten(_.map(this.state.clusters, c => _.values(c.metrics))));
    const clusterRows = _.map(this.state.clusters, (cluster) => {
      const total = _.sum(_.values(cluster.metrics));
      const totalPercent = total / trafficTotal;
      const errors = (cluster.metrics && cluster.metrics.danger) || 0;
      const errorRate = errors / total;
      let colorName;
      if (errorRate > 0.1) {
        colorName = 'danger';
      } else if (errorRate > 0.03) {
        colorName = 'warning';
      }
      const className = colorName ? `color-${colorName}` : '';

      return {
        name: cluster.name,
        errors: errors,
        total: total,
        errorRate: errorRate,
        totalPercent: totalPercent,
        app: cluster.app,
        className: className
      };
    });

    clusterRows.sort(sorters[this.state.sortBy]);
    if (this.state.sortDirection !== SortDirection.ASC) { _.reverse(clusterRows); }

    if (this.refs.flexTable && this.refs.flexTable.props.estimatedRowSize) {
      estimatedRowHeight = this.refs.flexTable.props.estimatedRowSize - 4;
    }
    const tableHeight = Math.min(maxTableHeight, (estimatedRowHeight * clusterRows.length) + headerHeight);


    return (
      clusterRows.length > 0 ?
      <div className="cluster-list">
        <FlexTable
          ref="flexTable"
          width={300}
          height={tableHeight}
          headerHeight={headerHeight}
          rowHeight={25}
          rowCount={clusterRows.length}
          rowGetter={({ index }) => clusterRows[index]}
          sortBy={this.state.sortBy}
          sortDirection={this.state.sortDirection}
          sort={this.sort}
        >
          <FlexColumn label="Name" dataKey="name" cellRenderer={nameRenderer} width={220} />
          <FlexColumn label="Errors" dataKey="errorRate" cellRenderer={errorRenderer} width={82}/>
          <FlexColumn label="Total" dataKey="totalPercent" cellRenderer={totalRenderer} width={70}/>
          <FlexColumn label="" dataKey="name" cellRenderer={this.linkRenderer} width={50}/>
        </FlexTable>
      </div>
      : <span>None.</span>
    );
  }

  sort = ({ sortBy, sortDirection }) => {
    this.setState({ sortBy, sortDirection });
  }
}

ClusterList.propTypes = {
  clusters: React.PropTypes.array.isRequired,
  region: React.PropTypes.string
};

export default ClusterList;
