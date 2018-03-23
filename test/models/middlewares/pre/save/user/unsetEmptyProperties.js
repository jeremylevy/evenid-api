var assert = require('assert');

var config = require('../../../../../../config');

var unsetEmptyProperties = require('../../../../../../models/middlewares/pre/save/user/unsetEmptyProperties');

var createUser = require('../../../../../../testUtils/db/createUser');

describe('models.middlewares.pre.save.user.unsetEmptyProperties', function () {
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
                unsetEmptyProperties.call(v, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function as next', function (done) {
        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            [null, undefined, {}, [], '', 0.0].forEach(function (v) {
                assert.throws(function () {
                    unsetEmptyProperties.call(user, v);
                }, assert.AssertionError);
            });

            done();
        });
    });

    it('replaces empty fields fields that could be asked '
       + 'by clients with `undefined`', function (done) {

        var emptyValues = ['', null, [], {}];

        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            // Make sure only fields that could 
            // be asked by clients are set to `undefined`
            user.password = '';

            config.EVENID_OAUTH
                  .VALID_ENTITY_FIELDS
                  .USERS.forEach(function (field) {

                // All empty values were tested.
                // Back to default.
                if (!emptyValues.length) {
                    user[field] = '';

                    return;
                }

                user[field] = emptyValues.shift();
            });

            unsetEmptyProperties.call(user, function () {
                // Make sure only fields that could 
                // be asked by clients are set to `undefined`
                assert.strictEqual(user.password, '');

                config.EVENID_OAUTH
                      .VALID_ENTITY_FIELDS
                      .USERS.forEach(function (field) {

                    assert.strictEqual(user[field], undefined);
                });

                done();
            });
        });
    });
});