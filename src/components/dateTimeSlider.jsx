'use strict';
import React from 'react';
import { ZonedDateTime, Duration, ChronoField, ChronoUnit, ZoneOffset } from 'js-joda';
import { DateTime_floorToGranularity, DateTime_doesRespectGranularity, validateGranularity } from '../dateTimeUtil';
import './dateTimeSlider.css';

const Console = console;
const dbl_floor = Math.floor;
const dbl_max = Math.max;
const dbl_isFinite = isFinite;
const dbl_round = Math.round;
const hasOwnPropertyFunc = Object.prototype.hasOwnProperty;

function isPositiveIntegralDouble(value) {
  return typeof value === "number" && value % 1 === 0 && 0 < value;
}

function isFunction(value) {
  return Object.prototype.toString.call(value) === '[object Function]';
}

function parseCssPixelLength(s) {
  // Defensive coding to not produce any false positive errors: use very generic grammar.
  let match = /^(.*)px\s*$/i.exec(s);
  if (match) {
    // Defensive coding: use Number instead of parseFloat to support exponential notation.
    // Both seem to support leading white space.
    // parseFloat accepts trailing rubbish, but this is really an error.
    let num = Number(match[1]);
    if (dbl_isFinite(num)) {
      return num;
    }
  }
  throw new Error('Could not parse CSS pixel length: ' + s);
}

function Event_preventDefault(e) {
  if (e.preventDefault) {
    e.preventDefault();
  } else {
    e.returnValue = e.type === "error";
  }
}

function Event_stopPropagation(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  } else {
    e.cancelBubble = true;
  }
}

function Element_getCssClasses(elem) {
  return elem.className
    .replace(/^[ \r\n\f\t]+|[ \r\n\f\t]+$/g, "")
    .split(/[ \r\n\f\t]+/);
}

function Element_removeCssClass(elem, cssClass) {
  // Do not trust the className of elem: remove all occurences of cssClass.
  let cssClassList = Element_getCssClasses(elem);
  let changed = false;
  let end = cssClassList.length - 1;
  while (0 <= end) {
    let i = cssClassList.lastIndexOf(cssClass, end);
    if (i < 0) {
      break;
    }
    cssClassList.splice(i, 1);
    changed = true;
    end = i - 1;
  }
  if (changed) {
    elem.className = cssClassList.join(" ");
  }
}

function Element_addCssClass(elem, cssClass) {
  let cssClassList = Element_getCssClasses(elem);
  if (cssClassList.lastIndexOf(cssClass) < 0) {
    cssClassList.push(cssClass);
    elem.className = cssClassList.join(" ");
  }
}

function MouseEvent_isLeftButtonOrButtonIsUnknown(e) {
  let f = false;
  if (isPositiveIntegralDouble(e.which)) {
    f = e.which === 1;
  } else if (isPositiveIntegralDouble(e.button)) {
    f = (eButton & 1) !== 0;
  } else {
    f = true;
  }
  return f;
}

function getPadding(elemComputedStyle) {
  let top = parseCssPixelLength(elemComputedStyle.paddingTop);
  let right = parseCssPixelLength(elemComputedStyle.paddingRight);
  let bottom = parseCssPixelLength(elemComputedStyle.paddingBottom);
  let left = parseCssPixelLength(elemComputedStyle.paddingLeft);
  return [ top, right, bottom, left ];
}

function getIllegalGranularityError(v, name, granularityInMinutes) {
  return new Error("The value of the field named '" + name + "' must divisible by " + granularityInMinutes + " minutes. NOTE: " + granularityInMinutes + " is (or will be) the selection granularity in minutes. The value is " + v + ". This error can occur when setting the field '" + name + "' or 'selectionGranularityInMinutes'");
}

const TickClass_day = 0;
const TickClass_hour = 1;
const TickClass_selectionGranularityUnit = 2;

class Tick {
  constructor(offsetFromMinInSeconds, tickClass) {
    this.offsetFromMinInSeconds = offsetFromMinInSeconds;
    this.tickClass = tickClass;
  }
}

