import { provideFormsDefaults, provideFormsPagePreset } from '@anarchitects/forms-angular/config';
import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: 'contact',
    pathMatch: 'full',
  },
  {
    path: 'contact',
    loadComponent: () => import('@anarchitects/forms-angular').then(m => m.AnarchitectsFeatureForm),
    providers: [provideFormsDefaults(), provideFormsPagePreset({
      layoutVariant: 'stacked',
      maxInlineSize: '44rem',
      spacing: 'compact',
      actionAlignment: 'start',
    }),],
    data: {
      formId: 'contact-form',
      formVersion: 1,
      pageTitle: 'Contact Us',
      pageCaption: 'We would love to hear from you! Please fill out the form below to get in touch with us.',
    }
  }
];
