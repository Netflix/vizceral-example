'use strict';

import _ from 'lodash';
import { Alert } from 'react-bootstrap';
import React from 'react';
import TWEEN from 'tween.js'; // Start TWEEN updates for sparklines and loading screen fading out
import Vizceral from 'vizceral-react';
import 'vizceral-react/dist/vizceral.css';
import keypress from 'keypress.js';
import queryString from 'query-string';
import request from 'superagent';

import Breadcrumbs from './breadcrumbs';
import DisplayOptions from './displayOptions';
import FilterControls from './filterControls';
import DetailsPanelConnection from './detailsPanelConnection';
import DetailsPanelNode from './detailsPanelNode';
import LoadingCover from './loadingCover';
import Locator from './locator';
import OptionsPanel from './optionsPanel';
import UpdateStatus from './updateStatus';

import filterActions from './filterActions';
import filterStore from './filterStore';

const listener = new keypress.Listener();

function animate (time) {
  requestAnimationFrame(animate);
  TWEEN.update(time);
}
requestAnimationFrame(animate);

const panelWidth = 400;

class TrafficFlow extends React.Component {
  constructor (props) {
    super(props);
    this.state = {
      currentView: undefined,
      redirectedFrom: undefined,
      selectedChart: undefined,
      displayOptions: {
        showLabels: true
      },
      labelDimensions: {},
      appliedFilters: filterStore.getChangedFilters(),
      filters: filterStore.getFiltersArray(),
      searchTerm: '',
      matches: {
        total: -1,
        visible: -1
      },
      trafficData: {
        nodes: [],
        connections: []
      },
      regionUpdateStatus: [],
      timeOffset: 0,
      modes: {
        detailedNode: 'volume'
      },
      styles: {
        colorText: 'rgb(214, 214, 214)', // ????
        colorTextDisabled: 'rgb( 1, 31, 56)', // ????
        colorTraffic: {
          normal: 'rgb(6, 247, 201)', // Traffic + Labels + %
          normalDonut: 'rgb(56, 247, 201)', // Color1 outside Donut
          warning: 'rgb(238, 244, 6)', // in Cluster- warning triangle
          danger: 'rgb(129, 21, 255)', //inside Cluster, danger
        },
        colorNormalDimmed: 'rgb( 50, 109, 230)', // text: TOTAL RPS, ERROR RATE
        colorBackgroundDark: 'rgb( 1, 31, 56)', // ????
        colorLabelBorder: 'rgb( 1, 31, 56)', // ???
        colorLabelText: 'rgb( 1, 31, 56)', // Color text inside labels + inside cluster circles
        colorDonutInternalColor: 'rgb(1, 31, 56)', // Color inside donuts
        colorDonutInternalColorHighlighted: 'rgb(18, 255, 97)', // ???
        colorConnectionLine: 'rgb(160, 202, 234)', // Lines in Clutser from INTERNET outside
        colorPageBackground: 'rgb(1, 31, 56)', // Color 2 outside donut
        colorPageBackgroundTransparent: 'rgba(0, 0, 0, 0.8)',  // ????
        colorBorderLines: 'rgb(193, 193, 72)', // ???
        colorArcBackground: 'rgb(193, 193, 72)'  // ???
      }
    };

    // Browser history support
    window.addEventListener('popstate', event => this.handlePopState(event.state));

    // Keyboard interactivity
    listener.simple_combo('esc', () => {
      if (this.state.detailedNode) {
        this.setState({ detailedNode: undefined });
      } else if (this.state.currentView.length > 0) {
        this.setState({ currentView: this.state.currentView.slice(0, -1) });
      }
    });
  }

  handlePopState () {
    const state = window.history.state || {};
    this.poppedState = true;
    this.setState({ currentView: state.selected, objectToHighlight: state.highlighted });
  }

  viewChanged = (data) => {
    this.setState({ currentView: data.view, currentGraph: data.graph, searchTerm: '', matches: { total: -1, visible: -1 }, redirectedFrom: data.redirectedFrom });
  }

  viewUpdated = () => {
    this.setState({});
  }

  objectHighlighted = (highlightedObject) => {
    // need to set objectToHighlight for diffing on the react component. since it was already highlighted here, it will be a noop
    this.setState({ highlightedObject: highlightedObject, objectToHighlight: highlightedObject ? highlightedObject.getName() : undefined, searchTerm: '', matches: { total: -1, visible: -1 }, redirectedFrom: undefined });
  }

  nodeContextSizeChanged = (dimensions) => {
    this.setState({ labelDimensions: dimensions });
  }

