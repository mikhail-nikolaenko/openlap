import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { ConnectionsComponent } from './connections.component';
import { MenuComponent } from './menu.component';

import { SharedModule } from '../shared';
import { AppRoutingModule } from '../app-routing.module';

@NgModule({
  declarations: [
    ConnectionsComponent,
    MenuComponent
  ],
  entryComponents: [
  ],
  exports: [
    MenuComponent
  ], 
  imports: [
    CommonModule,
    SharedModule,
    IonicModule,
    AppRoutingModule
  ],
  providers: [
    
  ]
})
export class MenuModule {}
