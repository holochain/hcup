module.exports = exports = env => {
  async function checkGitVersion () {
    env.log('[git] checking git version')
    const ver = await env.exec('platform', 'shellCapture', {
      cmd: 'git',
      args: ['--version']
    })
    env.log('[git] got: ' + ver)
  }

  env.register('git', '$init', [], async () => {
    try {
      await checkGitVersion()
      return
    } catch (e) { /* pass */ }

    env.log('[git] attempting to install "git", sudo may ask for your password')
    await env.exec('git', '$install')
    await checkGitVersion()
  })

  env.register('git', '$install', [], async () => {
    throw new Error('"git" not found in path. Please install "git".')
  })

  env.register('git', '$install', ['linux', 'debian'], async () => {
    await env.exec('platform', 'shell', {
      cmd: 'sudo',
      args: ['apt-get', 'install', 'git']
    })
  })

  env.register('git', '$install', ['linux', 'nix'], async () => {
    await env.exec('platform', 'shell', {
      cmd: 'nix-env',
      args: ['-i', 'git']
    })
  })

  env.register('git', 'ensureRepoUpdated', [], async args => {
    let needRelaunch = false
    try {
      await env.exec('platform', 'shell', {
        cmd: 'git',
        args: [
          'clone',
          args.url,
          args.path
        ]
      })
      needRelaunch = true
    } catch (e) { /* pass */ }

    const b4Hash = await env.exec('platform', 'shellCapture', {
      cmd: 'git',
      args: [
        'rev-parse',
        'HEAD'
      ],
      cwd: args.path
    })

    env.log('[git] before hash:', b4Hash)

    await env.exec('platform', 'shell', {
      cmd: 'git',
      args: [
        'reset',
        '--hard'
      ],
      cwd: args.path
    })

    await env.exec('platform', 'shell', {
      cmd: 'git',
      args: [
        'checkout',
        args.branch || 'master'
      ],
      cwd: args.path
    })

    await env.exec('platform', 'shell', {
      cmd: 'git',
      args: [
        'pull'
      ],
      cwd: args.path
    })

    const hash = await env.exec('platform', 'shellCapture', {
      cmd: 'git',
      args: [
        'rev-parse',
        'HEAD'
      ],
      cwd: args.path
    })

    env.log('[git] after hash:', hash)

    if (b4Hash !== hash) {
      needRelaunch = true
    }

    return { needRelaunch, hash }
  })
}
