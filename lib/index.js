const env = require('./env')
const bootstrap = require('./bootstrap')

// load modules
require('./modules/test')(env)

async function usage () {
  console.log('usage: hcup <command> <options>')
  console.log('usage: hcup help - show this message')
  console.log('usage: hcup list - list targets')
  console.log('usage: hcup install <target> - install <target>')
  process.exit(1)
}

async function list () {
  env.log('[index] listing targets')
  for (let target of env.targets) {
    console.log(target)
  }
}

async function install () {
  const target = process.argv[3]

  if (env.targets.indexOf(target) < 0) {
    env.error('[index] target "' + target + '" is not valid')
    return list()
  }

  env.exec(target, '$init')
}

module.exports = exports = async () => {
  await bootstrap()

  const command = process.argv[2]

  switch (command) {
    case 'help':
      return usage()
    case 'list':
      return list()
    case 'install':
      return install()
    default:
      env.error('unrecognized command:', command)
      return usage()
  }
}
