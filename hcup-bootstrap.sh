#!/bin/sh

die() {
  echo "$1"
  exit 1
}

__plat=`uname -s`
__arch=`uname -m`
case "${__plat}-${__arch}" in
  "Linux-x86_64")
    __plat="linux"
    __arch="x64"
    ;;
  "Darwin-x86_64")
    __plat="darwin"
    __arch="x64"
    ;;
  *)
    die "unsupported arch ${__plat}-${__arch}"
    ;;
esac

__data_dir=""
case "${__plat}" in
  "linux")
    if [ "x${XDG_DATA_DIR}" != "x" ]; then
      __data_dir="${XDG_DATA_DIR}/hcup"
    elif [ "x${HOME}" != "x" ]; then
      __data_dir="${HOME}/.local/share/hcup"
    fi
    ;;
  "darwin")
    if [ "x${HOME}" != "x" ]; then
      __data_dir="${HOME}/Library/Application Support/host.holo.hcup"
    fi
esac

if [ "x${__data_dir}" = "x" ]; then
  die "failed to locate home directory"
fi

__node_url=""
__node_file=""
__node_hash=""
__node_dir=""

case "${__plat}-${__arch}" in
  "linux-x64")
    __node_url="https://nodejs.org/dist/v8.15.1/node-v8.15.1-linux-x64.tar.gz"
    __node_file="node-v8.15.1-linux-x64.tar.gz"
    __node_hash="16e203f2440cffe90522f1e1855d5d7e2e658e759057db070a3dafda445d6d1f"
    __node_dir="node-v8.15.1-linux-x64"
    ;;
  "darwin-x64")
    __node_url="https://nodejs.org/dist/v8.15.1/node-v8.15.1-darwin-x64.tar.gz"
    __node_file="node-v8.15.1-darwin-x64.tar.gz"
    __node_hash="f3da0b4397150226c008a86c99d77dbb835dc62219d863654913a78332ab19a5"
    __node_dir="node-v8.15.1-darwin-x64"
    ;;
esac

check_hash() {
  __ldir="$1"
  __lfile="$2"
  __lhash="$3"

  __use="a"
  which sha256sum
  if [ $? -ne 0 ]; then
    which shasum
    if [ $? -ne 0 ]; then
      die "could not find sha256 sum utility"
    fi
    __use="b"
  fi

  if [ "${__use}" = "a" ]; then
    (cd "${__ldir}" && echo "${__lhash}  ${__lfile}" | sha256sum --check)
  else
    (cd "${__ldir}" && echo "${__lhash}  ${__lfile}" | shasum -a 256 --check)
  fi
  if [ $? -ne 0 ]; then
    die "sha256 sum mismatch"
  fi
}

__node_dir="${__data_dir}/${__node_dir}"
__bin_dir="${__data_dir}/bin"
__node_exe="${__node_dir}/bin/node"
__node_bin="${__bin_dir}/hcup-node"

echo "data dir: ${__data_dir}"
echo "    arch: ${__arch}"
echo "node_bin: ${__node_bin}"

mkdir -p "${__data_dir}"
mkdir -p "${__bin_dir}"

if [ ! -f "${__node_bin}" ]; then
  if [ ! -f "${__data_dir}/${__node_file}" ]; then
    (cd "${__data_dir}" && curl -L -O "${__node_url}")
    if [ $? -ne 0 ]; then
      die "failed to download ${__node_url}"
    fi
  fi

  check_hash "${__data_dir}" "${__node_file}" "${__node_hash}"

  if [ ! -d "${__node_dir}" ]; then
    (cd "${__data_dir}" && tar xf "${__node_file}")
    if [ $? -ne 0 ]; then
      die "failed to untar ${__data_dir}/${__node_file}"
    fi
  fi

  cp -f "${__node_exe}" "${__node_bin}"
fi

__node_test_ver=`"${__node_bin}" --version`
if [ $? -ne 0 ]; then
  die "could not execute ${__node_bin}"
fi

