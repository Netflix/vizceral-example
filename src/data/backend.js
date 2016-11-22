import EventEmitter from 'events';

class Backend extends EventEmitter {

    constructor() {
        super();
    }

    // Returns
    //   If supportsHistory() is false then the return value of this method is undefined
    //   Otherwise
    //     If chunk availability has never been computed (and is still being computed) returns undefined
    //     If no chunks exist returns null
    //     Otherwise returns the start time of the latest available chunk as a js-joda ZonedDateTime
    getHistoryChunkAvailability() {
        throw new Error('not supported');
    }

    _raiseHistoryChunkAvailabilityChangedEvent() {
        this.emit('historyChunkAvailabilityChanged');
    }

    supportsHistory() {
        return false;
    }

    // Parameter zdt: a js-joda ZonedDateTime that represents the instant of UTC time with which the 
    // chunk to retrieve overlaps.
    // Returns:
    //   If supportsHistory() is false then the return value of this method is undefined
    //   Otherwise
    //     A promise of of a chunk of data that overlaps with the instant of UTC time represented by 
    //     parameter zdt. This promise supports cancellation through a cancel method. At most one such 
    //     chunk exists. If none exist returns null.
    getHistoryChunk(zdt) {
        throw new Error('not supported');
    }

    // Returns the latest available chunk of data.
    getLatestChunk() {
        throw new Error('abstract method');
    }
}

exports.Backend = Backend; 