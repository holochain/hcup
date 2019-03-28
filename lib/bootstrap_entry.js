require('./env').setVerbose()
require('./bootstrap')().then(() => {}, err => {
  console.error(err)
  process.exit(1)
})
