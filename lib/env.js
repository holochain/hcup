const os = require('os')
const path = require('path')

module.exports = exports = {
  platform: os.platform(),
  arch: os.arch(),
  dataDir: path.resolve(os.homedir(), '.hcup'),
  selector: [os.platform()],
  modules: {},
  lastModule: null
}

if (exports.platform === 'linux') {
  if (process.env.XDG_DATA_HOME) {
    exports.dataDir = path.resolve(process.env.XDG_DATA_HOME, 'hcup')
  } else if (process.env.HOME) {
    exports.dataDir = path.resolve(process.env.HOME, '.local', 'share', 'hcup')
  }
}

require('./env/nix')(exports)
require('./env/debian')(exports)

exports.exec = async (moduleName, fnName, ...args) => {
  if (!(moduleName in exports.modules)) {
    throw new Error('module "' + moduleName + '" not found')
  }
  const modRef = exports.modules[moduleName]

  if (fnName === '$init' && modRef.$initDone) {
    return
  }

  if (fnName === '$install' && modRef.$installDone) {
    return
  }

  if (fnName !== '$init' && fnName !== '$install') {
    await exports.exec(moduleName, '$init')
  }

  if (!(fnName in modRef)) {
    throw new Error(
      'fn "' + fnName + '" not found in module "' + moduleName + '"')
  }

  let ref = modRef[fnName]
  let maybeFn = ref._
  for (let s of exports.selector) {
    if (!(s in ref)) {
      break
    }
    ref = ref[s]
    maybeFn = ref._
  }

  if (!maybeFn) {
    throw new Error('could not find selector fn')
  }

  const out = await maybeFn(...args)

  if (fnName === '$init') {
    modRef.$initDone = true
  } else if (fnName === '$install') {
    modRef.$installDone = true
  }

  return out
}

exports.register = (moduleName, fnName, selector, fn) => {
  exports.lastModule = moduleName

  if (!(moduleName in exports.modules)) {
    exports.modules[moduleName] = {}
  }
  let ref = exports.modules[moduleName]
  if (!(fnName in ref)) {
    ref[fnName] = {}
  }
  ref = ref[fnName]
  for (let s of selector) {
    if (!(s in ref)) {
      ref[s] = {}
    }
    ref = ref[s]
  }
  ref._ = fn

  return exports
}

exports.log = (...args) => {
  console.log('[hcup]', ...args)
}

exports.error = (...args) => {
  console.error('[hcup]', ...args)
}

let didPrep = false
process.on('beforeExit', async () => {
  if (didPrep) {
    return
  }
  didPrep = true

  const env = exports

  env.log('[env:prep] git')
  const gitDir = path.resolve(env.dataDir, 'repo')

  const gitRes = await env.exec('git', 'update', {
    path: gitDir
  })

  if (gitRes && gitRes.needRelaunch) {
    // we don't know that we have the correct node binary yet
    // relaunch so we can reload and check next time
    process.exit(await env.exec('platform', 'relaunch', process.argv[0]))
  }

  env.log('[env:prep] node')
  const nodeRes = await env.exec('node', '$init')

  if (nodeRes && nodeRes.needRelaunch) {
    // now we may have a different node binary, relaunch with that
    process.exit(await env.exec('node', 'relaunch'))
  }

  await env.exec('node', 'writeLauncher')

  env.log('[env:prep] ready')
  await env.exec(env.lastModule, '$init')
})

require('./coreModules/platform')(exports)
require('./coreModules/git')(exports)
require('./coreModules/node')(exports)
