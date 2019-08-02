import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { PopoverController } from '@ionic/angular';

import { TranslateService } from '@ngx-translate/core';

import { Observable, Subscription, from, fromEvent, of, merge } from 'rxjs';
import { combineLatest as combineLatestCreate } from 'rxjs';
import { combineLatest, concat, concatAll, distinctUntilChanged, filter, map, /*mergeAll,*/ mergeMap, pairwise, share, skipWhile, startWith, switchMap, take, withLatestFrom } from 'rxjs/operators';

import { ControlUnit, ControlUnitButton } from '../carrera';
import { CONTROL_UNIT_PROVIDER, Logger, RaceOptions, Settings, Speech } from '../core';

import { LeaderboardItem } from './leaderboard';
import { RmsMenu } from './rms.menu';
import { Session } from './session';

const ORIENTATION = {
  portrait: 'code',
  landscape: 'number name'
};

const FIELDS = [{
  // no fuel/pit lane
  practice: [
    'bestlap gap int lastlap laps status',
    'bestlap sector1 sector2 sector3 lastlap status'
  ],
  qualifying: [
    'bestlap gap int lastlap laps status',
    'bestlap sector1 sector2 sector3 lastlap status'
  ],
  race: [
    'time bestlap lastlap laps status',
    'time sector1 sector2 sector3 lastlap status',
  ]
}, {
  // with fuel/pit lane
  practice: [
    'bestlap gap int lastlap laps fuel status',
    'bestlap sector1 sector2 sector3 lastlap fuel status'
  ],
  qualifying: [
    'bestlap gap int lastlap laps fuel status',
    'bestlap sector1 sector2 sector3 lastlap fuel status'
  ],
  race: [
    'time bestlap lastlap laps pits fuel status',
    'time sector1 sector2 sector3 lastlap fuel status'
  ]
}];

@Component({
  selector: 'app-rms',
  providers: [CONTROL_UNIT_PROVIDER],
  templateUrl: 'rms.page.html',
})
export class RmsPage implements OnDestroy, OnInit {

  options: RaceOptions;

  slides: Observable<string[][]>;
  speechEnabled: Observable<boolean>;
  sortorder: Observable<string>;
  lapcount: Observable<{count: number, total: number}>;
  pitlane: Observable<boolean>;

  start: Observable<number>;
  lights: Observable<number>;
  blink: Observable<boolean>;
  timer: Observable<number>;
  keySupported: Observable<boolean>;

  session: Session;

  ranking: Observable<LeaderboardItem[]>;

  private subscriptions: Subscription;
  
  private dataSubscription: Subscription;

  constructor(public cu: ControlUnit, private logger: Logger, private settings: Settings, private speech: Speech,
    private popover: PopoverController, private translate: TranslateService, private route: ActivatedRoute)
  {
    // FIXME: proper initialization
    this.options = this.route.snapshot.data.options;
    this.session = new Session(this.cu, this.options);
    this.dataSubscription = this.route.data.subscribe(data => {
      this.onStart(this.options = data.options);
    });

    const start = this.cu.getStart().pipe(distinctUntilChanged());
    const state = this.cu.getState().pipe(distinctUntilChanged());
    const mode = this.cu.getMode().pipe(distinctUntilChanged());

    // use "resize" event for easier testing on browsers
    const orientation = fromEvent(window, 'resize').pipe(
      startWith(undefined),
      map(() => window.innerWidth < window.innerHeight ? 'portrait' : 'landscape'),
      distinctUntilChanged()
    );

    this.slides = mode.pipe(
      startWith(0),
      combineLatest(orientation),
      map(([mode, orientation]) => {
        return FIELDS[mode & 0x03 ? 1 : 0][this.options.mode].map(s => {
          return (ORIENTATION[orientation] + ' ' + s).split(/\s+/)
        });
      })
    );

    this.speechEnabled = settings.getOptions().pipe(map(options => options.speech));
    this.sortorder = settings.getOptions().pipe(map(options => options.fixedorder ? 'number' : 'position'));

    this.start = start;
    this.lights = start.pipe(
      map(value => value == 1 ? 5 : value > 1 && value < 7 ? value - 1 : 0)
    );
    this.blink = state.pipe(
      combineLatest(start, (state, value) => {
        return state !== 'connected' || value >= 8;
      })
      );
    this.pitlane = mode.pipe(
      map(value => (value & 0x04) != 0)
    );

    this.keySupported = this.cu.getVersion().pipe(
      distinctUntilChanged(),
      map(v => v >= '5331')
    );
  }

  ngOnInit() {
    // FIXME: proper initialization
    //this.onStart(this.options);
  }

  ngOnDestroy() {
    if (this.subscriptions) {
      this.subscriptions.unsubscribe();
    }
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
  }

