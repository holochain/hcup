require('./index')().then(() => {}, err => {
  console.error(err)
  process.exit(1)
})
