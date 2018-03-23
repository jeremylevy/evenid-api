var assert = require('assert');
var mongoose = require('mongoose');

var async = require('async');

var db = require('../../../../../../models');

var assertPhoneTypeMayBeUpdated = require('../../../../../../models/middlewares/pre/save/phoneNumber/assertPhoneTypeMayBeUpdated');

var createPhoneNumber = require('../../../../../../testUtils/db/createPhoneNumber');
var createOauthEntityID = require('../../../../../../testUtils/db/createOauthEntityID');

var findOauthEntitiesID = require('../../../../../../testUtils/db/findOauthEntitiesID');

var InvalidRequestError = require('../../../../../../errors/types/InvalidRequestError');

describe('models.middlewares.pre.save.phoneNumber.assertPhoneTypeMayBeUpdated', function () {
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
                assertPhoneTypeMayBeUpdated.call(v, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function as next', function (done) {
        createPhoneNumber(function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            [null, undefined, {}, [], '', 0.0].forEach(function (v) {
                assert.throws(function () {
                    assertPhoneTypeMayBeUpdated.call(phoneNumber, v);
                }, assert.AssertionError);
            });

            done();
        });
    });

    it('always passes when phone number is new', function (done) {
        var phoneNumber = new db.models.PhoneNumber({
            user: mongoose.Types.ObjectId(),
            number: '0649855847',
            // Update phone type
            phone_type: 'mobile',
            country: 'FR',
            _old_phone_type: 'landline',
            // Add one client which 
            // wants this phone type
            _granted_authorizations: [
                {
                    scope_flags: ['landline_phone_number'],
                    client: {
                        id: mongoose.Types.ObjectId()
                    }
                }
            ]
        });

        assertPhoneTypeMayBeUpdated.call(phoneNumber, done);
    });

    it('always passes when phone '
       + 'type is not updated', function (done) {
       
        createPhoneNumber(function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            phoneNumber.number = '0649855847';
            phoneNumber._old_phone_type = 'landline';
            phoneNumber._granted_authorizations = [
                {
                    scope_flags: ['landline_phone_number'],
                    client: {
                        id: mongoose.Types.ObjectId()
                    }
                }
            ];

            assertPhoneTypeMayBeUpdated.call(phoneNumber, done);
        });
    });

    it('always passes when granted '
       + 'authorizations is empty', function (done) {
        
        createPhoneNumber(function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            phoneNumber.number = '0649855847';
            
            phoneNumber.phone_type = phoneNumber.phone_type === 'landline' 
                ? 'mobile' 
                : 'landline';
            
            phoneNumber._granted_authorizations = [];

            assertPhoneTypeMayBeUpdated.call(phoneNumber, done);
        });
    });

    it('always passes when old phone '
       + 'type equals new phone type', function (done) {
        
        createPhoneNumber(function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            phoneNumber.number = phoneNumber.phone_type === 'landline' 
                ? '0649855847' 
                : '0491374837';
            
            phoneNumber.phone_type = phoneNumber.phone_type === 'landline' 
                ? 'mobile' 
                : 'landline';
            
            phoneNumber._old_phone_type = phoneNumber.phone_type;
            
            phoneNumber._granted_authorizations = [
                {
                    scope_flags: [phoneNumber.phone_type + '_phone_number'],
                    client: {
                        id: mongoose.Types.ObjectId()
                    }
                }
            ];

            assertPhoneTypeMayBeUpdated.call(phoneNumber, done);
        });
    });

    it('passes invalid request error '
       + 'when client ask for old phone type', function (done) {
        
        createPhoneNumber(function (err, phoneNumber) {
            if (err) {
                return done(err);
            }
            
            phoneNumber.phone_type = phoneNumber.phone_type === 'landline' 
                ? 'mobile' 
                : 'landline';
            
            phoneNumber._old_phone_type = phoneNumber.phone_type === 'landline' 
                ? 'mobile' 
                : 'landline';
            
            phoneNumber._granted_authorizations = [
                {
                    scope_flags: [phoneNumber._old_phone_type + '_phone_number'],
                    client: {
                        id: mongoose.Types.ObjectId()
                    }
                }
            ];

            assertPhoneTypeMayBeUpdated.call(phoneNumber, function (err) {
                assert.ok(err instanceof InvalidRequestError);

                done();
            });
        });
    });

    it('sets phone type to old phone type '
       + 'when new phone type is set do `undefined` '
       + 'and client wants mobile or landline', function (done) {
        
        createPhoneNumber(function (err, phoneNumber) {
            if (err) {
                return done(err);
            }
            
            phoneNumber.phone_type = 'unknown'
            
            phoneNumber._old_phone_type = phoneNumber.phone_type;
            
            phoneNumber._granted_authorizations = [
                {
                    scope_flags: [phoneNumber.phone_type + '_phone_number'],
                    client: {
                        id: mongoose.Types.ObjectId()
                    }
                }
            ];

            assertPhoneTypeMayBeUpdated.call(phoneNumber, function (err) {
                assert.ok(!err);

                assert.strictEqual(phoneNumber.phone_type,
                                   phoneNumber._old_phone_type);

                done();
            });
        });
    });

    it('update oauth entities ID when old '
       + 'phone type equals to unknown, new '
       + 'phone type equals to landline or mobile and '
       + 'client wants unknown phone number', function (done) {
        
        var userID = mongoose.Types.ObjectId();
        var clientID = mongoose.Types.ObjectId();

        async.auto({
            createPhoneNumber: function (cb) {
                createPhoneNumber.call({
                    user: userID
                }, function (err, phoneNumber) {
                    if (err) {
                        return cb(err);
                    }
                    
                    phoneNumber.phone_type = phoneNumber.phone_type === 'landline' 
                        ? 'mobile' 
                        : 'landline';
                    
                    phoneNumber._old_phone_type = 'unknown';
                    
                    phoneNumber._granted_authorizations = [
                        {
                            // When client wants unknown 
                            // phone number there is no 
                            // phone scope flags
                            scope_flags: [],
                            client: {
                                id: clientID
                            }
                        }
                    ];

                    cb(null, phoneNumber);
                });
            },

            createOauthEntityID: ['createPhoneNumber', function (cb, results) {
                var phoneNumber = results.createPhoneNumber;

                createOauthEntityID({
                    user: userID,
                    client: clientID,
                    real_id: phoneNumber._id,
                    fake_id: mongoose.Types.ObjectId(),
                    entities: ['unknown_phone_numbers'],
                }, function (err, oauthEntityID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthEntityID);
                });
            }]
        }, function (err, results) {
            var phoneNumber = results.createPhoneNumber;

            if (err) {
                return done(err);
            }

            assertPhoneTypeMayBeUpdated.call(phoneNumber, function (err) {
                if (err) {
                    return done(err);
                }

                findOauthEntitiesID({
                    user: userID,
                    client: clientID,
                    real_id: phoneNumber._id
                }, function (err, oauthEntityIDs) {
                    var oauthEntityID = oauthEntityIDs[0];

                    if (err) {
                        return done(err);
                    }

                    assert.strictEqual(oauthEntityID.entities.length, 2);
                    
                    assert.deepEqual(oauthEntityID.entities.toObject(),
                                     ['unknown_phone_numbers',
                                      phoneNumber.phone_type + '_phone_numbers']);

                    done();
                });
            });
        });
    });

    it('update oauth entities ID when '
       + 'client ask for updated phone type', function (done) {
        
        var userID = mongoose.Types.ObjectId();
        var clientID = mongoose.Types.ObjectId();

        async.auto({
            createPhoneNumber: function (cb) {
                createPhoneNumber.call({
                    user: userID
                }, function (err, phoneNumber) {
                    if (err) {
                        return cb(err);
                    }

                    phoneNumber.phone_type = phoneNumber.phone_type === 'landline' 
                        ? 'mobile' 
                        : 'landline';
                    
                    phoneNumber._old_phone_type = phoneNumber.phone_type === 'landline' 
                        ? 'mobile' 
                        : 'landline';
                    
                    phoneNumber._granted_authorizations = [
                        {
                            scope_flags: [phoneNumber.phone_type + '_phone_number'],
                            client: {
                                id: clientID
                            }
                        }
                    ];

                    cb(null, phoneNumber);
                });
            },

            createOauthEntityID: ['createPhoneNumber', function (cb, results) {
                var phoneNumber = results.createPhoneNumber;

                createOauthEntityID({
                    user: userID,
                    client: clientID,
                    real_id: phoneNumber._id,
                    fake_id: mongoose.Types.ObjectId(),
                    entities: ['unknown_phone_numbers'],
                }, function (err, oauthEntityID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthEntityID);
                });
            }]
        }, function (err, results) {
            var phoneNumber = results.createPhoneNumber;

            if (err) {
                return done(err);
            }

            assertPhoneTypeMayBeUpdated.call(phoneNumber, function (err) {
                if (err) {
                    return done(err);
                }

                findOauthEntitiesID({
                    user: userID,
                    client: clientID,
                    real_id: phoneNumber._id
                }, function (err, oauthEntityIDs) {
                    if (err) {
                        return done(err);
                    }

                    assert.strictEqual(oauthEntityIDs[0].entities.length, 2);
                    
                    assert.deepEqual(oauthEntityIDs[0].entities.toObject(),
                                     ['unknown_phone_numbers',
                                      phoneNumber.phone_type + '_phone_numbers']);

                    done();
                });
            });
        });
    });
});