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

  env.register('holochain-holochain-util-binary', '$install', async () => {
    const bin = getBin()
    await env.exec('platform', 'download', bin)
    await env.exec('platform', 'shell', {
      cmd: 'sh',
      args: ['-c', `cd \\"${env.dataDir}\\" && tar xf \\"${bin.fileName}\\" && cp -f \\"${bin.exe}\\" \\"${path.resolve(env.binDir, 'holochain')}\\"`]
    })
  })
}
