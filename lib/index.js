const env = require('./env')
const log = env.logger('index')
const bootstrap = require('./bootstrap')

// load modules
require('./modules/rustup')(env)
require('./modules/holochain-hc-util-binary')(env)
require('./modules/holochain-holochain-util-binary')(env)
require('./modules/holochain')(env)
require('./modules/holochain-dev')(env)

async function usage () {
  log.i('printing usage information')
  console.log('usage: hcup [options] <command> <...>')
  console.log('command: help = show this message')
  console.log('command: list = list targets')
  console.log('command: install <target> = run <target> module')
  console.log('command: upgrade = upgrade all selected target modules')
  console.log('option: -v = verbose logging')
  process.exit(1)
}

async function list () {
  log.i('listing targets')
  for (let target of Object.keys(env.targets).sort()) {
    console.log(target, '-', env.targets[target])
  }
}

async function install (target) {
  if (!(target in env.modules)) {
    log.e('target "' + target + '" is not valid')
    await list()
    process.exit(1)
  }

  log.i('attempting install of target', '"' + target + '"')

  await env.exec(target, '$init')

  if (!('selectedTargets' in env.config)) {
    env.config.selectedTargets = {}
  }

  if (target in env.targets) {
    env.config.selectedTargets[target] = true
    await env.exec('platform', 'writeConfig')
  }
}

async function upgrade () {
  if (
    !env.config.selectedTargets ||
    !Object.keys(env.config.selectedTargets).length
  ) {
    log.e('no selected targets, nothing to upgrade')
    return
  }

  for (let target of Object.keys(env.config.selectedTargets)) {
    if (!(target in env.targets)) {
      log.e('WARNING selectedTarget "' + target + '" not valid, skipping')
      continue
    }
    log.i('upgrading target', '"' + target + '"')
    await env.exec(target, '$init')
  }
}

module.exports = exports = async () => {
  try {
    const commands = []
    const flags = {}

    for (let i of process.argv.slice(2)) {
      if (i[0] === '-') {
        flags[i.toLowerCase()] = true
      } else {
        commands.push(i)
      }
    }

    if (flags['-v']) {
      env.setVerbose()
    }

    await bootstrap()

    const command = commands.shift()

    switch (command) {
      case 'help':
        await usage()
        break
      case 'list':
        await list()
        break
      case 'install':
        await install(commands.shift())
        break
      case 'upgrade':
        await upgrade()
        break
      default:
        log.e('unrecognized command:', command)
        await usage()
        break
    }

    log.i('done')
  } catch (e) {
    log.e(e)
    process.exit(1)
  }
}
