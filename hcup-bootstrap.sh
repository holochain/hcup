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
__node_bin="${__node_dir}/bin/node"

echo "data dir: ${__data_dir}"
echo "    arch: ${__arch}"
echo "node_bin: ${__node_bin}"

mkdir -p "${__data_dir}"

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
	    if (env.selector.length > 1) {
	      return
	    }

	    if (process.env.NIX_STORE) {
	      env.distro = 'nix';
	      env.selector.push('nix');
	      const v = childProcess.execSync('nix-env --version').toString();
	      const m = v.match(/nix-env \(Nix\) (.+)/);
	      if (m && m.length >= 2) {
	        env.selector.push(m[1]);
	        env.distro_version = m[1];
	      }
	    }
	  } catch (e) {
	    console.error(e);
	  }
	};
	});

	var debian = createCommonjsModule(function (module, exports) {
	// check to see if we are debian

	const fs = require('fs');

	module.exports = exports = env => {
	  try {
	    if (env.selector.length > 1) {
	      return
	    }

	    const res = fs.readFileSync('/etc/os-release', 'utf8');
	    if (/ID=debian/m.test(res)) {
	      env.distro = 'debian';
	      env.selector.push('debian');
	      const m = res.match(/VERSION_ID="([^"]+)"/m);
	      if (m && m.length >= 2) {
	        env.selector.push(m[1]);
	        env.distro_version = m[1];
	      }
	    }
	  } catch (e) {
	    console.error(e);
	  }
	};
	});

	var ubuntu = createCommonjsModule(function (module, exports) {
	// check to see if we are debian

	const fs = require('fs');

	module.exports = exports = env => {
	  try {
	    if (env.selector.length > 1) {
	      return
	    }

	    const res = fs.readFileSync('/etc/os-release', 'utf8');
	    if (/ID=ubuntu/m.test(res)) {
	      env.distro = 'ubuntu';
	      env.selector.push('ubuntu');
	      const m = res.match(/VERSION_ID="?([^"\s]+)"?/m);
	      if (m && m.length >= 2) {
	        env.selector.push(m[1]);
	        env.distro_version = m[1];
	      }
	    }
	  } catch (e) {
	    console.error(e);
	  }
	};
	});

	var fedora = createCommonjsModule(function (module, exports) {
	// check to see if we are debian

	const fs = require('fs');

	module.exports = exports = env => {
	  try {
	    if (env.selector.length > 1) {
	      return
	    }

	    const res = fs.readFileSync('/etc/os-release', 'utf8');
	    if (/ID=fedora/m.test(res)) {
	      env.distro = 'fedora';
	      env.selector.push('fedora');
	      const m = res.match(/VERSION_ID="?([^"\s]+)"?/m);
	      if (m && m.length >= 2) {
	        env.selector.push(m[1]);
	        env.distro_version = m[1];
	      }
	    }
	  } catch (e) {
	    console.error(e);
	  }
	};
	});

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

	  env.register('platform', '$init', [], () => {});

	  env.register('platform', 'mkdirp', [], async args => {
	    return mkdirp(args.path)
	  });

	  function download (url, fileHandle) {
	    return new Promise((resolve, reject) => {
	      try {
	        url = new URL(url);
	        env.log('[platform:download]', url.toString(), url.hostname, url.pathname);
	        https.get({
	          hostname: url.hostname,
	          path: url.pathname + url.search,
	          headers: {
	            'User-Agent': 'Mozilla/5.0 () AppleWebKit/537.36 (KHTML, like Gecko) NodeJs'
	          }
	        }, res => {
	          try {
	            if (res.statusCode === 302) {
	              return resolve(fetch(res.headers.location))
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
	                return reject(new Error('bad status: ' + res.statusCode + ' ' + data.toString('utf8')))
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

	  env.register('platform', 'sha256', [], async args => {
	    const hash = crypto.createHash('sha256');
	    const fileHandle = await $p(fs.open)(args.path, 'r');
	    let tmp = null;
	    const buffer = Buffer.alloc(4096);
	    do {
	      tmp = await $p(fs.read)(
	        fileHandle, buffer, 0, buffer.byteLength, null);
	      hash.update(buffer.slice(0, tmp.bytesRead));
	    } while (tmp.bytesRead > 0);
	    const gotHash = hash.digest().toString('hex');
	    if (gotHash !== args.hash) {
	      throw new Error('sha256 sum mismatch, file: ' + gotHash + ', expected: ' + args.hash)
	    }
	  });

	  env.register('platform', 'download', [], async args => {
	    await env.exec('platform', 'mkdirp', { path: env.dataDir });
	    const fileName = path.resolve(env.dataDir, args.fileName);

	    try {
	      if ((await $p(fs.stat)(fileName)
	      ).isFile()) {
	        await exports.exec('platform', 'sha256', {
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

	    await exports.exec('platform', 'sha256', { path: fileName, hash: args.hash });
	  });

	  env.register('platform', 'shell', [], async args => {
	    return new Promise((resolve, reject) => {
	      try {
	        env.log('[platform:shell]', args.cmd, JSON.stringify(args.args));
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
	            reject(new Error('shell exited with code ' + code));
	          }
	        });
	      } catch (e) {
	        reject(e);
	      }
	    })
	  });

	  env.register('platform', 'shellCapture', [], async args => {
	    return new Promise((resolve, reject) => {
	      try {
	        env.log('[platform:shellCapture]', args.cmd, JSON.stringify(args.args));
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
	          if (code === 0) {
	            resolve(stdout.toString().trim());
	          } else {
	            reject(new Error('code ' + code + ': ' + stderr.toString().trim()));
	          }
	        });
	      } catch (e) {
	        reject(e);
	      }
	    })
	  });

	  env.register('platform', 'relaunch', [], async nodeBin => {
	    return new Promise((resolve, reject) => {
	      try {
	        env.log('[platform:relaunch] with "' + nodeBin + '"');
	        const proc = childProcess.spawn(
	          '"' + nodeBin + '"',
	          process.argv.slice(1).map(a => '"' + a + '"'),
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

	var installApt = createCommonjsModule(function (module, exports) {
	module.exports = exports = env => {
	  async function installApt () {
	    await env.exec('platform', 'shell', {
	      cmd: 'sudo',
	      args: ['apt-get', 'update']
	    });
	    await env.exec('platform', 'shell', {
	      cmd: 'sudo',
	      args: ['apt-get', 'install', '-y', 'git']
	    });
	  }

	  env.register('git', '$install', ['linux', 'debian'], installApt);
	  env.register('git', '$install', ['linux', 'ubuntu'], installApt);
	};
	});

	var installDnf = createCommonjsModule(function (module, exports) {
	module.exports = exports = env => {
	  async function installApt () {
	    await env.exec('platform', 'shell', {
	      cmd: 'sudo',
	      args: ['dnf', 'install', '-y', 'git']
	    });
	  }

	  env.register('git', '$install', ['linux', 'fedora'], installApt);
	};
	});

	var git = createCommonjsModule(function (module, exports) {
	module.exports = exports = env => {
	  async function checkGitVersion () {
	    env.log('[git] checking git version');
	    const ver = await env.exec('platform', 'shellCapture', {
	      cmd: 'git',
	      args: ['--version']
	    });
	    env.log('[git] got: ' + ver);
	  }

	  env.register('git', '$init', [], async () => {
	    try {
	      await checkGitVersion();
	      return
	    } catch (e) { /* pass */ }

	    env.log('[git] attempting to install "git", sudo may ask for your password');
	    await env.exec('git', '$install');
	    await checkGitVersion();
	  });

	  env.register('git', '$install', [], async () => {
	    throw new Error('"git" not found in path. Please install "git".')
	  });

	  env.register('git', '$install', ['linux', 'nix'], async () => {
	    await env.exec('platform', 'shell', {
	      cmd: 'nix-env',
	      args: ['-i', 'git']
	    });
	  });

	  installApt(env);
	  installDnf(env);

	  env.register('git', 'ensureRepoUpdated', [], async args => {
	    let needRelaunch = false;
	    try {
	      await env.exec('platform', 'shell', {
	        cmd: 'git',
	        args: [
	          'clone',
	          args.url,
	          args.path
	        ]
	      });
	      needRelaunch = true;
	    } catch (e) { /* pass */ }

	    const b4Hash = await env.exec('platform', 'shellCapture', {
	      cmd: 'git',
	      args: [
	        'rev-parse',
	        'HEAD'
	      ],
	      cwd: args.path
	    });

	    env.log('[git] before hash:', b4Hash);

	    await env.exec('platform', 'shell', {
	      cmd: 'git',
	      args: [
	        'reset',
	        '--hard'
	      ],
	      cwd: args.path
	    });

	    await env.exec('platform', 'shell', {
	      cmd: 'git',
	      args: [
	        'checkout',
	        args.branch || 'master'
	      ],
	      cwd: args.path
	    });

	    await env.exec('platform', 'shell', {
	      cmd: 'git',
	      args: [
	        'pull'
	      ],
	      cwd: args.path
	    });

	    const hash = await env.exec('platform', 'shellCapture', {
	      cmd: 'git',
	      args: [
	        'rev-parse',
	        'HEAD'
	      ],
	      cwd: args.path
	    });

	    env.log('[git] after hash:', hash);

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
	  const WANT_VERSION = 'v8.15.1';

	  const NODE_BIN = {
	    linux: {
	      x64: {
	        url: 'https://nodejs.org/dist/v8.15.1/node-v8.15.1-linux-x64.tar.gz',
	        fileName: 'node-v8.15.1-linux-x64.tar.gz',
	        hash: '16e203f2440cffe90522f1e1855d5d7e2e658e759057db070a3dafda445d6d1f',
	        nodeDir: path.resolve(env.dataDir, 'node-v8.15.1-linux-x64')
	      }
	    },
	    darwin: {
	      x64: {
	        url: 'https://nodejs.org/dist/v8.15.1/node-v8.15.1-darwin-x64.tar.gz',
	        fileName: 'node-v8.15.1-darwin-x64.tar.gz',
	        hash: 'f3da0b4397150226c008a86c99d77dbb835dc62219d863654913a78332ab19a5',
	        nodeDir: path.resolve(env.dataDir, 'node-v8.15.1-darwin-x64')
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
	      env.error('[node] no node def for platform "' + env.platform + '"');
	      nodeFail();
	    }
	    ref = ref[env.arch];
	    if (!ref) {
	      env.error('[node] no node def for arch "' + env.arch + '"');
	      nodeFail();
	    }
	    return ref
	  }

	  env.register('node', '$init', [], async () => {
	    let needRelaunch = false;

	    env.log('[node] checking node version === ' + WANT_VERSION);

	    SINGLETON.nodeBin = path.resolve(getNodeBin().nodeDir, 'bin', 'node');

	    if (
	      process.version !== WANT_VERSION || process.argv[0] !== SINGLETON.nodeBin
	    ) {
	      needRelaunch = true;
	    }

	    let ver = '';

	    try {
	      ver = await env.exec('platform', 'shellCapture', {
	        cmd: SINGLETON.nodeBin,
	        args: ['--version']
	      });
	    } catch (e) { /* pass */ }

	    env.log('[node] version:', ver);

	    if (ver !== WANT_VERSION) {
	      needRelaunch = true;
	      await env.exec('node', '$install');

	      ver = await env.exec('platform', 'shellCapture', {
	        cmd: SINGLETON.nodeBin,
	        args: ['--version']
	      });

	      env.log('[node] version:', ver);

	      if (ver !== WANT_VERSION) {
	        throw new Error('node download did not produce correct version: ' + ver.stdout.toString())
	      }
	    }

	    if (needRelaunch) {
	      return { needRelaunch }
	    }
	  });

	  env.register('node', '$install', [], async () => {
	    nodeFail();
	  });

	  env.register('node', '$install', ['linux'], async () => {
	    const nodeBin = getNodeBin();

	    await env.exec('platform', 'download', nodeBin);
	    await env.exec('platform', 'shell', {
	      cmd: 'sh',
	      args: ['-c', `cd \\"${env.dataDir}\\" && tar xf \\"${nodeBin.fileName}\\"`]
	    });
	  });

	  env.register('node', 'writeLauncher', [], async () => {
	    throw new Error('no such thing as a default launcher')
	  });

	  async function writeBourneLauncher (args) {
	    env.log('[node] check launcher version ===', args.gitHash);

	    const binDir = path.resolve(env.dataDir, 'bin');
	    const launcher = path.resolve(binDir, 'hcup');

	    try {
	      const contents = fs.readFileSync(launcher, 'utf8');
	      const m = contents.match(/#gitHash:([^#]+)/m);
	      if (m && m.length >= 2 && m[1] === args.gitHash) {
	        env.log('[node] launcher is correct version');
	        return
	      }
	    } catch (e) { /* pass */ }

	    await env.exec('platform', 'mkdirp', { path: binDir });

	    const sh_path = await env.exec('platform', 'shellCapture', {
	      cmd: 'which',
	      args: ['sh']
	    });
	    env.log('[node:writeLauncher] found shell path: "' + sh_path + '"');

	    fs.writeFileSync(launcher, `#! ${sh_path}
#gitHash:${args.gitHash}#
__module="\${1-x}"
if [ "\${__module}" = "x" ]; then
  exec "${SINGLETON.nodeBin}" "${env.dataDir}/repo/lib/env.js"
fi
shift
exec "${SINGLETON.nodeBin}" "${env.dataDir}/repo/lib/modules/\${__module}" "$@"
`, {
	      mode: 0o755
	    });

	    env.log('[node:writeLauncher] launcher created:', launcher);

	    const profile = path.resolve(os.homedir(), '.profile');
	    const addPath = `export "PATH=${binDir}:$PATH"`;
	    try {
	      const contents = fs.readFileSync(profile);
	      if (contents.includes(binDir)) {
	        env.log(`[node] path addition found in ${profile}`);
	        return
	      }
	    } catch (e) { /* pass */ }

	    fs.writeFileSync(profile, '\n' + addPath + '\n', {
	      flag: 'a'
	    });

	    env.log('[node:writeLauncher] ---------------------------------------------');
	    env.log('[node:writeLauncher] execute the following, or log out and back in');
	    env.log(`[node:writeLauncher] ${addPath}`);
	    env.log('[node:writeLauncher] ---------------------------------------------');
	  }

	  env.register('node', 'writeLauncher', ['linux'], writeBourneLauncher);
	  env.register('node', 'writeLauncher', ['darwin'], writeBourneLauncher);

	  env.register('node', 'relaunch', [], async () => {
	    return await env.exec('platform', 'relaunch', SINGLETON.nodeBin)
	  });
	};
	});

	var env = createCommonjsModule(function (module, exports) {
	const os = require('os');
	const path = require('path');

	module.exports = exports = {
	  platform: os.platform(),
	  arch: os.arch(),
	  dataDir: null,
	  selector: [os.platform()],
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
	}

	if (!exports.dataDir) {
	  throw new Error('failed to locate home directory')
	}

	nix(exports);
	debian(exports);
	ubuntu(exports);
	fedora(exports);

	exports.log = (...args) => {
	  console.log('[hcup]', ...args);
	};

	exports.error = (...args) => {
	  console.error('[hcup]', ...args);
	};

	exports.log(JSON.stringify(exports, null, 2));

	exports.modules = {};
	exports.lastModule = null;

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

	  let ref = modRef[fnName];
	  let maybeFn = ref._;
	  for (let s of exports.selector) {
	    if (!(s in ref)) {
	      break
	    }
	    ref = ref[s];
	    if (ref._) {
	      maybeFn = ref._;
	    }
	  }

	  if (!maybeFn) {
	    throw new Error('could not find selector fn')
	  }

	  const out = await maybeFn(...args);

	  if (fnName === '$init') {
	    modRef.$initDone = true;
	  } else if (fnName === '$install') {
	    modRef.$installDone = true;
	  }

	  return out
	};

	exports.register = (moduleName, fnName, selector, fn) => {
	  exports.lastModule = moduleName;

	  if (!(moduleName in exports.modules)) {
	    exports.modules[moduleName] = {};
	  }
	  let ref = exports.modules[moduleName];
	  if (!(fnName in ref)) {
	    ref[fnName] = {};
	  }
	  ref = ref[fnName];
	  for (let s of selector) {
	    if (!(s in ref)) {
	      ref[s] = {};
	    }
	    ref = ref[s];
	  }
	  ref._ = fn;

	  return exports
	};

	let didPrep = false;
	process.on('beforeExit', async () => {
	  try {
	    if (didPrep) {
	      return
	    }
	    didPrep = true;

	    const env = exports;

	    env.log('[env:prep] git');
	    const gitDir = path.resolve(env.dataDir, 'repo');

	    const gitRes = await env.exec('git', 'ensureRepoUpdated', {
	      url: 'https://github.com/neonphog/hcup.git',
	      path: gitDir,
	      branch: 'master'
	    });

	    if (gitRes && gitRes.needRelaunch) {
	      // we don't know that we have the correct node binary yet
	      // relaunch so we can reload and check next time
	      process.exit(await env.exec('platform', 'relaunch', process.argv[0]));
	    }

	    env.log('[env:prep] node');
	    const nodeRes = await env.exec('node', '$init');

	    if (nodeRes && nodeRes.needRelaunch) {
	      // now we may have a different node binary, relaunch with that
	      process.exit(await env.exec('node', 'relaunch'));
	    }

	    await env.exec('node', 'writeLauncher', { gitHash: gitRes.hash });

	    env.log('[env:prep] ready');
	    await env.exec(env.lastModule, '$init');
	  } catch (e) {
	    exports.error(e);
	    process.exit(1);
	  }
	});

	platform(exports);
	git(exports);
	node(exports);
	});
	var env_1 = env.dataDir;
	var env_2 = env.log;
	var env_3 = env.error;
	var env_4 = env.modules;
	var env_5 = env.lastModule;
	var env_6 = env.exec;
	var env_7 = env.register;

	exports.dataDir = env_1;
	exports.default = env;
	exports.error = env_3;
	exports.exec = env_6;
	exports.lastModule = env_5;
	exports.log = env_2;
	exports.modules = env_4;
	exports.register = env_7;

	return exports;

}({}));

EOF

exec "${__node_bin}" "${__data_dir}/bootstrap.js"
