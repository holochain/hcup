const env = require('./env')

const path = require('path')

// load coreModules
require('./coreModules/platform')(env)
require('./coreModules/git')(env)
require('./coreModules/node')(env)

module.exports = exports = async () => {
  env.log('[env:prep] git')
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

  env.log('[env:prep] node')
  const nodeRes = await env.exec('node', '$init')

  if (nodeRes && nodeRes.needRelaunch) {
    // now we may have a different node binary, relaunch with that
    process.exit(await env.exec('node', 'relaunch'))
  }

  await env.exec('node', 'writeLauncher', { gitHash: gitRes.hash })

  env.log('[env:prep] ready')
  //await env.exec(env.lastModule, '$init')
}
