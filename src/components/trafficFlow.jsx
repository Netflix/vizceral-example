'use strict';
import _ from 'lodash';
import { Alert } from 'react-bootstrap';
import { ChronoUnit, DateTimeFormatter, Duration, ZonedDateTime, ZoneOffset, ZoneId } from 'js-joda';
import { DateTime_floorToGranularity, ZonedDateTime_parse } from '../dateTimeUtil';
import Promise from 'bluebird';
import React from 'react';
import TWEEN from 'tween.js'; // Start TWEEN updates for sparklines and loading screen fading out
import Vizceral from 'vizceral-react';
import 'vizceral-react/dist/vizceral.css';
import keypress from 'keypress.js';
import queryString from 'query-string';
import request from 'superagent';

import './trafficFlow.css';
import { AppConstants } from '../appConstants';
import { Backend } from '../data/backend';
import Breadcrumbs from './breadcrumbs';
import DateTimeSlider from './dateTimeSlider';
import DisplayOptions from './displayOptions';
import PhysicsOptions from './physicsOptions';
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

const Console = console;
const isFiniteAfterCoerceToDouble = isFinite;
const hasOwnPropFunc = Object.prototype.hasOwnProperty;

function animate (time) {
  requestAnimationFrame(animate);
  TWEEN.update(time);
}
requestAnimationFrame(animate);

function formatUtcAsLocalDateTime(zdt) {
  let zdt2 = zdt.withZoneSameInstant(ZoneId.SYSTEM).toLocalDateTime();
  let str = DateTimeFormatter.ISO_LOCAL_DATE_TIME.format(zdt2);
  let end = str.length - 3;
  let tindex = end - 6;
  return str.substring(2, tindex) + " " + str.substring(tindex + 1, end);
}

const panelWidth = 400;

function getBackendFromProps(props) {
  if (hasOwnPropFunc.call(props, "backend")) {
    let backend = props.backend;
    if (backend != null) {
      if (backend instanceof Backend) {
        return backend;
      }
      Console.error('The property \'backend\' of React component TrafficFlow must be an instance of Backend (unless it is null or undefined), the unexpected value is: ', backend);
    }
    return null;
  }
  return undefined;
}

