import { Component, OnDestroy, OnInit } from '@angular/core';

import { PopoverController } from '@ionic/angular';

import { AppVersion } from '@ionic-native/app-version/ngx';
import { Device } from '@ionic-native/device/ngx';
import { SocialSharing } from '@ionic-native/social-sharing/ngx';

import { Logger, Options, Settings } from '../core';

function stringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch(error) {
    return '' + obj;
  }
}

@Component({
  templateUrl: 'logging.menu.html',
})
export class LoggingMenu implements OnDestroy, OnInit {

  private options = new Options();

  private subscription: any;

  get debugEnabled() {
    return this.options.debug;
  }

  set debugEnabled(value) {
    this.options.debug = value;
    this.settings.setOptions(this.options);
    this.dismiss();
  }

  constructor(private appVersion: AppVersion, private sharing: SocialSharing, private device: Device,
    public logger: Logger, private settings: Settings, private popover: PopoverController) {}

  ngOnInit() {
    this.subscription = this.settings.getOptions().subscribe({
      next: (options) => {
        this.options = options;
      },
      error: (error) => {
        this.logger.error('Logging settings: ', error);
      },
      complete: () => {
        this.logger.debug('Logging settings complete');
      }
    });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  clear() {
    this.logger.clear();
    this.dismiss();
  }

  dismiss() {
    return this.popover.dismiss();
  }

  share() {
    Promise.all([this.appVersion.getAppName(), this.appVersion.getVersionNumber()]).then(([name, version]) => {
      const message = this.logger.records.map(record => {
        return [record.level, record.time, record.args.map(stringify).join(' ')].join('\t');
      }).join('\n');
      const subject = name + ' ' + version + ' (' + [this.device.model, this.device.platform, this.device.version].join(' ') + ')';
      return this.sharing.shareWithOptions({ message: message, subject: subject });
    }).catch(error => {
      this.logger.error('Error sharing log:', error);
    }).then(() => {
      this.dismiss();
    });
  }
}
