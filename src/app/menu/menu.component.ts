import { Component, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { Router } from '@angular/router';

import { ModalController, NavController, Platform } from '@ionic/angular';

import { Observable, of } from 'rxjs';
import { take } from 'rxjs/operators';

import { ControlUnit } from '../carrera';
import { I18nAlertController, Logger, RaceOptions, Settings } from '../core';
import { RaceSettingsPage, RmsPage } from '../rms';
import { ColorsPage, DriversPage, SettingsPage } from '../settings';
import { TuningPage } from '../tuning';

import { ConnectionsComponent } from './connections.component';

@Component({
  selector: 'app-menu',
  templateUrl: 'menu.component.html'
})
export class MenuComponent implements OnChanges {

  @Input() cu: ControlUnit;

  //@Input() nav: Nav;

  mode: boolean;

  version: Observable<string>;

  colorsPage = ColorsPage;
  driversPage = DriversPage;
  settingsPage = SettingsPage;
  tuningPage = TuningPage;

  initialized = false;

  @ViewChild(ConnectionsComponent, { static: false }) connections : ConnectionsComponent;

  constructor(private alert: I18nAlertController,
    private logger: Logger,
    private settings: Settings,
    private modal: ModalController,
    private nav: NavController,
    private platform: Platform,
    private router: Router)
  {}

  ngOnChanges(changes: SimpleChanges) {
    if ('cu' in changes) {
      this.mode = !!this.cu;
      this.version = this.cu ? this.cu.getVersion() : of(undefined);
    }
  }

  onMenuOpen() {
    // Web Bluetooth workaround - needs user gesture for scanning
    if (!this.initialized && this.connections) {
      if ((<any>navigator).bluetooth) {
        this.connections.ngOnInit();
      }
      this.initialized = true;
    }
  }

  onMenuClose() {
    this.mode = !!this.cu;
  }

  onMenuToggle() {
    this.mode = !this.mode;
  }

  reconnect() {
    if (this.cu) {
      this.logger.info('Reconnecting to', this.cu.peripheral);
      this.cu.reconnect().then(() => {
        this.version = this.cu.getVersion();
      });
    }
  }

  startPractice() {
    return this.nav.navigateRoot('rms/practice');
  }

  startQualifying() {
    this.settings.getQualifyingSettings().pipe(take(1)).subscribe((options) => {
      return this.modal.create({
        component: RaceSettingsPage, 
        componentProps: options
      }).then(modal => {
        modal.onDidDismiss().then(detail => {
          this.settings.setQualifyingSettings(detail.data).then(() => {
            this.nav.navigateRoot('rms/qualifying');
          });
        });
        modal.present();
      });
    });
  }

  startRace() {
    this.settings.getRaceSettings().pipe(take(1)).subscribe((options) => {
      return this.modal.create({
        component: RaceSettingsPage,
        componentProps: options
      }).then(modal => {
        modal.onDidDismiss().then(detail => {
          this.settings.setRaceSettings(detail.data).then(() => {
            this.nav.navigateRoot('rms/race');
          });
        });
        modal.present();
      });
    });
  }
}
