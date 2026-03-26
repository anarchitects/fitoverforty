# Fitoverforty

## Bricks README-First Overlay (Required)

- Before generating code, identify every `@anarchitects/*` package involved and read each package README end-to-end.
- Treat package READMEs as the primary source of integration truth (entry points, provider setup, expected composition, and constraints).
- Do not guess imports, module wiring, or runtime behavior when README guidance exists.
- If README guidance and local app code differ, align with README contracts unless a host override is explicitly documented.
- In generated code comments/PR notes, cite which package README sections drove decisions.
