'use strict';

import React from 'react';

import SubNodeList from './subNodeList';
import DetailsSubpanel from './detailsSubpanel';

class DetailsSubpanelSubNodes extends React.Component {
  constructor (props) {
    super(props);
    this.state = {
      nodes: props.nodes,
      region: props.region
    };
  }

  componentWillReceiveProps (nextProps) {
    this.setState({
      nodes: nextProps.nodes,
      region: nextProps.region
    });
  }

  render () {
    return (
      <DetailsSubpanel title="Sub Nodes" expanded={this.props.expanded} badge={this.state.nodes.length}>
        { this.state.nodes ?
        <div>
          <div className="details-panel-subtitle"><span style={{ fontWeight: 600 }}>Traffic by Sub Node</span></div>
          <SubNodeList nodes={this.state.nodes} region={this.state.region} />
        </div> : undefined }
      </DetailsSubpanel>
    );
  }
}

DetailsSubpanelSubNodes.propTypes = {
  nodes: React.PropTypes.array,
  region: React.PropTypes.string.isRequired

};

export default DetailsSubpanelSubNodes;
