import { join, relative } from 'path';
import { writeFileSync, readFileSync } from 'fs';
import mkdirp from 'mkdirp';
import chokidar from 'chokidar';
import assert from 'assert';
import chalk from 'chalk';
import { debounce, uniq } from 'lodash';
import Mustache from 'mustache';
import { winPath, findJS } from 'umi-utils';
import stripJSONQuote from './routes/stripJSONQuote';
import routesToJSON from './routes/routesToJSON';
import importsToStr from './importsToStr';
import { EXT_LIST } from './constants';

const debug = require('debug')('umi:FilesGenerator');

export const watcherIgnoreRegExp = /(^|[\/\\])(_mock.js$|\..)/;

export default class FilesGenerator {

    constructor(opts) {
        Object.keys(opts).forEach(key => {
            this[key] = opts[key];
        });
        this.routesContent = null;
        this.hasRebuildError = false;
    }

    generate() {
        debug('generate');
        const { paths } = this.service;
        const { absTmpDirPath, tmpDirPath } = paths;
        debug(`mkdir tmp dir: ${tmpDirPath}`);
        mkdirp.sync(absTmpDirPath); // 生成临时文件夹

        this.generateFiles();
    }

    generateFiles() {
        this.service.applyPlugins('onGenerateFiles');
        this.generateRouterJS();
        this.generateEntry();
        this.generateHistory();
    }

    generateRouterJS() {
        const { paths } = this.service;
        const { absRouterJSPath } = paths;
        const routesContent = this.getRouterJSContent();
        // 避免文件写入导致不必要的 webpack 编译
        if (this.routesContent !== routesContent) {
            writeFileSync(absRouterJSPath, `${routesContent.trim()}\n`, 'utf-8');
            this.routesContent = routesContent;
        }
    }

    getRouterJSContent() {
        const { paths } = this.service;
        const routerTpl = readFileSync(paths.defaultRouterTplPath, 'utf-8');
        const routes = stripJSONQuote(
            this.getRoutesJSON({
                env: process.env.NODE_ENV,
            }),
        );
        const rendererWrappers = this.service
            .applyPlugins('addRendererWrapperWithComponent', {
                initialValue: [],
            })
            .map((source, index) => {
                return {
                    source,
                    specifier: `RendererWrapper${index}`,
                };
        });
        const routerContent = this.getRouterContent(rendererWrappers);


    }

    getRouterContent(rendererWrappers) {

    }

    getRoutesJSON(opts = {}) {
        const { env } = opts;
        return routesToJSON(this.RoutesManager.routes, this.service, env);
    }

    generateEntry() {

    }

    generateHistory() {

    }
}

