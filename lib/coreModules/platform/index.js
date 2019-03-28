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

  env.register('platform', '$init', [], () => {})

  env.register('platform', 'mkdirp', [], async args => {
    return mkdirp(args.path)
  })

  function download (url, fileHandle) {
    return new Promise((resolve, reject) => {
      try {
        url = new URL(url)
        env.log('[platform:download]', url.toString(), url.hostname, url.pathname)
        https.get({
          hostname: url.hostname,
          path: url.pathname + url.search,
          headers: {
            'User-Agent': 'Mozilla/5.0 () AppleWebKit/537.36 (KHTML, like Gecko) NodeJs'
          }
        }, res => {
          try {
            if (res.statusCode === 302) {
              return resolve(download(res.headers.location))
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

  env.register('platform', 'sha256', [], async args => {
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

  env.register('platform', 'download', [], async args => {
    await env.exec('platform', 'mkdirp', { path: env.dataDir })
    const fileName = path.resolve(env.dataDir, args.fileName)

    try {
      if ((await $p(fs.stat)(fileName)
      ).isFile()) {
        await exports.exec('platform', 'sha256', {
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

    await exports.exec('platform', 'sha256', { path: fileName, hash: args.hash })
  })

  env.register('platform', 'shell', [], async args => {
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
            reject(new Error('shell exited with code ' + code))
          }
        })
      } catch (e) {
        reject(e)
      }
    })
  })

  env.register('platform', 'shellCapture', [], async args => {
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
          if (code === 0) {
            resolve(stdout.toString().trim())
          } else {
            reject(new Error('code ' + code + ': ' + stderr.toString().trim()))
          }
        })
      } catch (e) {
        reject(e)
      }
    })
  })

  env.register('platform', 'relaunch', [], async nodeBin => {
    return new Promise((resolve, reject) => {
      try {
        log.i('[relaunch] with "' + nodeBin + '"')
        const proc = childProcess.spawn(
          '"' + nodeBin + '"',
          process.argv.slice(1).map(a => '"' + a + '"'),
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
