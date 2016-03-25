import queue from 'minimal-queue';
import './patch-worker';
import uniqueId from 'lodash/uniqueId';
function WorkerQueue() {
}

const DEFAULT_OPTIONS = {
  numWorkers: 4
};

WorkerQueue.prototype = {
  init(inOpts) {
    const opts = Object.assign({}, DEFAULT_OPTIONS, inOpts);
    this.queue = queue.up(this._processItem.bind(this));
    this.queue.concurrency = opts.numWorkers;
    this.numWorkers = opts.numWorkers;
    this.workerUrl = opts.workerUrl;
    this.workers = [];
    this.workers.total = 0;
    return this;
  },
  enqueue() {
    return new Promise(resolve => {
      this.queue.enqueue({ workerMessage: Array.prototype.slice.call(arguments), cb: resolve })
    });
  },
  _processItem({workerMessage, cb}){
    const worker = this._getWorker();
    const id = uniqueId();
    const message = Object.assign({ id }, workerMessage[0])
    worker.postMessage.call(worker, message, workerMessage[1]);
    worker.addEventListener('message', e => {
      if (e.data && e.data.id === id) {
        this._releaseWorker(worker);
        cb(e.data);
        this.queue.done();
      }
    });
  },
  _getWorker(){
    let worker = this.workers.shift();
    if (!worker) {
      worker = new Worker(this.workerUrl);
      worker.number = this.workers.total;
      this.workers.total++;
    }
    return worker;
  },
  _releaseWorker(worker){
    this.workers.push(worker);
  }
};

export default {
  create(opts = {}) {
    return Object.create(WorkerQueue.prototype).init(opts);
  }
};