// check to see if we are an os that can be identified by /etc/os-release

const fs = require('fs')

module.exports = exports = env => {
  try {
    if (env.distro) {
      return
    }

    const res = fs.readFileSync('/etc/os-release', 'utf8')

    if (/ID=debian/m.test(res)) {
      env.distro = 'debian'
      env.packageTool = 'apt-get'
    } else if (/ID=ubuntu/m.test(res)) {
      env.distro = 'ubuntu'
      env.packageTool = 'apt-get'
    } else if (/ID=fedora/m.test(res)) {
      env.distro = 'fedora'
      env.packageTool = 'dnf'
    } else {
      // could not identify
      return
    }

    const m = res.match(/VERSION_ID="?([^"\s]+)"?/m)
    if (m && m.length >= 2) {
      env.distroVersion = m[1]
    }
  } catch (e) { /* pass */ }
}
