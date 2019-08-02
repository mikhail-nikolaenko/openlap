import { Component, Inject, Input } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

import { Platform } from '@ionic/angular';

import { Observable, concat, empty, from } from 'rxjs';
import { mergeAll, catchError, mergeMap, scan, take } from 'rxjs/operators';

import { Backend } from '../backend';
import { Peripheral } from '../carrera';
import { Logger, Settings, Toast } from '../core';

@Component({
  selector: 'app-connections',
  templateUrl: 'connections.component.html'
})
export class ConnectionsComponent {

  @Input() selected: Peripheral;

  peripherals: Observable<Peripheral[]>;

  constructor(@Inject(Backend) private backends: Backend[],
    private logger: Logger,
    private platform: Platform,
    private settings: Settings,
    private toast: Toast,
    private translate: TranslateService)
  {
  }

  ngOnInit() {
    this.platform.ready().then(readySource => {
      const scans = this.backends.map(backend => backend.scan().pipe(
        catchError(e => {
          this.logger.error('Scan error:', e);
          this.showToast(e.toString());
          return empty();
        })
      ));

      this.peripherals = from(scans).pipe(
        mergeMap(val => val),
        scan((result, value) => { 
          return result.concat(value);
        }, [])
      );
    });
  }

  onSelect(peripheral: Peripheral) {
    this.settings.getConnection().pipe(take(1)).subscribe((connection) => {
      this.settings.setConnection(Object.assign({}, connection, {
        type: peripheral.type,
        name: peripheral.name,
        address: peripheral.address
      }));
    });
  }

  private showToast(message: string) {
    this.translate.get(message).toPromise().then(message => {
      return this.toast.showCenter(message, 3000);
    }).catch(error => {
      this.logger.error('Error showing toast', error);
    });
  }
}