class TrafficFlow extends React.Component {
  constructor (props) {
    super(props);

    // Initialize DateTime slider defaults
    let zdt_now = ZonedDateTime.now(ZoneOffset.UTC);
    const selectionGranuInMins = AppConstants.dateTimeSlider.selectionGranularityInMinutes;
    let dtSlider_maxExcl = DateTime_floorToGranularity(zdt_now, selectionGranuInMins);
    let dtSlider_val = dtSlider_maxExcl.minus(Duration.ofMinutes(selectionGranuInMins));
    let dtSlider_min = dtSlider_maxExcl.minus(AppConstants.dateTimeSlider.timeBetweenMinAndMaxExcl);
    // The first time we retrieve which chunks of data are available successfully we want to initialize the date time slider to the newest (last) available bucket/chunk.
    
    this.state = {
      currentView: undefined,
      redirectedFrom: undefined,
      selectedChart: undefined,
      dateTimeSlider: {
        min: dtSlider_min,
        maxExcl: dtSlider_maxExcl,
        selectionGranularityInMinutes: selectionGranuInMins,
        startOfDangerTime: dtSlider_min,
        value: dtSlider_val,
      },
      dateTimeSlider_hidden: true,
      isHistoryChunkAvailabilityLoading: false,
      displayOptions: {
        allowDraggingOfNodes: false,
        showLabels: true
      },
      currentGraph_physicsOptions: {
        isEnabled: true,
        viscousDragCoefficient: 0.2,
        hooksSprings: {
          restLength: 50,
          springConstant: 0.2,
          dampingConstant: 0.1
        },
        particles: {
          mass: 1
        }
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
      trafficData: {
        nodes: [],
        connections: []
      },
      regionUpdateStatus: [],
      timeOffset: 0,
      modes: {
        detailedNode: 'volume'
      }
    };
    this._updateValueIfChunkAvailabilityBecomesKnown = true;
    this._onBackendHistoryChunkAvailabilityChanged_func = this._onBackendHistoryChunkAvailabilityChanged.bind(this);
    this._dataChunkPromise = null;
    this._backend = getBackendFromProps(props);
    if (this._backend === undefined) this._backend = null;
    
    // A reference to the DateTime slider, used to call DateTimeSlider.updateLayout when the window resizes. 
    this._dateTimeSlider = null;
    
    // Browser history support
    window.addEventListener('popstate', event => this.handlePopState(event.state));
    window.addEventListener('resize', e => this._windowOnResize(e), false);

    // Keyboard interactivity
    listener.simple_combo('esc', () => {
      // TODO: cancel dragging of the date time slider if it is dragging!
      if (this.state.detailedNode) {
        this.setState({ detailedNode: undefined });
      } else if (this.state.currentView.length > 0) {
        this.setState({ currentView: this.state.currentView.slice(0, -1) });
      }
    });
    this._onNewBackend(this.state);
  }
  
  _onBackendHistoryChunkAvailabilityChanged() {
    let newState = {};
    if (this._updateNewStateWithHistoryChunkAvailability(newState)) {
      this.setState(newState); 
    }
  }
  
  componentWillReceiveProps (nextProps) {
    let newBackend = getBackendFromProps(nextProps);
    if (newBackend !== undefined) {
      if (newBackend === this._backend) return;
      if (this._backend !== null) {
        this._backend.off('historyChunkAvailabilityChanged', this._onBackendHistoryChunkAvailabilityChanged_func);
        Console.warn('TODO clean up resources used by old backend when changing backends');
      }
      this._backend = newBackend;
      let newState = {};
      this._onNewBackend(newState);
      this.setState(newState);
    }
  }
  
  _onNewBackend(newState) {
    newState.dateTimeSlider_hidden = this._backend === null || !this._backend.supportsHistory();
    if (this._backend !== null) {
      this._backend.on('historyChunkAvailabilityChanged', this._onBackendHistoryChunkAvailabilityChanged_func);
    }
    this._updateNewStateWithHistoryChunkAvailability(newState);    
    this._beginRetrieveDataChunk();
  }

  _updateNewStateWithHistoryChunkAvailability(newState) {
    let zdt_dtSlider_startOfDangerTime;  
    if (this._backend !== null && this._backend.supportsHistory()) {
      let zdt_startOfLastChunk = this._backend.getHistoryChunkAvailability();
      if (zdt_startOfLastChunk == null || zdt_startOfLastChunk.compareTo(this.state.dateTimeSlider.min) < 0) {
        zdt_dtSlider_startOfDangerTime = this.state.dateTimeSlider.min; 
      } else {
        let selectionGranuInMins = AppConstants.dateTimeSlider.selectionGranularityInMinutes;
        zdt_dtSlider_startOfDangerTime = zdt_startOfLastChunk.plus(selectionGranuInMins, ChronoUnit.MINUTES);
        if (this.state.dateTimeSlider.maxExcl.compareTo(zdt_dtSlider_startOfDangerTime) < 0) {
          zdt_dtSlider_startOfDangerTime = this.state.dateTimeSlider.maxExcl;
        }
      }
    } else {
      zdt_dtSlider_startOfDangerTime = this.state.dateTimeSlider.maxExcl;
    }
    let flag1 = false;
    if (!this.state.dateTimeSlider.startOfDangerTime.equals(zdt_dtSlider_startOfDangerTime)) {
      if (!hasOwnPropFunc.call(newState, "dateTimeSlider")) {
        newState.dateTimeSlider = _.clone(this.state.dateTimeSlider);
      }
      newState.dateTimeSlider.startOfDangerTime = zdt_dtSlider_startOfDangerTime;
      flag1 = true;
    }
    let isHistoryChunkAvailabilityLoading = false;
    if (this._backend !== null && this._backend.supportsHistory()) {
        let zdt_startOfLastChunk = this._backend.getHistoryChunkAvailability();
        if (zdt_startOfLastChunk === undefined) {
          isHistoryChunkAvailabilityLoading = true;
        }
    }
    let flag2 = this.state.isHistoryChunkAvailabilityLoading !== isHistoryChunkAvailabilityLoading;
    if (flag2) {
      newState.isHistoryChunkAvailabilityLoading = isHistoryChunkAvailabilityLoading;
    }
    return flag1 || flag2;
  }

  _setDateTimeSlider(dateTimeSlider) {
    this._dateTimeSlider = dateTimeSlider;
  }

  _windowOnResize(e) {
    if (this._dateTimeSlider !== null) {
      this._dateTimeSlider.updateLayout();
    }
  }

  handlePopState () {
    // TODO: store the selected date time in history, but don't spam the history log with every change.
    // Probably a solution based on the query string is better.
    const state = window.history.state || {};
    this.poppedState = true;
    this.setState({ currentView: state.selected, objectToHighlight: state.highlighted });
  }

  viewChanged = (data) => {
    const changedState = {
      currentView: data.view,
      searchTerm: '',
      matches: { total: -1, visible: -1 },
      redirectedFrom: data.redirectedFrom
    };
    let flag = false;
    if (hasOwnPropFunc.call(data, 'graph')) {
      let oldCurrentGraph = this.state.currentGraph;
      if (oldCurrentGraph == null) oldCurrentGraph = null;
      let newCurrentGraph = data.graph;
      if (newCurrentGraph == null) newCurrentGraph = null;
      if (oldCurrentGraph !== newCurrentGraph) {
        flag = true;
        changedState.currentGraph = newCurrentGraph;
        const o = newCurrentGraph === null ? null : newCurrentGraph.getPhysicsOptions();
        changedState.currentGraph_physicsOptions = o;
      }
    }
    this.setState(changedState);
  }

  objectHighlighted = (highlightedObject) => {
    // need to set objectToHighlight for diffing on the react component. since it was already highlighted here, it will be a noop
    this.setState({ highlightedObject: highlightedObject, objectToHighlight: highlightedObject ? highlightedObject.getName() : undefined, searchTerm: '', matches: { total: -1, visible: -1 }, redirectedFrom: undefined });
  }

  rendered = (data) => {
    const renderedGraphs = _.clone(this.state.renderedGraphs);
    renderedGraphs[data.name] = data.rendered;
    this.setState({ renderedGraphs: renderedGraphs });
  }

  nodeFocused = (node) => {
    this.setState({ focusedNode: node });
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

  _beginRetrieveDataChunk () {
    if (this._dataChunkPromise !== null) {
      this._dataChunkPromise.cancel();
      this._dataChunkPromise = null;
    }
    let dataChunkPromise;
    if (this._backend !== null) {
      if (this._backend.supportsHistory()) {
        let zdt_chunkTime = this.state.dateTimeSlider.value;
        dataChunkPromise = this._backend.getHistoryChunk(zdt_chunkTime);
      } else {
        dataChunkPromise = this._backend.getLatestChunk();
      }
      dataChunkPromise = dataChunkPromise.catch(error => {
        Console.error('Could not retrieve a chunk of data: ', error);
        return { 
          nodes: [], 
          connections: [] 
        };
      });
    } else {
      dataChunkPromise = Promise.resolve({ 
        nodes: [], 
        connections: [] 
      });
    }
    this._dataChunkPromise = dataChunkPromise.then(dataChunk => {
      this._dataChunkPromise = null;
      this.updateData(dataChunk);
    });
  }

  componentDidMount () {
    this.checkInitialRoute();

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
      document.title = titleArray.join(' / ');

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
    // const updatedTraffic = {
    //   name: newTraffic.name,
    //   renderer: newTraffic.renderer,
    //   nodes: [],
    //   connections: []
    // };

    // _.each(this.state.trafficData.nodes, node => updatedTraffic.nodes.push(node));
    // _.each(this.state.trafficData.connections, connection => updatedTraffic.connections.push(connection));

    // let modified = false;
    // if (newTraffic) {
    //   modified = true;
    //   // Update the traffic graphs with the new state
    //   _.each(newTraffic.nodes, (node) => {
    //     const existingNodeIndex = _.findIndex(updatedTraffic.nodes, { name: node.name });
    //     if (existingNodeIndex !== -1) {
    //       if (node.nodes && node.nodes.length > 0) {
    //         node.updated = node.updated || updatedTraffic.nodes[existingNodeIndex].updated;
    //         updatedTraffic.nodes[existingNodeIndex] = node;
    //       }
    //     } else {
    //       updatedTraffic.nodes.push(node);
    //     }
    //   });
    //   _.each(newTraffic.connections, (connection) => {
    //     const existingConnectionIndex = _.findIndex(updatedTraffic.connections, { source: connection.source, target: connection.target });
    //     if (existingConnectionIndex !== -1) {
    //       updatedTraffic.connections[existingConnectionIndex] = connection;
    //     } else {
    //       updatedTraffic.connections.push(connection);
    //     }
    //   });
    // }

    // if (modified) {
    // const regionUpdateStatus = _.map(_.filter(updatedTraffic.nodes, n => n.name !== 'INTERNET'), (node) => {
    //   const updated = node.updated;
    //   return { region: node.name, updated: updated };
    // });
    // const lastUpdatedTime = _.max(_.map(regionUpdateStatus, 'updated'));
    // this.setState({
    //   regionUpdateStatus: regionUpdateStatus,
    //   timeOffset: newTraffic.clientUpdateTime - newTraffic.serverUpdateTime,
    //   lastUpdatedTime: lastUpdatedTime,
    //   trafficData: updatedTraffic
    // });
    // }
    let nodes = newTraffic.nodes;
    let lastUpdatedTime = null;
    let fError = false;
    let regionUpdateStatus = [];
    for (let i = 0, n = nodes.length; i < n; i++) {
      let node = nodes[i];
      if (node == null || !hasOwnPropFunc.call(node, "name") || typeof node.name !== "string") {
        Console.error("The root graph of the new traffic data has a null or undefined node or it does not have a 'name' own property. NOTE: the name of a node is required and must be a string");
        continue;
      }
      if (node.name === "INTERNET") continue;
      let updated = null;
      if (hasOwnPropFunc.call(node, "updated")) {
        updated = node.updated;
        if (typeof updated !== "number" || !isFiniteAfterCoerceToDouble(updated)) {
          updated = null;
        }
      }
      if (updated === null) {
        Console.error("The root graph of the new traffic data has is missing a property named 'updated' or its value is not a finite number");
        continue;
      }
      regionUpdateStatus.push({ region: node.name, updated: updated });
      if (lastUpdatedTime === null || lastUpdatedTime < updated) {
        lastUpdatedTime = updated;
      }
    }
    if (lastUpdatedTime === null) {
      lastUpdatedTime = Date.now();
      Console.error("The root graph of the new traffic data is empty (not counting the node named 'INTERNET'): making up a value to reduce the chance of crashing", newTraffic);
    }
    if (!fError) {
      this.setState({
        regionUpdateStatus: regionUpdateStatus,
        timeOffset: newTraffic.clientUpdateTime - newTraffic.serverUpdateTime,
        lastUpdatedTime: lastUpdatedTime,
        trafficData: newTraffic
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

  physicsOptionsChanged = (physicsOptions) => {
    this.setState({ currentGraph_physicsOptions: physicsOptions });
    let currentGraph = this.state.currentGraph;
    if (currentGraph == null) currentGraph = null;
    if (currentGraph !== null) {
      currentGraph.setPhysicsOptions(physicsOptions);
    }
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

  chartChanged = (chartName) => {
    this.setState({ selectedChart: chartName });
  }

  matchesFound = (matches) => {
    this.setState({ matches: matches });
  }

  graphsUpdated = (graphs) => {
    this.setState({ graphs: graphs });
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

  resetLayoutButtonClicked = () => {
    const g = this.state.currentGraph;
    if (g != null) {
      g._relayout();
    }
  }

  _onDateTimeSliderValueChanged(newValue) {
    let newDTSliderState = _.clone(this.state.dateTimeSlider);
    newDTSliderState.value = newValue;
    this._beginRetrieveDataChunk();
    this.setState({ dateTimeSlider: newDTSliderState });
  }

  dismissAlert = () => {
    this.setState({ redirectedFrom: undefined });
  }

  setState(newState) {
    let historyChunkAvailabilityBecomesKnown = hasOwnPropFunc.call(newState, "isHistoryChunkAvailabilityLoading") && 
      !newState.isHistoryChunkAvailabilityLoading && 
      this.state.isHistoryChunkAvailabilityLoading;
    if (historyChunkAvailabilityBecomesKnown && this._updateValueIfChunkAvailabilityBecomesKnown) {
      if (this._backend !== null && this._backend.supportsHistory()) {
        let newDTSliderState = hasOwnPropFunc.call(newState, "dateTimeSlider") 
          ? newState.dateTimeSlider
          : undefined;
        let min = newDTSliderState !== undefined ? newDTSliderState.min : this.state.dateTimeSlider.min;
        let maxExcl = newDTSliderState !== undefined ? newDTSliderState.maxExcl : this.state.dateTimeSlider.maxExcl;
        let zdt_startOfLastChunk = this._backend.getHistoryChunkAvailability();
        if (min.compareTo(zdt_startOfLastChunk) <= 0 && zdt_startOfLastChunk.compareTo(maxExcl) < 0) {
          if (newDTSliderState === undefined) {
            newDTSliderState = _.clone(this.state.dateTimeSlider);
            newState.dateTimeSlider = newDTSliderState;
          }
          newDTSliderState.value = zdt_startOfLastChunk;
        }
      } 
      this._updateValueIfChunkAvailabilityBecomesKnown = false;
    }
    super.setState(newState);
    if (historyChunkAvailabilityBecomesKnown) {
      this._beginRetrieveDataChunk();
    }
  }

  render () {
    const globalView = this.state.currentView && this.state.currentView.length === 0;
    const nodeView = !globalView && this.state.currentView && this.state.currentView[1] !== undefined;
    const nodeToShowDetails = this.state.focusedNode || (this.state.highlightedObject && this.state.highlightedObject.type === 'node' ? this.state.highlightedObject : undefined);
    const connectionToShowDetails = this.state.highlightedObject && this.state.highlightedObject.type === 'connection' ? this.state.highlightedObject : undefined;
    //const showLoadingCover = !!(this.state.currentView && this.state.currentView[0] && !this.state.renderedGraphs[this.state.currentView[0]]);

    let matches;
    if (this.state.currentGraph) {
      matches = {
        totalMatches: this.state.matches.total,
        visibleMatches: this.state.matches.visible,
        total: this.state.currentGraph.nodeCounts.total,
        visible: this.state.currentGraph.nodeCounts.visible
      };
    }
    const selectedDateTime = this.state.dateTimeSlider.value;


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
          <span className="selected-formatted-date-time">
            Showing data from {formatUtcAsLocalDateTime(selectedDateTime)} to {formatUtcAsLocalDateTime(selectedDateTime.plus(5, ChronoUnit.MINUTES))}
          </span>
          <div style={{ float: 'right', paddingTop: '4px' }}>
            { (!globalView && matches) && <Locator changeCallback={this.locatorChanged} searchTerm={this.state.searchTerm} matches={matches} clearFilterCallback={this.filtersCleared} /> }
            <OptionsPanel title="Filters"><FilterControls /></OptionsPanel>
            <OptionsPanel title="Display"><DisplayOptions options={this.state.displayOptions} changedCallback={this.displayOptionsChanged} /></OptionsPanel>
            <OptionsPanel title="Physics"><PhysicsOptions options={this.state.currentGraph_physicsOptions} changedCallback={this.physicsOptionsChanged}/></OptionsPanel>
            <a role="button" className="reset-layout-link" onClick={this.resetLayoutButtonClicked}>Reset Layout</a>
          </div>
        </div>
        <div className="date-time-slider-container" style={{display: this.state.dateTimeSlider_hidden ? 'none' : ''}}>
          <DateTimeSlider
            ref={(c) => this._setDateTimeSlider(c)}
            value={this.state.dateTimeSlider.value}
            min={this.state.dateTimeSlider.min}
            startOfDangerTime={this.state.dateTimeSlider.startOfDangerTime}
            maxExcl={this.state.dateTimeSlider.maxExcl}
            selectionGranularityInMinutes={this.state.dateTimeSlider.selectionGranularityInMinutes}
            selectedValueChanged={(oldValue, newValue) => this._onDateTimeSliderValueChanged(newValue)}>
          </DateTimeSlider>
        </div>
        <div className="service-traffic-map">
          <div style={{ position: 'absolute', top: '0px', right: nodeToShowDetails || connectionToShowDetails ? '380px' : '0px', bottom: '0px', left: '0px' }}>
            <Vizceral allowDraggingOfNodes={this.state.displayOptions.allowDraggingOfNodes}
                      filters={this.state.filters}
                      graphsUpdated={this.graphsUpdated}
                      match={this.state.searchTerm}
                      matchesFound={this.matchesFound}
                      modes={this.state.modes}
                      objectHighlighted={this.objectHighlighted}
                      objectToHighlight={this.state.objectToHighlight}
                      nodeContextSizeChanged={this.nodeContextSizeChanged}
                      nodeFocused={this.nodeFocused}
                      rendered={this.rendered}
                      showLabels={this.state.displayOptions.showLabels}
                      traffic={this.state.trafficData}
                      view={this.state.currentView}
                      viewChanged={this.viewChanged}
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
          {/*<LoadingCover show={showLoadingCover} />*/}
        </div>
      </div>
    );
  }
}

TrafficFlow.propTypes = {
  backend: React.PropTypes.object
};

TrafficFlow.defaultProps = {
  backend: null
};

export default TrafficFlow;
