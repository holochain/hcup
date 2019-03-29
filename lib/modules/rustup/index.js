module.exports = exports = env => {
  const log = env.logger('rustup')

  env.register('rustup', '$init', async () => {
    log.i('rustup is a stub!')
  })
}
