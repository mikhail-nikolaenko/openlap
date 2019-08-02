import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';

import { Platform } from '@ionic/angular';

import { AndroidFullScreen } from '@ionic-native/android-full-screen/ngx';
import { Insomnia } from '@ionic-native/insomnia/ngx';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';

import { TranslateService } from '@ngx-translate/core';

import { BehaviorSubject, Observable, Subscription, from } from 'rxjs';
import { distinctUntilChanged, debounceTime, filter, first, map, /*mergeAll,*/ mergeMap, switchMap, timeout } from 'rxjs/operators';

import { Backend } from './backend';
import { ControlUnit } from './carrera';
import { CONTROL_UNIT_SUBJECT, Logger, RaceOptions, Settings, Speech, Toast } from './core';

const CONNECTION_TIMEOUT = 3000;

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html'
})
export class AppComponent implements OnInit {

  private subscription: Subscription;

  constructor(@Inject(CONTROL_UNIT_SUBJECT) public cu: BehaviorSubject<ControlUnit>,
    @Inject(Backend) private backends: Backend[],
    private logger: Logger,
    private settings: Settings,
    private speech: Speech,
    private platform: Platform,
    private androidFullScreen: AndroidFullScreen,
    private insomnia: Insomnia,
    private splashScreen: SplashScreen,
    private router: Router,
    private toast: Toast,
    private translate: TranslateService)
  {
    this.platform.ready().then(readySource => {
      this.logger.info('Initializing ' + readySource + ' application');
      if (readySource === 'cordova') {
        this.platform.resize.subscribe(() => {
          this.enableFullScreen(this.platform.isLandscape());
        });
        this.enableFullScreen(this.platform.isLandscape());
        this.insomnia.keepAwake();
      }
    });
    translate.setDefaultLang('en');
  }

  ngOnInit() {
    this.settings.getOptions().subscribe(options => {
      this.logger.setDebugEnabled(options.debug);
      this.setLanguage(options.language);
    });
    this.settings.getConnection().subscribe(connection => {
      if (this.cu.value) {
        this.cu.value.disconnect();
      }
      if (connection) {
        this.logger.info('Connecting to ' + connection.name);
        from(this.backends.map(backend => backend.scan())).pipe(
          /*mergeAll(),*/
          mergeMap(device => device),
          filter(device => device.equals(connection)),
          timeout(CONNECTION_TIMEOUT),
          first()
        ).toPromise().then(device => {
          const cu = new ControlUnit(device, connection);
          this.cu.next(cu);
          cu.connect();
        }).then(() => {
          this.setRoot('/rms/practice');
        }).catch(error => {
          this.logger.warn('Error connecting to ' + connection.name + ':', error);
          this.setRoot('/root');
        });
      } else {
        this.logger.info('No connection set');
        this.cu.next(null);
        this.setRoot('/root');
      }
    });
    // TODO: move this to RaceControl?
    this.subscription = this.cu.pipe(
      filter((cu) => !!cu),
      switchMap((cu: ControlUnit) => {
        return cu.getState().pipe(
          debounceTime(200),
          distinctUntilChanged(),
          map(state => [state, cu.peripheral.name])
        );
      })
    ).subscribe(([state, device]) => {
      switch (state) {
      case 'connected':
        this.showConnectionToast('Connected to {{device}}', device);
        break;
      case 'connecting':
        this.showConnectionToast('Connecting to {{device}}', device);
        break;
      case 'disconnected':
        this.showConnectionToast('Disconnected from {{device}}', device);
        break;
      }
    });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  private enableFullScreen(value: boolean) {
    this.androidFullScreen.isImmersiveModeSupported().then(() => {
      if (value) {
        return this.androidFullScreen.immersiveMode();
      } else {
        return this.androidFullScreen.showSystemUI();
      }
    }).catch(error => {
      this.logger.error('Fullscreen error:', error);
    });
  }

  private setLanguage(language: string) {
    this.translate.use(language || this.translate.getBrowserLang() || 'en').toPromise().then(obj => {
      this.translate.get('notifications.locale').toPromise().then(locale => {
        this.speech.setLocale(locale);
      });
    });
  }

  private setRoot(page: any, params?: any) {
    this.router.navigate([page]).catch(error => {
      this.logger.error('Error setting root page', error);
    }).then(() => {
      this.logger.info('Hiding splash screen');
      this.splashScreen.hide();
    });
  }

  private showConnectionToast(message: string, device: string) {
    this.translate.get(message, { device: device }).toPromise().then(message => {
      return this.toast.showCenter(message, 3000);
    }).catch(error => {
      this.logger.error('Error showing toast', error);
    });
  }
}
