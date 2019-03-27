module.exports = exports = env => {
  async function checkGitVersion () {
    env.log('[git] checking git version')
    const ver = await env.exec('platform', 'shellCapture', {
      cmd: 'git',
      args: ['--version']
    })
    if (ver.code !== 0) {
      throw new Error('cmd exited non-zero: ' + ver.code + ' ' + ver.stderr.toString())
    }
    env.log('[git] got: ' + ver.stdout.toString().trim())
  }

  env.register('git', '$init', [], async () => {
    try {
      await checkGitVersion()
      return
    } catch (e) { /* pass */ }

    await env.exec('git', '$install')
  })

  env.register('git', '$install', [], async () => {
    throw new Error('"git" not found in path. Please install "git".')
  })

  env.register('git', '$install', ['linux', 'debian'], async () => {
    env.log('[git] attempting to install "git", sudo may ask for your password')
    await env.exec('platform', 'shell', {
      cmd: 'sudo',
      args: ['apt-get', 'install', 'git']
    })
    await checkGitVersion()
  })

  env.register('git', '$install', ['linux', 'nix'], async () => {
    await env.exec('platform', 'shell', {
      cmd: 'nix-env',
      args: ['-i', 'git']
    })
    await checkGitVersion()
  })

  env.register('git', 'update', [], async () => {
    return { needRelaunch: false }
  })
}
