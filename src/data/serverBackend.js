import Promise from 'bluebird';
import { ChronoUnit } from 'js-joda';
import request from 'superagent';

import Backend from './backend.js'; 
import { ZonedDateTime_parse } from '../dateTimeUtil';

const Console = console;
const hasOwnPropFunc = Object.prototype.hasOwnProperty;
const retryDelayInMilliseconds = 500;

function isObject(value) {
  let t = typeof value;
  if (t === 'object') return value !== null;
  // JavaScript has first class functions, thus they are also objects.
  return t === 'function';
}

function String_endsWith(s1, s2) {
  let i = s1.length - s2.length;
  return 0 <= i && 0 <= s1.indexOf(s2, i);
}

function String_startsWith(s1, s2) {
    return 0 <= s1.lastIndexOf(s2, 0);
}

function joinPaths(left, right) {
    let f1 = left.endsWith("/");
    let f2 = right.startsWith("/");
    if (f1 !== f2) {
        return left + right;
    }
    if (!f1) {
        return left + "/" + right;
    }
    let n = left.length;
    if (n < right.length) {
        return left.substring(0, n - 1) + right;
    }
    return left + right.substring(1);
}

class ServerBackend extends Backend {

  constructor(baseUrl) {
    if (typeof baseUrl !== 'string') {
      throw new TypeError('The first argument must be a string representing the URL of the backend that this class is interfacing with');
    }
    this._baseUrl = baseUrl;
    this._zdt_startOfLastBucket = undefined;
    this._pollHistoryChunkAvailability();
  }

  getHistoryChunkAvailability() {
    return this._zdt_startOfLastBucket;
  }

  _doRequest(options) {
    if (!isObject(options)) {
      throw new TypeError('The parameter named \'options\' is required and must be an object');
    }
    let path = options.path;
    if (!hasOwnPropFunc.call(options, 'path')) {
      throw new Error('The property named \'path\' of options is required');
    }
    if (typeof path !== 'string'
      || 0 <= path.indexOf('?')) {
      throw new SyntaxError('The property named \'path\' of options must be a string primitive that does not contain \'?\' characters. The \'?\' could be used to inject query string parameters');
    }
    let url = joinPaths(this._baseUrl, path);
    let retryCount = 0;
    let maxRetries = 2;
    // A superagent request is already a promise, but we want to wrap it anyway for (consistent) cancellation and retry functionality.
    let createDoRequestPromise;
    createDoRequestPromise = () => new Promise((resolve, reject, onCancel) => {
        let superAgentRequest;
        superAgentRequest = request.get(url)
          .set('Accept', 'application/json')
          .end((error, response) => {
            if (error == null) {
              resolve(response);
            } else {
              reject(error);
            }
          });
          onCancel(() => {
            superAgentRequest.abort();
          });
      }).catch(error => {
        let status = null;
        if (isObject(error)) {
          status = error.status;
          if (typeof status !== "number" || !isFinite(status)) {
              status = null;
          }
        }
        let shouldRetryBasedOnStatus = status !== null && 0 <= status && status < 1;
        if (shouldRetryBasedOnStatus && retryCount < maxRetries) {
          retryCount += 1;
          if (0 < retryDelayInMilliseconds) {
              return Promise.delay(retryDelayInMilliseconds).then(createDoRequestPromise);
          }
          return createDoRequestPromise();
        }
        throw error;
      });
    return createDoRequestPromise();
  }

  _pollHistoryChunkAvailability() {
    this._doRequest({
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
    }).catch(error => {
      Console.error("A network error or an unexpected error occured while polling chunk availability", error);
    });
  }
 
  supportsHistory() {
    return true;
  }
  
}