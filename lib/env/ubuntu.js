// check to see if we are debian

const fs = require('fs')

module.exports = exports = env => {
  try {
    if (env.selector.length > 1) {
      return
    }

    const res = fs.readFileSync('/etc/os-release', 'utf8')
    if (/ID=ubuntu/m.test(res)) {
      env.distro = 'ubuntu'
      env.selector.push('ubuntu')
      const m = res.match(/VERSION_ID="([^"]+)"/m)
      if (m && m.length >= 2) {
        env.selector.push(m[1])
        env.distro_version = m[1]
      }
    }
  } catch (e) {
    console.error(e)
  }
}
