var request = require('supertest');
var mongoose = require('mongoose');

var config = require('../../../../config');

var app = null;

var validClientID = mongoose.Types.ObjectId().toString();
var validClientSecret = 'a3a54606825e7474b9efcbc278b294b9354a563f';

describe('POST /oauth/token (Check client request)', function () {
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
        + 'when missing `client_id` and `client_secret` parameters', function (done) {
            
        var _request = null;

        makeARequest(_request, 401, {
            grant_type: 'authorization_code',
            code: 'bar'
        }, '{"error":"invalid_client"}', done);
    });

    it('responds with HTTP code 401 and `invalid_client` error '
       + 'when invalid `client_id` parameter', function (done) {
        
        var _request = null;

        makeARequest(_request, 401, {
            client_id: 'bar',
            client_secret: validClientSecret,
            grant_type: 'authorization_code',
            code: 'bar'
        }, '{"error":"invalid_client"}', done);
    });

    it('responds with HTTP code 401 and `invalid_client` error '
       + 'when invalid `client_secret` parameter', function (done) {
        
        var _request = null;

        makeARequest(_request, 401, {
            client_id: validClientID,
            client_secret: 'bar',
            grant_type: 'authorization_code',
            code: 'bar'
        }, '{"error":"invalid_client"}', done);
    });

    it('responds with HTTP code 401 and `invalid_client` error '
       + 'when invalid `client_id` and `client_secret` parameters', function (done) {
        
        var _request = null;

        makeARequest(_request, 401, {
            client_id: 'bar',
            client_secret: 'bar',
            grant_type: 'authorization_code',
            code: 'bar'
        }, '{"error":"invalid_client"}', done);
    });

    it('responds with HTTP code 401 and `invalid_client` error '
       + 'when `client_id` and `client_secret` does not belong to any client', function (done) {
        
        var _request = null;

        makeARequest(_request, 401, {
            client_id: validClientID,
            client_secret: validClientSecret,
            grant_type: 'authorization_code',
            code: 'bar'
        }, '{"error":"invalid_client"}', done);
    });

    it('responds with HTTP code 400 and `unauthorized_client` '
        + 'when app client try to use `authorization_code` grant type', function (done) {

        var _request = null;

        makeARequest(_request, 400, {
            client_id: config.EVENID_APP.CLIENT_ID,
            client_secret: config.EVENID_APP.CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: 'bar'
        }, '{"error":"unauthorized_client"}', done);
    });

    it('responds with HTTP code 400 and `unauthorized_client` '
        + 'when non-app client try to use `password` grant type', function (done) {

        var _request = null;

        makeARequest(_request, 400, {
            client_id: validClientID,
            client_secret: validClientSecret,
            grant_type: 'password',
            username: 'bar',
            password: 'bar'
        }, '{"error":"unauthorized_client"}', done);
    });

    it('responds with HTTP code 400 and `unauthorized_client` '
       + 'when non-app client try to use `client_credentials` grant type', function (done) {

        var _request = null;

        makeARequest(_request, 400, {
            client_id: validClientID,
            client_secret: validClientSecret,
            grant_type: 'client_credentials'
        }, '{"error":"unauthorized_client"}', done);
    });
});