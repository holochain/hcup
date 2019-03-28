module.exports = exports = env => {
  env.registerTarget('test', '$init', [], async () => {
    env.log('[test] in test!')
  })
}
