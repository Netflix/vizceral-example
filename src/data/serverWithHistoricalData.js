import { ChronoField, ChronoUnit, DateTimeFormatter, DateTimeFormatterBuilder, ResolverStyle, ZoneId } from 'js-joda';

import { Backend } from './backend.js'; 
import { doRequest } from './requestUtil';
import { ZonedDateTime_parse } from '../dateTimeUtil';

const Console = console;
const maxPollsPerMinute = 0.2;
const minPollIntervalInMinutes = 1 / maxPollsPerMinute;
const millisecondsToMinutes = 1 / (60 * 1000);
const Double_max = Math.max;

// We can't use DateTimeFormatter.ISO_OFFSET_DATE_TIME because seconds of minute 
// and nano's of second are optional, that is: if they're zero they're omitted.
const serverDateTimeFormatter = new DateTimeFormatterBuilder()
  .parseCaseInsensitive()
  .appendValue(ChronoField.YEAR, 4)
  .appendLiteral('-')
  .appendValue(ChronoField.MONTH_OF_YEAR, 2)
  .appendLiteral('-')
  .appendValue(ChronoField.DAY_OF_MONTH, 2)
  .appendLiteral('T')
  .appendValue(ChronoField.HOUR_OF_DAY, 2)
  .appendLiteral(':')
  .appendValue(ChronoField.MINUTE_OF_HOUR, 2)
  .appendLiteral(':')
  .appendValue(ChronoField.SECOND_OF_MINUTE, 2)
  .appendFraction(ChronoField.MILLI_OF_SECOND, 3, 3, true)
  .appendPattern('XXX')
  .toFormatter(ResolverStyle.STRICT);

function ZonedDateTime_formatForServer(zdt1) {
  let zdt2 = zdt1.withZoneSameInstant(ZoneId.UTC);
  let s = serverDateTimeFormatter.format(zdt2);
  return s;
}

class ServerWithHistoricalData extends Backend {
  constructor(baseUrl) {
    if (typeof baseUrl !== 'string') {
      throw new TypeError('The first argument must be a string representing the URL of the backend that this class is interfacing with');
    }
    super();
    this._baseUrl = baseUrl;
    this._zdt_startOfLastBucket = undefined;
    this._pollHistoryChunkAvailability_timeoutId = null;
    this._pollHistoryChunkAvailability();
  }

  getHistoryChunkAvailability() {
    return this._zdt_startOfLastBucket;
  }

  _pollHistoryChunkAvailability() {
    this._pollHistoryChunkAvailability_timeoutId = null;
    const millisSinceUnixEpoch_start = Date.now()
    doRequest({
        baseUrl: this._baseUrl,
        path: 'last-bucket'
    }).then(response => {
      let dtstr_startOfLastBucket = response.body.dt;
      // dtstr_startOfLastBucket may be null, which means the backend does not have any chunks/buckets of data, and there is no last one
      let zdt_startOfLastBucket;
      if (dtstr_startOfLastBucket) {
        zdt_startOfLastBucket = ZonedDateTime_parse(dtstr_startOfLastBucket, "yyyy-MM-d' 'HH:mm:ssXXX");
      } else {
        zdt_startOfLastBucket = null;
      }
      this._zdt_startOfLastBucket = zdt_startOfLastBucket;
      this._raiseHistoryChunkAvailabilityChangedEvent();
    }).catch(error => {
      Console.error('A network error or an unexpected error occured while polling chunk availability: ', error);
    }).then(() => {
      const millisSinceUnixEpoch_end = Date.now();
      const elapsedMilliseconds = millisSinceUnixEpoch_end - millisSinceUnixEpoch_start;
      const elapsedMinutes = elapsedMilliseconds * millisecondsToMinutes;
      const minutesUntilNext = Double_max(0, minPollIntervalInMinutes - elapsedMinutes);
      const millisecondsUntilNext = minutesUntilNext * 60000;
      this._pollHistoryChunkAvailability_timeoutId = setTimeout(this._pollHistoryChunkAvailability.bind(this), Double_max(1, millisecondsUntilNext));
    });
  }
 
  supportsHistory() {
    return true;
  }

  getHistoryChunk(zdt) {
    return doRequest({
      baseUrl: this._baseUrl,
      path: 'bucket',
      queryString: [
        ['dt', ZonedDateTime_formatForServer(zdt)]
      ]
    }).then(response => {
      return response.body;
    });
  }

  // Returns the latest available chunk of data.
  getLatestChunk() {
    throw new Error('not impl');
  }

}

exports.ServerWithHistoricalData = ServerWithHistoricalData;