  checkInitialRoute () {
    // Check the location bar for any direct routing information
    const pathArray = window.location.pathname.split('/');
    const currentView = [];
    if (pathArray[1]) {
      currentView.push(pathArray[1]);
      if (pathArray[2]) {
        currentView.push(pathArray[2]);
      }
    }
    const parsedQuery = queryString.parse(window.location.search);

    this.setState({ currentView: currentView, objectToHighlight: parsedQuery.highlighted });
  }

  beginSampleData () {
    this.traffic = { nodes: [], connections: [] };
    request.get('sample_data.json')
      .set('Accept', 'application/json')
      .end((err, res) => {
        if (res && res.status === 200) {
          this.traffic.clientUpdateTime = Date.now();
          this.updateData(res.body);
        }
      });
  }

  componentDidMount () {
    this.checkInitialRoute();
    this.beginSampleData();

    // Listen for changes to the stores
    filterStore.addChangeListener(this.filtersChanged);
  }

  componentWillUnmount () {
    filterStore.removeChangeListener(this.filtersChanged);
  }

  shouldComponentUpdate (nextProps, nextState) {
    if (!this.state.currentView ||
        this.state.currentView[0] !== nextState.currentView[0] ||
        this.state.currentView[1] !== nextState.currentView[1] ||
        this.state.highlightedObject !== nextState.highlightedObject) {
      const titleArray = (nextState.currentView || []).slice(0);
      titleArray.unshift('Vizceral');
      // document.title = titleArray.join(' / ');

      if (this.poppedState) {
        this.poppedState = false;
      } else if (nextState.currentView) {
        const highlightedObjectName = nextState.highlightedObject && nextState.highlightedObject.getName();
        const state = {
          title: document.title,
          url: nextState.currentView.join('/') + (highlightedObjectName ? `?highlighted=${highlightedObjectName}` : ''),
          selected: nextState.currentView,
          highlighted: highlightedObjectName
        };
        window.history.pushState(state, state.title, state.url);
      }
    }
    return true;
  }

  updateData (newTraffic) {
    const updatedTraffic = {
      name: newTraffic.name,
      renderer: newTraffic.renderer,
      nodes: [],
      connections: []
    };

    _.each(this.state.trafficData.nodes, node => updatedTraffic.nodes.push(node));
    _.each(this.state.trafficData.connections, connection => updatedTraffic.connections.push(connection));

    let modified = false;
    if (newTraffic) {
      modified = true;
      // Update the traffic graphs with the new state
      _.each(newTraffic.nodes, (node) => {
        const existingNodeIndex = _.findIndex(updatedTraffic.nodes, { name: node.name });
        if (existingNodeIndex !== -1) {
          if (node.nodes && node.nodes.length > 0) {
            node.updated = node.updated || updatedTraffic.nodes[existingNodeIndex].updated;
            updatedTraffic.nodes[existingNodeIndex] = node;
          }
        } else {
          updatedTraffic.nodes.push(node);
        }
      });
      _.each(newTraffic.connections, (connection) => {
        const existingConnectionIndex = _.findIndex(updatedTraffic.connections, { source: connection.source, target: connection.target });
        if (existingConnectionIndex !== -1) {
          updatedTraffic.connections[existingConnectionIndex] = connection;
        } else {
          updatedTraffic.connections.push(connection);
        }
      });
    }

    if (modified) {
      const regionUpdateStatus = _.map(_.filter(updatedTraffic.nodes, n => n.name !== 'INTERNET'), (node) => {
        const updated = node.updated;
        return { region: node.name, updated: updated };
      });
      const lastUpdatedTime = _.max(_.map(regionUpdateStatus, 'updated'));
      this.setState({
        regionUpdateStatus: regionUpdateStatus,
        timeOffset: newTraffic.clientUpdateTime - newTraffic.serverUpdateTime,
        lastUpdatedTime: lastUpdatedTime,
        trafficData: updatedTraffic
      });
    }
  }

  isSelectedNode () {
    return this.state.currentView && this.state.currentView[1] !== undefined;
  }

  zoomCallback = () => {
    const currentView = _.clone(this.state.currentView);
    if (currentView.length === 1 && this.state.focusedNode) {
      currentView.push(this.state.focusedNode.name);
    } else if (currentView.length === 2) {
      currentView.pop();
    }
    this.setState({ currentView: currentView });
  }

  displayOptionsChanged = (options) => {
    const displayOptions = _.merge({}, this.state.displayOptions, options);
    this.setState({ displayOptions: displayOptions });
  }

  navigationCallback = (newNavigationState) => {
    this.setState({ currentView: newNavigationState });
  }

  detailsClosed = () => {
    // If there is a selected node, deselect the node
    if (this.isSelectedNode()) {
      this.setState({ currentView: [this.state.currentView[0]] });
    } else {
      // If there is just a detailed node, remove the detailed node.
      this.setState({ focusedNode: undefined, highlightedObject: undefined });
    }
  }

