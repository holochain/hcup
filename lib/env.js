const os = require('os')
const path = require('path')

let rcount = 1
for (let r of process.argv) {
  if (r.startsWith('-r')) {
    rcount = parseInt(r.substr(2), 10) + 1
  }
}

module.exports = exports = {
  rcount,
  platform: os.platform(),
  arch: os.arch(),
  dataDir: null,
  binDir: null
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

exports.binDir = path.resolve(exports.dataDir, 'bin')

require('./env/nix')(exports)
require('./env/os-release')(exports)

let isVerbose = false
exports.setVerbose = () => { isVerbose = true }

exports.logger = (tag) => {
  const write = (lvl, esc, ...args) => {
    if (process.stderr.isTTY) {
      process.stderr.write(esc)
    }
    const output = []
    for (let arg of args) {
      if (arg instanceof Error) {
        arg = arg.stack || arg.toString()
      } else if (typeof arg === 'object') {
        arg = JSON.stringify(arg, null, 2)
      } else if (!arg) {
        arg = '[undefined]'
      } else {
        arg = arg.toString()
      }
      output.push(arg)
    }
    for (let line of output.join(' ').split('\n')) {
      console.error(lvl, '[hcup]', '[' + tag + ']', line)
    }
    if (process.stderr.isTTY) {
      process.stderr.write('\x1b[0m')
    }
  }
  return {
    v: (...args) => {
      if (!isVerbose) {
        return
      }
      write('@v@', '\x1b[36m', ...args)
    },
    i: (...args) => {
      write('-i-', '\x1b[32m', ...args)
    },
    e: (...args) => {
      write('#e#', '\x1b[31m', ...args)
    }
  }
}

// don't enumerate
Object.defineProperty(exports, 'modules', {
  value: {}
})

// don't enumerate
Object.defineProperty(exports, 'targets', {
  value: {}
})

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

  const out = await modRef[fnName](...args)

  if (fnName === '$init') {
    modRef.$initDone = true
  } else if (fnName === '$install') {
    modRef.$installDone = true
  }

  return out
}

exports.register = (moduleName, fnName, fn) => {
  if (!(moduleName in exports.modules)) {
    exports.modules[moduleName] = {}
  }
  const ref = exports.modules[moduleName]
  if (fnName in ref) {
    throw new Error('function "' + fnName + '" already registered for module "' + moduleName + '"')
  }
  ref[fnName] = fn

  return exports
}

exports.addTarget = (moduleName, description) => {
  if (!(moduleName in exports.modules)) {
    throw new Error('cannot add target for non-existant module: "' + moduleName + '"')
  }
  if (moduleName in exports.targets) {
    throw new Error('duplicate target module name: "' + moduleName + '"')
  }
  exports.targets[moduleName] = description

  return exports
}
