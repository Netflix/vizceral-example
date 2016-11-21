import EventEmitter from 'events';

class Backend extends EventEmitter {

    // If supportsHistory() is false then the return value of this method is undefined.
    // Otherwise
    //   If chunk availability has never been computed (and is still being computed) returns undefined
    //   If no chunks exist returns null
    //   Otherwise returns the start time of the latest available chunk as a js-joda ZonedDateTime
    getHistoryChunkAvailability() {
        return null;
    }

    _raiseHistoryChunkAvailabilityChangedEvent(newValue) {
        this.emit('historyChunkAvailabilityChanged');
    }

    supportsHistory() {
        return false;
    }
}

export default Backend; 