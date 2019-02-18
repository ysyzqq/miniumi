#!/usr/bin/env node

const resolveCwd = require('resolve-cwd');

const localCLI = resolveCwd.silent('miniumi/bin/umi');
if (localCLI && localCLI !== __filename) {
  const debug = require('debug')('miniumi');
  debug('Using local install of umi');
  require(localCLI);
} else {
  require('../src/cli');
}
