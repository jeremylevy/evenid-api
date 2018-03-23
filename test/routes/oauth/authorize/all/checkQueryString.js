var request = require('supertest');

var getUnauthenticatedAppAccessToken = require('../../../../../testUtils/getUnauthenticatedAppAccessToken');

var makeARequest = null;
var app = null;

describe('ALL /oauth/authorize (Check query string)', function () {
    before(function (done) {
        require('../../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;

            makeARequest = function (statusCode, querystring, body, done) {
                var cb = function (err, accessToken) {
                    var executedMethods = 0;
                    var methods = ['GET', 'POST', 'PUT', 'DELETE'];

                    querystring = querystring || '';

                    methods.forEach(function (method) {
                        request(app)
                            [method.toLowerCase()]('/oauth/authorize' + querystring)
                            .set('Authorization', 'Bearer ' + accessToken)
                            .expect(body)
                            .expect(statusCode, function (err, res) {
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
       + 'error when querystring is empty', function (done) {
        
        var reg = new RegExp('(?=[\\s\\S]*error)(?=[\\s\\S]*client_id)'
                           + '(?=[\\s\\S]*redirect_uri)(?=[\\s\\S]*state)'
                           + '(?=[\\s\\S]*flow)');
        
        makeARequest(400, null, reg, done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid client_id', function (done) {
        
        var reg = new RegExp('(?=[\\s\\S]*error)(?=[\\s\\S]*client_id)'
                           + '(?![\\s\\S]*redirect_uri)(?![\\s\\S]*state)'
                           + '(?![\\s\\S]*flow)');

        makeARequest(400,
                     '?client_id=bar&redirect_uri=http://goo.fr&state=bar&flow=login',
                     reg,
                     done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid redirect_uri', function (done) {

        var reg = new RegExp('(?=[\\s\\S]*error)(?![\\s\\S]*client_id)'
                           + '(?=[\\s\\S]*redirect_uri)(?![\\s\\S]*state)'
                           + '(?![\\s\\S]*flow)');
       
        makeARequest(400,
                     '?client_id=4edd40c86762e0fb12000003&redirect_uri=http/&state=bar&flow=login',
                     reg,
                     done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when empty state', function (done) {
        
        var reg = new RegExp('(?=[\\s\\S]*error)(?![\\s\\S]*client_id)'
                           + '(?![\\s\\S]*redirect_uri)(?=[\\s\\S]*state)'
                           + '(?![\\s\\S]*flow)');

        makeARequest(400,
                     '?client_id=4edd40c86762e0fb12000003&redirect_uri=http://goo.fr&state=&flow=login',
                     reg,
                     done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid flow', function (done) {
        
        var reg = new RegExp('(?=[\\s\\S]*error)(?=[\\s\\S]*flow)'
                           + '(?![\\s\\S]*client_id)(?![\\s\\S]*redirect_uri)'
                           + '(?![\\s\\S]*state)');

        makeARequest(400,
                     '?client_id=4edd40c86762e0fb12000003&redirect_uri=http://bar.fr&state=bar&flow=bar',
                     reg,
                     done);
    });
});