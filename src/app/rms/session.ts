import { BehaviorSubject, Observable, interval, merge, of } from 'rxjs';
import { combineLatest, distinctUntilChanged, filter, groupBy, map, /*mergeAll,*/ mergeMap, publishReplay, refCount, scan, share, startWith, tap, withLatestFrom } from 'rxjs/operators';

import { ControlUnit } from '../carrera';
import { RaceOptions } from '../core';

const TIMER_INTERVAL = 500;

function createMask(first: number, last: number) {
  let mask = 0;
  while (first !== last) {
    mask |= (1 << first);
    ++first;
  }
  return mask;
}

// TODO: merge with leaderboard item...
export interface RaceItem {
  id: number
  time: number;
  laps: number;
  last: number[];
  best: number[];
  fuel?: number;
  pit?: boolean;
  pits?: number;
  sector: number;
  finished?: boolean;
}

function numCompare(lhs: number, rhs: number) {
  const r = lhs - rhs;
  if (!isNaN(r)) {
    return r;
  } else if (isNaN(lhs)) {
    return isNaN(rhs) ? 0 : 1;
  } else {
    return -1;
  }
}

function timeCompare(lhs: RaceItem, rhs: RaceItem) {
  return (lhs.best[0] || Infinity) - (rhs.best[0] || Infinity);
}

function raceCompare(lhs: RaceItem, rhs: RaceItem) {
  return (rhs.laps - lhs.laps) || numCompare(lhs.time, rhs.time) || (lhs.id - rhs.id);
}

const COMPARE = {
  'practice': timeCompare,
  'qualifying': timeCompare,
  'race': raceCompare
}

export class Session {
  grid: Observable<Observable<RaceItem>>;
  ranking: Observable<RaceItem[]>;
  currentLap: Observable<number>;
  finished = new BehaviorSubject(false);
  yellowFlag = new BehaviorSubject(false);
  timer = of(0);
  started = false;
  stopped = false;

  private mask: number;
  private active = 0;

  private realMask: number = null;

  // TODO: move settings handling/combine to race-control!
  constructor(private cu: ControlUnit, private options: RaceOptions) {
    const compare = COMPARE[options.mode];

    const reset = merge(
      cu.getStart().pipe(distinctUntilChanged(),filter(start => start != 0),),
      cu.getState().pipe(distinctUntilChanged(),filter(state => state == 'connected'),)
    ).pipe(map(value => {
      cu.setMask(this.mask);
    }));
    // create monotonic timer
    type TimerType = [number, number, number];
    const timer = cu.getTimer().pipe(
      filter(([id]) => {
        return !(this.mask & (1 << id));
      }),
      scan(([_, [prev, offset, then]], [id, time, group]: TimerType) => {
        // TODO: combine with reset?
        const now = Date.now();
        if (time < prev) {
          offset = ((now - then + prev) || 0) - time;
        }
        return [[id, time + offset, group], [time, offset, now]];
      }, [[], [Infinity, 0, NaN]]),
      map(([t]: TimerType[]) => t)
    );
    const fuel = cu.getFuel();
    const pit = cu.getPit();

    this.mask = (options.auto ? 0 : 1 << 6) | (options.pace ? 0 : 1 << 7);
    if (options.drivers) {
      this.mask |= createMask(options.drivers, 6);
      this.grid = this.createGrid(timer, fuel, pit, ~this.mask & 0xff);
    } else {
      this.grid = this.createGrid(timer, fuel, pit);
    }

    this.ranking = reset.pipe(
      startWith(null),
      combineLatest(this.grid),
      map(([_reset, grid]) => {
        return grid;  // for reset side effects only...
      }),
      /*mergeAll(),*/
      mergeMap(val => val),
      scan((grid, event) => {
        const newgrid = [...grid];
        newgrid[event.id] = event;
        return newgrid;
      }, []),
      map((cars: Array<RaceItem>) => {
        const ranks = cars.filter(car => !!car);
        ranks.sort(compare);
        return ranks;
      })
    );

    this.currentLap = this.grid.pipe(
      /*mergeAll(),*/
      mergeMap(val => val),
      scan<RaceItem, number>((current, event) => {
        if (current > event.laps) {
          return current;
        } else if (this.finished.value || isNaN(event.time)) {
          return event.laps;
        } else {
          return event.laps + 1;
        }
      }, 0),
      startWith(0),
      publishReplay(1),
      refCount(),
      distinctUntilChanged()
    );

    if (options.time) {
      this.timer = interval(TIMER_INTERVAL).pipe(
        withLatestFrom(
          cu.getStart(),
          cu.getState()
        ),
        filter(([_, start, state]) => {
          return this.started && (!this.options.pause || (start == 0 && state == 'connected'));
        }),
        scan<any, number>((time, _) => {
          return Math.max(0, time - TIMER_INTERVAL);
        }, options.time),
        tap(time => {
          if (time == 0) {
            this.stopped = true;
            this.finish();
          }
        }),
        share(),
        startWith(options.time)
      );
    }

    this.cu.setMask(this.mask);
    this.cu.clearPosition();
    this.cu.reset();
  }

