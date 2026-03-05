import 'reflect-metadata';

import { catchError, ErrorManager } from './error-manager';

class Handler {
  // static

  static This: Handler;

  // instance data

  error = 0;
  rangeError = 0;
  stringError = 0;
  anyError = 0;

  // constructor

  constructor() {
    Handler.This = this;
  }

  // handlers

  @catchError()
  public handleError(error: Error) {
    this.error++;
  }

  @catchError()
  public handleRangeError(error: RangeError) {
    this.rangeError++;
  }

  @catchError()
  public handleStringError(error: string) {
    this.stringError++;
  }

  @catchError()
  public handleAnyError(error: any) {
    this.anyError++;
  }
}


describe('ErrorManager', () => {
  const errorManager = new ErrorManager();

  errorManager.registerHandler(new Handler());

  it('should dispatch error types', () => {
    // error

    try {
      throw new Error('ouch');
    } catch (error) {
      errorManager.handle(error);

      expect(Handler.This.error).toBe(1);
    }

    // range error

    try {
      throw new RangeError('ouch');
    } catch (error) {
      errorManager.handle(error);

      expect(Handler.This.rangeError).toBe(1);
    }

    // string, any?

    try {
      throw 'ouch';
    } catch (error) {
      errorManager.handle(error);

      expect(Handler.This.stringError).toBe(1);
    }
  });
});
