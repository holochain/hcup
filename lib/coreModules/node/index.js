const path = require('path')

module.exports = exports = env => {
  const WANT_VERSION = 'v8.15.1'

  const NODE_BIN = {
    linux: {
      x64: {
        url: 'https://nodejs.org/dist/v8.15.1/node-v8.15.1-linux-x64.tar.gz',
        fileName: 'node-v8.15.1-linux-x64.tar.gz',
        hash: '16e203f2440cffe90522f1e1855d5d7e2e658e759057db070a3dafda445d6d1f',
        nodeDir: path.resolve(env.dataDir, 'node-v8.15.1-linux-x64')
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

  env.register('node', '$init', [], async () => {
    let needRelaunch = false

    env.log('[node] checking node version === ' + WANT_VERSION)

    SINGLETON.nodeBin = path.resolve(getNodeBin().nodeDir, 'bin', 'node')

    if (
      process.version !== WANT_VERSION || process.argv[0] !== SINGLETON.nodeBin
    ) {
      needRelaunch = true
    }

    const ver = await env.exec('platform', 'shellCapture', {
      cmd: SINGLETON.nodeBin,
      args: ['--version']
    })

    if (ver.code !== 0 || ver.stdout.toString().trim() !== WANT_VERSION) {
      needRelaunch = true
      await env.exec('node', '$install')

      const ver = await env.exec('platform', 'shellCapture', {
        cmd: SINGLETON.nodeBin,
        args: ['--version']
      })

      if (ver.code !== 0 || ver.stdout.toString().trim() !== WANT_VERSION) {
        throw new Error('node download did not produce correct version: ' + ver.stdout.toString())
      }
    }

    if (needRelaunch) {
      return { needRelaunch }
    }
  })

  env.register('node', '$install', [], async () => {
    nodeFail()
  })

  env.register('node', '$install', ['linux'], async () => {
    const nodeBin = getNodeBin()

    await env.exec('platform', 'download', nodeBin)
    await env.exec('platform', 'shell', {
      cmd: 'sh',
      args: ['-c', `"cd ${env.dataDir} && tar xf ${nodeBin.fileName}"`]
    })
  })

  env.register('node', 'writeLauncher', [], async () => {
    throw new Error('no such thing as a default launcher')
  })

  env.register('node', 'writeLauncher', ['linux'], async () => {
    const sh = await env.exec('platform', 'shellCapture', {
      cmd: 'which',
      args: ['sh']
    })
    if (sh.code !== 0) {
      throw new Error('could not determine shell path')
    }
    const sh_path = sh.stdout.toString().trim()
    env.log('[node:writeLauncher] found shell path: "' + sh_path + '"')

    env.log('[node:writeLauncher] ------------------------------------------')
    env.log('[node:writeLauncher] execute the following, or restart terminal')
    env.log(`[node:writeLauncher] export PATH=${env.dataDir}/bin`)
    env.log('[node:writeLauncher] ------------------------------------------')
  })

  env.register('node', 'relaunch', [], async () => {
    return await env.exec('platform', 'relaunch', SINGLETON.nodeBin)
  })
}
