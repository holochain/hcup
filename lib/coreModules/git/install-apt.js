module.exports = exports = env => {
  async function installApt () {
    await env.exec('platform', 'shell', {
      cmd: 'sudo',
      args: ['apt-get', 'update']
    })
    await env.exec('platform', 'shell', {
      cmd: 'sudo',
      args: ['apt-get', 'install', '-y', 'git']
    })
  }

  env.register('git', '$install', ['linux', 'debian'], installApt)
  env.register('git', '$install', ['linux', 'ubuntu'], installApt)
}