cat > "${__data_dir}/bootstrap.js" <<'EOF'
var hcup_bootstrap = (function (exports) {
	'use strict';

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var nix = createCommonjsModule(function (module, exports) {
	// check to see if we are nix

	const childProcess = require('child_process');

	module.exports = exports = env => {
	  try {
	    if (env.distro) {
	      return
	    }

	    if (process.env.NIX_STORE) {
	      env.distro = 'nix';
	      const v = childProcess.execSync('nix-env --version').toString();
	      const m = v.match(/nix-env \(Nix\) (.+)/);
	      if (m && m.length >= 2) {
	        env.distroVersion = m[1];
	      }
	    }
	  } catch (e) {
	    console.error(e);
	  }
	};
	});

	var osRelease = createCommonjsModule(function (module, exports) {
	// check to see if we are an os that can be identified by /etc/os-release

	const fs = require('fs');

	module.exports = exports = env => {
	  try {
	    if (env.distro) {
	      return
	    }

	    const res = fs.readFileSync('/etc/os-release', 'utf8');

	    if (/ID=debian/m.test(res)) {
	      env.distro = 'debian';
	      env.packageTool = 'apt-get';
	    } else if (/ID=ubuntu/m.test(res)) {
	      env.distro = 'ubuntu';
	      env.packageTool = 'apt-get';
	    } else if (/ID=fedora/m.test(res)) {
	      env.distro = 'fedora';
	      env.packageTool = 'dnf';
	    } else {
	      // could not identify
	      return
	    }

	    const m = res.match(/VERSION_ID="?([^"\s]+)"?/m);
	    if (m && m.length >= 2) {
	      env.distroVersion = m[1];
	    }
	  } catch (e) { /* pass */ }
	};
	});

	var env = createCommonjsModule(function (module, exports) {
	const os = require('os');
	const path = require('path');

	let rcount = 1;
	for (let r of process.argv) {
	  if (r.startsWith('-r')) {
	    rcount = parseInt(r.substr(2), 10) + 1;
	  }
	}

	module.exports = exports = {
	  rcount,
	  platform: os.platform(),
	  arch: os.arch(),
	  dataDir: null,
	  binDir: null
	};

	if (exports.platform === 'linux') {
	  if (process.env.XDG_DATA_HOME) {
	    exports.dataDir = path.resolve(process.env.XDG_DATA_HOME, 'hcup');
	  } else if (process.env.HOME) {
	    exports.dataDir = path.resolve(process.env.HOME, '.local', 'share', 'hcup');
	  }
	} else if (exports.platform === 'darwin') {
	  if (process.env.HOME) {
	    exports.dataDir = path.resolve(process.env.HOME, 'Library', 'Application Support', 'host.holo.hcup');
	  }
	} else if (exports.platform === 'win32') {
	  if (process.env.APPDATA) {
	    exports.dataDir = path.resolve(process.env.APPDATA, 'holo', 'hcup', 'data');
	  }
	}

	if (!exports.dataDir) {
	  throw new Error('failed to locate home directory')
	}

	exports.binDir = path.resolve(exports.dataDir, 'bin');

	nix(exports);
	osRelease(exports);

	let isVerbose = false;
	exports.setVerbose = () => { isVerbose = true; };

	exports.logger = (tag) => {
	  const write = (lvl, esc, ...args) => {
	    if (process.stderr.isTTY) {
	      process.stderr.write(esc);
	    }
	    const output = [];
	    for (let arg of args) {
	      if (arg instanceof Error) {
	        arg = arg.stack || arg.toString();
	      } else if (typeof arg === 'object') {
	        arg = JSON.stringify(arg, null, 2);
	      } else if (!arg) {
	        arg = '[undefined]';
	      } else {
	        arg = arg.toString();
	      }
	      output.push(arg);
	    }
	    for (let line of output.join(' ').split('\n')) {
	      console.error(lvl, '[hcup]', '[' + tag + ']', line);
	    }
	    if (process.stderr.isTTY) {
	      process.stderr.write('\x1b[0m');
	    }
	  };
	  return {
	    v: (...args) => {
	      if (!isVerbose) {
	        return
	      }
	      write('@v@', '\x1b[36m', ...args);
	    },
	    i: (...args) => {
	      write('-i-', '\x1b[32m', ...args);
	    },
	    e: (...args) => {
	      write('#e#', '\x1b[31m\x1b[40m', ...args);
	    }
	  }
	};

	// don't enumerate
	Object.defineProperty(exports, 'modules', {
	  value: {}
	});

	// don't enumerate
	Object.defineProperty(exports, 'targets', {
	  value: {}
	});

	exports.exec = async (moduleName, fnName, ...args) => {
	  if (!(moduleName in exports.modules)) {
	    throw new Error('module "' + moduleName + '" not found')
	  }
	  const modRef = exports.modules[moduleName];

	  if (fnName === '$init' && modRef.$initDone) {
	    return
	  }

	  if (fnName === '$install' && modRef.$installDone) {
	    return
	  }

	  if (fnName !== '$init' && fnName !== '$install') {
	    await exports.exec(moduleName, '$init');
	  }

	  if (!(fnName in modRef)) {
	    throw new Error(
	      'fn "' + fnName + '" not found in module "' + moduleName + '"')
	  }

	  let out = null;
	  try {
	    out = await modRef[fnName](...args);
	  } catch (e) {
	    throw new Error(`error calling ${moduleName}:${fnName}, inner: ${e.stack}`)
	  }

	  if (fnName === '$init') {
	    modRef.$initDone = true;
	  } else if (fnName === '$install') {
	    modRef.$installDone = true;
	  }

	  return out
	};

	exports.register = (moduleName, fnName, fn) => {
	  if (!(moduleName in exports.modules)) {
	    exports.modules[moduleName] = {};
	  }
	  const ref = exports.modules[moduleName];
	  if (fnName in ref) {
	    throw new Error('function "' + fnName + '" already registered for module "' + moduleName + '"')
	  }
	  ref[fnName] = fn;

	  return exports
	};

	exports.addTarget = (moduleName, description) => {
	  if (!(moduleName in exports.modules)) {
	    throw new Error('cannot add target for non-existant module: "' + moduleName + '"')
	  }
	  if (moduleName in exports.targets) {
	    throw new Error('duplicate target module name: "' + moduleName + '"')
	  }
	  exports.targets[moduleName] = description;

	  return exports
	};
	});
	var env_1 = env.dataDir;
	var env_2 = env.binDir;
	var env_3 = env.setVerbose;
	var env_4 = env.logger;
	var env_5 = env.exec;
	var env_6 = env.register;
	var env_7 = env.addTarget;

	var platform = createCommonjsModule(function (module, exports) {
	const crypto = require('crypto');
	const { URL } = require('url');
	const childProcess = require('child_process');
	const fs = require('fs');
	const https = require('https');
	const path = require('path');
	const util = require('util');
	const $p = util.promisify;

	module.exports = exports = env => {
	  const log = env.logger('platform');

	  async function mkdirp (p, exit) {
	    p = path.resolve(p);
	    try {
	      await $p(fs.mkdir)(p);
	    } catch (e) {
	      if (!exit && e.code === 'ENOENT') {
	        await mkdirp(path.dirname(p));
	        await mkdirp(p, true);
	      } else {
	        const s = await $p(fs.stat)(p);
	        if (!s.isDirectory()) {
	          throw e
	        }
	      }
	    }
	  }

	  env.register('platform', '$init', () => {});

	  if (env.platform === 'win32') {
	    env.register('platform', 'pathPrepend', (val) => {
	      if (!process.env.PATH.includes(val)) {
	        process.env.PATH = val + ';' + process.env.PATH;
	      }
	    });
	  } else {
	    env.register('platform', 'pathPrepend', (val) => {
	      if (!process.env.PATH.includes(val)) {
	        process.env.PATH = val + ':' + process.env.PATH;
	      }
	    });
	  }

	  env.register('platform', 'mkdirp', async args => {
	    return mkdirp(args.path)
	  });

	  env.register('platform', 'readConfig', async () => {
	    const configFN = path.resolve(env.dataDir, 'config.json');
	    try {
	      env.config = JSON.parse(fs.readFileSync(configFN));
	    } catch (e) {
	      env.config = {};
	      await env.exec('platform', 'writeConfig');
	    }
	  });

	  env.register('platform', 'writeConfig', async () => {
	    const configFN = path.resolve(env.dataDir, 'config.json');
	    fs.writeFileSync(configFN, JSON.stringify(env.config, null, 2));
	  });

	  if (env.packageTool === 'apt-get') {
	    env.register('platform', 'installPackage', async (packageName) => {
	      // non-capture shell so they can type sudo password
	      await env.exec('platform', 'shell', {
	        cmd: 'sudo',
	        args: ['apt-get', 'update']
	      });
	      // non-capture shell so they can type sudo password
	      await env.exec('platform', 'shell', {
	        cmd: 'sudo',
	        args: [
	          'apt-get', 'install', '--no-install-recommends', '-y',
	          packageName
	        ]
	      });
	    });
	  } else if (env.packageTool === 'dnf') {
	    env.register('platform', 'installPackage', async (packageName) => {
	      // non-capture shell so they can type sudo password
	      await env.exec('platform', 'shell', {
	        cmd: 'sudo',
	        args: [
	          'dnf', '--setopt=install_weak_deps=False', '--best', 'install', '-y',
	          packageName
	        ]
	      });
	    });
	  } else if (env.platform === 'darwin') {
	    env.register('platform', 'installPackage', async (packageName) => {
	      // non-capture shell so they can interact with brew
	      await env.exec('platform', 'shell', {
	        cmd: 'brew',
	        args: ['install', packageName]
	      });
	    });
	  } else if (env.platform === 'win32') {
	    env.register('platform', 'installPackage', async (packageName) => {
	      // non-capture shell so they can interact with choco
	      await env.exec('platform', 'shell', {
	        cmd: 'choco.exe',
	        args: ['install', packageName]
	      });
	    });
	  } else {
	    env.register('platform', 'installPackage', async (packageName) => {
	      throw new Error('installPackage not configured for your system. Please manually install "' + packageName + '"')
	    });
	  }

	  env.register('platform', 'sha256', async args => {
	    const hash = crypto.createHash('sha256');
	    const fileHandle = await $p(fs.open)(args.path, 'r');
	    let tmp = null;
	    const buffer = Buffer.alloc(4096);
	    do {
	      tmp = await $p(fs.read)(
	        fileHandle, buffer, 0, buffer.byteLength, null);
	      hash.update(buffer.slice(0, tmp.bytesRead));
	    } while (tmp.bytesRead > 0)
	    const gotHash = hash.digest().toString('hex');
	    if (gotHash !== args.hash) {
	      throw new Error('sha256 sum mismatch, file: ' + gotHash + ', expected: ' + args.hash)
	    }
	  });

	  function download (url, fileHandle) {
	    return new Promise((resolve, reject) => {
	      try {
	        url = new URL(url);
	        log.i('download', url.toString(), url.hostname, url.pathname);
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
	                fs.writeSync(fileHandle, chunk);
	              } catch (e) {
	                try { res.destroy(e); } catch (e) { /* pass */ }
	                reject(e);
	              }
	            });
	            res.on('end', () => {
	              if (res.statusCode !== 200) {
	                return reject(new Error('bad status: ' + res.statusCode))
	              }
	              resolve();
	            });
	          } catch (e) {
	            try { res.destroy(e); } catch (e) { /* pass */ }
	            reject(e);
	          }
	        });
	      } catch (e) {
	        reject(e);
	      }
	    })
	  }

	  env.register('platform', 'download', async args => {
	    const fileName = path.resolve(env.dataDir, args.fileName);

	    try {
	      if ((await $p(fs.stat)(fileName)).isFile()) {
	        await env.exec('platform', 'sha256', {
	          path: fileName, hash: args.hash
	        });
	        // file hash checks out, we're already good
	        return
	      }
	    } catch (e) {
	      try {
	        await $p(fs.unlink)(fileName);
	      } catch (e) { /* pass */ }
	    }

	    const fileHandle = await $p(fs.open)(fileName, 'w');
	    try {
	      await download(args.url, fileHandle);
	    } finally {
	      await $p(fs.close)(fileHandle);
	    }

	    await env.exec('platform', 'sha256', { path: fileName, hash: args.hash });
	  });

	  env.register('platform', 'shell', async args => {
	    const callCtx = (new Error('callCtx')).stack;
	    return new Promise((resolve, reject) => {
	      try {
	        log.v('[shell]', args.cmd, JSON.stringify(args.args));
	        const proc = childProcess.spawn(
	          '"' + args.cmd + '"',
	          args.args.map(a => '"' + a + '"'),
	          {
	            shell: true,
	            stdio: 'inherit',
	            cwd: path.resolve(args.cwd || '.')
	          }
	        );
	        proc.on('close', code => {
	          if (code === 0) {
	            resolve();
	          } else {
	            reject(new Error('shell exited with code ' + code + ': ' + callCtx));
	          }
	        });
	      } catch (e) {
	        reject(e);
	      }
	    })
	  });

	  env.register('platform', 'shellCapture', async args => {
	    return new Promise((resolve, reject) => {
	      try {
	        log.v('[shellCapture]', args.cmd, JSON.stringify(args.args));
	        const proc = childProcess.spawn(
	          '"' + args.cmd + '"',
	          args.args.map(a => '"' + a + '"'),
	          {
	            shell: true,
	            cwd: path.resolve(args.cwd || '.')
	          }
	        );
	        let stdout = Buffer.alloc(0);
	        let stderr = Buffer.alloc(0);
	        proc.stdout.on('data', chunk => {
	          stdout = Buffer.concat([stdout, chunk]);
	        });
	        proc.stderr.on('data', chunk => {
	          stderr = Buffer.concat([stderr, chunk]);
	        });
	        proc.on('close', code => {
	          stdout = stdout.toString().trim();
	          stderr = stderr.toString().trim();
	          if (code === 0) {
	            resolve({ stdout, stderr });
	          } else {
	            const e = new Error(JSON.stringify({
	              code,
	              stdout,
	              stderr
	            }, null, 2));
	            e.code = code;
	            e.stdout = stdout;
	            e.stderr = stderr;
	            reject(e);
	          }
	        });
	      } catch (e) {
	        reject(e);
	      }
	    })
	  });

	  env.register('platform', 'relaunch', async nodeBin => {
	    return new Promise((resolve, reject) => {
	      try {
	        if (env.rcount >= 5) {
	          throw new Error('refusing to relaunch more than five times')
	        }

	        let addedR = false;
	        const args = process.argv.slice(1).map(a => {
	          if (a.startsWith('-r')) {
	            addedR = true;
	            return `"-r${env.rcount}"`
	          }
	          return '"' + a + '"'
	        });
	        if (!addedR) {
	          args.push(`"-r${env.rcount}"`);
	        }
	        log.i('[relaunch] with "' + nodeBin + '"', args);
	        const proc = childProcess.spawn(
	          '"' + nodeBin + '"',
	          args,
	          {
	            shell: true,
	            stdio: 'inherit'
	          }
	        );
	        proc.on('close', code => {
	          resolve(code);
	        });
	      } catch (e) {
	        reject(e);
	      }
	    })
	  });
	};
	});

	var git = createCommonjsModule(function (module, exports) {
	module.exports = exports = env => {
	  const log = env.logger('git');

	  async function checkGitVersion () {
	    log.v('checking git version');
	    const ver = await env.exec('platform', 'shellCapture', {
	      cmd: 'git',
	      args: ['--version']
	    });
	    log.v('got: ' + ver);
	  }

	  env.register('git', '$init', async () => {
	    try {
	      await checkGitVersion();
	      return
	    } catch (e) { log.e(e); }

	    log.i('attempting to install "git", sudo may ask for your password');
	    await env.exec('git', '$install');
	    await checkGitVersion();
	  });

	  env.register('git', '$install', async () => {
	    await env.exec('platform', 'installPackage', 'git');
	  });

	  env.register('git', 'ensureRepoUpdated', async args => {
	    let needRelaunch = false;
	    try {
	      log.v((await env.exec('platform', 'shellCapture', {
	        cmd: 'git',
	        args: [
	          'clone',
	          args.url,
	          args.path
	        ]
	      })).stdout);
	      needRelaunch = true;
	    } catch (e) {
	      if (e.stack.includes('already exists')) {
	        log.v(e);
	      } else {
	        throw e
	      }
	    }

	    const b4Hash = (await env.exec('platform', 'shellCapture', {
	      cmd: 'git',
	      args: [
	        'rev-parse',
	        'HEAD'
	      ],
	      cwd: args.path
	    })).stdout;

	    log.v('before hash:', b4Hash);

	    log.v((await env.exec('platform', 'shellCapture', {
	      cmd: 'git',
	      args: [
	        'reset',
	        '--hard'
	      ],
	      cwd: args.path
	    })).stdout);

	    log.v((await env.exec('platform', 'shellCapture', {
	      cmd: 'git',
	      args: [
	        'checkout',
	        args.branch || 'master'
	      ],
	      cwd: args.path
	    })).stdout);

	    log.v((await env.exec('platform', 'shellCapture', {
	      cmd: 'git',
	      args: [
	        'pull'
	      ],
	      cwd: args.path
	    })).stdout);

	    const hash = (await env.exec('platform', 'shellCapture', {
	      cmd: 'git',
	      args: [
	        'rev-parse',
	        'HEAD'
	      ],
	      cwd: args.path
	    })).stdout;

	    log.v('after hash:', hash);

	    if (b4Hash !== hash) {
	      needRelaunch = true;
	    }

	    return { needRelaunch, hash }
	  });
	};
	});

	var node = createCommonjsModule(function (module, exports) {
	const os = require('os');
	const path = require('path');
	const fs = require('fs');

	module.exports = exports = env => {
	  const log = env.logger('node');

	  const WANT_VERSION = 'v8.15.1';

	  const NODE_BIN = {
	    linux: {
	      x64: {
	        url: 'https://nodejs.org/dist/v8.15.1/node-v8.15.1-linux-x64.tar.gz',
	        fileName: 'node-v8.15.1-linux-x64.tar.gz',
	        hash: '16e203f2440cffe90522f1e1855d5d7e2e658e759057db070a3dafda445d6d1f',
	        nodeExe: path.resolve(env.dataDir, 'node-v8.15.1-linux-x64', 'bin', 'node')
	      }
	    },
	    darwin: {
	      x64: {
	        url: 'https://nodejs.org/dist/v8.15.1/node-v8.15.1-darwin-x64.tar.gz',
	        fileName: 'node-v8.15.1-darwin-x64.tar.gz',
	        hash: 'f3da0b4397150226c008a86c99d77dbb835dc62219d863654913a78332ab19a5',
	        nodeExe: path.resolve(env.dataDir, 'node-v8.15.1-darwin-x64', 'bin', 'node')
	      }
	    },
	    win32: {
	      x64: {
	        url: 'https://nodejs.org/dist/v8.15.1/node-v8.15.1-win-x64.zip',
	        fileName: 'node-v8.15.1-win-x64.zip',
	        hash: 'f636fa578dc079bacc6c4bef13284ddb893c99f7640b96701c2690bd9c1431f5',
	        nodeExe: path.resolve(env.dataDir, 'node-v8.15.1-win-x64', 'node.exe')
	      }
	    }
	  };

	  const SINGLETON = {
	    nodeBin: null
	  };

	  function nodeFail () {
	    throw new Error('"node" not found in path. Please install "node"@"' + WANT_VERSION + '".')
	  }

	  function getNodeBin () {
	    let ref = NODE_BIN[env.platform];
	    if (!ref) {
	      log.e('[node] no node def for platform "' + env.platform + '"');
	      nodeFail();
	    }
	    ref = ref[env.arch];
	    if (!ref) {
	      log.e('[node] no node def for arch "' + env.arch + '"');
	      nodeFail();
	    }
	    return ref
	  }

	  env.register('node', '$init', async () => {
	    let needRelaunch = false;

	    log.v('checking node version === ' + WANT_VERSION);

	    if (env.platform === 'win32') {
	      SINGLETON.nodeBin = path.resolve(env.dataDir, 'bin', 'hcup-node.exe');
	    } else {
	      SINGLETON.nodeBin = path.resolve(env.dataDir, 'bin', 'hcup-node');
	    }

	    if (
	      process.version !== WANT_VERSION || process.argv[0] !== SINGLETON.nodeBin
	    ) {
	      needRelaunch = true;
	    }

	    let ver = '';

	    try {
	      ver = (await env.exec('platform', 'shellCapture', {
	        cmd: SINGLETON.nodeBin,
	        args: ['--version']
	      })).stdout;
	    } catch (e) { /* pass */ }

	    log.v('[node] version:', ver);

	    if (ver !== WANT_VERSION) {
	      needRelaunch = true;
	      await env.exec('node', '$install');

	      ver = (await env.exec('platform', 'shellCapture', {
	        cmd: SINGLETON.nodeBin,
	        args: ['--version']
	      })).stdout;

	      log.v('[node] version:', ver);

	      if (ver !== WANT_VERSION) {
	        throw new Error('node download did not produce correct version: ' + ver.stdout.toString())
	      }
	    }

	    if (needRelaunch) {
	      return { needRelaunch }
	    }
	  });

	  if (env.platform === 'linux' || env.platform === 'darwin') {
	    env.register('node', '$install', async () => {
	      const nodeBin = getNodeBin();

	      await env.exec('platform', 'download', nodeBin);
	      await env.exec('platform', 'shell', {
	        cmd: 'sh',
	        args: ['-c', `cd \\"${env.dataDir}\\" && tar xf \\"${nodeBin.fileName}\\" && cp -f \\"${nodeBin.nodeExe}\\" \\"${SINGLETON.nodeBin}\\"`]
	      });
	    });
	  } else if (env.platform === 'win32') {
	    env.register('node', '$install', async () => {
	      const nodeBin = getNodeBin();

	      await env.exec('platform', 'download', nodeBin);
	      await env.exec('platform', 'shell', {
	        cmd: process.env.SystemRoot + '\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
	        args: [
	          '-NoProfile',
	          '-InputFormat',
	          'None',
	          '-ExecutionPolicy',
	          'Bypass',
	          '-Command',
	          `Expand-Archive -Path "${path.resolve(env.dataDir, nodeBin.fileName)}" -DestinationPath "${env.dataDir}" -Force; Copy-Item "${path.resolve(nodeBin.nodeDir, 'node.exe')}" -Destination "${SINGLETON.nodeBin}" -Force`
	        ]
	      });
	    });
	  } else {
	    env.register('node', '$install', async () => {
	      nodeFail();
	    });
	  }

	  async function writeBourneLauncher (args) {
	    log.v('[node] check launcher version ===', args.gitHash);

	    const binDir = path.resolve(env.dataDir, 'bin');
	    const launcher = path.resolve(binDir, 'hcup');

	    try {
	      const contents = fs.readFileSync(launcher, 'utf8');
	      const m = contents.match(/#gitHash:([^#]+)/m);
	      if (m && m.length >= 2 && m[1] === args.gitHash) {
	        log.v('launcher is correct version');
	        return
	      }
	    } catch (e) { /* pass */ }

	    await env.exec('platform', 'mkdirp', { path: binDir });

	    const shPath = (await env.exec('platform', 'shellCapture', {
	      cmd: 'which',
	      args: ['sh']
	    })).stdout;
	    log.v('found shell path: "' + shPath + '"');

	    fs.writeFileSync(launcher, `#! ${shPath}
#gitHash:${args.gitHash}#
exec "${SINGLETON.nodeBin}" "${env.dataDir}/repo/lib/index_entry.js" "$@"
`, {
	      mode: 0o755
	    });

	    log.i('launcher created:', launcher);

	    let profile = path.resolve(os.homedir(), '.profile');
	    if (
	      env.platform === 'darwin' &&
	      fs.existsSync(path.resolve(os.homedir(), '.bash_profile'))
	    ) {
	      profile = path.resolve(os.homedir(), '.bash_profile');
	    }

	    const addPath = `export "PATH=${binDir}:$PATH"`;
	    try {
	      const contents = fs.readFileSync(profile);
	      if (contents.includes(binDir)) {
	        log.v(`[node] path addition found in ${profile}`);
	        return
	      }
	    } catch (e) { /* pass */ }

	    fs.writeFileSync(profile, '\n' + addPath + '\n', {
	      flag: 'a'
	    });

	    log.i('| --------------------------------------------------');
	    log.i('| execute the following, or log out and back in');
	    log.i(`| ${addPath}`);
	    log.i('| --------------------------------------------------');
	  }

	  async function writeWin32BatchLauncher (args) {
	    const binDir = path.resolve(env.dataDir, 'bin');
	    const launcher = path.resolve(binDir, 'hcup.cmd');

	    try {
	      const contents = fs.readFileSync(launcher, 'utf8');
	      const m = contents.match(/REM gitHash:([^\s]+) REM/m);
	      if (m && m.length >= 2 && m[1] === args.gitHash) {
	        log.v('launcher is correct version');
	        return
	      }
	    } catch (e) { /* pass */ }

	    fs.writeFileSync(launcher, `@ECHO OFF
REM gitHash:${args.gitHash} REM
@"%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -InputFormat None -ExecutionPolicy Bypass -Command "${SINGLETON.nodeBin} ${env.dataDir}/repo/lib/index_entry.js %*"
`, {
	      mode: 0o755
	    });
	  }

	  if (env.platform === 'linux' || env.platform === 'darwin') {
	    env.register('node', 'writeLauncher', writeBourneLauncher);
	  } else if (env.platform === 'win32') {
	    env.register('node', 'writeLauncher', writeWin32BatchLauncher);
	  } else {
	    env.register('node', 'writeLauncher', async () => {
	      throw new Error('no launcher configured for your platform')
	    });
	  }

	  env.register('node', 'relaunch', async () => {
	    return env.exec('platform', 'relaunch', SINGLETON.nodeBin)
	  });
	};
	});

	var bootstrap = createCommonjsModule(function (module, exports) {
	const log = env.logger('bootstrap');

	const path = require('path');

	// load coreModules
	platform(env);
	git(env);
	node(env);

	async function darwinCheckBrew () {
	  try {
	    let ver = (await env.exec('platform', 'shellCapture', {
	      cmd: 'brew',
	      args: ['--version']
	    }));
	    log.v('brew version', ver);
	    return
	  } catch (e) { /* pass */ }

	  log.i('homebrew not found, installing');

	  // non-capturing shell so user can interact with stdin
	  await env.exec('platform', 'shell', {
	    cmd: '/usr/bin/ruby',
	    args: [
	      '-e',
	      '$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)'
	    ]
	  });
	}

	async function win32CheckChoco () {
	  try {
	    let ver = (await env.exec('platform', 'shellCapture', {
	      cmd: 'choco.exe',
	      args: ['version']
	    }));
	    log.v('choco version', ver);
	    return
	  } catch (e) { /* pass */ }

	  log.i('choco not found, installing');

	  // non-capturing shell so user can interact with stdin
	  await env.exec('platform', 'shell', {
	    cmd: process.env.SystemRoot + '\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
	    args: [
	      '-NoProfile',
	      '-InputFormat',
	      'None',
	      '-ExecutionPolicy',
	      'Bypass',
	      '-Command',
	      '"iex ((New-Object System.Net.WebClient).DownloadString(\'https://chocolatey.org/install.ps1\'))"'
	    ]
	  });

	  // XXX make this cleaner
	  log.e('please run `refreshenv` or restart your terminal, then re-execute the hcup script');
	  process.exit(1);
	}

	module.exports = exports = async () => {
	  try {
	    log.i('checking bootstrap dependencies');

	    if (env.platform === 'darwin') {
	      await darwinCheckBrew();
	    } else if (env.platform === 'win32') {
	      await win32CheckChoco();
	    }

	    await env.exec('platform', 'mkdirp', { path: env.dataDir });
	    await env.exec('platform', 'mkdirp', { path: env.binDir });

	    log.v(JSON.stringify(env, null, 2));
	    log.i('platform', env.platform);
	    log.i('arch', env.arch);

	    log.v('verify git');
	    const gitDir = path.resolve(env.dataDir, 'repo');

	    const gitRes = await env.exec('git', 'ensureRepoUpdated', {
	      url: 'https://github.com/holochain/hcup.git',
	      path: gitDir,
	      branch: 'master'
	    });

	    if (gitRes && gitRes.needRelaunch) {
	      // we don't know that we have the correct node binary yet
	      // relaunch so we can reload and check next time
	      process.exit(await env.exec('platform', 'relaunch', process.argv[0]));
	    }

	    log.v('verify node');
	    const nodeRes = await env.exec('node', '$init');

	    if (nodeRes && nodeRes.needRelaunch) {
	      // now we may have a different node binary, relaunch with that
	      process.exit(await env.exec('node', 'relaunch'));
	    }

	    log.v('verify config');
	    await env.exec('platform', 'readConfig');

	    log.v('verify launcher');
	    await env.exec('node', 'writeLauncher', { gitHash: gitRes.hash });

	    log.i('ready');
	  } catch (e) {
	    log.e(e);
	    process.exit(1);
	  }
	};
	});

	env.setVerbose();
	bootstrap().then(() => {}, err => {
	  console.error(err);
	  process.exit(1);
	});

	var bootstrap_entry = {

	};

	exports.default = bootstrap_entry;

	return exports;

}({}));

EOF

exec "${__node_bin}" "${__data_dir}/bootstrap.js"
