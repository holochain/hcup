module.exports = exports = env => {
  env.register('git', '$install', async () => {
    await env.exec('platform', 'shell', {
      cmd: 'sudo',
      args: ['apt-get', 'update']
    })
    await env.exec('platform', 'shell', {
      cmd: 'sudo',
      args: ['apt-get', 'install', '-y', 'git']
    })
  })
}
