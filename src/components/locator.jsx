'use strict';

import React from 'react';
import PropTypes from 'prop-types';

import './locator.css';

const style = {
  display: 'inline-block',
  position: 'relative'
};

const listStyle = {
  display: 'inline-block',
  position: 'relative',
  paddingRight: '5px'
};

class Locator extends React.Component {
  constructor (props) {
    super(props);
    this.state = {
    };
  }

  locatorChanged (value) {
    this.props.changeCallback(value);
  }

  clearFilterClicked () {
    if (this.props.clearFilterCallback) {
      this.props.clearFilterCallback();
    }
  }

  render () {
    const totalServices = this.props.matches.totalMatches > -1 ? this.props.matches.totalMatches : this.props.matches.total;
    const filteredServices = totalServices - (this.props.matches.visibleMatches > -1 ? this.props.matches.visibleMatches : this.props.matches.visible);

    return (
      <div style={style}>
        <div style={listStyle}>{totalServices} services / {filteredServices} filtered &nbsp;
          { filteredServices > 0
            ? <span className="clickable" onClick={this.clearFilterClicked.bind(this)}>(show)</span>
            : undefined
          }
        </div>
        <div style={style}>
          <input type="search" className="form-control locator-input" placeholder="Locate Service" onChange={(event) => { this.locatorChanged(event.currentTarget.value); }} value={this.props.searchTerm} />
          <span className="glyphicon glyphicon-search form-control-feedback" style={{ height: '24px', lineHeight: '24px' }}></span>
        </div>
      </div>
    );
  }
}

Locator.propTypes = {
  searchTerm: PropTypes.string.isRequired,
  changeCallback: PropTypes.func.isRequired,
  clearFilterCallback: PropTypes.func,
  matches: PropTypes.shape({
    total: PropTypes.number,
    totalMatches: PropTypes.number,
    visible: PropTypes.number,
    visibleMatches: PropTypes.number
  })
};

export default Locator;
