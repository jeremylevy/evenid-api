var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var updateOauthUserStatus = require('../../../models/actions/updateOauthUserStatus');

var compareArray = require('../../../testUtils/lib/compareArray');

var createOauthUserStatus = require('../../../testUtils/db/createOauthUserStatus');


var findOauthUserStatus = require('../../../testUtils/db/findOauthUserStatus');

var firstUpdatedEmails = firstUpdatedPhoneNumbers = firstUpdatedAddresses = [{
    id: mongoose.Types.ObjectId(),
    status: 'new',
    updated_fields: []
}];

var getOauthUserStatus = function (status, updatedFields, 
                                   useTestAccount, clientID, userID, cb) {
    
    createOauthUserStatus.call({
        insert: {
            updated_fields: updatedFields,

            updated_emails: firstUpdatedEmails,

            updated_phone_numbers: firstUpdatedPhoneNumbers,

            updated_addresses: firstUpdatedPhoneNumbers
        }
    }, clientID, userID, status, 
    useTestAccount, function (err, userStatus) {

        if (err) {
            return cb(err);
        }

        cb(null, userStatus);
    });
};

var preventsUserStatusUpdateFromTo = function (from, to, cb) {
    var context = this;

    var clientID = mongoose.Types.ObjectId();
    var userID = mongoose.Types.ObjectId();

    var updatedFields = ['emails'];

    async.auto({
        // First we need to create an user status
        createOauthUserStatus: function (cb) {
            var useTestAccount = context.useTestAccount || false;

            getOauthUserStatus(from, updatedFields, useTestAccount, 
                               clientID, userID, function (err, userStatus) {

                if (err) {
                    return cb(err);
                }

                cb(null, userStatus);
            });
        },

        // Then we try to update it
        updateOauthUserStatus: ['createOauthUserStatus', function (cb) {
            var update = {
                status: to
            };

            if (to === 'existing_user_after_test') {
                update.use_test_account = false;
            }

            if (context.update) {
                Object.keys(context.update).forEach(function (key) {
                    update[key] = context.update[key];
                });
            }

            updateOauthUserStatus([clientID], userID, update, function (err) {
                if (err) {
                    return cb(err);
                }

                 if (to !== 'existing_user_after_test') {
                    if (context.update) {
                        return cb();
                    }
                }

                cb();
            });
        }],

        assertUpdateWasPrevented: ['updateOauthUserStatus', function (cb) {
            findOauthUserStatus([clientID], [userID], 
                                function (err, oauthUserStatuss) {

                var oauthUserStatus = !err && oauthUserStatuss[0];
                
                if (err) {
                    return cb(err);
                }

                // Make sure status update was prevented
                assert.strictEqual(oauthUserStatus.status, from);

                // Make sure `use_test_account` was set to `false`
                // when to equals to `existing_user_after_test` 
                // even if status update has not occurred
                if (to === 'existing_user_after_test') {
                    assert.strictEqual(oauthUserStatus.use_test_account, false);
                }

                cb(null, oauthUserStatus);
            });
        }]
    }, function (err, results) {
        var oauthUserStatus = results.assertUpdateWasPrevented;

        if (err) {
            return cb(err);
        }

        cb(null, oauthUserStatus);
    });
};

