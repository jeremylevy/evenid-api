var request = require('supertest');
var async = require('async');

var getUnauthenticatedAppAccessToken = require('../../../../../testUtils/getUnauthenticatedAppAccessToken');

var createOauthClient = require('../../../../../testUtils/db/createOauthClient');
var createOauthRedirectionURI = require('../../../../../testUtils/db/createOauthRedirectionURI');

var makeARequest = null;
var app = null;

describe('ALL /oauth/authorize (Check client and redirect uri)', function () {
    before(function (done) {
        require('../../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;

            makeARequest = function (statusCode, querystring, body, done) {
                var cb = function (err, accessToken) {
                    var context = this;
                    var executedMethods = 0;
                    var methods = ['GET', 'POST', 'PUT', 'DELETE'];

                    if (err) {
                        return done(err);
                    }

                    querystring = querystring || '';

                    methods.forEach(function (method) {
                        var _statusCode = statusCode;

                        if (context.statusCodes) {
                            _statusCode = context.statusCodes[method];
                        }

                        request(app)
                            [method.toLowerCase()]('/oauth/authorize' + querystring)
                            .set('Authorization', 'Bearer ' + accessToken)
                            .expect(body)
                            .expect(_statusCode, function (err, res) {
                                if (err) {
                                    return done(err);
                                }

                                executedMethods++;
                                
                                if (executedMethods === methods.length) {
                                    done();
                                }
                            });
                    });
                }.bind(this);

                getUnauthenticatedAppAccessToken(cb);
            };

            getUnauthenticatedAppAccessToken = getUnauthenticatedAppAccessToken(app);

            done();
        });
    });

    // In order to match newline don't use `.*` in regex but `[\\s\\S]`
    // Match any whitespace or non whitespace character, 
    // effectively matching any character. 
    // It's like `.`, but matching whitespace too (`\s`) means it also matches `\n`
    // See http://stackoverflow.com/questions/1068280/javascript-regex-multiline-flag-doesnt-work

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when client id does not exist', function (done) {
        
        var reg = new RegExp('(?=[\\s\\S]*error)(?=[\\s\\S]*client_id)'
                             + '(?![\\s\\S]*redirect_uri)');

        makeARequest(400,
                     '?client_id=4edd40c86762e0fb12000003'
                        + '&redirect_uri=http://goo.fr&state=foo&flow=login',
                     reg,
                     done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when redirect_uri does not exist', function (done) {
        
        var reg = new RegExp('(?=[\\s\\S]*error)(?=[\\s\\S]*redirect_uri)'
                             + '(?![\\s\\S]*client_id)');

        createOauthClient(function (err, oauthClient) {
            if (err) {
                return done(err);
            }

            makeARequest(400,
                         '?client_id=' 
                            + oauthClient.client_id 
                            + '&redirect_uri=http://goo.fr&state=foo&flow=login',
                         reg,
                         done);
        });
    });

    it('does not take into account port and stripe '
       + 'slashes for localhost address', function (done) {

        async.auto({
            createOauthRedirectionURI: function (cb) {
                createOauthRedirectionURI.call({
                    uri: 'http://localhost:6490'
                }, function (err, redirectionURI) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, redirectionURI);
                });
            },

            createOauthClient: ['createOauthRedirectionURI', function (cb, results) {
                var redirectionURI = results.createOauthRedirectionURI;

                createOauthClient.call({
                    redirection_uris: [redirectionURI.id]
                }, function (err, oauthClient) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthClient);
                });
            }]
        }, function (err, results) {
            var oauthClient = results && results.createOauthClient;
            var redirectionURI = results && results.createOauthRedirectionURI;

            if (err) {
                return done(err);
            }

            makeARequest.call({
                statusCodes: {
                    // Step credentials
                    'GET': 200,
                    // Invalid grant
                    'POST': 400,
                    /* Does not managed 
                       by oauth authorize */
                    'PUT': 404,
                    'DELETE': 404
                }
            }, null, '?client_id=' 
                        + oauthClient.client_id 
                        + '&redirect_uri=http://localhost:4874//&state=foo&flow=login',
            /((?=.*step)(?=.*credentials))|invalid_grant|not_found/,
            done);
        });
    });

    it('stripes slashes for all redirect uris', function (done) {
        async.auto({
            createOauthRedirectionURI: function (cb) {
                createOauthRedirectionURI.call({
                    uri: 'http://foo.com'
                }, function (err, redirectionURI) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, redirectionURI);
                });
            },

            createOauthClient: ['createOauthRedirectionURI', function (cb, results) {
                var redirectionURI = results.createOauthRedirectionURI;

                createOauthClient.call({
                    redirection_uris: [redirectionURI.id]
                }, function (err, oauthClient) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthClient);
                });
            }]
        }, function (err, results) {
            var oauthClient = results && results.createOauthClient;
            var redirectionURI = results && results.createOauthRedirectionURI;

            if (err) {
                return done(err);
            }

            makeARequest.call({
                statusCodes: {
                    // Step credentials
                    'GET': 200,
                    // Invalid grant
                    'POST': 400,
                    /* Does not managed 
                       by oauth authorize */
                    'PUT': 404,
                    'DELETE': 404
                }
            }, null, '?client_id=' 
                        + oauthClient.client_id 
                        + '&redirect_uri=http://foo.com//&state=foo&flow=login',
            /((?=.*step)(?=.*credentials))|invalid_grant|not_found/,
            done);
        });
    });
});