// This code assumes that offsets between local time and UTC are multiples of 5 minutes.
class DateTimeSlider extends React.Component {
  constructor (props) {
    super(props);
    let selectionGranularityInMinutes = 5;
    let zdt_now = ZonedDateTime.now(ZoneOffset.UTC);
    let zdt_maxExcl = DateTime_floorToGranularity(zdt_now, selectionGranularityInMinutes);

    let zdt_min = zdt_maxExcl.minus(Duration.ofHours(48));
    let zdt_value = zdt_maxExcl.minus(Duration.ofMinutes(selectionGranularityInMinutes));

    this._handleIsDragging = false;
    this._canvasElem = null;
    this._rootElem = null;
    this._trackElem = null;
    this._handleElem = null;
    
    // Tick Info
    this._tickList = null;
    this._secondsCoveredByThisSlider = null;

    this._secondsCoveredByThisSlider_beforeStartOfDanger = null;

    this._handleElemCenterOffsetRelativeToMousePointer = 0;
    this._docNodeOnMouseMoveFunc = this._docNodeOnMouseMove.bind(this);
    this._docNodeOnMouseUpFunc = this._docNodeOnMouseUp.bind(this);
    this._windowOnBlurFunc = this._windowOnBlur.bind(this);
    this._docNodeOnDragStartFunc = this._docNodeOnDragStart.bind(this);
    this._fIsInternalSetState = false;

    this.state = {
      min: zdt_min,
      maxExcl: zdt_maxExcl,
      startOfDangerTime: zdt_min,
      value: zdt_value,
      selectionGranularityInMinutes: selectionGranularityInMinutes
    };
    this._onNewStartOfDangerTime();
    this._updateTickInfo();
  }

  _updateTickInfo() {
    const min = this.state.min;
    const selectionGranularityInMinutes = this.state.selectionGranularityInMinutes;
    const maxExcl = this.state.maxExcl;
    this._secondsCoveredByThisSlider = min.until(maxExcl, ChronoUnit.SECONDS);
    this._tickList = [];
    for (let i = min; i.compareTo(maxExcl) <= 0; i = i.plus(selectionGranularityInMinutes, ChronoUnit.MINUTES)) {
      let tickClass;
      if (i.get(ChronoField.SECOND_OF_DAY) === 0) {
        tickClass = TickClass_day;
      } else if (i.get(ChronoField.MINUTE_OF_HOUR) === 0) {
        tickClass = TickClass_hour;
      } else {
        tickClass = TickClass_selectionGranularityUnit;
      }
      this._tickList.push(new Tick(min.until(i, ChronoUnit.SECONDS), tickClass));
    }
  }

  componentWillReceiveProps (newProps) {
    let newState = null;
    for (let key in newProps) {
      if (hasOwnPropertyFunc.call(newProps, key)) {
        switch (key) {
          case "min":
          case "maxExcl":
          case "value":
          case "startOfDangerTime":
          case "selectionGranularityInMinutes":
            if (newState === null) newState = {};
            newState[key] = newProps[key];
            break;
          default:
            break;
        }
      }
    }
    if (newState !== null) {
      this.setState(newState);
    }
  }

  componentDidMount() {
    let docNode = this._handleElem.ownerDocument;
    let window = docNode.defaultView;
    window.addEventListener("blur", this._windowOnBlurFunc, false);
    docNode.addEventListener("mousemove", this._docNodeOnMouseMoveFunc, false);
    docNode.addEventListener("mouseup", this._docNodeOnMouseUpFunc, false);
    docNode.addEventListener("dragstart", this._docNodeOnDragStartFunc, false);
    this.updateLayout();
  }

  componentWillUnmount(){
    let docNode = this._handleElem.ownerDocument;
    let window = docNode.defaultView;
    window.removeEventListener("blur", this._windowOnBlurFunc, false);
    docNode.removeEventListener("mousemove", this._docNodeOnMouseMoveFunc, false);
    docNode.removeEventListener("mouseup", this._docNodeOnMouseUpFunc, false);
    docNode.removeEventListener("dragstart", this._docNodeOnDragStartFunc, false);
  }

  // This method can be static, but this is not worth the refactoring.
  _validateIsWithinMinMax(v, name, min, maxExcl, allowEqualToMaxExcl) {
    
    if (v.compareTo(min) < 0) {
      throw new Error("The value for field '" + name + "' is too small: " + v + " must be at least " + min + ". This error can occur when setting the field '" + name + "' or 'min'");
    } else {
      let c = maxExcl.compareTo(v);
      if (allowEqualToMaxExcl) {
        if (c < 0) {
          throw new Error("The value for field '" + name + "' is too large: " + v + " must not be greater than " + maxExcl + ". This error can occur when setting the field '" + name + "' or 'maxExcl'");
        }
      } else {
        if (c <= 0) {
          throw new Error("The value for field '" + name + "' is too large: " + v + " must not be greater than or equal to " + maxExcl + ". This error can occur when setting the field '" + name + "' or 'maxExcl'");
        }
      }
    }
  }

