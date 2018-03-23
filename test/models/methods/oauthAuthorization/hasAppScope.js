var assert = require('assert');

var hasAppScope = require('../../../../models/methods/oauthAuthorization/hasAppScope');

var createOauthAuthorization = require('../../../../testUtils/db/createOauthAuthorization');

describe('models.methods.oauthAuthorization.hasAppScope', function () {
    // Connect to database
    before(function (done) {
        require('../../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
    
    it('throws an exception when passing invalid context', function () {
        [null, undefined, {}, [], '', 0.0, function () {}].forEach(function (v) {
            assert.throws(function () {
                hasAppScope.call(v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid scope', function () {
        [null, undefined, {}, '', 0.0, function () {}].forEach(function (v) {
            assert.throws(function () {
                hasAppScope.call(v);
            }, assert.AssertionError);
        });
    });

    it('returns `false` when passing valid scope without app values', function (done) {
        createOauthAuthorization.call({
            scope: ['emails', 'first_name', 'last_name']
        }, function (err, authorization) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(hasAppScope.call(authorization), false);

            done();
        });
    });

    it('returns `true` when passing valid scope with `app` value', function (done) {
        createOauthAuthorization.call({
            scope: ['emails', 'app']
        }, function (err, authorization) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(hasAppScope.call(authorization), true);

            done();
        });
    });

    it('returns `true` when passing valid scope with `app_developer` value', function (done) {
        createOauthAuthorization.call({
            scope: ['app_developer', 'first_name']
        }, function (err, authorization) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(hasAppScope.call(authorization), true);

            done();
        });
    });

    it('returns `true` when passing valid scope with `app` and `app_developer` value', function (done) {
        createOauthAuthorization.call({
            scope: ['app', 'app_developer', 'first_name']
        }, function (err, authorization) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(hasAppScope.call(authorization), true);

            done();
        });
    });
});