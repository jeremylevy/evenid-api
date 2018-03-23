var assert = require('assert');
var mongoose = require('mongoose');

var formatURI = require('../../../../../../models/middlewares/pre/save/oauthRedirectionURI/formatURI');

var createOauthRedirectionURI = require('../../../../../../testUtils/db/createOauthRedirectionURI');

describe('models.middlewares.pre.save.oauthRedirectionURI.formatURI', function () {
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
                formatURI.call(v, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function as next', function (done) {
        createOauthRedirectionURI(function (err, oauthRedirectionURI) {
            if (err) {
                return done(err);
            }

            [null, undefined, {}, [], '', 0.0].forEach(function (v) {
                assert.throws(function () {
                    formatURI.call(oauthRedirectionURI, v);
                }, assert.AssertionError);
            });

            done();
        });
    });

    it('remove port for localhost addresses', function (done) {
        // Needs to be unique
        var URI = 'http://localhost:5200/' 
            + mongoose.Types.ObjectId().toString();

        createOauthRedirectionURI.call({
            uri: URI
        }, function (err, oauthRedirectionURI) {
            if (err) {
                return done(err);
            }

            formatURI.call(oauthRedirectionURI, function () {
                assert.strictEqual(oauthRedirectionURI.uri, URI.replace(':5200', ''));

                done();
            });
        });
    });

    it('remove trailing slashes for all addresses', function (done) {
        // Needs to be unique
        var URI = 'http://' 
            + mongoose.Types.ObjectId().toString() 
            + '.com///';

        createOauthRedirectionURI.call({
            uri: URI
        }, function (err, oauthRedirectionURI) {
            if (err) {
                return done(err);
            }

            formatURI.call(oauthRedirectionURI, function () {
                assert.strictEqual(oauthRedirectionURI.uri, 
                                   URI.replace(new RegExp('/+$'), ''));

                done();
            });
        });
    });
});