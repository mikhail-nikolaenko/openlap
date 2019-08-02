import { ErrorHandler, Injectable } from '@angular/core';

import { Logger } from './logger';

@Injectable()
export class LoggingErrorHandler implements ErrorHandler {

  constructor(private logger: Logger) {}

  handleError(error: any) {
    this.logger.error('Error:', error);
  }
}
