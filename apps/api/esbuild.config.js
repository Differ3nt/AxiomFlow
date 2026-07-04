const fs = require('fs');
const { transformSync } = require('@swc/core');

// esbuild cannot emit `emitDecoratorMetadata` (it does no type analysis), which
// NestJS relies on for constructor-based dependency injection. Without it every
// provider is instantiated with `undefined` dependencies. This plugin routes
// TypeScript files through swc, which does emit the `design:paramtypes` metadata.
// Note: esbuild only runs onLoad plugins when bundling, hence `bundle: true`.
const swcDecoratorMetadata = {
  name: 'swc-decorator-metadata',
  setup(build) {
    build.onLoad({ filter: /\.ts$/ }, (args) => {
      const source = fs.readFileSync(args.path, 'utf8');
      const { code } = transformSync(source, {
        filename: args.path,
        jsc: {
          parser: { syntax: 'typescript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
          target: 'es2021',
          keepClassNames: true,
        },
      });
      return { contents: code, loader: 'js' };
    });
  },
};

module.exports = {
  plugins: [swcDecoratorMetadata],
};
