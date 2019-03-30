const path = require('path')

const BIN = {
  linux: {
    x64: {
      url: 'https://github.com/holochain/holochain-rust/releases/download/v0.0.8-alpha/conductor-v0.0.8-alpha-x86_64-ubuntu-linux-gnu.tar.gz',
      fileName: 'conductor-v0.0.8-alpha-x86_64-ubuntu-linux-gnu.tar.gz',
      hash: 'b2d1ecbf4fa2a19b99a2e129ede6294c924330b6a55b1b8be4b769b4ab5c44a6',
      version: 'holochain 0.0.8-alpha',
      exe: 'conductor-v0.0.8-alpha-x86_64-unknown-linux-gnu/holochain'
    }
  },
  darwin: {
    x64: {
      url: 'https://github.com/holochain/holochain-rust/releases/download/v0.0.8-alpha/conductor-v0.0.8-alpha-x86_64-apple-darwin.tar.gz',
      fileName: 'conductor-v0.0.8-alpha-x86_64-apple-darwin.tar.gz',
      hash: 'eb637070caa123a40dd5e9060b4c6f7bafbee1ef175ced3d3cd683105f2249ee',
      version: 'holochain 0.0.8-alpha',
      exe: 'conductor-v0.0.8-alpha-x86_64-apple-darwin/holochain'
    }
  },
  win32: {
    x64: {
      url: 'https://github.com/holochain/holochain-rust/releases/download/v0.0.8-alpha/conductor-v0.0.8-alpha-x86_64-pc-windows-msvc.zip',
      fileName: 'conductor-v0.0.8-alpha-x86_64-pc-windows-msvc.zip',
      hash: '11dbca2863e8402791a7abbaaa6193f6bb65f2f2f8c6f6349d1632141e096e40',
      version: 'holochain 0.0.8-alpha',
      exe: 'conductor-v0.0.8-alpha-x86_64-pc-windows-msvc/holochain.exe'
    }
  }
}

module.exports = exports = env => {
  const log = env.logger('holochain-holochain-util-binary')

  function getBin () {
    let ref = BIN[env.platform]
    if (!ref) {
      throw new Error('no def for platform "' + env.platform + '"')
    }
    ref = ref[env.arch]
    if (!ref) {
      throw new Error('no def for arch "' + env.arch + '"')
    }
    return ref
  }

  env.register('holochain-holochain-util-binary', '$init', async () => {
    const bin = getBin()
    try {
      const ver = (await env.exec('platform', 'shellCapture', {
        cmd: 'holochain',
        args: ['--version']
      })).stdout
      log.v('version', ver)
      if (ver === bin.version) {
        return
      }
    } catch (e) { /* pass */ }
    await env.exec('holochain-holochain-util-binary', '$install')
    const ver = (await env.exec('platform', 'shellCapture', {
      cmd: 'holochain',
      args: ['--version']
    })).stdout
    log.v('version', ver)
    if (ver !== bin.version) {
      throw new Error('version mismatch!')
    }
  })

  if (env.platform === 'win32') {
    env.register('holochain-holochain-util-binary', '$install', async () => {
      const bin = getBin()
      await env.exec('platform', 'download', bin)
      await env.exec('platform', 'shell', {
        cmd: process.env.SystemRoot + '\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
        args: [
          '-NoProfile',
          '-InputFormat',
          'None',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          `"Expand-Archive -Path '${path.resolve(env.dataDir, bin.fileName)}' -DestinationPath '${env.dataDir}' -Force; Copy-Item '${path.resolve(env.dataDir, bin.exe)}' -Destination '${path.resolve(env.binDir, 'hc')}' -Force"`
        ]
      })
    })
  } else {
    env.register('holochain-holochain-util-binary', '$install', async () => {
      const bin = getBin()
      await env.exec('platform', 'download', bin)
      await env.exec('platform', 'shell', {
        cmd: 'sh',
        args: ['-c', `cd \\"${env.dataDir}\\" && tar xf \\"${bin.fileName}\\" && cp -f \\"${bin.exe}\\" \\"${path.resolve(env.binDir, 'holochain')}\\"`]
      })
    })
  }
}
