import { Backend } from './backend.js'; 
import { doRequest } from './requestUtil';

class SimpleServer extends Backend {
  // Returns the latest available chunk of data.
  getLatestChunk() {
    let l = location;
    return doRequest({
        baseUrl: l.protocol + '://' + l.hostname,
        path: 'sample_data.json'
    });
  }
}

exports.SimpleServer = SimpleServer;