const path = require('path')

const BIN = {
  linux: {
    x64: {
      url: 'https://github.com/holochain/holochain-rust/releases/download/v0.0.8-alpha/cli-v0.0.8-alpha-x86_64-ubuntu-linux-gnu.tar.gz',
      fileName: 'cli-v0.0.8-alpha-x86_64-ubuntu-linux-gnu.tar.gz',
      hash: 'a9775fdbe0ee59938609bf212aae20b12fc906c0a15de318212992350b895ddd',
      version: 'hc 0.0.8-alpha',
      exe: 'cli-v0.0.8-alpha-x86_64-unknown-linux-gnu/hc'
    }
  },
  darwin: {
    x64: {
      url: 'https://github.com/holochain/holochain-rust/releases/download/v0.0.8-alpha/cli-v0.0.8-alpha-x86_64-apple-darwin.tar.gz',
      fileName: 'cli-v0.0.8-alpha-x86_64-apple-darwin.tar.gz',
      hash: 'de2caaaa1f559ba2e15aeddf38d3636cbe04069a831631f6f02131697c43fd13',
      version: 'hc 0.0.8-alpha',
      exe: 'cli-v0.0.8-alpha-x86_64-apple-darwin/hc'
    }
  },
  win32: {
    x64: {
      url: 'https://github.com/holochain/holochain-rust/releases/download/v0.0.8-alpha/cli-v0.0.8-alpha-x86_64-pc-windows-msvc.tar.gz'
      fileName: 'cli-v0.0.8-alpha-x86_64-pc-windows-msvc.tar.gz',
      hash: '3ed69d958bb2aa58ae8d309600cbc8f5448ada7fc93022e9657f12c39124d954',
      version: 'hc 0.0.8-alpha',
      exe: 'cli-v0.0.8-alpha-x86_64-pc-windows-msvc/hc.exe'
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
        cmd: 'hc',
        args: ['--version']
      })).stdout
      log.v('version', ver)
      if (ver === bin.version) {
        return
      }
    } catch (e) { /* pass */ }
    await env.exec('holochain-hc-util-binary', '$install')
    const ver = (await env.exec('platform', 'shellCapture', {
      cmd: 'hc',
      args: ['--version']
    })).stdout
    log.v('version', ver)
    if (ver !== bin.version) {
      throw new Error('version mismatch!')
    }
  })

  env.register('holochain-hc-util-binary', '$install', async () => {
    const bin = getBin()
    await env.exec('platform', 'download', bin)
    await env.exec('platform', 'shell', {
      cmd: 'sh',
      args: ['-c', `cd \\"${env.dataDir}\\" && tar xf \\"${bin.fileName}\\" && cp -f \\"${bin.exe}\\" \\"${path.resolve(env.binDir, 'hc')}\\"`]
    })
  })
}
