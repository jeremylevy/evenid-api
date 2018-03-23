var request = require('supertest');

var app = null;

describe('POST /oauth/token (Check request)', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;

            makeARequest = function (_request, statusCode, data, body, done) {
                _request = _request || request(app).post('/oauth/token');

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

    it('responds with HTTP code 400 and `invalid_request` '
        + 'error when empty request', function (done) {
        
        var request = null;

        makeARequest(request, 400, {}, 
                     '{"error":"invalid_request"}', done);
    });

    it('responds with HTTP code 400 and `invalid_request` error '
       + 'when missing code parameter for authorization_code grant type', function (done) {

        var request = null;

        makeARequest(request, 400, {
            grant_type: 'authorization_code'
        }, '{"error":"invalid_request"}', done);
    });

    it('responds with HTTP code 400 and `invalid_request` error '
       + 'when missing username parameter for `password` grant type', function (done) {
        
        var request = null;

        makeARequest(request, 400, {
            password: 'bar',
            grant_type: 'password'
        }, '{"error":"invalid_request"}', done);
    });

    it('responds with HTTP code 400 and `invalid_request` error '
       + 'when missing password parameter for `password` grant type', function (done) {
        
        var request = null;

        makeARequest(request, 400, {
            username: 'bar',
            grant_type: 'password'
        }, '{"error":"invalid_request"}', done);
    });

    // If user send login form with empty values
    // prefer to send `invalid_grant` error 
    // (ie: `Invalid credentials`)
    // than `invalid_request` error 
    // (ie: `This form contains invalid fields`)
    it('responds with error different than `invalid_request` when '
       + 'username and password were empty during `password` grant type', function (done) {
        
        var request = null;

        makeARequest(request, 401, {
            username: '',
            password: '',
            grant_type: 'password'
        }, '{"error":"invalid_client"}', done);
    });

    it('responds with HTTP code 400 and `invalid_request` error when '
       + 'missing refresh_token parameter for `refresh_token` grant type', function (done) {
        
        var request = null;

        makeARequest(request, 400, {
            grant_type: 'refresh_token'
        }, '{"error":"invalid_request"}', done);
    });

    it('responds with HTTP code 400 and `unsupported_grant_type` '
       + 'error when invalid grant type', function (done) {
        
        var request = null;

        makeARequest(request, 400, {
            grant_type: 'bar'
        }, '{"error":"unsupported_grant_type"}', done);
    });
});