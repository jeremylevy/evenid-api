var assert = require('assert');
var Type = require('type-of-is');

var mongoose = require('mongoose');

var setLogo = require('../../../../../models/properties/setters/oauthClient/logo');

var createOauthClient = require('../../../../../testUtils/db/createOauthClient');

describe('models.properties.setters.oauthClient.logo', function () {
    // Connect to database
    before(function (done) {
        require('../../../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing '
       + 'invalid context', function () {

        [null, undefined, {}, [], 
         '', 0.0, function () {}].forEach(function (v) {
            
            assert.throws(function () {
                setLogo.call(v);
            }, assert.AssertionError);
        });
    });

    it('returns passed value when '
       + 'passing invalid URL', function (done) {
        
        createOauthClient(function (err, logo) {
            if (err) {
                return done(err);
            }

            [null, undefined, {}, [], 
             '', 0.0, function () {}].forEach(function (v) {
                
                assert.strictEqual(setLogo.call(logo, v), v);
            });

            done();
        });
    });

    it('returns logo hash when passing valid logo URL', function (done) {
        var clientID = mongoose.Types.ObjectId().toString();
        var logoHash = 'a55740c03c72c603ee1a6675cef0e5a78364fa55';
        
        var logoURL = 'http://foo.com/client/' + clientID 
                    + '/logos/' + logoHash;

        createOauthClient(function (err, client) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(setLogo.call(client, logoURL), logoHash);

            done();
        });
    });

    it('returns logo hash when passing valid logo URL with size', function (done) {
        var clientID = mongoose.Types.ObjectId().toString();
        var logoHash = 'a55740c03c72c603ee1a6675cef0e5a78364fa55';
        
        var logoURL = 'http://foo.com/client/' + clientID 
                    + '/logos/' + logoHash
                    + '/25';

        createOauthClient(function (err, client) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(setLogo.call(client, logoURL), logoHash);

            done();
        });
    });
});