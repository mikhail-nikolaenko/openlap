import { BehaviorSubject , ConnectableObservable , Observable, Subject , Subscription, concat, timer } from 'rxjs';

import { concatMap, distinctUntilChanged, filter, map, publish, publishReplay, refCount, retryWhen, scan, share, take, tap, timeout } from 'rxjs/operators';

import { DataView } from './data-view';
import { Peripheral } from './peripheral';

const CONNECTION_TIMEOUT = 5000;
const REQUEST_TIMEOUT = 1000;
const MIN_RECONNECT_DELAY = 2000;
const MAX_RECONNECT_DELAY = 10000;

const POLL_COMMAND = DataView.fromString('?');
const RESET_COMMAND = DataView.fromString('=10');
const VERSION_COMMAND = DataView.fromString('0');

export enum ControlUnitButton {
  ESC = 1,
  PACE_CAR = 1,
  ENTER = 2,
  START = 2,
  SPEED = 5,
  BRAKE = 6,
  FUEL = 7,
  CODE = 8
}

export class Settings {
  connectionTimeout = CONNECTION_TIMEOUT;
  requestTimeout = REQUEST_TIMEOUT;
  minReconnectDelay = MIN_RECONNECT_DELAY;
  maxReconnectDelay = MAX_RECONNECT_DELAY;
};

export class ControlUnit {

  private connection: Subject<ArrayBuffer>;

  private subscription: Subscription;

  private requests = new Array<DataView>();

  private data: ConnectableObservable<DataView>;

  private status: Observable<DataView>;

  private state = new BehaviorSubject<'disconnected' | 'connecting' | 'connected'>('disconnected');

  constructor(public peripheral: Peripheral, private settings: Settings) {
    this.connection = this.peripheral.connect({
      next: () => this.connection.next(POLL_COMMAND.buffer)
    });
    const sharedConnection = this.connection.pipe(share());  // FIXME: concat does not define order of (un)subscribe
    const timedConnection = concat(
      sharedConnection.pipe(
        timeout(settings.connectionTimeout),
        take(1),
        tap(() => this.state.next('connected'))
      ),
      sharedConnection.pipe(
        timeout(settings.requestTimeout)
      )
    );
    this.data = timedConnection.pipe(
      retryWhen(errors => {
        return this.doReconnect(errors);
      }),
      tap(() => {
        this.poll();
      }),
      map((data: ArrayBuffer) => {
        return new DataView(data);
      }),
      publish()
    ) as ConnectableObservable<DataView>;
    this.status = this.data.pipe(filter((view) => {
      return view.byteLength >= 16 && view.toString(0, 2) === '?:';
    }),publishReplay(1),refCount(),);
  }

  connect() {
    this.state.next('connecting');
    this.subscription = this.data.connect();
    return Promise.resolve();
  }

  disconnect() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    return Promise.resolve();
  }

  reconnect() {
    return new Promise(resolve => {
      this.disconnect();
      setTimeout(() => {
        this.connect();
        resolve();
      }, this.settings.minReconnectDelay);
    });
  }

  getState(): Observable<'disconnected' | 'connecting' | 'connected'> {
    return this.state.asObservable();
  }

  getFuel(): Observable<ArrayLike<number>> {
    return this.status.pipe(map((data: DataView) => data.getUint8Array(2, 8)));
  }

  getStart(): Observable<number> {
    return this.status.pipe(map((data: DataView) => data.getUint4(10)));
  }

  getMode(): Observable<number> {
    return this.status.pipe(map((data: DataView) => data.getUint4(11)));
  }

  getPit(): Observable<number> {
    return this.status.pipe(map((data: DataView) => data.getUint8(12)));
  }

  getTimer(): Observable<[number, number, number]> {
    return this.data.pipe(
      filter(view => {
        // TODO: check CRC
        return view.byteLength >= 12 && view.toString(0, 1) === '?' && view.toString(1, 1) !== ':';
      }),
      filter(view => {
        const id = view.toString(1, 1);
        return id >= '1' && id <= '8';
      }),
      map(view => {
        // tuples are never inferred
        return <[number, number, number]>[view.getUint4(1) - 1, view.getUint32(2), view.getUint4(10)];
      }),
      distinctUntilChanged((a, b) => a[0] === b[0] && a[1] === b[1])
    );
  }

  getVersion(): Observable<string> {
    // TODO: timeout, retry?
    const observable = this.data.pipe(
      filter(view => view.byteLength == 6 && view.toString(0, 1) == '0'),
      map(view => view.toString(1, 4))
    );
    this.requests.push(VERSION_COMMAND);
    return observable;
  }

  reset() {
    this.requests.push(RESET_COMMAND);
  }

  setLap(value: number) {
    this.setLapHi(value >> 4);
    this.setLapLo(value & 0xf);
  }

  setLapHi(value: number) {
    this.set(17, 7, value);
  }

  setLapLo(value: number) {
    this.set(18, 7, value);
  }

  setPosition(id: number, pos: number) {
    this.set(6, id, pos);
  }

  clearPosition() {
    this.set(6, 0, 9);
  }

  setMask(value: number) {
    this.requests.push(DataView.from(':', value & 0xf, value >> 4));
  }

  setSpeed(id: number, value: number) {
    this.set(0, id, value, 2);
  }

  setBrake(id: number, value: number) {
    this.set(1, id, value, 2);
  }

  setFuel(id: number, value: number) {
    this.set(2, id, value, 2);
  }

  toggleStart() {
    this.trigger(ControlUnitButton.START);
  }

  trigger(button: ControlUnitButton) {
    this.requests.push(DataView.fromString('T' + String.fromCharCode(0x30 | button)));
  }

  private set(address: number, id: number, value: number, repeat = 1) {
    const args = [address & 0x0f, (address >> 4) | (id << 1), value, repeat];
    this.requests.push(DataView.from('J', ...args));
  }

  private poll() {
    const request = this.requests.shift() || POLL_COMMAND;
    this.connection.next(request.buffer);
  }

  private doReconnect(errors: Observable<any>) {
    const state = this.state;
    return errors.pipe(
      //tap(error => this.logger.error('Device error:', error)),
      scan((count, error) => {
        return state.value === 'connected' ? 0 : count + 1;
      }, 0),
      tap(() => state.next('disconnected')),
      concatMap(count => {
        const backoff = this.settings.minReconnectDelay * Math.pow(1.5, count);
        return timer(Math.min(backoff, this.settings.maxReconnectDelay));
      }),
      tap(() => state.next('connecting'))
    );
  }
}
