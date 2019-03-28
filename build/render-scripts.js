const hb = require('handlebars')
const fs = require('fs')
const path = require('path')

const TPL = [
  'hcup-bootstrap.sh',
  'hcup-bootstrap.ps1'
]

const data = {
  src: fs.readFileSync(path.resolve(__dirname, '..', 'hcup-bootstrap.js'), 'utf8')
}

for (let tpl of TPL) {
  const out = path.resolve(__dirname, '..', tpl)
  fs.writeFileSync(
    out,
    hb.compile(fs.readFileSync(path.resolve(__dirname, tpl), 'utf8'))(data),
    {
      mode: 0o755
    }
  )
}
