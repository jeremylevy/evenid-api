var assert = require('assert');

var needsClientSecret = require('../../../../../../models/properties/getters/'
                                + 'oauthRedirectionURI/virtuals/needsClientSecret');

var createOauthRedirectionURI = require('../../../../../../testUtils/db/createOauthRedirectionURI');

describe('models.properties.getters.oauthRedirectionURI.'
         + 'virtuals.needsClientSecret', function () {

    // Connect to database
    before(function (done) {
        require('../../../../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing invalid context', function () {
        [null, undefined, {}, [], '', 0.0, function () {}].forEach(function (v) {
            assert.throws(function () {
                needsClientSecret.call(v);
            }, assert.AssertionError);
        });
    });

    it('returns `false` when uri was not set', function (done) {
        createOauthRedirectionURI(function (err, redirectionURI) {
            if (err) {
                return done(err);
            }

            redirectionURI.uri = undefined;

            assert.strictEqual(needsClientSecret.call(redirectionURI), false);

            done();
        });
    });

    it('returns `false` for localhost and installed apps addresses', function (done) {
        var uris = [
            'http://localhost:5200',
            'https://localhost/foo?bar=bar',
            'urn:ietf:wg:oauth:2.0:oob',
            'urn:ietf:wg:oauth:2.0:oob:auto',
            'myapp://callback'
        ];

        createOauthRedirectionURI(function (err, redirectionURI) {
            if (err) {
                return done(err);
            }

            uris.forEach(function (uri) {
                redirectionURI.uri = uri;

                assert.strictEqual(needsClientSecret.call(redirectionURI), false);
            });

            done();
        });
    });

    it('returns `true` for server addresses', function (done) {
        var uris = [
            'http://myapp.com',
            'https://www.foo.com/bar?foo=bar#foo'
        ];

        createOauthRedirectionURI(function (err, redirectionURI) {
            if (err) {
                return done(err);
            }

            uris.forEach(function (uri) {
                redirectionURI.uri = uri;

                assert.strictEqual(needsClientSecret.call(redirectionURI), true);
            });

            done();
        });
    });
});