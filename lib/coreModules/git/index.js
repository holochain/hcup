module.exports = exports = env => {
  const log = env.logger('git')

  async function checkGitVersion () {
    log.v('checking git version')
    const ver = await env.exec('platform', 'shellCapture', {
      cmd: 'git',
      args: ['--version']
    })
    log.v('got: ' + ver)
  }

  env.register('git', '$init', async () => {
    try {
      await checkGitVersion()
      return
    } catch (e) { log.e(e) }

    log.i('attempting to install "git", sudo may ask for your password')
    await env.exec('git', '$install')
    await checkGitVersion()
  })

  if (env.packageTool === 'apt-get') {
    require('./install-apt')(env)
  } else if (env.packageTool === 'dnf') {
    require('./install-dnf')(env)
  } else if (env.distro === 'nix') {
    env.register('git', '$install', async () => {
      await env.exec('platform', 'shell', {
        cmd: 'nix-env',
        args: ['-i', 'git']
      })
    })
  } else {
    env.register('git', '$install', async () => {
      throw new Error('"git" not found in path. Please install "git".')
    })
  }

  env.register('git', 'ensureRepoUpdated', async args => {
    let needRelaunch = false
    try {
      log.v((await env.exec('platform', 'shellCapture', {
        cmd: 'git',
        args: [
          'clone',
          args.url,
          args.path
        ]
      })).stdout)
      needRelaunch = true
    } catch (e) {
      if (e.stack.includes('already exists')) {
        log.v(e)
      } else {
        throw e
      }
    }

    const b4Hash = (await env.exec('platform', 'shellCapture', {
      cmd: 'git',
      args: [
        'rev-parse',
        'HEAD'
      ],
      cwd: args.path
    })).stdout

    log.v('before hash:', b4Hash)

    log.v((await env.exec('platform', 'shellCapture', {
      cmd: 'git',
      args: [
        'reset',
        '--hard'
      ],
      cwd: args.path
    })).stdout)

    log.v((await env.exec('platform', 'shellCapture', {
      cmd: 'git',
      args: [
        'checkout',
        args.branch || 'master'
      ],
      cwd: args.path
    })).stdout)

    log.v((await env.exec('platform', 'shellCapture', {
      cmd: 'git',
      args: [
        'pull'
      ],
      cwd: args.path
    })).stdout)

    const hash = (await env.exec('platform', 'shellCapture', {
      cmd: 'git',
      args: [
        'rev-parse',
        'HEAD'
      ],
      cwd: args.path
    })).stdout

    log.v('after hash:', hash)

    if (b4Hash !== hash) {
      needRelaunch = true
    }

    return { needRelaunch, hash }
  })
}
