module.exports = exports = env => {
  const log = env.logger('holochain-holochain-util-binary')

  env.register('holochain-holochain-util-binary', '$init', async () => {
    log.i('holochain-holochain-util-binary is a stub!')
  })
}
