const env = require('../../env')

env.register('test', '$init', [], async () => {
  env.log('[test] in test!')
})
