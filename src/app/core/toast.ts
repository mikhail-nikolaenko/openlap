import { Injectable } from '@angular/core';

import { Platform, ToastController } from '@ionic/angular';

import { Toast as NativeToast } from '@ionic-native/toast/ngx';

interface ToastProvider {
  show(message: string, duration: number, position: 'top' | 'bottom' | 'center'): Promise<void>;
}

class NativeToastProvider implements ToastProvider {
  constructor(private toast: NativeToast) {}

  show(message: string, duration: number, position: 'top' | 'bottom' | 'center') {
    return this.toast.hide().then(() => {
      return new Promise<void>((resolve, reject) => {
        this.toast.show(message, duration.toString(), position).subscribe(
          () => resolve(),
          error => reject(error)
        );
      });
    });
  }
}

class IonicToastProvider implements ToastProvider {

  constructor(private controller: ToastController) {}

  show(message: string, duration: number, position: 'top' | 'bottom' | 'center') {
    return this.controller.create({
      message: message,
      duration: duration,
      position: position === 'center' ? 'middle' : position,
      showCloseButton: true
    }).then(toast => {
      return toast.present();
    });
  }
}

@Injectable()
export class Toast {

  private toast: ToastProvider;

  constructor(platform: Platform, controller: ToastController, nativeToast: NativeToast) {
    this.toast = platform.is('cordova') ? new NativeToastProvider(nativeToast) : new IonicToastProvider(controller);
  }

  show(message: string, duration: number, position: 'top' | 'bottom' | 'center') {
    return this.toast.show(message, duration, position);
  }

  showTop(message: string, duration: number) {
    return this.show(message, duration, 'top');
  }

  showBottom(message: string, duration: number) {
    return this.show(message, duration, 'bottom');
  }

  showCenter(message: string, duration: number) {
    return this.show(message, duration, 'center');
  }
}
