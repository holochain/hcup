// check to see if we are nix

const childProcess = require('child_process')

module.exports = exports = env => {
  try {
    if (env.distro) {
      return
    }

    if (process.env.NIX_STORE) {
      env.distro = 'nix'
      const v = childProcess.execSync('nix-env --version').toString()
      const m = v.match(/nix-env \(Nix\) (.+)/)
      if (m && m.length >= 2) {
        env.distroVersion = m[1]
      }
    }
  } catch (e) {
    console.error(e)
  }
}
