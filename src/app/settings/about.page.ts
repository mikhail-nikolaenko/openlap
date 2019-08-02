import { Component } from '@angular/core';

import { AppVersion } from '@ionic-native/app-version/ngx';

import { Logger } from '../core';

@Component({
  templateUrl: 'about.page.html',
})
export class AboutPage {

  version: Promise<string>;

  constructor(private appVersion: AppVersion, private logger: Logger) {}

  ngOnInit() {
    this.version = this.appVersion.getVersionNumber().catch(error => {
      this.logger.error('Error retrieving application version', error);
      return 'Web';
    });
  }
}
