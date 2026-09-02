/**
 * pm2 process definition for the deployed blog.
 *
 * Copy this next to the artefact and adjust `cwd`. pm2 is expected to be
 * installed on the server, not in this workspace: nothing here builds or tests
 * against it.
 */
module.exports = {
  apps: [
    {
      name: 'fitoverforty',

      /**
       * `cwd` is load-bearing, not tidiness.
       *
       * Three paths in the environment are relative — WEB_SERVER_ENTRY,
       * WEB_BROWSER_ASSETS_DIR and MAILER_TEMPLATE_DIR — and pm2 resolves a
       * relative `script` and the process's working directory against pm2's
       * own cwd, which is wherever `pm2 start` happened to be run from. Set
       * this and the artefact can be laid out anywhere; leave it out and the
       * app either refuses to boot (the two SSR paths are checked at startup)
       * or fails much later at send time (the template directory is not).
       */
      cwd: '/srv/fitoverforty/current/server',
      script: 'main.js',

      /**
       * Fork, one instance.
       *
       * Cluster mode would need more than a flag flip: the newsletter's rate
       * limiter keeps its window in process memory, so N workers means N times
       * the allowance, and uploaded media is written to local disk. Neither is
       * hard to fix, but both are silent under load rather than at boot, and a
       * blog is not the place to discover them.
       */
      exec_mode: 'fork',
      instances: 1,

      /**
       * Everything else comes from the `.env` beside main.js. Nest's
       * ConfigModule loads it during bootstrap, which is *before* main.ts
       * reads PORT and before the SSR paths are checked, so a variable does
       * not have to be exported here to be seen. Values set in an `env` block
       * below would win over that file, which is a reason to keep this empty:
       * one place to look.
       */
      env: {},

      autorestart: true,
      max_memory_restart: '512M',
      // Angular SSR holds the whole app in memory and boots for perhaps two
      // seconds; without this pm2 counts a slow start as a crash loop.
      min_uptime: '20s',
      max_restarts: 10,

      out_file: '/var/log/fitoverforty/out.log',
      error_file: '/var/log/fitoverforty/error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
