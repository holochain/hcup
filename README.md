# hcup

[![Project](https://img.shields.io/badge/project-holochain-blue.svg?style=flat-square)](http://holochain.org/)
[![Chat](https://img.shields.io/badge/chat-chat%2eholochain%2enet-blue.svg?style=flat-square)](https://chat.holochain.net)

[![Twitter Follow](https://img.shields.io/twitter/follow/holochain.svg?style=social&label=Follow)](https://twitter.com/holochain)

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Overview

Configure Holo the things!

:warning: This is a work in progress, please help us test it, but there may be bugs! :warning:

Configure your system and fetch holochain commandline binaries `hc` (the holochain utility) and `holochain` (the rust conductor).

## Getting Started

### Linux

Uses native system package management, but there are a lot of Linux distros out there... will fall back to recommending you install something and run the script again. Help us out by submitting patches for your system!

```
sh -c "$(curl -fsSL https://raw.githubusercontent.com/holochain/hcup/master/hcup-bootstrap.sh)"
```

(Expects some basic system utilities to be avaliable: `sudo`, `curl`, `which`, `tar`, etc)

### macOs

Uses [Homebrew](https://brew.sh/).

```
sh -c "$(curl -fsSL https://raw.githubusercontent.com/holochain/hcup/master/hcup-bootstrap.sh)"
```

Will install `brew` if not already installed.

### Windows

Uses [Chocolatey](https://chocolatey.org/).

In an ADMIN powershell (v5):

```
Set-ExecutionPolicy Bypass -Scope Process -Force; iex ((New-Object System.Net.WebClient).DownloadString('https://raw.githubusercontent.com/holochain/hcup/master/hcup-bootstrap.ps1'))
```

Will install `choco.exe` if not already installed. Please see [Chocolatey Install](https://chocolatey.org/install) for information on why an "Admin" Powershell is required.

## Usage

### Help

```
$ hcup help
usage: hcup [options] <command> <...>
command: help = show this message
command: list = list targets
command: install <target> = run <target> module
command: upgrade = upgrade all selected target modules
option: -v = verbose logging
```

### List Avalable Targets

```
$ hcup list
holochain - tools needed to run holochain applications
holochain-dev - tools needed to run and build holochain applications
```

### Install Tagret

```
$ hcup install holochain-dev
```

### Keep System Up-To-Date

```
$ hcup upgrade
```

## Contributing

System installation / configuration is a very broad target that is almost impossible to manage by a small group of developers. We need your support to test, find problems, and get things working on all your systems!

### Q: Can you give me an overview of how `hcup` works?

A: There are several phases to the hcup script.

#### Phase 0 ("shell one-liners")

The "Getting Started" shell one-liners download nodejs binaries for your system / architecture. Nodejs binaries are relatively portable, and [pretty easy to build for other systems](https://github.com/holochain/node-static-build) if we should need to. These scripts include a bundled bootstrap script (Phase 1 below), which is also run everytime you invoke `hcup`.

#### Phase 1 ("bootstrap")

- Make sure `${dataDir}/bin/hcup-node` is a valid nodejs binary
- Make sure `git` is installed on the system
- Make sure `${dataDir}/repo` is a current checkout of the `master` branch of this repository

#### Phase 2 ("execute")

If we are not a "shell one-liner" we also execute the commandline options specified.

### Q: How do I add my platform?

A: If the "shell one-liner" is not working, see the next question.

1. Make sure your platform is detected properly at the top of `lib/env.js` (including the `packageTool` property), there are some breakout helpers in `/lib/env/*.js`.
2. Make sure the `installPackage` function is properly registered in `lib/coreModules/platform/index.js` for your packageTool.
3. Test it out! Hopefully That is all that is needed. If your platform uses different package names, you may need to customize the individual modules.

### Q: How do I fix the "shell one-liner" for my platform?

A: The "shell one-liner" is supposed to do the minimal amount of work to get a nodejs application running. Any changes made to the nodejs download / unpackaging should be duplicated in `lib/coreModules/node/index.js` so that already installed versions of hcup can upgrade in parallel.

- If you are on a platform with a "Bourne"-compatible shell (this includes macOs and most x-nix distributions) you can make additions to `build/hcup-bootstrap.sh` and rebuild with `npm test`.
- If you are on Windows, we currently require Powershell version 5 (Because that is when `Expand-Archive` was introduced), We'd love to expand platform coverage, but need your help to do so. You can edit `build/hcup-bootstrap.ps1` and rebuild with `npm test`. PLEASE keep all files encoded as utf-8 and unix (`\n`) line endings.
- If you are on a platform with neither of these options, feel free to submit a patch adding another `build/hcup-bootstrap.*` script.

### Q: What Can I Help With?

A: Please view the issues in this repository for things we still need to do!

## License
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

Copyright (C) 2019, Holochain Trust

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

[http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0)

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
