var assert = require('assert');

var crypto = require('crypto');
var mongoose = require('mongoose');

var config = require('../../../../../config');

var getLogo = require('../../../../../models/properties/getters/oauthClient/logo');

var createOauthClient = require('../../../../../testUtils/db/createOauthClient');

describe('models.properties.getters.oauthClient.logo', function () {
    // Connect to database
    before(function (done) {
        require('../../../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing invalid context', function () {
        [null, undefined, {}, [], '', 0.0, function () {}].forEach(function (v) {
            assert.throws(function () {
                getLogo.call(v, mongoose.Types.ObjectId());
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-objectID non-false value as logo hash', function (done) {
        createOauthClient(function (err, client) {
            if (err) {
                return done(err);
            }

            [{}, [], 'foo', 18.0].forEach(function (v) {
                assert.throws(function () {
                    getLogo.call(client, v);
                }, assert.AssertionError);
            });

            done();
        });
    });

    it('returns `undefined` when logo hash was not passed', function (done) {
        createOauthClient(function (err, client) {
            if (err) {
                return done(err);
            }

            [null, undefined, false, ''].forEach(function (v) {
                assert.strictEqual(getLogo.call(client, v), undefined);
            });

            done();
        });
    });

    it('returns full URL when logo hash was passed', function (done) {
        var logoHash = crypto.createHash('sha1')
                             .update(mongoose.Types.ObjectId().toString())
                             .digest('hex');

        createOauthClient(function (err, client) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(getLogo.call(client, logoHash), 
                               config.EVENID_AWS.CLOUDFRONT.URLS.UPLOADS + '/clients/logos/' + logoHash);

            done();
        });
    });
});