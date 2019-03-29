module.exports = exports = env => {
  env.register('git', '$install', async () => {
    await env.exec('platform', 'shell', {
      cmd: 'sudo',
      args: ['dnf', 'install', '-y', 'git']
    })
  })
}
