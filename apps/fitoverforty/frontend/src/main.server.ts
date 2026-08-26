import {
  bootstrapApplication,
  type BootstrapContext,
} from '@angular/platform-browser';
import { App } from './app/app';
import { serverAppConfig } from './app/app.config.server';

export function bootstrapServerApplication(context: BootstrapContext) {
  return bootstrapApplication(App, serverAppConfig, context);
}

export default bootstrapServerApplication;
