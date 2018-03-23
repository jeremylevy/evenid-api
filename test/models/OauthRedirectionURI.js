var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');
var mongoose = require('mongoose');

var config = require('../../config');
var db = require('../../models');

var OauthRedirectionURISchema = require('../../models/OauthRedirectionURI');

var isUniqueIndexError = require('../../models/validators/isUniqueIndexError');

var compareArray = require('../../testUtils/lib/compareArray');

var OauthRedirectionURI = db.models.OauthRedirectionURI;
var validOauthRedirectionURI = function (oauthRedirectionURI) {
    oauthRedirectionURI = oauthRedirectionURI || new OauthRedirectionURI();

    oauthRedirectionURI.uri = 'https://bar.com';
    oauthRedirectionURI.response_type = 'code';
    oauthRedirectionURI.scope = ['emails'];
    oauthRedirectionURI.client = mongoose.Types.ObjectId().toString();

    return oauthRedirectionURI;
};

var requiredFields = [
    'client', 'uri', 
    'response_type', 
    'scope'
];

describe('models.OauthRedirectionURI', function () {
    // Connect to database
    before(function (done) {
        require('../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('has valid `toObject` options', function () {
        var toObjectOpts = OauthRedirectionURISchema.get('toObject');
        var validHideOpt = ['_id', '__v'];

        // Transform function is set for all 
        // models in the index function
        assert.ok(Type.is(toObjectOpts.transform, Function));
        
        assert.ok(compareArray(toObjectOpts.hide.split(' '),
                  validHideOpt));
        
        assert.strictEqual(toObjectOpts.virtuals, true);
    });

    it('applies default values', function () {
        var oauthRedirectionURI = new OauthRedirectionURI();

        /* `toObject()`: Get a real JS array */

        assert.deepEqual(oauthRedirectionURI.scope.toObject(), []);
        assert.deepEqual(oauthRedirectionURI.scope_flags.toObject(), []);
    });

    it('has virtual properties', function () {
        var oauthRedirectionURI = new OauthRedirectionURI();

        oauthRedirectionURI.uri = 'http://bar.com';

        assert.strictEqual(oauthRedirectionURI.needs_client_secret, true);
    });

    it('validates that required fields are set', function (done) {
        var oauthRedirectionURI = new OauthRedirectionURI();

        oauthRedirectionURI.validate(function (err) {
            /* Make sure model throws error 
               when required fields are not set */

            requiredFields.forEach(function (field) {
                assert.strictEqual(err.errors[field].name, 'ValidatorError');
            });

            /* Make sure model validation pass 
               when all required fields are set */

            validOauthRedirectionURI(oauthRedirectionURI).validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates URI', function (done) {
        async.auto({
            invalidURI: function (cb) {
                var oauthRedirectionURI = validOauthRedirectionURI();

                oauthRedirectionURI.uri = 'bar';

                oauthRedirectionURI.validate(function (err) {
                    assert.strictEqual(err.errors.uri.name, 'ValidatorError');

                    cb();
                });
            },

            URITooLong: function (cb) {
                var oauthRedirectionURI = validOauthRedirectionURI();

                oauthRedirectionURI.uri = 'http://'
                                        + new Array(config.EVENID_OAUTH_REDIRECTION_URIS
                                                          .MAX_LENGTHS
                                                          .URI + 2).join('a')
                                        + '.com';

                oauthRedirectionURI.validate(function (err) {
                    assert.strictEqual(err.errors.uri.name, 'ValidatorError');

                    cb();
                });
            },

            URIWithoutProtocol: function (cb) {
                var oauthRedirectionURI = validOauthRedirectionURI();

                oauthRedirectionURI.uri = 'www.bar.com';

                oauthRedirectionURI.validate(function (err) {
                    assert.strictEqual(err.errors.uri.name, 'ValidatorError');

                    cb();
                });
            },

            URIWithQueryString: function (cb) {
                var oauthRedirectionURI = validOauthRedirectionURI();

                oauthRedirectionURI.uri = 'http://bar.com?bar=bar';

                oauthRedirectionURI.validate(function (err) {
                    assert.ok(!err);

                    cb();
                });
            },

            URIWithHash: function (cb) {
                var oauthRedirectionURI = validOauthRedirectionURI();

                oauthRedirectionURI.uri = 'http://bar.com#bar';

                oauthRedirectionURI.validate(function (err) {
                    assert.strictEqual(err.errors.uri.name, 'ValidatorError');

                    cb();
                });
            }
        }, function (err, results) {
            var oauthRedirectionURI = validOauthRedirectionURI();

            /* Make sure model validation 
               pass when URI is valid */

            oauthRedirectionURI.uri = 'http://bar.com';

            oauthRedirectionURI.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates response type', function (done) {
        var oauthRedirectionURI = validOauthRedirectionURI();

        oauthRedirectionURI.response_type = 'bar';

        oauthRedirectionURI.validate(function (err) {
            assert.strictEqual(err.errors.response_type.name, 'ValidatorError');

            /* Make sure model validation pass 
               when response type is valid */

            oauthRedirectionURI.response_type = 'code';

            oauthRedirectionURI.validate(function (err) {
                assert.ok(!err);

                oauthRedirectionURI.response_type = 'token';

                oauthRedirectionURI.validate(function (err) {
                    assert.ok(!err);

                    done();
                });
            });
        });
    });

    it('ensures that response type may be '
       + 'set to `token` only for `https` URI', function (done) {
        
        var oauthRedirectionURI = validOauthRedirectionURI();

        oauthRedirectionURI.uri = 'http://bar.com'
        oauthRedirectionURI.response_type = 'token';

        oauthRedirectionURI.validate(function (err) {
            assert.strictEqual(err.errors.response_type.name, 'ValidatorError');

            /* Make sure model validation pass 
               when URI is set to an `https` URL */

            oauthRedirectionURI.uri = 'https://bar.com';

            oauthRedirectionURI.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates scope', function (done) {
        var oauthRedirectionURI = validOauthRedirectionURI();

        oauthRedirectionURI.scope = ['bar'];

        oauthRedirectionURI.validate(function (err) {
            assert.strictEqual(err.errors.scope.name, 'ValidatorError');

            /* Make sure model validation
               pass when scope is valid */

            oauthRedirectionURI.scope = ['emails', 'first_name'];

            oauthRedirectionURI.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates scope flags', function (done) {
        var oauthRedirectionURI = new validOauthRedirectionURI();

        oauthRedirectionURI.scope_flags = ['bar'];

        oauthRedirectionURI.validate(function (err) {
            assert.strictEqual(err.errors.scope_flags.name, 'ValidatorError');

            /* Make sure model validation 
               pass when scope flags are valid */

            oauthRedirectionURI.scope_flags = ['mobile_phone_number'];

            oauthRedirectionURI.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates that clients cannot have multiple '
       + 'redirection uris with same `uri` field', function (done) {
        
        var oauthRedirectionURI = new validOauthRedirectionURI();
        var client = null;
        var uri = null;

        client = oauthRedirectionURI.client
        uri = oauthRedirectionURI.uri;

        oauthRedirectionURI.save(function (err) {
            if (err) {
                return done(err);
            }

            oauthRedirectionURI = new validOauthRedirectionURI();

            // Reuse the same client and uri
            oauthRedirectionURI.client = client;
            oauthRedirectionURI.uri = uri;

            oauthRedirectionURI.save(function (err) {
                assert.ok(isUniqueIndexError(err));

                done();
            });
        });
    });

    it('formats uri before save', function (done) {
        var oauthRedirectionURI = new validOauthRedirectionURI();

        oauthRedirectionURI.uri = 'http://localhost:5200/';

        oauthRedirectionURI.save(function (err, oauthRedirectionURI) {
            if (!err) {
                return done(err);
            }

            // Remove port and trailing slashes
            assert.strictEqual(oauthRedirectionURI.uri, 'http://localhost');

            done();
        });
    });

    it('sets `needs_client_secret` '
       + 'to `true` for website uri', function (done) {
        
        var oauthRedirectionURI = new validOauthRedirectionURI();

        oauthRedirectionURI.uri = 'http://bar.com';

        oauthRedirectionURI.save(function (err, oauthRedirectionURI) {
            if (!err) {
                return done(err);
            }

            // Remove port and trailing slashes
            assert.strictEqual(oauthRedirectionURI.needs_client_secret, true);

            done();
        });
    });

    it('sets `needs_client_secret` '
       + 'to `false` for mobile app uri', function (done) {

        var oauthRedirectionURI = new validOauthRedirectionURI();

        oauthRedirectionURI.uri = 'myapp://bar';

        oauthRedirectionURI.save(function (err, oauthRedirectionURI) {
            if (!err) {
                return done(err);
            }

            // Remove port and trailing slashes
            assert.strictEqual(oauthRedirectionURI.needs_client_secret, false);

            done();
        });
    });

    it('sets `needs_client_secret` '
       + 'to `false` for `localhost` uri', function (done) {

        var oauthRedirectionURI = new validOauthRedirectionURI();

        oauthRedirectionURI.uri = 'http://localhost';

        oauthRedirectionURI.save(function (err, oauthRedirectionURI) {
            if (!err) {
                return done(err);
            }

            // Remove port and trailing slashes
            assert.strictEqual(oauthRedirectionURI.needs_client_secret, false);

            done();
        });
    });

    it('sets `needs_client_secret` to `false` for '
       + '`urn:ietf:wg:oauth:2.0:oob` uri', function (done) {

        var oauthRedirectionURI = new validOauthRedirectionURI();

        oauthRedirectionURI.uri = 'urn:ietf:wg:oauth:2.0:oob';

        oauthRedirectionURI.save(function (err, oauthRedirectionURI) {
            if (!err) {
                return done(err);
            }

            // Remove port and trailing slashes
            assert.strictEqual(oauthRedirectionURI.needs_client_secret, false);

            done();
        });
    });

    it('sets `needs_client_secret` to `false` for '
       + '`urn:ietf:wg:oauth:2.0:oob:auto` uri', function (done) {

        var oauthRedirectionURI = new validOauthRedirectionURI();

        oauthRedirectionURI.uri = 'urn:ietf:wg:oauth:2.0:oob:auto';

        oauthRedirectionURI.save(function (err, oauthRedirectionURI) {
            if (!err) {
                return done(err);
            }

            // Remove port and trailing slashes
            assert.strictEqual(oauthRedirectionURI.needs_client_secret, false);

            done();
        });
    });
});