module.exports = exports = env => {
  const log = env.logger('test')

  env.registerTarget('test', '$init', [], async () => {
    log.i('in test!')
  })
}
