module.exports = exports = env => {
  async function installApt () {
    await env.exec('platform', 'shell', {
      cmd: 'sudo',
      args: ['dnf', 'install', '-y', 'git']
    })
  }

  env.register('git', '$install', ['linux', 'fedora'], installApt)
}