  start() {
    this.started = true;
  }

  stop() {
    this.stopped = true;
    this.finish();
  }

  toggleYellowFlag() {
    const value = this.yellowFlag.value;
    if (this.yellowFlag.value) {
      this.mask = this.realMask;
      this.realMask = null;
    } else {
      this.realMask = this.mask;
      this.mask = 0xff;
    }
    this.cu.setMask(this.mask);
    this.yellowFlag.next(!value);
  }

  private createGrid(
    timer: Observable<[number, number, number]>,
    fuel: Observable<ArrayLike<number>>,
    pits: Observable<number>,
    mask = 0
  ) {
    const init = new Array<[number, number, number]>();
    for (let i = 0; mask; ++i) {
      if (mask & 1) {
        init.push([i, NaN, 0]);
      }
      mask >>>= 1;
    }
    return timer.pipe(startWith(...init), groupBy(([id]) => id), map(group => {
      type TimeInfo = [number[][], number[], number[], boolean];
      this.active |= (1 << group.key);

      const times = group.pipe(scan(([times, last, best, finished]: TimeInfo, [id, time, sensor]: [number, number, number]) => {
        const tail = times[times.length - 1] || [];
        if (sensor && time > (tail.length >= sensor ? tail[sensor - 1] : -Infinity) + this.options.minLapTime) {
          if (sensor === 1) {
            times.push([time]);
            last[0] = time - tail[0];
            best[0] = Math.min(last[0], best[0] || Infinity);
            if (tail.length > 1) {
              last[tail.length] = time - tail[tail.length - 1];
              best[tail.length] = Math.min(last[tail.length], best[tail.length] || Infinity);
            }
            if (!finished && this.isFinished(times.length - 1)) {
              this.finish(id);
              finished = true;
            }
          } else {
            const index = sensor - 1;
            tail[index] = time;
            last[index] = time - tail[index - 1];
            best[index] = Math.min(last[index], best[index] || Infinity);
          }
        }
        return <TimeInfo>[times, last, best, finished];
      }, <TimeInfo>[[], [], [], false]));

      return times.pipe(
        combineLatest(
          pits.pipe(
            map(mask => ((mask & ~this.mask) & (1 << group.key)) != 0),
            distinctUntilChanged(),
            scan(([count]: [number, boolean], inpit: boolean) => {
              return [inpit ? count + 1 : count, inpit]
            }, [0, false])
          ),
          fuel.pipe(
            map(fuel => fuel[group.key]),
            distinctUntilChanged()
          )
        ),
        map(([[times, last, best, finished], [pits, pit], fuel]: [TimeInfo, [number, boolean], number]) => {
          const laps = times.length ? times.length - 1 : 0;
          const curr = times[times.length - 1] || [];
          const prev = times[times.length - 2] || [];
          return {
            id: group.key,
            time: curr[0],
            laps: laps,
            last: last,
            best: best,
            fuel: fuel,
            pit: pit,
            pits: pits,
            sector: curr.length - 1 || prev.length,
            finished: finished
          };
        }),
        publishReplay(1),
        refCount()
      );
    }),
    publishReplay(),
    refCount()
    );
  }

  private finish(id?: number) {
    const mask = this.mask;
    this.mask |= (~this.active & 0xff);
    if (id !== undefined) {
      this.mask |= (1 << id);
    }
    if (mask != this.mask) {
      this.cu.setMask(this.mask);
    }
    this.finished.next(true);
  }

  private isFinished(laps: number) {
    if (this.stopped) {
      return true;
    } else if (this.options.laps && laps >= this.options.laps) {
      return true;
    } else if (!this.options.slotmode && this.finished.value) {
      return true;
    } else {
      return false;
    }
  }
}
