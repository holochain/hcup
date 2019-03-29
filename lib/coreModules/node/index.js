const os = require('os')
const path = require('path')
const fs = require('fs')

module.exports = exports = env => {
  const log = env.logger('node')

  const WANT_VERSION = 'v8.15.1'

  const NODE_BIN = {
    linux: {
      x64: {
        url: 'https://nodejs.org/dist/v8.15.1/node-v8.15.1-linux-x64.tar.gz',
        fileName: 'node-v8.15.1-linux-x64.tar.gz',
        hash: '16e203f2440cffe90522f1e1855d5d7e2e658e759057db070a3dafda445d6d1f',
        nodeDir: path.resolve(env.dataDir, 'node-v8.15.1-linux-x64')
      }
    },
    darwin: {
      x64: {
        url: 'https://nodejs.org/dist/v8.15.1/node-v8.15.1-darwin-x64.tar.gz',
        fileName: 'node-v8.15.1-darwin-x64.tar.gz',
        hash: 'f3da0b4397150226c008a86c99d77dbb835dc62219d863654913a78332ab19a5',
        nodeDir: path.resolve(env.dataDir, 'node-v8.15.1-darwin-x64')
      }
    }
  }

  const SINGLETON = {
    nodeBin: null
  }

  function nodeFail () {
    throw new Error('"node" not found in path. Please install "node"@"' + WANT_VERSION + '".')
  }

  function getNodeBin () {
    let ref = NODE_BIN[env.platform]
    if (!ref) {
      env.error('[node] no node def for platform "' + env.platform + '"')
      nodeFail()
    }
    ref = ref[env.arch]
    if (!ref) {
      env.error('[node] no node def for arch "' + env.arch + '"')
      nodeFail()
    }
    return ref
  }

  env.register('node', '$init', async () => {
    let needRelaunch = false

    log.v('checking node version === ' + WANT_VERSION)

    SINGLETON.nodeBin = path.resolve(getNodeBin().nodeDir, 'bin', 'node')

    if (
      process.version !== WANT_VERSION || process.argv[0] !== SINGLETON.nodeBin
    ) {
      needRelaunch = true
    }

    let ver = ''

    try {
      ver = (await env.exec('platform', 'shellCapture', {
        cmd: SINGLETON.nodeBin,
        args: ['--version']
      })).stdout
    } catch (e) { /* pass */ }

    log.v('[node] version:', ver)

    if (ver !== WANT_VERSION) {
      needRelaunch = true
      await env.exec('node', '$install')

      ver = (await env.exec('platform', 'shellCapture', {
        cmd: SINGLETON.nodeBin,
        args: ['--version']
      })).stdout

      log.v('[node] version:', ver)

      if (ver !== WANT_VERSION) {
        throw new Error('node download did not produce correct version: ' + ver.stdout.toString())
      }
    }

    if (needRelaunch) {
      return { needRelaunch }
    }
  })

  if (env.platform === 'linux' || env.platform === 'darwin') {
    env.register('node', '$install', async () => {
      const nodeBin = getNodeBin()

      await env.exec('platform', 'download', nodeBin)
      await env.exec('platform', 'shell', {
        cmd: 'sh',
        args: ['-c', `cd \\"${env.dataDir}\\" && tar xf \\"${nodeBin.fileName}\\"`]
      })
    })
  } else {
    env.register('node', '$install', async () => {
      nodeFail()
    })
  }

  async function writeBourneLauncher (args) {
    log.v('[node] check launcher version ===', args.gitHash)

    const binDir = path.resolve(env.dataDir, 'bin')
    const launcher = path.resolve(binDir, 'hcup')

    try {
      const contents = fs.readFileSync(launcher, 'utf8')
      const m = contents.match(/#gitHash:([^#]+)/m)
      if (m && m.length >= 2 && m[1] === args.gitHash) {
        log.v('launcher is correct version')
        return
      }
    } catch (e) { /* pass */ }

    await env.exec('platform', 'mkdirp', { path: binDir })

    const shPath = (await env.exec('platform', 'shellCapture', {
      cmd: 'which',
      args: ['sh']
    })).stdout
    log.v('found shell path: "' + shPath + '"')

    fs.writeFileSync(launcher, `#! ${shPath}
#gitHash:${args.gitHash}#
exec "${SINGLETON.nodeBin}" "${env.dataDir}/repo/lib/index_entry.js" "$@"
`, {
      mode: 0o755
    })

    log.i('launcher created:', launcher)

    let profile = path.resolve(os.homedir(), '.profile')
    if (
      env.platform === 'darwin' &&
      fs.existsSync(path.resolve(os.homedir(), '.bash_profile'))
    ) {
      profile = path.resolve(os.homedir(), '.bash_profile')
    }

    const addPath = `export "PATH=${binDir}:$PATH"`
    try {
      const contents = fs.readFileSync(profile)
      if (contents.includes(binDir)) {
        log.v(`[node] path addition found in ${profile}`)
        return
      }
    } catch (e) { /* pass */ }

    fs.writeFileSync(profile, '\n' + addPath + '\n', {
      flag: 'a'
    })

    log.i('| --------------------------------------------------')
    log.i('| execute the following, or log out and back in')
    log.i(`| ${addPath}`)
    log.i('| --------------------------------------------------')
  }

  async function writeWin32BatchLauncher (args) {
    const binDir = path.resolve(env.dataDir, 'bin')
    const launcher = path.resolve(binDir, 'hcup.cmd')

    try {
      const contents = fs.readFileSync(launcher, 'utf8')
      const m = contents.match(/REM gitHash:([^\s]+) REM/m)
      if (m && m.length >= 2 && m[1] === args.gitHash) {
        log.v('launcher is correct version')
        return
      }
    } catch (e) { /* pass */ }

    fs.writeFileSync(launcher, `@ECHO OFF
REM gitHash:${args.gitHash} REM
@"%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -InputFormat None -ExecutionPolicy Bypass -Command "${SINGLETON.nodeBin} ${env.dataDir}/repo/lib/index_entry.js %*"
`, {
      mode: 0o755
    })
  }

  if (env.platform === 'linux' || env.platform === 'darwin') {
    env.register('node', 'writeLauncher', writeBourneLauncher)
  } else if (env.platform === 'win32') {
    env.register('node', 'writeLauncher', writeWin32BatchLauncher)
  } else {
    env.register('node', 'writeLauncher', async () => {
      throw new Error('no launcher configured for your platform')
    })
  }

  env.register('node', 'relaunch', async () => {
    return env.exec('platform', 'relaunch', SINGLETON.nodeBin)
  })
}
