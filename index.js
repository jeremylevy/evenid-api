var cluster = require('cluster');
var os = require('os');
var http = require('http');

var express = require('express');
var bodyParser = require('body-parser');
var I18n = require('i18n-2');

var config = require('./config');

var db = require('./models');
var routes = require('./routes');

var checkAccessToken = require('./routes/oauth/middlewares/checkAccessToken');

var checkOauthAuthorizeQS = require('./routes/oauth/middlewares/authorize/checkQueryString');
var checkOauthClientAndRedirectURI = require('./routes/oauth/middlewares/authorize/checkClientAndRedirectURI');
var checkOauthClientAuthorizeTestAccounts = require('./routes/oauth/middlewares/authorize/checkClientAuthorizeTestAccounts');

var lookupOauthTestAccount = require('./routes/oauth/middlewares/authorize/lookupTestAccount');
var setOauthClientToSend = require('./routes/oauth/middlewares/authorize/setClientToSend');

var findRealIDForClientSpecificID = require('./routes/oauth/middlewares/findRealIDForClientSpecificID');

var apiErrorMiddleware = require('./errors/middlewares');

var AccessDeniedError = require('./errors/types/AccessDeniedError');
var NotFoundError = require('./errors/types/NotFoundError');

var app = null;
var server = null;

process.on('uncaughtException', function (err) {
    console.error(
        '[%s] Uncaught exception: %s',
        (new Date).toUTCString(),
        err.message
    );
    
    console.error(err.stack);
    
    process.exit(1);
});

app = express();

// AWS Elastic Load Balancing placed behind proxy
app.enable('trust proxy');

// Don't set `x-powered-by` header in responses
app.disable('x-powered-by');

// Redirect http:// to https://
app.use(function (req, res, next) {
    if (['development', 'test'].indexOf(config.ENV) !== -1) {
        return next();
    }

    // ELB health check made through HTTP
    if (req.path === '/health') {
        return next();
    }

    if (req.get('x-forwarded-proto') !== 'https') {
        return res.redirect(301, 'https://' + req.get('host') + req.originalUrl);
    }
    
    next();
});

I18n.expressBind(app, {
    // setup some locales
    locales: config.EVENID_LOCALES.ENABLED,
    // If user locale is not enabled default to `en-us` silently
    defaultLocale: config.EVENID_LOCALES.DEFAULT,
    query: true
});

// Parse application/x-www-form-urlencoded request and populate req.body object
app.use(bodyParser.urlencoded({
    extended: true
}));

// Make sure to set this BEFORE routes loading
app.use(function (req, res, next) {
    // Don't cache API results
    res.set({
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache'
    });

    next('route');
});

// Make sure to set this BEFORE routes loading.
// Check access token for all requests.
app.use(checkAccessToken);

// Make sure to set this BEFORE routes loading.
// Check query string during oauth authorize flow
// and lookup client.
// Use regex to match `/oauth/authorize/recover-password`
app.all(new RegExp('^/oauth/authorize(/.*)?$'), 
        checkOauthAuthorizeQS, 
        checkOauthClientAndRedirectURI, 
        setOauthClientToSend);

// Check that user doesn't try to use test account
// when client has disabled it
app.post('/oauth/authorize', 
         checkOauthClientAuthorizeTestAccounts,
         lookupOauthTestAccount);

// Exposed methods use capturing parenthesis so use `forEach`
// here don't try to concat path regexs with '|' operator
config.EVENID_API.EXPOSED_METHODS.forEach(function (pathReg) {
    app.all(new RegExp(pathReg), findRealIDForClientSpecificID);
});

// Load the routes
routes(app, express);

app.all('/oauth/authorize', function (req, res, next) {
    // 404 for unsupported methods
    if (config.EVENID_OAUTH
              .SUPPORTED_HTTP_METHODS
              .indexOf(req.method) === -1) {
        
        return next('route');
    }

    // 403 for access tokens 
    // with invalid scope
    next(new AccessDeniedError());
});

// 404
app.use(function (req, res, next) {
    next(new NotFoundError());
});

// Error middleware
app.use(apiErrorMiddleware);

// if (cluster.isMaster 
//     && config.ENV !== 'test') {
    
//     for (var i = 0; i < os.cpus().length; ++i) {
//         cluster.fork();
//     }
    
//     cluster.on('exit', function (worker, code, signal) {
//         console.log(
//             'Worker %d died (%s). Restarting...',
//             worker.process.pid,
//             signal || code
//         );

//         cluster.fork();
//     });

//     return;
// }

// When required
module.exports = function (cb) {
    db.connect(function (err) {
        if (err) {
            return cb(err);
        }

        if (!server) {
            server = http.createServer(app);
        }

        server.listen(config.PORT, function () {
            cb(null, server);
        });
    });
};

// Loaded from command line
if (require.main === module) {
    db.connect(function (err) {
        if (err) {
            return console.error(err);
        }

        app.listen(config.PORT, function () {
            console.log('Listening on %d', config.PORT);
        });
    });
}