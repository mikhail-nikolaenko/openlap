import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SharedModule } from '../shared';

import { LeaderboardModule } from './leaderboard';
import { RmsMenu } from './rms.menu';
import { RmsPage } from './rms.page';
import { RaceSettingsPage } from './race-settings.page';

@NgModule({
  declarations: [
    RmsMenu,
    RmsPage,
    RaceSettingsPage
  ],
  entryComponents: [
    RmsMenu,
    RmsPage,
    RaceSettingsPage
  ],
  exports: [
    RmsPage,
    RaceSettingsPage
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    LeaderboardModule,
    SharedModule
  ],
  providers: [
  ]
})
export class RmsModule {}
