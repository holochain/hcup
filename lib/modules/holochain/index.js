module.exports = exports = env => {
  // const log = env.logger('holochain')

  env.register('holochain', '$init', async () => {
    await env.exec('holochain-hc-util-binary', '$init')
    await env.exec('holochain-holochain-util-binary', '$init')
  })

  env.addTarget('holochain', 'tools needed to run holochain applications')
}
