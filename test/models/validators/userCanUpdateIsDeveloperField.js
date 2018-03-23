var assert = require('assert');
var mongoose = require('mongoose');

var userCanUpdateIsDeveloperField = require('../../../models/validators/userCanUpdateIsDeveloperField');

var createUser = require('../../../testUtils/db/createUser');

describe('models.validators.userCanUpdateIsDeveloperField', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
    
    it('throws an exception when passing non-user as context', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                userCanUpdateIsDeveloperField.call(v, true);
            }, assert.AssertionError);
        });
    });

    it('returns `false` when user wants to '
       + 'leave developer program but still own clients', function (done) {
        
        createUser(function (err, user) {
            var clientID = mongoose.Types.ObjectId();

            if (err) {
                return done(err);
            }

            user.developer.clients.push(clientID);

            assert.strictEqual(userCanUpdateIsDeveloperField.call(user, false),
                               false);

            done();
        });
    });

    it('returns `true` when user wants to '
       + 'leave developer program and doesn\`t own clients', function (done) {
        
        createUser(function (err, user) {
            var clientID = mongoose.Types.ObjectId();

            if (err) {
                return done(err);
            }

            user.developer.clients = [];

            assert.strictEqual(userCanUpdateIsDeveloperField.call(user, false),
                               true);

            done();
        });
    });

    it('returns `true` when user wants to '
       + 'enter the developer program', function (done) {
        
        createUser(function (err, user) {
            var clientID = mongoose.Types.ObjectId();

            if (err) {
                return done(err);
            }

            assert.strictEqual(userCanUpdateIsDeveloperField.call(user, true),
                               true);

            /* Also check when user own clients */

            user.developer.clients.push(clientID);

            assert.strictEqual(userCanUpdateIsDeveloperField.call(user, true),
                               true);

            done();
        });
    });
});