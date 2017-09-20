'use strict';

import _ from 'lodash';
import React from 'react';
import { OverlayTrigger, Popover } from 'react-bootstrap';
import { Table, Column, SortDirection } from 'react-virtualized';
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

class SubNodeList extends React.Component {
  constructor (props) {
    super(props);
    this.state = {
      nodes: props.nodes,
      sortBy: 'totalPercent',
      sortDirection: SortDirection.ASC
    };

    this.linkPopover = (node) => {
      const atlasBackend = this.props.region ? `&backend=http:%2F%2Fatlas-main.${this.props.region}.prod.netflix.net:7001` : '';
      const atlasLink = `http://atlasui.prod.netflix.net/ui/graph?g.q=nf.cluster,${node.name},:eq,name,RequestStats-all-requests-_Num,:re,:and,:sum,(,name,),:by&g.e=now-1m&g.s=e-3h&g.tz=US%2FPacific&mode=png&vsplit=520px&sel=expr.0.0${atlasBackend}`;
      const spinnakerRegion = this.props.region ? `&reg=${this.props.region}` : '';
      const spinnakerLink = `https://spinnaker.prod.netflix.net/#/applications/${node.app}/clusters?acct=prod&q=cluster:${node.name}${spinnakerRegion}`;
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
      nodes: nextProps.nodes
    });
  }

  render () {
    const headerHeight = 30;
    let estimatedRowHeight = 25;
    const maxTableHeight = 300;
    const trafficTotal = _.sum(_.flatten(_.map(this.state.nodes, c => _.values(c.metrics))));
    const nodeRows = _.map(this.state.nodes, (node) => {
      const total = _.sum(_.values(node.metrics));
      const totalPercent = total / trafficTotal;
      const errors = (node.metrics && node.metrics.danger) || 0;
      const errorRate = errors / total;
      let colorName;
      if (errorRate > 0.1) {
        colorName = 'danger';
      } else if (errorRate > 0.03) {
        colorName = 'warning';
      }
      const className = colorName ? `color-${colorName}` : '';

      return {
        name: node.name,
        errors: errors,
        total: total,
        errorRate: errorRate,
        totalPercent: totalPercent,
        app: node.app,
        className: className
      };
    });

    nodeRows.sort(sorters[this.state.sortBy]);
    if (this.state.sortDirection !== SortDirection.ASC) { _.reverse(nodeRows); }

    if (this.refs.flexTable && this.refs.flexTable.props.estimatedRowSize) {
      estimatedRowHeight = this.refs.flexTable.props.estimatedRowSize - 4;
    }
    const tableHeight = Math.min(maxTableHeight, (estimatedRowHeight * nodeRows.length) + headerHeight);


    return (
      nodeRows.length > 0 ?
      <div className="node-list">
        <Table
          ref="flexTable"
          width={300}
          height={tableHeight}
          headerHeight={headerHeight}
          rowHeight={25}
          rowCount={nodeRows.length}
          rowGetter={({ index }) => nodeRows[index]}
          sortBy={this.state.sortBy}
          sortDirection={this.state.sortDirection}
          sort={this.sort}
        >
          <Column label="Name" dataKey="name" cellRenderer={nameRenderer} width={220} />
          <Column label="Errors" dataKey="errorRate" cellRenderer={errorRenderer} width={82}/>
          <Column label="Total" dataKey="totalPercent" cellRenderer={totalRenderer} width={70}/>
          <Column label="" dataKey="name" cellRenderer={this.linkRenderer} width={50}/>
        </Table>
      </div>
      : <span>None.</span>
    );
  }

  sort = ({ sortBy, sortDirection }) => {
    this.setState({ sortBy, sortDirection });
  }
}

SubNodeList.propTypes = {
  nodes: React.PropTypes.array.isRequired,
  region: React.PropTypes.string
};

export default SubNodeList;
