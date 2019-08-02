// FIXME: also import zone-patch-rxjs?
import 'zone.js/dist/zone-patch-cordova';

import { NgModule } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { RouterModule } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AndroidFullScreen } from '@ionic-native/android-full-screen/ngx';
import { AppVersion } from '@ionic-native/app-version/ngx';
import { BLE } from '@ionic-native/ble/ngx';
import { Device } from '@ionic-native/device/ngx';
import { Insomnia } from '@ionic-native/insomnia/ngx';
import { Serial } from '@ionic-native/serial/ngx';
import { SocialSharing } from '@ionic-native/social-sharing/ngx';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { TextToSpeech } from '@ionic-native/text-to-speech/ngx';
import { Toast } from '@ionic-native/toast/ngx';

import { IonicStorageModule } from '@ionic/storage';

import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

import { BackendModule } from './backend';
import { CoreModule } from './core';
import { MenuModule } from './menu';
import { RmsModule } from './rms';
import { SettingsModule } from './settings';
import { SharedModule } from './shared';
import { TuningModule } from './tuning';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { RootPage } from './root.page';

// AoT requires an exported function for factories
export function createTranslateLoader(http: HttpClient) {
    return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
  declarations: [
    AppComponent,
    RootPage
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    IonicModule.forRoot(),
    IonicStorageModule.forRoot(/* TODO: config */),
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: createTranslateLoader,
        deps: [HttpClient]
      }
    }),
    RouterModule.forChild([
      {
        path: '',
        component: RootPage
      }
    ]),
    BackendModule,
    CoreModule,
    MenuModule,
    RmsModule,
    SettingsModule,
    SharedModule,
    TuningModule,
    AppRoutingModule
  ],
  providers: [
    AndroidFullScreen,
    AppVersion,
    BLE,
    Device,
    Insomnia,
    Serial,
    SocialSharing,
    SplashScreen,
    StatusBar,
    TextToSpeech,
    Toast,
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy }
  ],
  bootstrap: [AppComponent],
  entryComponents: [
    /*
    AppComponent,
    RootPage
    */
  ],
})
export class AppModule {}
