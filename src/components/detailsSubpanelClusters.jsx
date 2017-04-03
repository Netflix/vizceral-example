'use strict';

import React from 'react';

import ClusterList from './clusterList';
import DetailsSubpanel from './detailsSubpanel';

class DetailsSubpanelClusters extends React.Component {
  constructor (props) {
    super(props);
    this.state = {
      clusters: props.clusters,
      region: props.region
    };
  }

  componentWillReceiveProps (nextProps) {
    this.setState({
      clusters: nextProps.clusters,
      region: nextProps.region
    });
  }

  render () {
    return (
      <DetailsSubpanel title="Clusters" expanded={this.props.expanded} badge={this.state.clusters.length}>
        { this.state.clusters ?
        <div>
          <div className="details-panel-subtitle"><span style={{ fontWeight: 600 }}>Traffic by Cluster</span></div>
          <ClusterList clusters={this.state.clusters} region={this.state.region} />
        </div> : undefined }
      </DetailsSubpanel>
    );
  }
}

DetailsSubpanelClusters.propTypes = {
  nodes: React.PropTypes.array,
  region: React.PropTypes.string.isRequired

};

export default DetailsSubpanelClusters;
