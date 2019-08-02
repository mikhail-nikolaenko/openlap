import { Component, OnDestroy, OnInit } from '@angular/core';

import { NavParams, PopoverController } from '@ionic/angular';

import { I18nAlertController, Options, Settings } from '../core';

@Component({
  templateUrl: 'rms.menu.html',
})
export class RmsMenu implements OnDestroy, OnInit  {

  options = new Options();

  params: {mode: string, active: boolean, restart: any, cancel: any};

  private subscription: any;

  constructor(
    private alert: I18nAlertController,
    private settings: Settings,
    private popover: PopoverController,
    params: NavParams
  ) {
    this.params = <any>params.data;  // FIXME
  }

  get fixedOrder() {
    return this.options.fixedorder;
  }

  set fixedOrder(value) {
    this.options.fixedorder = value;
    this.settings.setOptions(this.options);
    this.dismiss();
  }

  ngOnInit() {
    this.subscription = this.settings.getOptions().subscribe(options => {
      this.options = options;
    });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  onRestart() {
    this.dismiss().then(() => {
      if (this.params.active) {
        this.alert.create({
          message: 'Restart ' + this.params.mode + '?',
          buttons: [{
            text: 'Cancel',
            role: 'cancel',
          }, {
            text: 'OK',
            handler: () => this.params.restart()
          }]
        }).then(alert => {
          alert.present();
        });
      } else {
        this.params.restart();
      }
    });
  }

  onCancel() {
    this.dismiss().then(() => {
      if (this.params.active) {
        this.alert.create({
          message: 'Cancel ' + this.params.mode + '?',
          buttons: [{
            text: 'Cancel',
            role: 'cancel',
          }, {
            text: 'OK',
            handler: () => this.params.cancel()
          }]
        }).then(alert => {
          alert.present();
        });
      } else {
        this.params.cancel();
      }
    });
  }

  private dismiss() {
    return this.popover.dismiss({});
  }
}
