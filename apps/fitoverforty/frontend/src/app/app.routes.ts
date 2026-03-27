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
    data: {
      formId: 'contact-form',
      formVersion: 1,
      layout: 'form:stacked',
      layoutOptions: {
        columns: 1,
      },
    }
  }
];
