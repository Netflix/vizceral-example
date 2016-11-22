import Promise from 'bluebird';
import request from 'superagent';

const hasOwnPropFunc = Object.prototype.hasOwnProperty;
const retryDelayInMilliseconds = 500;
const maxRetries = 2;
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

// Same as HTTP request, but wrapped in cancellable promise and contains retry logic in case of (temporary) network failure.
function doRequest(options) {
  if (!isObject(options)) {
    throw new TypeError('The parameter named \'options\' is required and must be an object');
  }
  let path = options.path;
  if (!hasOwnPropFunc.call(options, 'path')) {
    path = null;
  } else if (typeof path !== 'string'
    || 0 <= path.indexOf('?')) {
    throw new SyntaxError('The property named \'path\' of options must be a string that does not contain \'?\' characters. A \'?\' would accidentally create an invalid query string and allows injection of query string parameters');
  }
  let queryString1 = null;
  if (hasOwnPropFunc.call(options, 'queryString')) {
    let queryString2 = options.queryString;
    if (!isObject(queryString2)) {
      throw new TypeError('The property named \'queryString\' of options must look like an array');
    }
    let n = queryString2.length;
    if (typeof n !== "number" || n < 0 || !(n % 1 === 0)) {
      throw new TypeError('The property named \'queryString\' of options must look like an array, but it does not have a non-negative integral property named \'length\'');
    }
    for (let i = 0; i < n; i++) {
      // Protect against sparse arrays, not that this will ever happen.
      if (hasOwnPropFunc.call(queryString2, i)) {
        let kvp2 = queryString2[i];
        if (!isObject(kvp2) || kvp2.length !== 2) {
          throw new TypeError(`The property named \'queryString\' of options had an invalid element at index ${i}. Valid elements are string arrays with length 2`);
        }
        if (!hasOwnPropFunc.call(kvp2, 0) || !hasOwnPropFunc.call(kvp2, 1)) {
          throw new TypeError(`The property named \'queryString\' of options had an invalid element. Element at index ${i} is correctly array-like, but it is sparse`);
        }
        let k = kvp2[0];
        let v = kvp2[1];
        if (typeof k !== "string" ||
          typeof v !== "string") {
          throw new TypeError(`The property named \'queryString\' of options had an invalid element. Element at index ${i} contains a non-string element`);
        }
        let kvp1 = `${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
        queryString1 = (queryString1 === null
          ? kvp1
          : queryString1 + '&' + kvp1);
      }
    }
  }
  let baseUrl = options.baseUrl;
  if (!hasOwnPropFunc.call(options, 'baseUrl') ||
    typeof baseUrl !== 'string'
    || 0 <= baseUrl.indexOf('?')) {
    throw new TypeError('The property named \'baseUrl\' of options is required and must be a string that does not contain \'?\' characters. A \'?\' would accidentally create an invalid query string and allows injection of query string parameters');
  }
  let url = path === null ? baseUrl : joinPaths(baseUrl, path);
  if (queryString1 !== null) {
    url += '?' + queryString1;
  }
  let retryCount = 0;
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

exports.doRequest = doRequest;