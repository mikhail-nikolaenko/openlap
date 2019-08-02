import { Component } from '@angular/core';

import { PopoverController } from '@ionic/angular';

import { Logger } from '../core';

import { LoggingMenu } from './logging.menu';

@Component({
  templateUrl: 'logging.page.html',
})
export class LoggingPage {

  // FIXME: numeric values of levels are implementation details
  icons = [
    {name: 'bug', style: {color: 'green'}},
    {name: 'information-circle', style: {color: 'blue'}},
    {name: 'warning', style: {color: 'yellow'}},
    {name: 'alert', style: {color: 'red'}}
  ];

  constructor(public logger: Logger, private popover: PopoverController) {}

  showMenu(event) {
    return this.popover.create({
      component: LoggingMenu, 
      event: event
    }).then(menu => {
      menu.present();
    });
  }

  stringify(obj: any) {
    try {
      return JSON.stringify(obj);
    } catch(error) {
      return '' + obj;
    }
  }

}
