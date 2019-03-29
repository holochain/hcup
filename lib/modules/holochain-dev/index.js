module.exports = exports = env => {
  // const log = env.logger('holochain-dev')

  env.register('holochain-dev', '$init', async () => {
    await env.exec('rustup', '$init')

    await env.exec('rustup', 'default', 'nightly-2019-01-24')

    await env.exec('holochain', '$init')
  })

  env.addTarget('holochain-dev', 'tools needed to run and build holochain applications')
}
