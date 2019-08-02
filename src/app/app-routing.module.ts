import { Injectable, NgModule } from '@angular/core';
import { ActivatedRouteSnapshot, PreloadAllModules, Resolve, RouterModule, RouterStateSnapshot, Routes } from '@angular/router';

import { Observable } from 'rxjs';
import { first } from 'rxjs/operators';

import { RaceOptions, Settings } from './core';
import { RmsPage } from './rms';
import { SettingsPage, ColorsPage, DriversPage, AboutPage, LoggingPage , LicensesPage, ConnectionPage, NotificationsPage } from './settings';
import { TuningPage } from './tuning';

import { RootPage } from './root.page';

@Injectable({
  providedIn: 'root',
})
export class RaceOptionsResolver implements Resolve<RaceOptions> {
  constructor(private settings: Settings) { }

  resolve(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<RaceOptions> | RaceOptions {
    // FIXME: Settings.get() vs. Settings.observe()!
    switch (route.paramMap.get('mode')) {
      case 'race':
        return this.settings.getRaceSettings().pipe(first()).toPromise();
      case 'qualifying':
        return this.settings.getQualifyingSettings().pipe(first()).toPromise();
      default:
        return new RaceOptions('practice');
    }
  }
}

const routes: Routes = [
  {
    path: '',
    redirectTo: 'root',
    pathMatch: 'full'
  },
  {
    path: 'root',
    component: RootPage
  },
  {
    path: 'rms/:mode',
    component: RmsPage,
    resolve: {
      options: RaceOptionsResolver
    },
    runGuardsAndResolvers: 'always'
  },
  {
    path: 'settings',
    component: SettingsPage
  },
  {
    path: 'colors',
    component: ColorsPage
  },
  {
    path: 'drivers',
    component: DriversPage
  },
  {
    path: 'about',
    component: AboutPage
  },
  {
    path: 'logging',
    component: LoggingPage
  },
  {
    path: 'licenses',
    component: LicensesPage
  },
  {
    path: 'connection',
    component: ConnectionPage
  },
  {
    path: 'notifications',
    component: NotificationsPage
  },
  {
    path: 'tuning',
    component: TuningPage
  },
  { 
    path: '**', 
    component: RootPage 
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { 
      onSameUrlNavigation: 'reload',
      preloadingStrategy: PreloadAllModules 
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
