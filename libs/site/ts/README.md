# site-ts

The site's own identity: its name, its one-sentence description and its contact
address, plus the Nest injection token for them.

Framework-free on purpose — the backend imports this, so it must not reach for
`@angular/core`. The Angular `InjectionToken` and `provideSiteIdentity()` live
in `@fitoverforty/site-angular`.

What belongs here is chrome and machine-readable metadata, not copy. The test
is whether a second site would want *the same sentence with a different noun in
it*. See the notes in `src/lib/site-identity.ts` for the two things that look
like they belong and deliberately do not.