  filtersChanged = () => {
    this.setState({
      appliedFilters: filterStore.getChangedFilters(),
      filters: filterStore.getFiltersArray()
    });
  }

  filtersCleared = () => {
    if (!filterStore.isClear()) {
      if (!filterStore.isDefault()) {
        filterActions.resetFilters();
      } else {
        filterActions.clearFilters();
      }
    }
  }

  locatorChanged = (value) => {
    this.setState({ searchTerm: value });
  }

  matchesFound = (matches) => {
    this.setState({ matches: matches });
  }

  nodeClicked = (node) => {
    if (this.state.currentView.length === 1) {
      // highlight node
      this.setState({ objectToHighlight: node.getName() });
    } else if (this.state.currentView.length === 2) {
      // detailed view of node
      this.setState({ currentView: [this.state.currentView[0], node.getName()] });
    }
  }

  dismissAlert = () => {
    this.setState({ redirectedFrom: undefined });
  }

  render () {
    const globalView = this.state.currentView && this.state.currentView.length === 0;
    const nodeView = !globalView && this.state.currentView && this.state.currentView[1] !== undefined;
    let nodeToShowDetails = this.state.currentGraph && this.state.currentGraph.type === 'focused' ? this.state.currentGraph.focusedNode : undefined;
    nodeToShowDetails = nodeToShowDetails || (this.state.highlightedObject && this.state.highlightedObject.type === 'node' ? this.state.highlightedObject : undefined);
    const connectionToShowDetails = this.state.highlightedObject && this.state.highlightedObject.type === 'connection' ? this.state.highlightedObject : undefined;
    const showLoadingCover = !this.state.currentGraph;

    let matches;
    if (this.state.currentGraph) {
      matches = {
        totalMatches: this.state.matches.total,
        visibleMatches: this.state.matches.visible,
        total: this.state.currentGraph.nodeCounts.total,
        visible: this.state.currentGraph.nodeCounts.visible
      };
    }

    return (
      <div className="vizceral-container">
        { this.state.redirectedFrom ?
          <Alert onDismiss={this.dismissAlert}>
            <strong>{this.state.redirectedFrom.join('/') || '/'}</strong> does not exist, you were redirected to <strong>{this.state.currentView.join('/') || '/'}</strong> instead
          </Alert>
        : undefined }
        <div className="subheader">
          <Breadcrumbs rootTitle="global" navigationStack={this.state.currentView || []} navigationCallback={this.navigationCallback} />
          <UpdateStatus status={this.state.regionUpdateStatus} baseOffset={this.state.timeOffset} warnThreshold={180000} />
          <div style={{ float: 'right', paddingTop: '4px' }}>
            { (!globalView && matches) && <Locator changeCallback={this.locatorChanged} searchTerm={this.state.searchTerm} matches={matches} clearFilterCallback={this.filtersCleared} /> }
            <OptionsPanel title="Filters"><FilterControls /></OptionsPanel>
            <OptionsPanel title="Display"><DisplayOptions options={this.state.displayOptions} changedCallback={this.displayOptionsChanged} /></OptionsPanel>
          </div>
        </div>
        <div><h1> sdwedfew</h1></div>
        <div className="service-traffic-map">
          <div style={{ position: 'absolute', top: '0px', right: nodeToShowDetails || connectionToShowDetails ? '380px' : '0px', bottom: '0px', left: '0px' }}>
            <Vizceral traffic={this.state.trafficData}
                      view={this.state.currentView}
                      showLabels={this.state.displayOptions.showLabels}
                      filters={this.state.filters}
                      viewChanged={this.viewChanged}
                      viewUpdated={this.viewUpdated}
                      objectHighlighted={this.objectHighlighted}
                      nodeContextSizeChanged={this.nodeContextSizeChanged}
                      objectToHighlight={this.state.objectToHighlight}
                      matchesFound={this.matchesFound}
                      match={this.state.searchTerm}
                      modes={this.state.modes}
                      styles={this.state.styles}
            />
          </div>
          {
            !!nodeToShowDetails &&
            <DetailsPanelNode node={nodeToShowDetails}
                              nodeSelected={nodeView}
                              region={this.state.currentView[0]}
                              width={panelWidth}
                              zoomCallback={this.zoomCallback}
                              closeCallback={this.detailsClosed}
                              nodeClicked={node => this.nodeClicked(node)}
            />
          }
          {
            !!connectionToShowDetails &&
            <DetailsPanelConnection connection={connectionToShowDetails}
                                    region={this.state.currentView[0]}
                                    width={panelWidth}
                                    closeCallback={this.detailsClosed}
                                    nodeClicked={node => this.nodeClicked(node)}
            />
          }
          <LoadingCover show={showLoadingCover} />
        </div>
      </div>
    );
  }
}

TrafficFlow.propTypes = {
};

export default TrafficFlow;
