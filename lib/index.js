const env = require('./env')
const log = env.logger('index')
const bootstrap = require('./bootstrap')

// load modules
require('./modules/test')(env)

async function usage () {
  log.i('printing usage information')
  console.log('usage: hcup [options] <command> <...>')
  console.log('command: help = show this message')
  console.log('command: list = list targets')
  console.log('command: install <target> = run <target> module')
  console.log('option: -v = verbose logging')
  process.exit(1)
}

async function list () {
  log.i('listing targets')
  for (let target of env.targets) {
    console.log(target)
  }
}

async function install (target) {
  if (env.targets.indexOf(target) < 0) {
    log.e('target "' + target + '" is not valid')
    await list()
    process.exit(1)
  }

  log.i('attempting install of target', '"' + target + '"')

  env.exec(target, '$init')
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
