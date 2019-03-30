const crypto = require('crypto')
const { URL } = require('url')
const childProcess = require('child_process')
const fs = require('fs')
const https = require('https')
const path = require('path')
const util = require('util')
const $p = util.promisify

module.exports = exports = env => {
  const log = env.logger('platform')

  async function mkdirp (p, exit) {
    p = path.resolve(p)
    try {
      await $p(fs.mkdir)(p)
    } catch (e) {
      if (!exit && e.code === 'ENOENT') {
        await mkdirp(path.dirname(p))
        await mkdirp(p, true)
      } else {
        const s = await $p(fs.stat)(p)
        if (!s.isDirectory()) {
          throw e
        }
      }
    }
  }

  env.register('platform', '$init', () => {})

  if (env.platform === 'win32') {
    env.register('platform', 'pathPrepend', (val) => {
      if (!process.env.PATH.includes(val)) {
        process.env.PATH = val + ';' + process.env.PATH
      }
    })
  } else {
    env.register('platform', 'pathPrepend', (val) => {
      if (!process.env.PATH.includes(val)) {
        process.env.PATH = val + ':' + process.env.PATH
      }
    })
  }

  env.register('platform', 'mkdirp', async args => {
    return mkdirp(args.path)
  })

  env.register('platform', 'readConfig', async () => {
    const configFN = path.resolve(env.dataDir, 'config.json')
    try {
      env.config = JSON.parse(fs.readFileSync(configFN))
    } catch (e) {
      env.config = {}
      await env.exec('platform', 'writeConfig')
    }
  })

  env.register('platform', 'writeConfig', async () => {
    const configFN = path.resolve(env.dataDir, 'config.json')
    fs.writeFileSync(configFN, JSON.stringify(env.config, null, 2))
  })

  if (env.packageTool === 'apt-get') {
    env.register('platform', 'installPackage', async (packageName) => {
      // non-capture shell so they can type sudo password
      await env.exec('platform', 'shell', {
        cmd: 'sudo',
        args: ['apt-get', 'update']
      })
      // non-capture shell so they can type sudo password
      await env.exec('platform', 'shell', {
        cmd: 'sudo',
        args: [
          'apt-get', 'install', '--no-install-recommends', '-y',
          packageName
        ]
      })
    })
  } else if (env.packageTool === 'dnf') {
    env.register('platform', 'installPackage', async (packageName) => {
      // non-capture shell so they can type sudo password
      await env.exec('platform', 'shell', {
        cmd: 'sudo',
        args: [
          'dnf', '--setopt=install_weak_deps=False', '--best', 'install', '-y',
          packageName
        ]
      })
    })
  } else if (env.platform === 'darwin') {
    env.register('platform', 'installPackage', async (packageName) => {
      // non-capture shell so they can interact with brew
      await env.exec('platform', 'shell', {
        cmd: 'brew',
        args: ['install', packageName]
      })
    })
  } else if (env.platform === 'win32') {
    env.register('platform', 'installPackage', async (packageName) => {
      // non-capture shell so they can interact with choco
      await env.exec('platform', 'shell', {
        cmd: 'choco.exe',
        args: ['install', packageName]
      })
    })
  } else {
    env.register('platform', 'installPackage', async (packageName) => {
      throw new Error('installPackage not configured for your system. Please manually install "' + packageName + '"')
    })
  }

  env.register('platform', 'sha256', async args => {
    const hash = crypto.createHash('sha256')
    const fileHandle = await $p(fs.open)(args.path, 'r')
    let tmp = null
    const buffer = Buffer.alloc(4096)
    do {
      tmp = await $p(fs.read)(
        fileHandle, buffer, 0, buffer.byteLength, null)
      hash.update(buffer.slice(0, tmp.bytesRead))
    } while (tmp.bytesRead > 0)
    const gotHash = hash.digest().toString('hex')
    if (gotHash !== args.hash) {
      throw new Error('sha256 sum mismatch, file: ' + gotHash + ', expected: ' + args.hash)
    }
  })

  function download (url, fileHandle) {
    return new Promise((resolve, reject) => {
      try {
        url = new URL(url)
        log.i('download', url.toString(), url.hostname, url.pathname)
        https.get({
          hostname: url.hostname,
          path: url.pathname + url.search,
          headers: {
            'User-Agent': 'Mozilla/5.0 () AppleWebKit/537.36 (KHTML, like Gecko) NodeJs'
          }
        }, res => {
          try {
            if (res.statusCode === 302) {
              return resolve(download(res.headers.location, fileHandle))
            }
            res.on('data', chunk => {
              try {
                fs.writeSync(fileHandle, chunk)
              } catch (e) {
                try { res.destroy(e) } catch (e) { /* pass */ }
                reject(e)
              }
            })
            res.on('end', () => {
              if (res.statusCode !== 200) {
                return reject(new Error('bad status: ' + res.statusCode))
              }
              resolve()
            })
          } catch (e) {
            try { res.destroy(e) } catch (e) { /* pass */ }
            reject(e)
          }
        })
      } catch (e) {
        reject(e)
      }
    })
  }

  env.register('platform', 'download', async args => {
    const fileName = path.resolve(env.dataDir, args.fileName)

    try {
      if ((await $p(fs.stat)(fileName)).isFile()) {
        await env.exec('platform', 'sha256', {
          path: fileName, hash: args.hash
        })
        // file hash checks out, we're already good
        return
      }
    } catch (e) {
      try {
        await $p(fs.unlink)(fileName)
      } catch (e) { /* pass */ }
    }

    const fileHandle = await $p(fs.open)(fileName, 'w')
    try {
      await download(args.url, fileHandle)
    } finally {
      await $p(fs.close)(fileHandle)
    }

    await env.exec('platform', 'sha256', { path: fileName, hash: args.hash })
  })

  env.register('platform', 'shell', async args => {
    const callCtx = (new Error('callCtx')).stack
    return new Promise((resolve, reject) => {
      try {
        log.v('[shell]', args.cmd, JSON.stringify(args.args))
        const proc = childProcess.spawn(
          '"' + args.cmd + '"',
          args.args.map(a => '"' + a + '"'),
          {
            shell: true,
            stdio: 'inherit',
            cwd: path.resolve(args.cwd || '.')
          }
        )
        proc.on('close', code => {
          if (code === 0) {
            resolve()
          } else {
            reject(new Error('shell exited with code ' + code + ': ' + callCtx))
          }
        })
      } catch (e) {
        reject(e)
      }
    })
  })

  env.register('platform', 'shellCapture', async args => {
    return new Promise((resolve, reject) => {
      try {
        log.v('[shellCapture]', args.cmd, JSON.stringify(args.args))
        const proc = childProcess.spawn(
          '"' + args.cmd + '"',
          args.args.map(a => '"' + a + '"'),
          {
            shell: true,
            cwd: path.resolve(args.cwd || '.')
          }
        )
        let stdout = Buffer.alloc(0)
        let stderr = Buffer.alloc(0)
        proc.stdout.on('data', chunk => {
          stdout = Buffer.concat([stdout, chunk])
        })
        proc.stderr.on('data', chunk => {
          stderr = Buffer.concat([stderr, chunk])
        })
        proc.on('close', code => {
          stdout = stdout.toString().trim()
          stderr = stderr.toString().trim()
          if (code === 0) {
            resolve({ stdout, stderr })
          } else {
            const e = new Error(JSON.stringify({
              code,
              stdout,
              stderr
            }, null, 2))
            e.code = code
            e.stdout = stdout
            e.stderr = stderr
            reject(e)
          }
        })
      } catch (e) {
        reject(e)
      }
    })
  })

  env.register('platform', 'relaunch', async nodeBin => {
    return new Promise((resolve, reject) => {
      try {
        if (env.rcount >= 5) {
          throw new Error('refusing to relaunch more than five times')
        }

        let addedR = false
        const args = process.argv.slice(1).map(a => {
          if (a.startsWith('-r')) {
            addedR = true
            return `"-r${env.rcount}"`
          }
          return '"' + a + '"'
        })
        if (!addedR) {
          args.push(`"-r${env.rcount}"`)
        }
        log.i('[relaunch] with "' + nodeBin + '"', args)
        const proc = childProcess.spawn(
          '"' + nodeBin + '"',
          args,
          {
            shell: true,
            stdio: 'inherit'
          }
        )
        proc.on('close', code => {
          resolve(code)
        })
      } catch (e) {
        reject(e)
      }
    })
  })
}
