var request = require('supertest');

var makeARequest = null;
var app = null;
    
describe('GET /health', function () {
    before(function (done) {
        require('../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, body, done) {
                var cb = function () {
                    request(app)
                        .get('/health')
                        .expect(body)
                        .expect(statusCode, function (err, resp) {
                            if (err) {
                                return done(err);
                            }

                            done(null, resp);
                        });
                }.bind(this);

                cb();
            };

            done();
        });
    });
    
    it('responds with HTTP code 200 no matter what', function (done) {
        makeARequest(200, /OK/, done);
    });
});