var assert = require('assert');
var Type = require('type-of-is');

var mongoose = require('mongoose');

var config = require('../../../config');

var insertOauthAccessToken = require('../../../models/actions/insertOauthAccessToken');

var areValidObjectIDs = require('../../../models/validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

describe('models.actions.insertOauthAccessToken', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing invalid authorization', function () {
        [null, undefined, {}, {_id: 'bar'}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                insertOauthAccessToken(v, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                insertOauthAccessToken({
                    _id: mongoose.Types.ObjectId()
                }, v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when used during refresh token '
       + 'grant type and omitting values in context', function () {

        assert.throws(function () {
            insertOauthAccessToken.call({
                name: 'refreshTokenGrantType',
                // When access token was omitted
            }, {
                _id: mongoose.Types.ObjectId()
            }, function (err, accessToken) {});
        }, Error);

        assert.throws(function () {
            insertOauthAccessToken.call({
                name: 'refreshTokenGrantType',
                accessToken: {
                    // When logged by client was omitted
                    logged_with_email: mongoose.Types.ObjectId()
                }
            }, {
                _id: mongoose.Types.ObjectId()
            }, function (err, accessToken) {});
        }, Error);

        assert.throws(function () {
            insertOauthAccessToken.call({
                name: 'refreshTokenGrantType',
                accessToken: {
                    logged_by_client: mongoose.Types.ObjectId()
                    // When logged with email was omitted
                }
            }, {
                _id: mongoose.Types.ObjectId()
            }, function (err, accessToken) {});
        }, Error);
    });

    it('throws an exception when used during password grant '
       + 'on client and omitting values in context', function () {

        assert.throws(function () {
            insertOauthAccessToken.call({
                name: 'passwordGrantOnClient',
                // When logged by client was omitted
                logged_with_email: mongoose.Types.ObjectId()
            }, {
                _id: mongoose.Types.ObjectId()
            }, function (err, accessToken) {});
        }, Error);

        assert.throws(function () {
            insertOauthAccessToken.call({
                name: 'passwordGrantOnClient',
                logged_by_client: mongoose.Types.ObjectId()
                // When logged with email was omitted
            }, {
                _id: mongoose.Types.ObjectId()
            }, function (err, accessToken) {});
        }, Error);
    });

    it('returns oauth access token when passed valid authorization', function (done) {
        var authorizationID = mongoose.Types.ObjectId();

        insertOauthAccessToken({
            _id: authorizationID
        }, function (err, accessToken) {
            var sha1Reg = /^[a-z0-9]{40}$/;

            if (err) {
                return done(err);
            }

            // Make sure access token was inserted in DB
            assert.ok(areValidObjectIDs([accessToken.id]));

            // Check that access token's authorization ID 
            // is the same than passed ID
            assert.strictEqual(authorizationID.toString(), 
                               accessToken.authorization.toString());

            /* Check that function has hashed tokens */

            assert.ok(Type.is(accessToken.token, String));
            assert.ok(accessToken.token.match(config.EVENID_OAUTH.PATTERNS.TOKENS));

            assert.ok(Type.is(accessToken.refresh_token, String));
            assert.ok(accessToken.refresh_token.match(config.EVENID_OAUTH.PATTERNS.TOKENS));

            // Check that `expires_at` was not in the past
            assert.ok(accessToken.expires_at > new Date());

            /* Check that function also returns generated tokens
               not only hashed tokens */

            assert.ok(Type.is(accessToken._token, String));
            assert.ok(Type.is(accessToken._refresh_token, String));

            assert.ok(accessToken._token.match(sha1Reg));
            assert.ok(accessToken._refresh_token.match(sha1Reg));

            done();
        });
    });
    
    it('keeps the `logged_by_client` and `logged_with_email` values '
       + 'when used during refresh token grant type', function (done) {
        
        var clientID = mongoose.Types.ObjectId();
        var emailID = mongoose.Types.ObjectId();

        insertOauthAccessToken.call({
            name: 'refreshTokenGrantType',
            accessToken: {
                logged_by_client: clientID,
                logged_with_email: emailID
            }
        }, {
            _id: mongoose.Types.ObjectId()
        }, function (err, accessToken) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(accessToken.logged_by_client.toString(), 
                               clientID.toString());

            assert.strictEqual(accessToken.logged_with_email.toString(), 
                               emailID.toString());

            done();
        });
    });

    it('keeps the `logged_by_client` and `logged_with_email` values '
       + 'when used during password grant on client', function (done) {
        
        var clientID = mongoose.Types.ObjectId();
        var emailID = mongoose.Types.ObjectId();

        insertOauthAccessToken.call({
            name: 'passwordGrantOnClient',
            logged_by_client: clientID,
            logged_with_email: emailID
        }, {
            _id: mongoose.Types.ObjectId()
        }, function (err, accessToken) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(accessToken.logged_by_client.toString(), 
                               clientID.toString());
            
            assert.strictEqual(accessToken.logged_with_email.toString(), 
                               emailID.toString());

            done();
        });
    });
});