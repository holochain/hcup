// check to see if we are debian

const fs = require('fs')

module.exports = exports = env => {
  try {
    if (env.selector.length > 1) {
      return
    }

    const res = fs.readFileSync('/etc/os-release', 'utf8')
    if (/ID=fedora/m.test(res)) {
      env.distro = 'fedora'
      env.selector.push('fedora')
      const m = res.match(/VERSION_ID="?([^"\s]+)"?/m)
      if (m && m.length >= 2) {
        env.selector.push(m[1])
        env.distro_version = m[1]
      }
    }
  } catch (e) {
    console.error(e)
  }
}
