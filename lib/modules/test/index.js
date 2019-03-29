module.exports = exports = env => {
  const log = env.logger('test')

  env.register('test', '$init', async () => {
    log.i('in test!')
  })

  env.addTarget('test', 'test target to prove out listing / etc')
}
