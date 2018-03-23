var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');
var mongoose = require('mongoose');
var moment = require('moment');

var findUserToSetInResponseLocals = require('../../../models/actions/findUserToSetInResponseLocals');

var createUser = require('../../../testUtils/db/createUser');
var createEmail = require('../../../testUtils/db/createEmail');

var validUser = {
    first_name: 'John',
    last_name: 'Rockerfeld',
    nickname: mongoose.Types.ObjectId().toString(), 
    date_of_birth: new Date('1992', '05', '18'),
    gender: 'male',
    place_of_birth: 'FR',
    nationality: 'FR',
    timezone: 'Europe/Paris'
};

describe('models.actions.findUserToSetInResponseLocals', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing non-ObjectID as userID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                findUserToSetInResponseLocals(v, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                findUserToSetInResponseLocals(mongoose.Types.ObjectId().toString(), v);
            }, assert.AssertionError);
        });
    });

    it('returns valid user when user exists', function (done) {
        async.auto({
            createEmail: function (cb) {
                createEmail(function (err, email) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, email);
                });
            },

            createUser: ['createEmail', function (cb, results) {
                var email = results.createEmail;

                validUser.emails = [email.id];

                createUser.call({
                    user: validUser
                }, function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            }],

            findUserToSetInResponseLocals: ['createUser', function (cb, results) {
                var user = results.createUser;

                findUserToSetInResponseLocals(user.id, function (err, user) {
                    if (err) {
                        cb(err);
                    }

                    cb(null, user);
                });
            }]
        }, function (err, results) {
            var email = null;
            var user = null;

            if (err) {
                return done(err);
            }

            user = results.findUserToSetInResponseLocals;
            email = results.createEmail;

            Object.keys(validUser).forEach(function (validUserKey) {
                // Make sure `emails` were populated
                if (validUserKey === 'emails') {
                    assert.strictEqual(validUser[validUserKey][0].toString(), user[validUserKey][0].id);
                    assert.strictEqual(email.address, user[validUserKey][0].address);
                    assert.strictEqual(email.is_verified, user[validUserKey][0].is_verified);

                    return;
                }

                if (validUserKey === 'date_of_birth') {
                    assert.ok(moment(validUser.date_of_birth).isSame(moment(user.date_of_birth)));

                    return;
                }

                assert.strictEqual(validUser[validUserKey], user[validUserKey]);
            });

            done();
        });
    });
});