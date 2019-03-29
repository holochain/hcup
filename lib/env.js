const os = require('os')
const path = require('path')

module.exports = exports = {
  platform: os.platform(),
  arch: os.arch(),
  dataDir: null,
  selector: [os.platform()]
}

if (exports.platform === 'linux') {
  if (process.env.XDG_DATA_HOME) {
    exports.dataDir = path.resolve(process.env.XDG_DATA_HOME, 'hcup')
  } else if (process.env.HOME) {
    exports.dataDir = path.resolve(process.env.HOME, '.local', 'share', 'hcup')
  }
} else if (exports.platform === 'darwin') {
  if (process.env.HOME) {
    exports.dataDir = path.resolve(process.env.HOME, 'Library', 'Application Support', 'host.holo.hcup')
  }
} else if (exports.platform === 'win32') {
  if (process.env.APPDATA) {
    exports.dataDir = path.resolve(process.env.APPDATA, 'holo', 'hcup', 'data')
  }
}

if (!exports.dataDir) {
  throw new Error('failed to locate home directory')
}

require('./env/nix')(exports)
require('./env/os-release')(exports)

let isVerbose = false
exports.setVerbose = () => { isVerbose = true }

exports.logger = (tag) => {
  const write = (lvl, esc, ...args) => {
    if (process.stderr.isTTY) {
      process.stderr.write(esc)
    }
    console.error(lvl, '[hcup]', '[' + tag + ']', ...args)
    if (process.stderr.isTTY) {
      process.stderr.write('\x1b[0m')
    }
  }
  return {
    v: (...args) => {
      if (!isVerbose) {
        return
      }
      write('@v@', '\x1b[34m', ...args)
    },
    i: (...args) => {
      write('-i-', '\x1b[32m', ...args)
    },
    e: (...args) => {
      write('#e#', '\x1b[31m', ...args)
    }
  }
}

// const log = exports.logger('env')

exports.modules = {}
exports.targets = []

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
    if (ref._) {
      maybeFn = ref._
    }
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

exports.registerTarget = (moduleName, ...args) => {
  exports.register(moduleName, ...args)
  exports.targets.push(moduleName)
  exports.targets = exports.targets.sort()
}
