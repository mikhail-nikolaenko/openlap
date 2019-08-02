import { Injectable } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

import { AlertController } from '@ionic/angular';
import { AlertOptions } from '@ionic/core';

@Injectable()
export class I18nAlertController {

  constructor(private alert: AlertController, private translate: TranslateService) {}

  create(opts?: AlertOptions) {
    // create returns Alert, so use synchronous translate.instant()
    if (opts) {
      opts = Object.assign({}, opts, {
        title: opts.header ? this.translate.instant(opts.header) : opts.header,
        subTitle: opts.subHeader ? this.translate.instant(opts.subHeader) : opts.subHeader,
        message: opts.message ? this.translate.instant(opts.message) : opts.message,
        buttons: (opts.buttons || []).map(button => {
          if (typeof button === 'string') {
            return this.translate.instant(button);
          } else {
            return Object.assign({}, button, {text: this.translate.instant(button.text)});
          }
        })
      });
    }
    return this.alert.create(opts);
  }
}