  setState(newState) {
    // There's 5 fields that have to be consistent with eachother, hence the complexity of this function.
    // We store new values in variables instead of state, because we want to delay changing state until all validation is passed successfully.
    let newSelectionGranularityInMinutes = null;
    if (hasOwnPropertyFunc.call(newState, "selectionGranularityInMinutes")) {
      newSelectionGranularityInMinutes = newState.selectionGranularityInMinutes;
      validateGranularity(newSelectionGranularityInMinutes, "selectionGranularityInMinutes");
    }
    let validationSelectionGranularityInMinutes = newSelectionGranularityInMinutes === null
      ? this.state.selectionGranularityInMinutes
      : newSelectionGranularityInMinutes;
    let newMin = null;
    if (hasOwnPropertyFunc.call(newState, "min")) {
      newMin = newState.min;
      if (!(newMin instanceof ZonedDateTime)) {
        throw new TypeError("min must be an instance of ZonedDateTime");
      }
    }
    let validationMin = newMin !== null ? newMin : this.state.min;
    if (!DateTime_doesRespectGranularity(validationMin, validationSelectionGranularityInMinutes)) {
      throw getIllegalGranularityError(validationMin, "min", validationSelectionGranularityInMinutes);
    }
    let newMaxExcl = null;
    if (hasOwnPropertyFunc.call(newState, "maxExcl")) {
      newMaxExcl = newState.maxExcl;
      if (!(newMaxExcl instanceof ZonedDateTime)) {
          throw new TypeError("maxExcl must be an instance of ZonedDateTime");
      }
    }
    let validationMaxExcl = newMaxExcl !== null ? newMaxExcl : this.state.maxExcl;
    if (!DateTime_doesRespectGranularity(validationMaxExcl, validationSelectionGranularityInMinutes)) {
      throw getIllegalGranularityError(validationMaxExcl, "maxExcl", validationSelectionGranularityInMinutes);
    }
    let c = validationMin.compareTo(validationMaxExcl);
    if ((newMaxExcl !== null || newMin !== null) && c > 0) {
      throw new Error("min (" + validationMin + ") cannot be greater than maxExcl (" + validationMaxExcl + ")");
    }
    let newValue = null;
    if (hasOwnPropertyFunc.call(newState, "value")) {
      newValue = newState.value;
    }
    let validationValue = newValue !== null ? newValue : this.state.value;

    if (!DateTime_doesRespectGranularity(validationValue, validationSelectionGranularityInMinutes)) {
      throw getIllegalGranularityError(validationValue, "value", validationSelectionGranularityInMinutes);
    }
    this._validateIsWithinMinMax(validationValue, "value", validationMin, validationMaxExcl, false);
    let newStartOfDangerTime = null;
    if (hasOwnPropertyFunc.call(newState, "startOfDangerTime")) {
      newStartOfDangerTime = newState.startOfDangerTime;
    }
    let validationStartOfDangerTime = newStartOfDangerTime !== null ? newStartOfDangerTime : this.state.startOfDangerTime;
    if (!DateTime_doesRespectGranularity(validationStartOfDangerTime, validationSelectionGranularityInMinutes)) {
      throw getIllegalGranularityError(validationStartOfDangerTime, "startOfDangerTime", validationSelectionGranularityInMinutes);
    }
    this._validateIsWithinMinMax(validationStartOfDangerTime, "startOfDangerTime", validationMin, validationMaxExcl, true);
    let oldValue = this.state.value;
    super.setState(newState);

    let minChanged = newMin !== null && !this.state.min.equals(newMin);
    let maxExclChanged = newMaxExcl !== null && !this.state.maxExcl.equals(newMaxExcl);
    let selectionGranularityInMinutesChanged = newSelectionGranularityInMinutes !== null && newSelectionGranularityInMinutes !== this.state.selectionGranularityInMinutes;
    if (minChanged) this.state.min = newMin;
    if (maxExclChanged) this.state.maxExcl = newMaxExcl;
    if (selectionGranularityInMinutesChanged) this.state.selectionGranularityInMinutes = newSelectionGranularityInMinutes;

    if (minChanged || maxExclChanged || selectionGranularityInMinutesChanged) {
      this._updateTickInfo();
    }
    // Do not do any unnecessary work!
    if (!this._fIsInternalSetState || selectionGranularityInMinutesChanged) {
      this._pushValueToHandleElemXPerc();
    }
    if (newStartOfDangerTime !== null) {
      this._onNewStartOfDangerTime();
    }
    if (minChanged || maxExclChanged || newStartOfDangerTime !== null || selectionGranularityInMinutesChanged) {
      this._updateCanvas();
    }
    if (newValue !== null && !oldValue.equals(newValue)) {
      let f = this.props.selectedValueChanged;
      f(oldValue, newValue);
    }
  }

