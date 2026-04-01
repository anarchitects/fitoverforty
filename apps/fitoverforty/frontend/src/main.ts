import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { applyAnxBaseStyles } from '@anarchitects/common-angular-design/styles';
import './styles.css';

// Apply design system base styles
applyAnxBaseStyles();

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
