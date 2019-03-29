module.exports = exports = env => {
  const log = env.logger('holochain-hc-util-binary')

  env.register('holochain-hc-util-binary', '$init', async () => {
    log.i('holochain-hc-util-binary is a stub!')
  })
}
