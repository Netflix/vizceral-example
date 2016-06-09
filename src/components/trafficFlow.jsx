'use strict';
import _ from 'lodash';
import React from 'react';
import keypress from 'keypress.js';
import request from 'superagent';

import Vizceral from 'vizceral-react';
require('vizceral-react/dist/vizceral.css');

import Breadcrumbs from './breadcrumbs';
import DisplayOptions from './displayOptions';
import EdgeNodeTable from './edgeNodeTable';
import FilterControls from './filterControls';
import NodeDetails from './nodeDetails';
import LoadingCover from './loadingCover';
import Locator from './locator';
import OptionsPanel from './optionsPanel';
import UpdateStatus from './updateStatus';

import filterActions from './filterActions';
import filterStore from './filterStore';
import trafficActions from './trafficActions';
import trafficStore from './trafficStore';

const listener = new keypress.Listener();

// Start TWEEN updates for sparklines and loading screen fading out
import TWEEN from 'tween.js';
function animate (time) {
  requestAnimationFrame(animate);
  TWEEN.update(time);
}
requestAnimationFrame(animate);

const Console = console;
const nodeDetailsSidePanelWidth = 400;

class TrafficFlow extends React.Component {
  constructor (props) {
    super(props);
    this.state = {
      currentView: [],
      selectedChart: undefined,
      displayOptions: {
        showLabels: true,
        showEdgeTable: false
      },
      labelDimensions: {},
      appliedFilters: filterStore.getChangedFilters(),
      filters: filterStore.getFiltersArray(),
      graphs: { regions: {} },
      renderedGraphs: {},
      searchTerm: '',
      matches: {
        total: -1,
        visible: -1
      },
      trafficData: {},
      excludedEdgeNodes: trafficStore.getExcludedEdgeNodes().keySeq().toArray(),
      regionUpdateStatus: [],
      timeOffset: 0
    };
    this.traffic = {};
    this.nodeDetailsPanelOffset = 0;

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
    this.setState({ currentView: state.selected });
  }

  viewChanged = data => {
    trafficActions.emptyExcludedEdgeNodes();
    this.setState({ currentView: data.view, currentGraph: data.graph, nodeFocused: undefined, nodeHighlighted: undefined, searchTerm: '', matches: { total: -1, visible: -1 } });
  }

  nodeHighlighted = node => {
    this.setState({ highlightedNode: node, searchTerm: '', matches: { total: -1, visible: -1 } });
  }

  rendered = data => {
    const renderedGraphs = _.clone(this.state.renderedGraphs);
    renderedGraphs[data.name] = data.rendered;
    this.setState({ renderedGraphs: renderedGraphs });
  }

  nodeFocused = node => {
    this.setState({ focusedNode: node });
  }

  regionContextSizeChanged = dimensions => {
    this.setState({ labelDimensions: dimensions });
  }

  beginSampleData () {
    request.get('sample_data.json')
      .set('Accept', 'application/json')
      .end((err, res) => {
        if (res && res.status === 200) {
          this.traffic.clientUpdateTime = Date.now();
          const regions = res.body.regions;
          const regionNames = Object.keys(regions);
          // Set the regions to render
          this.setRegions(regionNames);

          // Fake latencies to get the data to show the loading regions
          let mult = 1;

          _.each(regionNames, region => {
            const data = {};
            data[region] = regions[region];
            _.delay(() => this.updateData({ regions: data }), 750 * mult);
            mult++;
          });
        }
      });
  }

  checkRoute () {
    const pathArray = window.location.pathname.split('/');
    const currentView = [];
    if (pathArray[1]) {
      currentView.push(pathArray[1]);
      if (pathArray[2]) {
        currentView.push(pathArray[2]);
      }
    }

    this.setState({ currentView: currentView });
  }

  componentDidMount () {
    this.checkRoute();
    this.beginSampleData();

    // Listen for changes to the stores
    filterStore.addChangeListener(this.filtersChanged);
    trafficStore.addChangeListener(this.trafficStoreChanged);
  }

  setRegions (regions) {
    this.traffic.regions = this.traffic.regions || {};
    _.each(regions, region => {
      this.traffic.regions[region] = this.traffic.regions[region] || {};
    });

    this.updateData(this.traffic, this.state.excludedEdgeNodes);
  }

  componentWillUnmount () {
    filterStore.removeChangeListener(this.filtersChanged);
    trafficStore.removeChangeListener(this.trafficStoreChanged);
  }

  shouldComponentUpdate (nextProps, nextState) {
    if (nextState.excludedEdgeNodes !== this.state.excludedEdgeNodes) {
      this.updateData(this.traffic, nextState.excludedEdgeNodes);
    }

    if (!this.state.currentView || this.state.currentView[0] !== nextState.currentView[0] ||
        this.state.currentView[1] !== nextState.currentView[1]) {
      const titleArray = (nextState.currentView || []).slice(0);
      titleArray.unshift('Vizceral');
      document.title = titleArray.join(' / ');

      if (nextState.currentView) {
        const state = {
          title: document.title,
          url: nextState.currentView.join('/'),
          selected: nextState.currentView
        };
        window.history.pushState(state, state.title, state.url);
      }
    }
    return true;
  }

