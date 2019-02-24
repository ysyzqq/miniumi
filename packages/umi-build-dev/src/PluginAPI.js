import debug from 'debug';
import assert from 'assert';
import { relative } from 'path';
import lodash, { isPlainObject } from 'lodash';
import Mustache from 'mustache';
import { winPath, compatDirname, findJS, findCSS } from 'umi-utils';
import Generator from 'yeoman-generator';
import signale from 'signale';
import registerBabel, { addBabelRegisterFiles } from './registerBabel';

export default class PluginAPI {

    constructor(id, service) {

        this.id = id;
        this.service = service;

        // 工具
        this.debug = debug(`umi-plugin: ${id}`);
        this.log = signale;
        this.winPath = winPath;
        this._ = lodash;
        this.compatDirname = compatDirname;
        this.findCSS = findCSS;
        this.findJS = findJS;
        this.Mustache = Mustache;
        this.Generator = Generator;

        this.API_TYPE = {
            ASS: Symbol('add'),
            MODIFY: Symbol('modify'),
            EVENT: Symbol('event'),
        }

        this._addMethods();
    }

    relativeToTmp = path => {
        return this.winPath(relative(this.service.paths.absTmpDirPath, path));
    };

    _resolveDeps(file) {
        return require.resolve(file);
    }

    _addMethods() {
        [
            [
                'chainWebpackConfig',
                {
                    type: this.API_TYPE.EVENT,
                },
            ],
            [
                '_registerConfig',
                {
                    type: this.API_TYPE.ADD,
                },
            ],
            'onStart',
            'onDevCompileDone',
            'onBuildSuccess',
            'onBuildFail',
            'addPageWatcher',
            'addEntryCode',
            'addEntryCodeAhead',
            'addEntryImport',
            'addEntryImportAhead',
            'addEntryPolyfillImports',
            'addRendererWrapperWithComponent',
            'addRendererWrapperWithModule',
            'addRouterImport',
            'addRouterImportAhead',
            'addVersionInfo',
            'addUIPlugin',
            'modifyAFWebpackOpts',
            'modifyEntryRender',
            'modifyEntryHistory',
            'modifyRouteComponent',
            'modifyRouterRootComponent',
            'modifyWebpackConfig',
            '_beforeServerWithApp',
            'beforeDevServer',
            '_beforeDevServerAsync',
            'afterDevServer',
            'addMiddlewareAhead',
            'addMiddleware',
            'addMiddlewareBeforeMock',
            'addMiddlewareAfterMock',
            'modifyRoutes',
            'onPatchRoute',
            'modifyHTMLContext',
            'addHTMLMeta',
            'addHTMLLink',
            'addHTMLScript',
            'addHTMLStyle',
            'addHTMLHeadScript',
            'modifyHTMLChunks',
            'onGenerateFiles',
            'onHTMLRebuild',
            'modifyDefaultConfig',
            '_modifyConfig',
            'modifyHTMLWithAST',
            '_modifyHelpInfo',
            'addRuntimePlugin',
            'addRuntimePluginKey',
            'beforeBlockWriting',
            '_modifyBlockPackageJSONPath',
            '_modifyBlockDependencies',
            '_modifyBlockFile',
            '_modifyBlockTarget',
            '_modifyCommand',
            '_modifyBlockNewRouteConfig',
        ].forEach(method => {
            if (Array.isArray(method)) {
                this.registerMethod(...method);
            } else {
                let type;
                const isPrivate = method.indexOf('_') === 0;
                const sliceMethod = isPrivate ? method.slice(1) : method;
                if (sliceMethod.indexOf('add') === 0) {
                    type = this.API_TYPE.ADD;
                } else if (sliceMethod.indexOf('modify') === 0) {
                    type = this.API_TYPE.MODIFY;
                } else if (
                    sliceMethod.indexOf('on') === 0 ||
                    sliceMethod.indexOf('before') === 0 ||
                    sliceMethod.indexOf('after') === 0
                ) {
                    type = this.API_TYPE.EVENT;
                } else {
                    throw new Error(`unexpected method name ${method}`);
                }
                this.registerMethod(method, { type });
            }
        })
    }


    registerMethod(name, opts) {
        assert(!this[name], `api.${name} exists.`);
        assert(opts, `opts must supplied`);
        const { type, apply } = opts;
        assert(!(type && apply), `Only be one for type and apply.`);
        assert(type || apply, `One of type and apply must supplied.`);
        /**
         * 添加service的pluginMethods方法, 被api代理, 插件调用时传入对应的hook
         * service调用applyPlugins时传入对应的opts 一般包含initialValue
         */
        this.service.pluginMethods[name] = (...args) => { // 插件调用api时传入的Hooks 或 值
            if (apply) {
                this.register(name, opts => {
                    return apply(opts, ...args);
                })
            } else if (type === this.API_TYPE.ADD) {
                this.register(name, opts => { // service调用时, 这里的opts包含initialValue, args; applyPlugins时传入, memo是reduce的hooks调用
                    return (opts.memo || []).concat(
                        typeof args[0] === 'function'
                            ? args[0](opts.memo, opts.args)
                            : args[0],
                    )
                });
            } else if (type === this.API_TYPE.MODIFY) {
                this.register(name, opts => {
                    return typeof args[0] === 'function'
                        ? args[0](opts.memo, opts.args)
                        : args[0];
                });
            } else if (type === this.API_TYPE.EVENT) {
                this.register(name, opts => {
                    args[0](opts.args);
                })
            } else {
                throw new Error(`unexpected api type ${type}`);
            }
        }
    }

    register(hook, fn) {
        assert(
            typeof hook === 'string',
            `The first argument of api.register() must be string, but got ${hook} : ${typeof hook}`,
        );
        assert(
            typeof fn === 'function',
            `The second argument of api.register() must be function, but got ${fn} : ${typeof fn}`,
        );

        const { pluginHooks } = this.service;
        pluginHooks[hook] = pluginHooks[hook] || [];
        pluginHooks[hook].push({
            fn
        })
    }

    registerCommand(name, opts, fn) {
        this.service.registerCommand(name, opts, fn);
    }

    registerGenerator(name, opts) {
        const { generators } = this.service;
        assert(
            typeof name === 'string',
            `name should be supplied with a string, but got ${name}`,
        );
        assert(opts && opts.Generator, `opts.Generator should be supplied`);
        assert(
            !(name in generators),
            `Generator ${name} exists, please select another one.`,
        );
        generators[name] = opts;
    }

    registerPlugin(opts) {
        assert(isPlainObject(opts), `opts should be plain object, but got ${opts}`);
        const { id, apply } = opts;
        assert(id && apply, `id and apply must supplied`);
        assert(typeof id === 'string', `id must be string`);
        assert(typeof apply === 'function', `apply must be function`);
        assert(
            id.indexOf('user:') !== 0 && id.indexOf('built-in:') !== 0,
            `api.registerPlugin() should not register plugin prefixed with user: and built-in:`,
        );
        assert(
            Object.keys(opts).every(key => ['id', 'apply', 'opts'].includes(key)),
            `Only id, apply and opts is valid plugin properties`,
        );
        this.service.extraPlugins.push(opts);
    }

    addBabelRegister(files) {
        assert(
            Array.isArray(files),
            `files for registerBabel must be Array, but got ${files}: ${typeof files}`,
        );
        addBabelRegisterFiles(files);
        registerBabel({
            cwd: this.service.cwd,
        });
    }

}