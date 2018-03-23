var request = require('supertest');
var mongoose = require('mongoose');

var config = require('../../../../config');

var app = null;

var validClientID = mongoose.Types.ObjectId().toString();
var validClientSecret = 'a3a54606825e7474b9efcbc278b294b9354a563f';
var validAuthHeader = 'Basic ' 
                      + new Buffer(
                        validClientID 
                        + ':' 
                        + validClientSecret).toString('base64');

describe('POST /oauth/token (Check client header)', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;

            makeARequest = function (_request, statusCode, data, body, done) {
                _request = _request || request(app).post('/oauth/token');

                // According to RFC
                if (statusCode === 401) {
                    _request.expect('WWW-Authenticate', 'Basic realm="API"');
                }

                _request
                    // Body parser middleware needs it to populate `req.body`
                    .set('Content-Type', 'application/x-www-form-urlencoded')
                    .send(data)
                    .expect('Content-Type', 'application/json; charset=utf-8')
                    .expect('Cache-Control', 'no-store')
                    .expect('Pragma', 'no-cache')
                    .expect(body)
                    .expect(statusCode, done);
            };

            done();
        });
    });

    it('responds with HTTP code 401 and `invalid_client` error '
        + 'when missing `Authorization` HTTP header field', function (done) {
            
        var _request = request(app).post('/oauth/token');

        makeARequest(_request, 401, {
            grant_type: 'authorization_code',
            code: 'bar'
        }, '{"error":"invalid_client"}', done);
    });

    it('responds with HTTP code 401 and `invalid_client` error '
       + 'when invalid `Authorization` request header field', function (done) {
        
        var _request = request(app).post('/oauth/token')
                                   .set('Authorization', 'Baic (§(po(§poùù¨¨^$');

        makeARequest(_request, 401, {
            grant_type: 'authorization_code',
            code: 'bar'
        }, '{"error":"invalid_client"}', done);
    });

    // Test to check that `/oauth/token` avoid `CastError: Cast to ObjectId failed` 
    // error when `client_id` is not an ObjectID
    it('responds with HTTP code 401 and `invalid_client` error when `Authorization` '
       + 'request header field contains invalid client credentials', function (done) {
        
        var _request = request(app).post('/oauth/token')
                                   .set('Authorization', 'Basic cG9vOmZvbw==');

        makeARequest(_request, 401, {
            grant_type: 'authorization_code',
            code: 'bar'
        }, '{"error":"invalid_client"}', done);
    });

    // Test to check that `/oauth/token` avoid error
    // when authorization header is not Base64
    it('responds with HTTP code 401 and `invalid_client` error '
       + 'when invalid `Authorization` request header field', function (done) {
        
        var _request = request(app).post('/oauth/token')
                                   .set('Authorization',
                                        config.EVENID_APP.AUTHORIZATION_HTTP_HEADER + '==');

        makeARequest(_request, 401, {
            grant_type: 'client_credentials'
        }, '{"error":"invalid_client"}', done);
    });

    it('responds with HTTP code 400 and `unauthorized_client` '
        + 'when app client try to use `authorization_code` grant type', function (done) {

        var _request = request(app).post('/oauth/token')
                                   .set('Authorization',
                                        config.EVENID_APP.AUTHORIZATION_HTTP_HEADER);

        makeARequest(_request, 400, {
            grant_type: 'authorization_code',
            code: 'bar'
        }, '{"error":"unauthorized_client"}', done);
    });

    it('responds with HTTP code 400 and `unauthorized_client` '
        + 'when non-app client try to use `password` grant type', function (done) {

        var _request = request(app).post('/oauth/token')
                                   .set('Authorization', validAuthHeader);

        makeARequest(_request, 400, {
            grant_type: 'password',
            username: 'bar',
            password: 'bar'
        }, '{"error":"unauthorized_client"}', done);
    });

    it('responds with HTTP code 400 and `unauthorized_client` '
       + 'when non-app client try to use `client_credentials` grant type', function (done) {

        var _request = request(app).post('/oauth/token')
                                   .set('Authorization', validAuthHeader);

        makeARequest(_request, 400, {
            grant_type: 'client_credentials'
        }, '{"error":"unauthorized_client"}', done);
    });
});