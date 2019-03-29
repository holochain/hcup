const os = require('os')
const path = require('path')

module.exports = exports = env => {
  const log = env.logger('rustup')

  env.register('rustup', '$init', async () => {
    await env.exec(
      'platform', 'pathPrepend',
      path.resolve(os.homedir(), '.cargo', 'bin')
    )

    try {
      const ver = (await env.exec('platform', 'shellCapture', {
        cmd: 'rustup',
        args: ['--version']
      })).stdout
      log.v('version', ver)
    } catch (e) {
      await env.exec('rustup', '$install')
    }
  })

  env.register('rustup', '$install', async () => {
    // non-capturing shell so rustup can interact with user
    await env.exec('platform', 'shell', {
      cmd: 'sh',
      args: [
        '-c',
        'curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain none'
      ]
    })
  })

  env.register('rustup', 'default', async (version) => {
    // non-capturing shell to show rust download progress
    await env.exec('platform', 'shell', {
      cmd: 'rustup',
      args: [
        'default',
        version
      ]
    })
  })
}