  _onNewStartOfDangerTime() {
    this._secondsCoveredByThisSlider_beforeStartOfDanger = this.state.min.until(this.state.startOfDangerTime, ChronoUnit.SECONDS);
  }

  _setTrackElem(trackElem) {
    this._trackElem = trackElem;
  }

  _setRootElem(rootElem) {
    this._rootElem = rootElem;
  }

  _setHandleElem(handleElem) {
    this._handleElem = handleElem;
  }

  _setCanvasElem(canvasElem) {
    this._canvasElem = canvasElem;
  }

  _handleElem_onMouseDown(e) {
    this._handleOrTrackElem_onMouseDown(e, true);
  }

  _trackElem_onMouseDown(e) {
    this._handleOrTrackElem_onMouseDown(e, false);
  }

  _handleOrTrackElem_onMouseDown(e, fIsHandleElem) {
    if (MouseEvent_isLeftButtonOrButtonIsUnknown(e)) {
      this._handleOrTrackElem_onDragStart(e, fIsHandleElem);
      Event_preventDefault(e);
      if (fIsHandleElem) {
        Event_stopPropagation(e);
      }
    }
  }

  _handleOrTrackElem_onDragStart(e, fIsHandleElem) {
    if (this._handleIsDragging) {
      return;
    }
    this._handleIsDragging = true;
    let handleElem = this._handleElem;
    Element_addCssClass(handleElem, "is-dragging");
    if (fIsHandleElem) {
      // When clicking off the center of the handle, we don't want the handle to jump to the center of the pointer.
      // Thus we calculate an offset to alleviate this jumping effect.
      let handleElem_clientRect = handleElem.getBoundingClientRect();
      let handleElem_width = handleElem_clientRect.right - handleElem_clientRect.left;
      let mousePos_clientX = e.clientX;
      let mousePos_handleX = mousePos_clientX - handleElem_clientRect.left;
      this._handleElemCenterOffsetRelativeToMousePointer = mousePos_handleX - handleElem_width * 0.5;
    } else {
      this._handleElemCenterOffsetRelativeToMousePointer = 0;
      this._commonMoveHandleFromMouseEvent(e);
    }
  }

  _commonMoveHandleFromMouseEvent(e) {
    let mousePos_clientX = e.clientX;
    let trackElem = this._trackElem;
    let trackElem_clientRect = this._trackElem.getBoundingClientRect();
    let mousePos_trackX = (mousePos_clientX - trackElem_clientRect.left) - trackElem.clientLeft;
    let handleElem_width = this._handleElem.offsetWidth;
    let perc = (mousePos_trackX - this._handleElemCenterOffsetRelativeToMousePointer - handleElem_width * 0.5 + 0.5) / (trackElem.clientWidth - handleElem_width);
    perc = this._snapXPerc(perc);
    this._handleElem_setXPerc(perc);

    try {
      this._fIsInternalSetState = true;
      let s = perc * (this._secondsCoveredByThisSlider - this.state.selectionGranularityInMinutes * 60);
      this.setState({
        value: this.state.min.plus(dbl_round(s), ChronoUnit.SECONDS)
      });
    } finally {
      this._fIsInternalSetState = false;
    }
  }

  _docNodeOnMouseMove(e) {
    if (this._handleIsDragging) {
      this._commonMoveHandleFromMouseEvent(e);
    }
  }

  _snapXPerc(perc) {
    if (0 <= perc) {
      if (perc < 1) {
        let seconds_selectionGranularity = this.state.selectionGranularityInMinutes * 60;
        let t = perc;
        t *= this._secondsCoveredByThisSlider - seconds_selectionGranularity;
        t /= seconds_selectionGranularity;
        t = dbl_round(t);
        t *= seconds_selectionGranularity;
        t /= this._secondsCoveredByThisSlider - seconds_selectionGranularity;
        return t;
      }
      return 1;
    }
    return 0;
  }

  _handleElem_setXPerc(perc) {
    let handleElem_x = perc * (this._trackElem.clientWidth - this._handleElem.offsetWidth);
    this._handleElem.style.left = handleElem_x + "px";
  }

  _docNodeOnMouseUp(e) {
    if (this._handleIsDragging) {
      this._handleElem_stopDragging();
    }
  }

  _handleElem_stopDragging() {
    if (this._handleIsDragging) {
      this._handleIsDragging = false;
      Element_removeCssClass(this._handleElem, "is-dragging");
    }
  }

