'use strict';
import _ from 'lodash';
import React from 'react';
import TWEEN from 'tween.js'; // Start TWEEN updates for sparklines and loading screen fading out
import keypress from 'keypress.js';
import request from 'superagent';
import Vizceral from 'vizceral-react';
import 'vizceral-react/dist/vizceral.css';

import Breadcrumbs from './breadcrumbs';
import DisplayOptions from './displayOptions';
import FilterControls from './filterControls';
import NodeDetails from './nodeDetails';
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
      currentView: [],
      selectedChart: undefined,
      displayOptions: {
        showLabels: true
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
      regionUpdateStatus: [],
      timeOffset: 0,
      modes: {
        detailedNode: 'volume'
      }
    };
    this.traffic = { nodes: [], connections: [] };
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

  nodeContextSizeChanged = dimensions => {
    this.setState({ labelDimensions: dimensions });
  }

  beginSampleData () {
    request.get('topic_channel.json')
      .set('Accept', 'application/json')
      .end((err, res) => {
        if (res && res.status === 200) {
          this.traffic.clientUpdateTime = Date.now();
          this.updateData(res.body);
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

  fetchData () {
    request.get('http://192.168.33.10:7880/vizc')
      .set('Accept', 'application/json')
      .end((req, res) => {
        if (res && res.status === 200) {
          const body = JSON.parse(res.text);
          this.traffic.clientUpdateTime = Date.now();
          this.updateData(body);
        }
      });
  }

  componentDidMount () {
    // Check the location bar for any direct routing information
    this.checkRoute();
    this.fetchData();

    setTimeout(() => {
      this.fetchData()
    }, 60 * 1000);
    // Listen for changes to the stores
    filterStore.addChangeListener(this.filtersChanged);
  };

  componentWillUnmount () {
    filterStore.removeChangeListener(this.filtersChanged);
  }

  shouldComponentUpdate (nextProps, nextState) {
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

  updateData (newTraffic) {
    this.traffic.name = newTraffic.name;
    this.traffic.renderer = newTraffic.renderer;

    let modified = false;
    if (newTraffic) {
      modified = true;
      // Update the traffic graphs with the new state
      _.each(newTraffic.nodes, node => {
        const existingNodeIndex = _.findIndex(this.traffic.nodes, { name: node.name });
        if (existingNodeIndex !== -1) {
          node.updated = node.updated || this.traffic.nodes[existingNodeIndex].updated;
          this.traffic.nodes[existingNodeIndex] = node;
        } else {
          this.traffic.nodes.push(node);
        }
      });
      _.each(newTraffic.connections, connection => {
        const existingConnectionIndex = _.findIndex(this.traffic.connections, { source: connection.source, target: connection.target });
        if (existingConnectionIndex !== -1) {
          this.traffic.connections[existingConnectionIndex] = connection;
        } else {
          this.traffic.connections.push(connection);
        }
      });
    }

    if (modified) {
      this.setState({
        regionUpdateStatus: _.map(_.filter(this.traffic.nodes, n => n.name !== 'INTERNET'), node => {
          const updated = node.updated;
          return { region: node.name, updated: updated };
        }),
        timeOffset: newTraffic.clientUpdateTime - newTraffic.serverUpdateTime,
        trafficData: _.cloneDeep(this.traffic)
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
    } else {
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
          <div style={{ position: 'absolute', top: '0px', right: nodeToShowDetails ? '380px' : '0px', bottom: '0px', left: '0px' }}>
            <Vizceral traffic={this.state.trafficData}
                      view={this.state.currentView}
                      showLabels={this.state.displayOptions.showLabels}
                      filters={this.state.filters}
                      graphsUpdated={this.graphsUpdated}
                      viewChanged={this.viewChanged}
                      nodeHighlighted={this.nodeHighlighted}
                      rendered={this.rendered}
                      nodeFocused={this.nodeFocused}
                      nodeContextSizeChanged={this.nodeContextSizeChanged}
                      matchesFound={this.matchesFound}
                      match={this.state.searchTerm}
                      modes={this.state.modes}
            />
          </div>
          {
            !!nodeToShowDetails &&
            <NodeDetails node={nodeToShowDetails} nodeSelected={nodeView} region={this.state.currentView[0]} width={panelWidth} zoomCallback={this.zoomCallback} closeCallback={this.detailsClosed} />
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
