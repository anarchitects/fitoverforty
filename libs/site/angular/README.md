# site-angular

The Angular half of site identity: an `InjectionToken` and
`provideSiteIdentity()`.

The value and its interface live in `@fitoverforty/site-ts`, which is
framework-free because the backend imports it too. This library exists only
because an `InjectionToken` needs `@angular/core`.

There is deliberately no default. A library with a fallback identity works
unconfigured and then renders the wrong site's name in the next application,
which is the failure this replaced.
