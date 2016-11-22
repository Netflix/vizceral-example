
import { 
  ChronoField, 
  ChronoUnit, 
  DateTimeFormatter, 
  LocalDateTime,
  TemporalQueries,
  ZonedDateTime } from 'js-joda';

const dbl_floor = Math.floor;
const dbl_posInf = 1/0;

function validateGranularity(granularityInMinutes, name) {
  if (typeof granularityInMinutes !== "number"
    || !(granularityInMinutes % 1 === 0)
    || granularityInMinutes <= 0
    || granularityInMinutes === dbl_posInf) {
    throw new Error(name + ' must be a positive integral double');
  }
  if (60 < granularityInMinutes || (60 / granularityInMinutes) % 1 !== 0) {
    throw new Error(name + ' must evenly divide one hour, any other value is not currently supported');
  }
}

function DateTime_floorToGranularity(dt, granularityInMinutes) {
  validateGranularity(granularityInMinutes, "granularityInMinutes");
  let dt_truncSubseconds = dt.minus(
    dt.get(ChronoField.NANO_OF_SECOND),
    ChronoUnit.NANOS);
  let dt_truncSubMinutes = dt_truncSubseconds.minus(
    dt.get(ChronoField.SECOND_OF_MINUTE),
    ChronoUnit.SECONDS);
  let minOfHour = dt_truncSubMinutes.get(ChronoField.MINUTE_OF_HOUR);
  let minOfHour_floorToGranularity = dbl_floor(minOfHour / granularityInMinutes) * granularityInMinutes;
  return dt_truncSubMinutes.minus(minOfHour - minOfHour_floorToGranularity, ChronoUnit.MINUTES);
}

function DateTime_doesRespectGranularity(dt, granularityInMinutes) {
  validateGranularity(granularityInMinutes, "granularityInMinutes");
  if (dt.get(ChronoField.NANO_OF_SECOND) !== 0) {
    return false;
  }
  if (dt.get(ChronoField.SECOND_OF_MINUTE) !== 0) {
    return false;
  }
  let minOfHour = dt.get(ChronoField.MINUTE_OF_HOUR);
  return (minOfHour % granularityInMinutes) === 0;
}

function ZonedDateTime_parse(s, format) {
  let builder = DateTimeFormatter.ofPattern(format).parse(s);
  let localDate = builder.build(TemporalQueries.localDate());
  let localTime = builder.build(TemporalQueries.localTime());
  let zoneOffset = builder.build(TemporalQueries.offset());
  let zone = builder.build(TemporalQueries.zone());
  let zonedDateTime = new ZonedDateTime(
    new LocalDateTime(localDate, localTime), 
    zoneOffset, 
    zone);
  return zonedDateTime;
}

exports.DateTime_floorToGranularity = DateTime_floorToGranularity;
exports.DateTime_doesRespectGranularity = DateTime_doesRespectGranularity;
exports.validateGranularity = validateGranularity;
exports.ZonedDateTime_parse = ZonedDateTime_parse;