const env = require('./env')
const log = env.logger('bootstrap')

const path = require('path')

// load coreModules
require('./coreModules/platform')(env)
require('./coreModules/git')(env)
require('./coreModules/node')(env)

async function darwinCheckBrew () {
  try {
    let ver = (await env.exec('platform', 'shellCapture', {
      cmd: 'brew',
      args: ['--version']
    }))
    log.v('brew version', ver)
    return
  } catch (e) { /* pass */ }

  log.i('homebrew not found, installing')

  // non-capturing shell so user can interact with stdin
  await env.exec('platform', 'shell', {
    cmd: '/usr/bin/ruby',
    args: [
      '-e',
      '$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)'
    ]
  })
}

async function win32CheckChoco () {
  try {
    let ver = (await env.exec('platform', 'shellCapture', {
      cmd: 'choco.exe',
      args: ['version']
    }))
    log.v('choco version', ver)
    return
  } catch (e) { /* pass */ }

  log.i('choco not found, installing')

  // non-capturing shell so user can interact with stdin
  await env.exec('platform', 'shell', {
    cmd: process.env.SystemRoot + '\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    args: [
      '-NoProfile',
      '-InputFormat',
      'None',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      '"iex ((New-Object System.Net.WebClient).DownloadString(\'https://chocolatey.org/install.ps1\'))"'
    ]
  })

  // XXX make this cleaner
  log.e('please run `refreshenv` or restart your terminal, then re-execute the hcup script')
  process.exit(1)
}

module.exports = exports = async () => {
  try {
    log.i('checking bootstrap dependencies')

    if (env.platform === 'darwin') {
      await darwinCheckBrew()
    } else if (env.platform === 'win32') {
      await win32CheckChoco()
    }

    log.v(JSON.stringify(env, null, 2))
    log.i('platform', env.platform)
    log.i('arch', env.arch)

    log.v('verify git')
    const gitDir = path.resolve(env.dataDir, 'repo')

    const gitRes = await env.exec('git', 'ensureRepoUpdated', {
      url: 'https://github.com/neonphog/hcup.git',
      path: gitDir,
      branch: 'master'
    })

    if (gitRes && gitRes.needRelaunch) {
      // we don't know that we have the correct node binary yet
      // relaunch so we can reload and check next time
      process.exit(await env.exec('platform', 'relaunch', process.argv[0]))
    }

    log.v('verify node')
    const nodeRes = await env.exec('node', '$init')

    if (nodeRes && nodeRes.needRelaunch) {
      // now we may have a different node binary, relaunch with that
      process.exit(await env.exec('node', 'relaunch'))
    }

    log.v('verify config')
    await env.exec('platform', 'readConfig')

    log.v('verify launcher')
    await env.exec('node', 'writeLauncher', { gitHash: gitRes.hash })

    log.i('ready')
  } catch (e) {
    log.e(e)
    process.exit(1)
  }
}