  onStart(options: RaceOptions) {
    const session = this.session = new Session(this.cu, options);

    this.lapcount = session.currentLap.pipe(map(lap => {
      return {
        count: lap,
        total: options.laps
      };
    }));

    const drivers = this.settings.getDrivers().pipe(switchMap(drivers => {
      const observables = drivers.map((obj, index) => {
        const code = obj.code || '#' + (index + 1);
        if (obj.name) {
          return of({name: obj.name, code: code, color: obj.color});
        } else {
          return this.getTranslations('Driver {{number}}', {number: index + 1}).pipe(map((name: string) => {
            return {name: name, code: code, color: obj.color}
          }));
        }
      });
      return combineLatestCreate(...observables);
    }));

    const best = [Infinity, Infinity, Infinity, Infinity];
    const events = merge(
      session.grid.pipe(
        map(obs => obs.pipe(pairwise())),
        mergeMap(obs => obs),
        mergeMap(([prev, curr]) => {
          const events = [];
          curr.best.forEach((time, index) => {
            if ((time || Infinity) < best[index]) {
              best[index] = time;
              if (curr.laps >= 3) {
                events.push([index ? 'bests' + index : 'bestlap', curr.id]);
              }
            }
          });
          if (!curr.finished && curr.time) {
            if (curr.fuel < prev.fuel) {
              events.push(['fuel' + curr.fuel, curr.id]);
            }
            if (curr.pit && !prev.pit) {
              events.push(['pitenter', curr.id]);
            }
            if (!curr.pit && prev.pit) {
              events.push(['pitexit', curr.id]);
            }
          }
          return from(events);
        }),
      ),
      this.start.pipe(
        distinctUntilChanged(),
        filter(value => value === 9),
        map(() => {
          return ['falsestart', null];
        })
      ),
      this.lapcount.pipe(
        filter(laps => {
          return options.laps && laps.count === options.laps && !session.finished.value;
        }),
        map(() => {
          return ['finallap', null];
        })
      ),
      session.yellowFlag.pipe(
        distinctUntilChanged(),
        skipWhile(value => !value),
        map(value => {
          return [value ? 'yellowflag' : 'greenflag', null];
        })
      ),
      session.finished.pipe(
        distinctUntilChanged(),
        filter(finished => finished),
        map(() => {
          return ['finished', null];
        })
      )
    ).pipe(
      withLatestFrom(drivers),
      map(([[event, id], drivers]) => {
        return <[string, any]>[event, id !== null ? drivers[id] : null];
      })
    );

    // TODO: convert to Observable.scan()?
    const gridpos = [];
    const pitfuel = [];
    this.ranking = session.ranking.pipe(
      combineLatest(drivers),
      map(([ranks, drivers]) => {
        return ranks.map((item, index) => {
          if (options.mode == 'race' && gridpos[item.id] === undefined && item.time !== undefined) {
            gridpos[item.id] = index;
          }
          if (!item.pit || item.fuel < pitfuel[item.id]) {
            pitfuel[item.id] = item.fuel;
          }
          return Object.assign({}, item, {
            position: index,
            driver: drivers[item.id],
            gridpos: gridpos[item.id],
            refuel: item.pit && item.fuel > pitfuel[item.id]
          });
        });
      }),
      share()
    );

    if (this.subscriptions) {
      this.subscriptions.unsubscribe();
    }

    this.subscriptions = events.pipe(withLatestFrom(
      this.settings.getOptions(),
      this.settings.getNotifications(),
      this.getTranslations('notifications')
    )).subscribe(([[event, driver], options, notifications, translations]) => {
      this.logger.debug('Race event: ' + event, driver);
      if (options.speech && notifications[event] && notifications[event].enabled) {
        let message = notifications[event].message || translations[event];
        if (driver && driver.name) {
          this.speech.speak(driver.name + ': ' + message);
        } else {
          this.speech.speak(message);
        }
      }
    });

    this.subscriptions.add(
      this.lapcount.subscribe(
        laps => {
          this.cu.setLap(laps.count);
        },
        error => {
          this.logger.error('Lap counter error:', error);
        },
        () => {
          this.logger.info('Lap counter finished');
        }
      )
    );

    if (options.mode != 'practice') {
      const start = this.cu.getStart();
      start.pipe(take(1)).toPromise().then(value => {
        if (value === 0) {
          this.cu.toggleStart();
        }
        // wait until startlight goes off; TODO: subscribe/unsibscribe?
        this.cu.getStart().pipe(pairwise(),filter(([prev, curr]) => {
          return prev != 0 && curr == 0;
        }),take(1),).toPromise().then(() => {
          this.logger.info('Start ' + options.mode + ' mode');
          session.start();
        });
      });
    }
  }

  toggleSpeech() {
    this.settings.getOptions().pipe(take(1)).subscribe(options => {
      this.settings.setOptions(Object.assign({}, options, {speech: !options.speech}));
    });
  }

  triggerPaceCar() {
    this.cu.trigger(ControlUnitButton.PACE_CAR);
  }

  triggerStart() {
    this.cu.trigger(ControlUnitButton.START);
  }

  showMenu(event) {
    return this.popover.create({
      component: RmsMenu,
      componentProps: {
        mode: this.options.mode,
        active: this.session && !this.session.finished.value && this.options.mode != 'practice',
        restart: () => this.onStart(this.options),
        cancel:  () => this.session.stop()
      }, 
      event: event
    }).then(menu => {
      menu.present();
    });
  }

  // see https://github.com/ngx-translate/core/issues/330
  private getTranslations(key: string, params?: Object) {
    return this.translate.get(key, params).pipe(
      concat(this.translate.onLangChange.asObservable().pipe(
        map(() => this.translate.get(key, params)),
        concatAll()
      )
    ));
  }
}
