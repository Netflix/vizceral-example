'use strict';

import NodeDetailsSubpanel from './nodeDetailsSubpanel';
import ConnectionList from './connectionList';
import React from 'react';

require('./nodeDetails.css');

class NodeDetails extends React.Component {
  constructor (props) {
    super(props);
    this.state = {
      node: props.node,
      region: props.region,
      description: undefined
    };
  }

  componentWillReceiveProps (nextProps) {
    const newState = {
      region: nextProps.region,
      node: nextProps.node
    };

    if (this.state.region !== nextProps.region || this.state.node.getName() !== nextProps.node.getName()) {
      newState.description = undefined;
    }

    this.setState(newState);
  }

  render () {
    const node = this.state.node;
    const hasNotices = node && node.notices && node.notices.length > 0;
    const clusterList = node && node.clusters !== undefined ? node.clusters.join(', ') : 'Unknown';
    let zoomClassName = 'glyphicon clickable zoom-icon ';
    zoomClassName += this.props.nodeSelected ? 'glyphicon-log-out' : 'glyphicon-log-in';
    const zoomTitle = `Zoom ${this.props.nodeSelected ? 'out of' : 'into'} node view`;

    return (
      <div className="node-details">
        <div className="subsection">
          <div className="node-details-title">{node.getName()}
            <span title={zoomTitle} className={zoomClassName} onClick={this.props.zoomCallback}></span>
          </div>
          <div className="node-details-close" onClick={this.props.closeCallback}>
            <span className="glyphicon glyphicon-remove" aria-hidden="true"></span>
          </div>
        </div>
        {
          hasNotices ?
            <div className="node-details-description subsection"><span style={{ fontWeight: 600 }}>Notices</span>&nbsp;
            {
              node.notices.map(notice => {
                let noticeTitle = notice.title;
                if (notice.link) {
                  noticeTitle = <span>{notice.title} <a href={notice.link} target="_blank"><span className="glyphicon glyphicon-new-window"></span></a></span>;
                }
                return <div key={notice.title}>{noticeTitle}</div>;
              })
            }
          </div>
          : undefined
        }
        <NodeDetailsSubpanel title="Clusters" expanded={true}>
          {clusterList}
        </NodeDetailsSubpanel>
        <NodeDetailsSubpanel title="Incoming Connections">
          <ConnectionList key={node.getName()} connections={node.incomingConnections} direction="incoming" />
        </NodeDetailsSubpanel>
        <NodeDetailsSubpanel title="Outgoing Connections">
          <ConnectionList key={node.getName()} connections={node.outgoingConnections} direction="outgoing" />
        </NodeDetailsSubpanel>
      </div>
    );
  }
}

NodeDetails.propTypes = {
  closeCallback: React.PropTypes.func.isRequired,
  zoomCallback: React.PropTypes.func.isRequired,
  node: React.PropTypes.object.isRequired,
  nodeSelected: React.PropTypes.bool.isRequired,
  region: React.PropTypes.string
};

export default NodeDetails;
