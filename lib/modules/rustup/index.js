module.exports = exports = env => {
  const log = env.logger('rustup')

  env.register('rustup', '$init', async () => {
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
        'curl https://sh.rustup.rs -sSf | sh'
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
