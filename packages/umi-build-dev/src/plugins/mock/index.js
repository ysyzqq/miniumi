import createMockMiddleware from './createMockMiddleware';

export default function (api) {
    let errors = [];
    const {log} = api;
    api._beforeServerWithApp(({ app }) => {
        if (process.env.MOCK !== 'none' && process.env.HTTP_MOCK !== 'none') {
            const beforeMiddlewares = api.applyPlugins('addMiddlewareBeforeMock', {
                initialValue: [],
            });
            const afterMiddlewares = api.applyPlugins('addMiddlewareAfterMock', {
                initialValue: [],
            });
            beforeMiddlewares.forEach(m => app.use(m));
            app.use(createMockMiddleware(api, errors));
            afterMiddlewares.forEach(m => app.user(m));
        }
    });
    api.onDevCompileDone(() => {
        if (errors.length) {
            log.error(`Mock file parse failed`);
            errors.forEach(e => {
                console.error(e.message);
            });
        }
    });

}