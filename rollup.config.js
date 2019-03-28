import commonjs from 'rollup-plugin-commonjs'

export default {
  input: 'lib/bootstrap_entry.js',
  output: {
    file: 'hcup-bootstrap.js',
    format: 'iife',
    name: 'hcup_bootstrap',
    exports: 'named'
  },
  plugins: [
    commonjs({
      sourceMap: false,
      ignore: [
        'os',
        'fs',
        'path',
        'child_process',
        'url',
        'https',
        'util',
        'crypto'
      ]
    })
  ]
}
