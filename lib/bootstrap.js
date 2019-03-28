const env = require('./env')
const log = env.logger('bootstrap')

const path = require('path')

// load coreModules
require('./coreModules/platform')(env)
require('./coreModules/git')(env)
require('./coreModules/node')(env)

module.exports = exports = async () => {
  try {
    log.i('checking bootstrap dependencies')

    log.v(JSON.stringify({
      platform: env.platform,
      arch: env.arch,
      dataDir: env.dataDir,
      selector: env.selector,
      distro: env.distro,
      distro_version: env.distro_version,
      modules: Object.keys(env.modules),
      targets: env.targets
    }, null, 2))
    log.i('platform', env.platform)
    log.i('arch', env.arch)

    log.v('git')
    const gitDir = path.resolve(env.dataDir, 'repo')

    const gitRes = await env.exec('git', 'ensureRepoUpdated', {
      url: 'https://github.com/neonphog/hcup.git',
      path: gitDir,
      branch: 'master'
    })

    if (gitRes && gitRes.needRelaunch) {
      // we don't know that we have the correct node binary yet
      // relaunch so we can reload and check next time
      process.exit(await env.exec('platform', 'relaunch', process.argv[0]))
    }

    log.v('node')
    const nodeRes = await env.exec('node', '$init')

    if (nodeRes && nodeRes.needRelaunch) {
      // now we may have a different node binary, relaunch with that
      process.exit(await env.exec('node', 'relaunch'))
    }

    await env.exec('node', 'writeLauncher', { gitHash: gitRes.hash })

    log.i('ready')
  } catch (e) {
    log.e(e)
    process.exit(1)
  }
}
