var assert = require('assert');
var Type = require('type-of-is');

var token = require('../../libs/token');

var firstToken = null;

describe('libs.token', function () {
    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                token(v);
            }, assert.AssertionError);
        });
    });

    it('returns sha-1 token when valid callback', function (done) {
        token(function (err, token) {
            firstToken = token;

            if (err) {
                return done(err);
            }

            assert.ok(Type.is(token, String) && token.match(/[a-z0-9]{40}/));

            done();
        });
    });

    it('does not return the same hash each time', function (done) {
        token(function (err, token) {
            if (err) {
                return done(err);
            }

            assert.ok(token !== firstToken);

            done();
        });
    });
});