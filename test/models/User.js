var assert = require('assert');
var Type = require('type-of-is');

var crypto = require('crypto');
var async = require('async');

var mongoose = require('mongoose');

var config = require('../../config');

var db = require('../../models');

var populateGrantedAuthorizations = require('../../models/middlewares/pre/validate/populateGrantedAuthorizations');

var findOauthEntitiesID = require('../../models/middlewares/pre/save/findOauthEntitiesID');
var sendNotificationToClients = require('../../models/middlewares/pre/save/sendNotificationToClients');

var updateOauthUserStatus = require('../../models/middlewares/pre/save/updateOauthUserStatus');
var unsetHiddenProperties = require('../../models/middlewares/pre/save/unsetHiddenProperties');

var hashPassword = require('../../models/middlewares/pre/save/user/hashPassword');
var unsetEmptyProperties = require('../../models/middlewares/pre/save/user/unsetEmptyProperties');

var UserSchema = require('../../models/User');

var createHash = require('../../libs/createHash');

var isUniqueIndexError = require('../../models/validators/isUniqueIndexError');

var User = db.models.User;

var compareArray = require('../../testUtils/lib/compareArray');

var createEmail = require('../../testUtils/db/createEmail');
var createUser = require('../../testUtils/db/createUser');

var createUserAuthorization = require('../../testUtils/db/createUserAuthorization');