  _windowOnBlur(e) {
    this._handleElem_stopDragging();
  }

  _docNodeOnDragStart(e) {
    this._handleElem_stopDragging();
  }

  _renderOnCanvas(c) {
    let rootElemComputedStyle = this._rootElem.ownerDocument.defaultView.getComputedStyle(this._rootElem, null);
    let rootElemPadding = getPadding(rootElemComputedStyle);
    let clientWidth = this._canvasElem.width;
    let clientHeight = this._canvasElem.height;
    // Assume the canvas has the same dimensions as root element.
    c.clearRect(0, 0, clientWidth, clientHeight);
    let left = rootElemPadding[3];
    let right = rootElemPadding[1];
    let width = clientWidth - left - right;
    if (width < 0) {
      return;
    }
    let top = rootElemPadding[0];
    c.fillStyle = c.strokeStyle = "rgb(137, 137, 137)";
    let trackElem_offsetHeight = this._trackElem.offsetHeight;
    c.fillRect(left, top, width, trackElem_offsetHeight);
    let tickList = this._tickList;
    let secondsCoveredByThisSlider = this._secondsCoveredByThisSlider;
    let left_startOfDanger = this._secondsCoveredByThisSlider_beforeStartOfDanger * this._trackElem.offsetWidth / secondsCoveredByThisSlider;
    c.fillStyle = "rgb(184, 36, 36)"; // Danger
    c.fillRect(left + left_startOfDanger, top, width - left_startOfDanger, trackElem_offsetHeight);

    top += trackElem_offsetHeight + 1;
    c.lineWidth = 1;
    for (let i = 0, n = tickList.length; i < n; i++) {
      let tick = tickList[i];
      let perc = tick.offsetFromMinInSeconds / secondsCoveredByThisSlider;
      let x = perc * width + left - (c.lineWidth * 0.5);
      c.beginPath();
      c.moveTo(x, top);
      c.lineTo(x, top + 7.5 * (1 + 2 - tick.tickClass));
      c.stroke();
    }
  }

  // Updates the pixel position of the handle element.
  _pushValueToHandleElemXPerc() {
    let secondsBetweenValueAndMin = this.state.min.until(this.state.value, ChronoUnit.SECONDS);
    this._handleElem_setXPerc(secondsBetweenValueAndMin / (this._secondsCoveredByThisSlider - this.state.selectionGranularityInMinutes * 60));
  }

  _updateCanvas() {
   if (this._canvasElem !== null) {
      if (isFunction(this._canvasElem.getContext)) {
        let context2D = this._canvasElem.getContext('2d');
        this._canvasElem.width = this._rootElem.clientWidth;
        this._canvasElem.height = this._rootElem.clientHeight;
        this._renderOnCanvas(context2D);
      }
    }
  }

  // Call this when the dateTimeSlider has to be resized.
  updateLayout() {
    let seconds_selectionGranularity = this.state.selectionGranularityInMinutes * 60;
    let secondsCoveredByThisSlider = this._secondsCoveredByThisSlider;
    this._handleElem.style.width = dbl_round(this._trackElem.clientWidth * seconds_selectionGranularity / secondsCoveredByThisSlider) + "px";
    this._pushValueToHandleElemXPerc();
    this._updateCanvas();
  }

  render () {
    return (
      <div className="date-time-slider" ref={(rootElem) => this._setRootElem(rootElem)}>
        <canvas ref={(canvasElem) => this._setCanvasElem(canvasElem)}></canvas>
        <div className="track" ref={(trackElem) => this._setTrackElem(trackElem)} onMouseDown={(e)=>this._trackElem_onMouseDown(e)}>
          <div className="handle" ref={(handleElem) => this._setHandleElem(handleElem)} onMouseDown={(e)=>this._handleElem_onMouseDown(e)}></div>
        </div>
      </div>
    );
  }
}

DateTimeSlider.propTypes = {
  maxExcl: React.PropTypes.object, // ZonedDateTime
  min: React.PropTypes.object, // ZonedDateTime     
  // min must be smaller than or equal to maxExcl, but since value cannot be null and value must be smaller than maxExcl we effectively have
  // min must be smaller than maxExcl
  selectionGranularityInMinutes: React.PropTypes.number, // Must be a positive integral double that evenly divides 60
  selectedValueChanged: React.PropTypes.func.isRequired,
  startOfDangerTime: React.PropTypes.object, // ZonedDateTime
  value: React.PropTypes.object, // ZonedDateTime
};

export default DateTimeSlider;