  updateData (newTraffic, excludedEdgeNodes) {
    excludedEdgeNodes = excludedEdgeNodes || this.state.excludedEdgeNodes;
    const traffic = { regions: {} };
    if (this.traffic) {
      _.each(this.traffic.regions, (data, region) => {
        traffic.regions[region] = data;
      });
    }

    let modified = false;
    if (newTraffic && newTraffic.regions) {
      modified = true;
      Console.info(`Updated regional traffic data received for ${Object.keys(newTraffic.regions).join(',')}.`);
      // Update the traffic graphs with the new state
      _.each(newTraffic.regions, (regionData, regionName) => {
        traffic.regions[regionName] = regionData;
      });
      this.traffic = traffic;
    }

    if (modified) {
      this.setState({
        regionUpdateStatus: _.map(this.traffic.regions, (regionData, region) => {
          const updated = regionData.updated;
          return { region: region, updated: updated };
        }),
        timeOffset: newTraffic.clientUpdateTime - newTraffic.serverUpdateTime,
        trafficData: this.traffic,
        excludedEdgeNodes: excludedEdgeNodes
      });
    }
  }

  isFocusedNode () {
    return !this.isSelectedNode()
      && this.state.currentView
      && this.state.currentView[0] !== undefined
      && this.state.focusedNode !== undefined;
  }

  isSelectedNode () {
    return this.state.currentView && this.state.currentView[1] !== undefined;
  }

  zoomCallback = () => {
    const currentView = _.clone(this.state.currentView);
    if (currentView.length === 1) {
      currentView.push(this.state.foucsedNode.name);
    } else if (currentView.length === 2) {
      currentView.pop();
    }
    this.setState({ currentView: currentView });
  }

  displayOptionsChanged = options => {
    const displayOptions = _.merge({}, this.state.displayOptions, options);
    this.setState({ displayOptions: displayOptions });
  }

  navigationCallback = newNavigationState => {
    this.setState({ currentView: newNavigationState });
  }

  detailsClosed = () => {
    // If there is a selected node, deselect the node
    if (this.isSelectedNode()) {
      this.setState({ currentView: [this.state.currentView[0]] });
    } else if (this.isFocusedNode()) {
      // If there is just a detailed node, remove the detailed node.
      this.setState({ focusedNode: undefined, highlightedNode: undefined });
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

  trafficStoreChanged = () => {
    this.setState({ excludedEdgeNodes: trafficStore.getExcludedEdgeNodes().keySeq().toArray() });
  }

  locatorChanged = value => {
    this.setState({ searchTerm: value });
  }

  chartChanged = chartName => {
    this.setState({ selectedChart: chartName });
  }

  matchesFound = matches => {
    this.setState({ matches: matches });
  }

  graphsUpdated = graphs => {
    this.setState({ graphs: graphs });
  }

  render () {
    const globalView = this.state.currentView && this.state.currentView.length === 0;
    const nodeView = !globalView && this.state.currentView && this.state.currentView[1] !== undefined;
    const nodeToShowDetails = this.state.focusedNode || this.state.highlightedNode;
    const showLoadingCover = !!(this.state.currentView && this.state.currentView[0] && !this.state.renderedGraphs[this.state.currentView[0]]);

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
        <div className="subheader">
          <Breadcrumbs rootTitle="global" navigationStack={this.state.currentView || []} navigationCallback={this.navigationCallback} />
          <UpdateStatus status={this.state.regionUpdateStatus} baseOffset={this.state.timeOffset} warnThreshold={180000} />
          <div style={{ float: 'right', paddingTop: '2px' }}>
            { (!globalView && matches) && <Locator changeCallback={this.locatorChanged} searchTerm={this.state.searchTerm} matches={matches} clearFilterCallback={this.filtersCleared} /> }
            <OptionsPanel title="Filters"><FilterControls /></OptionsPanel>
            <OptionsPanel title="Display"><DisplayOptions options={this.state.displayOptions} changedCallback={this.displayOptionsChanged} /></OptionsPanel>
          </div>
        </div>
        <div className="service-traffic-map">
          <div style={{ position: 'absolute', top: '0px', right: !!nodeToShowDetails ? '380px' : '0px', bottom: '0px', left: '0px' }}>
            <Vizceral traffic={this.state.trafficData}
                      excludedEdgeNodes={this.state.excludedEdgeNodes}
                      view={this.state.currentView}
                      showLabels={this.state.displayOptions.showLabels}
                      filters={this.state.filters}
                      graphsUpdated={this.graphsUpdated}
                      viewChanged={this.viewChanged}
                      nodeHighlighted={this.nodeHighlighted}
                      rendered={this.rendered}
                      nodeFocused={this.nodeFocused}
                      regionContextSizeChanged={this.regionContextSizeChanged}
                      matchesFound={this.matchesFound}
                      match={this.state.searchTerm}
            />
          </div>
          {
            !!nodeToShowDetails &&
            <NodeDetails node={nodeToShowDetails} nodeSelected={nodeView} region={this.state.currentView[0]} width={nodeDetailsSidePanelWidth} zoomCallback={this.zoomCallback} closeCallback={this.detailsClosed} />
          }
          {
            (globalView && this.state.displayOptions.showEdgeTable) &&
            <EdgeNodeTable regionGraphs={this.state.graphs.regions} />
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