describe('models.actions.updateOauthUserStatus', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing invalid clients ID', function () {
        [null, undefined, {}, ['bar', 'foo'], 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                updateOauthUserStatus(v, 
                                      mongoose.Types.ObjectId(),
                                      {}, 
                                      function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid user ID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                updateOauthUserStatus([mongoose.Types.ObjectId()], 
                                       v,
                                       {},
                                       function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-object value as update', function () {
        [null, undefined, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                updateOauthUserStatus([mongoose.Types.ObjectId()], 
                                       mongoose.Types.ObjectId(),
                                       v,
                                       function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                updateOauthUserStatus([mongoose.Types.ObjectId()], 
                                      mongoose.Types.ObjectId(),
                                      {},
                                      v);
            }, assert.AssertionError);
        });
    });

    it('prevents updated entities overwrite when empty fields', function (done) {
        var clientID = mongoose.Types.ObjectId();
        var userID = mongoose.Types.ObjectId();

        var updatedFields = ['emails', 'phone_numbers', 'addresses'];

        async.auto({
            // First we need to create an user status
            createOauthUserStatus: function (cb) {
                var useTestAccount = false;

                getOauthUserStatus('existing_user', updatedFields, useTestAccount, 
                                   clientID, userID, function (err, userStatus) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null, userStatus);
                });
            },

            // Then we update it
            updateOauthUserStatus: ['createOauthUserStatus',
                                    function (cb) {
                
                updateOauthUserStatus([clientID], userID, {
                    /* Make sure it does not overwrite `updated_*` 
                       fields when empty arrays were passed */
                    updated_fields: [],
                    updated_emails: [],
                    updated_phone_numbers: [],
                    updated_addresses: []
                }, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            findUpdatedUserStatus: ['updateOauthUserStatus', function (cb) {
                findOauthUserStatus([clientID], 
                                    [userID], 
                                    function (err, updatedUserStatus) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, updatedUserStatus);
                });
            }]
        }, function (err, results) {
            var updatedUserStatus = results && results.findUpdatedUserStatus;

            if (err) {
                return done(err);
            }

            updatedUserStatus.forEach(function (userStatus) {
                /* Make sure it does not overwrite `updated_*` 
                   fields when empty arrays were passed */
                assert.strictEqual(userStatus.updated_fields.length, updatedFields.length);
                assert.strictEqual(userStatus.updated_emails.length, 1);
                assert.strictEqual(userStatus.updated_phone_numbers.length, 1);
                assert.strictEqual(userStatus.updated_addresses.length, 1);

                assert.ok(compareArray(userStatus.updated_emails.toObject(),
                                       firstUpdatedEmails));

                assert.ok(compareArray(userStatus.updated_phone_numbers.toObject(),
                                       firstUpdatedPhoneNumbers));

                assert.ok(compareArray(userStatus.updated_addresses.toObject(),
                                       firstUpdatedAddresses));
            });

            done();
        });
    });
    
    it('overwrites updated entities when empty '
       + 'fields are sent with `$set` operator', function (done) {
        
        var clientID = mongoose.Types.ObjectId();
        var userID = mongoose.Types.ObjectId();

        var updatedFields = ['emails', 'phone_numbers', 'addresses'];

        async.auto({
            // First we need to create an user status
            createOauthUserStatus: function (cb) {
                var useTestAccount = false;

                getOauthUserStatus('existing_user', updatedFields, useTestAccount, 
                                   clientID, userID, function (err, userStatus) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null, userStatus);
                });
            },

            // Then we update it
            updateOauthUserStatus: ['createOauthUserStatus',
                                    function (cb) {
                
                updateOauthUserStatus([clientID], userID, {
                    /* Make sure it does overwrite `updated_*` 
                       fields when `$set` operator was used */
                    $set: {
                        updated_fields: [],
                        updated_emails: [],
                        updated_phone_numbers: [],
                        updated_addresses: []
                    }
                }, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            findUpdatedUserStatus: ['updateOauthUserStatus', function (cb) {
                findOauthUserStatus([clientID], 
                                    [userID], 
                                    function (err, updatedUserStatus) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, updatedUserStatus);
                });
            }]
        }, function (err, results) {
            var updatedUserStatus = results && results.findUpdatedUserStatus;

            if (err) {
                return done(err);
            }

            updatedUserStatus.forEach(function (userStatus) {
                /* Make sure it does overwrite `updated_*` 
                   fields when `$set` operator was used */
                assert.strictEqual(userStatus.updated_fields.length, 0);
                assert.strictEqual(userStatus.updated_emails.length, 0);
                assert.strictEqual(userStatus.updated_phone_numbers.length, 0);
                assert.strictEqual(userStatus.updated_addresses.length, 0);
            });

            done();
        });
    });
    
    it('prevents update from `new_user` '
       + 'to `existing_user_after_update`', function (done) {
        
        preventsUserStatusUpdateFromTo('new_user', 
                                       'existing_user_after_update', 
                                       done);
    });

    it('prevents update from `new_user` '
       + 'to `existing_user_after_test`', function (done) {
        
        preventsUserStatusUpdateFromTo.call({
            useTestAccount: true
        }, 'new_user', 'existing_user_after_test', done);
    });

    it('prevents status update but not '
       + 'updated entities update', function (done) {

        var entityID = mongoose.Types
                               .ObjectId()
                               .toString();

        var entity = 'addresses';

        var secondUpdatedAddresses = [{
            id: entityID,
            status: 'new',
            updated_fields: []
        }];
        
        preventsUserStatusUpdateFromTo.call({
            useTestAccount: true,
            update: {
                updated_fields: [entity],
                updated_addresses: secondUpdatedAddresses
            }
        }, 'existing_user_after_test', 
        'existing_user_after_update', function (err, oauthUserStatus) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(oauthUserStatus.status, 'existing_user_after_test');

            assert.ok(oauthUserStatus.updated_fields.indexOf(entity) !== -1);

            assert.strictEqual(oauthUserStatus.updated_addresses.length, 2);

            assert.ok(compareArray(oauthUserStatus.updated_addresses.toObject(),
                                   firstUpdatedAddresses.concat(secondUpdatedAddresses)));

            done();
        });
    });

    it('updates user status and push updated entities', function (done) {
        var clientID = mongoose.Types.ObjectId();
        var client2ID = mongoose.Types.ObjectId();

        var userID = mongoose.Types.ObjectId();

        var updatedFields = [
            'emails', 
            'phone_numbers', 
            'first_name', 
            'last_name'
        ];

        var secondUpdatedEmails = [{
            id: mongoose.Types.ObjectId(),
            status: 'updated',
            updated_fields: ['address']
        }];

        var secondUpdatedPhoneNumbers = [{
            id: mongoose.Types.ObjectId(),
            status: 'updated',
            updated_fields: ['number']
        }];

        var secondUpdatedAddresses = [{
            id: mongoose.Types.ObjectId(),
            status: 'updated',
            updated_fields: ['address_line_1']
        }];

        async.auto({
            // First we need to create an user status
            createOauthUserStatus: function (cb) {
                var useTestAccount = false;

                getOauthUserStatus('existing_user', updatedFields, useTestAccount, 
                                   clientID, userID, function (err, userStatus) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null, userStatus);
                });
            },

            // Create another status to make sure 
            // it may updates multiple user status
            createOauthUserStatus2: function (cb) {
                var useTestAccount = false;

                getOauthUserStatus('existing_user',
                                   updatedFields, useTestAccount, 
                                   client2ID, userID, function (err, userStatus) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null, userStatus);
                });
            },

            // Then we update it
            updateOauthUserStatus: ['createOauthUserStatus', 
                                    'createOauthUserStatus2',
                                    function (cb) {
                
                updateOauthUserStatus([clientID, client2ID], userID, {
                    // Make sure it updates the user status
                    status: 'existing_user_after_update',

                    // Make sure it prevents duplicates and push values
                    updated_fields: updatedFields.slice(0, 2),

                    /* Make sure it push `updated_*` fields */
                    updated_emails: secondUpdatedEmails,

                    updated_phone_numbers: secondUpdatedPhoneNumbers,

                    updated_addresses: secondUpdatedAddresses
                }, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            findUpdatedUserStatus: ['updateOauthUserStatus', function (cb) {
                findOauthUserStatus([clientID, client2ID], 
                                    [userID], 
                                    function (err, updatedUserStatus) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, updatedUserStatus);
                });
            }]
        }, function (err, results) {
            var updatedUserStatus = results && results.findUpdatedUserStatus;

            if (err) {
                return done(err);
            }

            // Make sure it may updates multiple user status
            updatedUserStatus.forEach(function (userStatus) {
                // Make sure user status was updated
                assert.strictEqual(userStatus.status, 'existing_user_after_update');

                // Make sure it prevents duplicates 
                // and push values for `updated_fields` field
                assert.ok(compareArray(userStatus.updated_fields, 
                                       updatedFields));

                /* Make sure it push `updated_*` fields */

                assert.strictEqual(userStatus.updated_emails.length, 2);
                assert.strictEqual(userStatus.updated_phone_numbers.length, 2);
                assert.strictEqual(userStatus.updated_addresses.length, 2);

                assert.ok(compareArray(userStatus.updated_emails.toObject(),
                                       firstUpdatedEmails.concat(secondUpdatedEmails)));

                assert.ok(compareArray(userStatus.updated_phone_numbers.toObject(),
                                       firstUpdatedPhoneNumbers.concat(secondUpdatedPhoneNumbers)));

                assert.ok(compareArray(userStatus.updated_addresses.toObject(),
                                       firstUpdatedAddresses.concat(secondUpdatedAddresses)));
            });

            done();
        });
    });
});