describe('models.User', function () {
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
        var toObjectOpts = UserSchema.get('toObject');
        var validHideOpt = [
            '_id', '__v',
            'password',
            '_granted_authorizations',
            '_oauth_entities_id'
        ];

        // Transform function is set for all 
        // models in the index function
        assert.ok(Type.is(toObjectOpts.transform, Function));
        
        assert.ok(compareArray(toObjectOpts.hide.split(' '),
                  validHideOpt));
        
        assert.strictEqual(toObjectOpts.virtuals, true);
        assert.strictEqual(toObjectOpts.getters, true);
    });

    it('applies default values', function () {
        var user = new User();

        assert.strictEqual(user.is_test_account, false);
        assert.strictEqual(user.auto_login, true);
    });

    it('uses custom getters and setters', function () {
        var profilPhotoHash = createHash('sha1', mongoose.Types.ObjectId().toString());
        var profilPhoto = config.EVENID_AWS.CLOUDFRONT.URLS.UPLOADS + '/users/profil-photos/' + profilPhotoHash;
        var user = new User({
            first_name: 'jOhN',
            last_name: 'dUrAnD',
            profil_photo: profilPhoto
        });

        // Check that first and last name
        // where `first letter camelcased`
        assert.strictEqual(user.first_name, 'John');
        assert.strictEqual(user.last_name, 'Durand');

        // Check that profil photo setter has set
        // profil photo ID in `profil_photo` field
        assert.strictEqual(user.toObject({
            getters: false
        }).profil_photo, profilPhotoHash);

        // Check that profil photo getter
        // reconstruct the full URL
        assert.strictEqual(user.profil_photo, 
                           config.EVENID_AWS.CLOUDFRONT.URLS.UPLOADS 
                           + '/users/profil-photos/' 
                           + profilPhotoHash);
    });
    
    // `email` (singular) and `gravatar`
    it('has virtual properties', function (done) {
        async.auto({
            createEmail: function (cb) {
                createEmail(function (err, email) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, email);
                });
            },

            // Make sure `email` virtual property
            // only returns main address
            createEmail2: function (cb) {
                createEmail.call({
                    isMainAddress: false
                }, function (err, email) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, email);
                });
            },

            createUser: ['createEmail', 'createEmail2', function (cb, results) {
                var email = results.createEmail;
                var email2 = results.createEmail2;

                createUser.call({
                    user: {
                        emails: [email.id, email2.id]
                    }
                }, function (err, user) {
                    if (err) {
                        return done(err);
                    }

                    // Make sure virtuals return `undefined` 
                    // when emails were not populated
                    assert.strictEqual(user.email, undefined);
                    assert.strictEqual(user.gravatar, undefined);

                    user.populate('emails', function (err, user) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, user);
                    });
                });
            }]
        }, function (err, results) {
            var user = results.createUser;
            var email = results.createEmail;
            var gravatarReg = null;

            if (err) {
                return done(err);
            }
            
            gravatarReg = new RegExp('^' + config.EVENID_AWS.CLOUDFRONT.URLS.UPLOADS 
                                         + '/users/profil-photos/default'
                                   + '$');

            // Make sure it has email property 
            //and it equals to main address
            assert.strictEqual(user.email, email.address);

            // Make sure it has gravatar virtual
            assert.ok(gravatarReg.test(user.gravatar));

            done();
        });
    });

    it('has pre validate middlewares registered', function () {
        var user = new User();
        
        assert.strictEqual(user._pres.$__original_validate[0].toString(),
                           populateGrantedAuthorizations('users').toString());
    });

    it('validates simple user fields', function (done) {
        var user = new User({
            password: 'foo',
            // '+2': for first and last elements
            first_name: new Array(config.EVENID_USERS.MAX_LENGTHS.FIRST_NAME + 2).join('a'),
            last_name: new Array(config.EVENID_USERS.MAX_LENGTHS.LAST_NAME + 2).join('a'),
            nickname: new Array(config.EVENID_USERS.MAX_LENGTHS.NICKNAME + 2).join('a'),
            place_of_birth: 'bar',
            nationality: 'bar',
            timezone: 'bar'
        });

        user.validate(function (err) {
            assert.strictEqual(err.errors.password.name, 'ValidatorError');
            
            assert.strictEqual(err.errors.first_name.name, 'ValidatorError');
            assert.strictEqual(err.errors.last_name.name, 'ValidatorError');
            
            assert.strictEqual(err.errors.nickname.name, 'ValidatorError');
            assert.strictEqual(err.errors.place_of_birth.name, 'ValidatorError');
            
            assert.strictEqual(err.errors.nationality.name, 'ValidatorError');
            assert.strictEqual(err.errors.timezone.name, 'ValidatorError');

            /* Make sure model validation pass when all fields
               are valid */

            user.password = user.first_name 
                          = user.last_name
                          = user.nickname 
                          = 'foobar';

            user.place_of_birth = user.nationality = 'FR';

            user.timezone = 'Europe/Paris';

            user.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates that gender is an allowed value', function (done) {
        var user = new User({
            gender: 'foo'
        });

        user.validate(function (err) {
            assert.strictEqual(err.errors.gender.name, 'ValidatorError');

            /* Make sure model validation 
               pass when gender is valid */

            user.gender = 'female';

            user.validate(function (err) {
                assert.ok(!err);

                user.gender = 'male';

                user.validate(function (err) {
                    assert.ok(!err);

                    done();
                });
            });
        });
    });

    // Added after a bug which prevented app 
    // to remove gender by assigning it to an
    // empty string. (The API returned `Gender is not an allowed value.` error)
    it('passes when gender is set to an empty string', function (done) {
        var user = new User({
            gender: ''
        });

        user.validate(function (err) {
            assert.ok(!err);

            done();
        });
    });

    it('validates that profil photo is not set or is an upload hash', function (done) {
        var user = new User({
            profil_photo: 'foo'
        });

        user.validate(function (err) {
            assert.strictEqual(err.errors.profil_photo.name, 'ValidatorError');

            /* Make sure model validation 
               pass when profil photo is valid */

            user.profil_photo = '';

            user.validate(function (err) {
                assert.ok(!err);

                user.profil_photo = createHash('sha1', mongoose.Types.ObjectId().toString());

                user.validate(function (err) {
                    assert.ok(!err);

                    done();
                });
            });
        });
    });

    it('validates date of birth', function (done) {
        var user = new User({
            date_of_birth: 'invalid'
        });

        // Cast error triggered before save
        user.save(function (err) {
            assert.strictEqual(err.name, 'ValidationError');
            assert.strictEqual(err.errors.date_of_birth.name, 'CastError');

            /* Make sure model validation pass 
               when place of birth is valid */

            user.date_of_birth = new Date();

            user.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates that user doesn\'t own client '
       + 'before leaving developer program', function (done) {
        
        var user = new User({
            developer: {
                clients: [mongoose.Types.ObjectId()]
            },
            is_developer: false
        });

        user.validate(function (err) {
            assert.strictEqual(err.errors.is_developer.name, 'ValidatorError');

            /* Make sure model validation pass 
               when user doesn't own any clients */

            user.developer.clients = [];

            user.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates that field is set if client wants it', function (done) {
        var userScope = config.EVENID_OAUTH.VALID_USER_SCOPE;
        // Emails, phone numbers...
        var pluralScope = config.EVENID_OAUTH.PLURAL_SCOPE;

        var userFields = userScope.filter(function (scope) {
            return pluralScope.indexOf(scope) === -1;
        });
        
        async.auto({
            createUser: function (cb) {
                createUser(function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            },

            createUserAuthorization: ['createUser', function (cb, results) {
                var user = results.createUser;

                createUserAuthorization.call({
                    user: user,
                    scope: userFields.slice(0, Math.floor(userFields.length / 2))
                }, function (err, userAuthorization) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, userAuthorization);
                });
            }],

            createUserAuthorization2: ['createUser', function (cb, results) {
                var user = results.createUser;

                createUserAuthorization.call({
                    user: user,
                    scope: userFields.slice(Math.floor(userFields.length / 2))
                }, function (err, userAuthorization) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, userAuthorization);
                });
            }]
        }, function (err, results) {
            var user = results.createUser;
            var userAuthorization = results.createUserAuthorization;
            
            if (err) {
                return done(err);
            }

            // Unset all fields
            userFields.forEach(function (userField) {
                user[userField] = '';
            });

            user.validate(function (err) {
                userFields.forEach(function (userField) {
                    // Profil photo is optional
                    if (userField === 'profil_photo') {
                        return;
                    }

                    assert.strictEqual(err.errors[userField].name, 'ValidatorError');
                });

                done();
            });
        });
    });

    it('validates that nickname is not already used', function (done) {
        var user = new User();
        var nickname = mongoose.Types.ObjectId().toString();

        user.nickname = nickname;

        user.save(function (err) {
            var user = new User();

            if (err) {
                return done(err);
            }

            user.nickname = nickname;

            user.save(function (err) {
                assert.ok(isUniqueIndexError(err));

                done();
            });
        });
    });

    it('has methods', function () {
        var user = new User();

        assert.ok(Type.is(user.comparePassword, Function));
        assert.ok(Type.is(user.own, Function));
        assert.ok(Type.is(user.ownEmail, Function));
        assert.ok(Type.is(user.ownClient, Function));
        assert.ok(Type.is(user.hasProfilPhoto, Function));
        assert.ok(Type.is(user.hasAuthorizedClient, Function));
        assert.ok(Type.is(user.ownAddress, Function));
        assert.ok(Type.is(user.ownPhoneNumber, Function));
    });

    it('has pre save middlewares registered', function () {
        var user = new User();
        var expectedMiddlewares = [
            findOauthEntitiesID('emails').toString(),
            sendNotificationToClients('emails').toString(),
            updateOauthUserStatus('emails').toString(),
            unsetHiddenProperties('emails').toString(),
            unsetEmptyProperties.toString(),
            hashPassword.toString()
        ];

        // May contains private Mongoose functions
        user._pres.$__original_save.forEach(function (middleware) {
            if (middleware.toString() === expectedMiddlewares[0].toString()) {
                expectedMiddlewares = expectedMiddlewares.slice(1);
            }
        });
        
        // Make sure all expected middlewares 
        // were registered in order
        assert.strictEqual(expectedMiddlewares.length, 0);
    });
});