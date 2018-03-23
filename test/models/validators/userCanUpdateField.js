var assert = require('assert');

var mongoose = require('mongoose');

var config = require('../../../config');

var userCanUpdateField = require('../../../models/validators/userCanUpdateField');

var createUser = require('../../../testUtils/db/createUser');

var emptyValues = [null, undefined, {}, [], ''];
var valuesToTestAgainst = emptyValues.concat(['bar']);

describe('models.validators.userCanUpdateField', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
    
    it('throws an exception when passing '
       + 'non/empty-string value as field', function () {
        
        [null, undefined, {}, 9, '', []].forEach(function (v) {
            assert.throws(function () {
                userCanUpdateField(v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'non-user as context', function () {
        
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                userCanUpdateField('first_name').call(v, 'John');
            }, assert.AssertionError);
        });
    });

    it('throws an exception on update '
       + 'if user `_granted_authorizations` field '
       + 'was not populated', function (done) {
        
        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            valuesToTestAgainst.forEach(function (v) {
                assert.throws(function () {
                    userCanUpdateField('first_name').call(user, v);
                }, Error);
            });

            done();
        });
    });

    it('always returns `true` on signup', function (done) {
        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            user.isNew = true;
            // Make sure it returns `true` because user is new 
            // not because there are not granted authorizations
            user._granted_authorizations = [
                {
                    scope: ['first_name'],
                    entities: {
                        emails: [],
                        phone_numbers: [],
                        addresses: []
                    }
                }
            ];

            valuesToTestAgainst.forEach(function (v) {
                assert.strictEqual(userCanUpdateField('first_name').call(user, v),
                                   true);
            });

            done();
        });
    });

    it('returns `true` on update if no client wants field', function (done) {
        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            user._granted_authorizations = [
                {
                    scope: ['emails', 'last_name'],
                    entities: {
                        emails: [mongoose.Types.ObjectId()],
                        phone_numbers: [],
                        addresses: []
                    }
                }, 

                {
                    scope: ['phone_numbers'],
                    entities: {
                        emails: [],
                        phone_numbers: [mongoose.Types.ObjectId()],
                        addresses: []
                    }
                }
            ];

            valuesToTestAgainst.forEach(function (v) {
                assert.strictEqual(userCanUpdateField('first_name').call(user, v),
                                   true);
            });

            done();
        });
    });

    it('returns `false` on update if some clients '
       + 'want field and user unset field', function (done) {
        
        createUser(function (err, user) {
            if (err) {
                return done(err);
            }
            
            user._granted_authorizations = [
                {
                    scope: ['emails', 'last_name'],
                    entities: {
                        emails: [mongoose.Types.ObjectID],
                        phone_numbers: [],
                        addresses: []
                    }
                }, 

                {
                    scope: ['phone_numbers'],
                    entities: {
                        emails: [],
                        phone_numbers: [mongoose.Types.ObjectId()],
                        addresses: []
                    }
                }, 

                {
                    scope: ['first_name'],
                    entities: {
                        emails: [],
                        phone_numbers: [],
                        addresses: []
                    }
                }
            ];

            emptyValues.forEach(function (v) {
                assert.strictEqual(userCanUpdateField('first_name').call(user, v),
                                   false);
            });

            done();
        });
    });
});