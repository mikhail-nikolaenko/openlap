import { Component, OnDestroy, OnInit } from '@angular/core';

import { AboutPage } from './about.page';
import { ConnectionPage } from './connection.page';
import { LicensesPage } from './licenses.page';
import { LoggingPage } from './logging.page';
import { NotificationsPage } from './notifications.page';

import { I18nAlertController, Options, Settings } from '../core';

@Component({
  templateUrl: 'settings.page.html'
})
export class SettingsPage implements OnDestroy, OnInit {
  aboutPage = AboutPage;
  connectionPage = ConnectionPage;
  licensesPage = LicensesPage;
  loggingPage = LoggingPage;
  notificationsPage = NotificationsPage;

  options = new Options();

  private subscription: any;

  constructor(private alert: I18nAlertController, private settings: Settings) {}

  ngOnInit() {
    this.subscription = this.settings.getOptions().subscribe(options => {
      this.options = options;
    });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  reset() {
    this.alert.create({
      message: 'Reset all user settings to default values?',
      buttons: [{
        text: 'Cancel',
        role: 'cancel',
      }, {
        text: 'OK',
        handler: () => { this.settings.clear(); }
      }]
    }).then(alert => {
      alert.present();
    });
  }

  update() {
    this.settings.setOptions(this.options);
  }
}
