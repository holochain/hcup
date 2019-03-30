const path = require('path')

const BIN = {
  linux: {
    x64: {
      url: 'https://github.com/holochain/holochain-rust/releases/download/v0.0.8-alpha/cli-v0.0.8-alpha-x86_64-ubuntu-linux-gnu.tar.gz',
      fileName: 'cli-v0.0.8-alpha-x86_64-ubuntu-linux-gnu.tar.gz',
      hash: 'a9775fdbe0ee59938609bf212aae20b12fc906c0a15de318212992350b895ddd',
      version: 'hc 0.0.8-alpha',
      archiveLoc: 'cli-v0.0.8-alpha-x86_64-unknown-linux-gnu/hc',
      exeName: 'hc'
    }
  },
  darwin: {
    x64: {
      url: 'https://github.com/holochain/holochain-rust/releases/download/v0.0.8-alpha/cli-v0.0.8-alpha-x86_64-apple-darwin.tar.gz',
      fileName: 'cli-v0.0.8-alpha-x86_64-apple-darwin.tar.gz',
      hash: 'de2caaaa1f559ba2e15aeddf38d3636cbe04069a831631f6f02131697c43fd13',
      version: 'hc 0.0.8-alpha',
      archiveLoc: 'cli-v0.0.8-alpha-x86_64-apple-darwin/hc',
      exeName: 'hc'
    }
  },
  win32: {
    x64: {
      url: 'https://github.com/holochain/holochain-rust/releases/download/v0.0.8-alpha/cli-v0.0.8-alpha-x86_64-pc-windows-msvc.zip',
      fileName: 'cli-v0.0.8-alpha-x86_64-pc-windows-msvc.zip',
      hash: '5b2de2eba71243ec14f3dd335592ecd60b2de71465f8f4c704977d549e655ec9',
      version: 'hc 0.0.8-alpha',
      archiveLoc: 'cli-v0.0.8-alpha-x86_64-pc-windows-msvc/hc.exe',
      exeName: 'hc.exe'
    }
  }
}

module.exports = exports = env => {
  const log = env.logger('holochain-hc-util-binary')

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

  env.register('holochain-hc-util-binary', '$init', async () => {
    const bin = getBin()
    try {
      const ver = (await env.exec('platform', 'shellCapture', {
        cmd: bin.exeName,
        args: ['--version']
      })).stdout
      log.v('version', ver)
      if (ver === bin.version) {
        return
      }
    } catch (e) { /* pass */ }
    await env.exec('holochain-hc-util-binary', '$install')
    const ver = (await env.exec('platform', 'shellCapture', {
      cmd: bin.exeName,
      args: ['--version']
    })).stdout
    log.v('version', ver)
    if (ver !== bin.version) {
      throw new Error('version mismatch!')
    }
  })

  if (env.platform === 'win32') {
    env.register('holochain-hc-util-binary', '$install', async () => {
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
          `"Expand-Archive -Path '${path.resolve(env.dataDir, bin.fileName)}' -DestinationPath '${env.dataDir}' -Force; Copy-Item '${path.resolve(env.dataDir, bin.archiveLoc)}' -Destination '${path.resolve(env.binDir, bin.exeName)}' -Force"`
        ]
      })
    })
  } else {
    env.register('holochain-hc-util-binary', '$install', async () => {
      const bin = getBin()
      await env.exec('platform', 'download', bin)
      await env.exec('platform', 'shell', {
        cmd: 'sh',
        args: ['-c', `cd \\"${env.dataDir}\\" && tar xf \\"${bin.fileName}\\" && cp -f \\"${bin.archiveLoc}\\" \\"${path.resolve(env.binDir, bin.exeName)}\\"`]
      })
    })
  }
}
