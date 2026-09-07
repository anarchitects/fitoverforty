const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '../../../dist/apps/fitoverforty/backend'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      // A deployed backend has no other way to run migrations: the classes are
      // bundled (data-source.ts imports them statically) but nothing in main.js
      // runs them, and the TypeORM CLI needs the workspace. See src/migrate.ts.
      additionalEntryPoints: [
        { entryName: 'migrate', entryPath: './src/migrate.ts' },
      ],
      tsConfig: './tsconfig.app.json',
      assets: [
        './src/assets',
        // Yarn Berry defaults to Plug'n'Play, and the artefact's package.json
        // carries `packageManager: yarn@4.x`, so a bare `yarn install` beside
        // main.js produces .pnp.cjs and no node_modules - after which plain
        // `node main.js` cannot resolve its first require. The workspace root
        // sets node-modules in its own .yarnrc.yml; the artefact is a separate
        // install root and inherits nothing, so it has to carry its own.
        {
          input: 'apps/fitoverforty/backend/deploy',
          glob: '.yarnrc.yml',
          output: '.',
        },
      ],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      // Packages that are require()d at runtime rather than imported, so
      // webpack never sees them and generatePackageJson never lists them.
      // Both fail only once the built artefact runs somewhere that is not the
      // workspace, which is why neither showed up before deployment scoping:
      //
      //   pg          - TypeORM loads the driver by name. Without it the
      //                 process dies at boot with
      //                 "Postgres package has not been found installed".
      //   nodemailer  - a non-optional peer of @nestjs-modules/mailer. In the
      //                 workspace it resolves only because mailparser hoists a
      //                 copy, which is luck rather than a promise.
      runtimeDependencies: ['pg', 'nodemailer'],
      sourceMap: true,
    }),
  ],
};
