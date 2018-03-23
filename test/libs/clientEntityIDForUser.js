var assert = require('assert');
var mongoose = require('mongoose');

var clientEntityIDForUser = require('../../libs/clientEntityIDForUser');

var clientEntityIDsForUser = [{
    user: mongoose.Types.ObjectId(),
    client: mongoose.Types.ObjectId(),
    fake_id: mongoose.Types.ObjectId(),
    real_id: mongoose.Types.ObjectId(),
    entities: ['users'],
    use_test_account: false
}];

describe('libs.clientsEntityIDForUser', function () {
    it('throws an exception when passing non-array '
       + 'value as client entities ID for user', function () {
        
        [null, undefined, {}, 9, ''].forEach(function (v) {
            assert.throws(function () {
                clientEntityIDForUser(v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'invalid value as entity', function () {
        
        [null, undefined, {}, 9, [], 'foo'].forEach(function (v) {
            assert.throws(function () {
                clientEntityIDForUser([])(v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'invalid value as wanted ID type', function () {
        
        [null, undefined, {}, 9, [], 'foo'].forEach(function (v) {
            assert.throws(function () {
                clientEntityIDForUser([])(v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'non-ObjectID & non-false value as given ID', function () {
        
        [{}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                clientEntityIDForUser([])(v);
            }, assert.AssertionError);
        });
    });

    it('returns `undefined` when wanted entity doesn\'t exist', function () {
        assert.strictEqual(
            clientEntityIDForUser(clientEntityIDsForUser)
                                 ('emails', 'real', clientEntityIDsForUser[0].fake_id), 
            undefined
        );
    });

    it('returns `undefined` when given ID doesn\'t exist', function () {
        assert.strictEqual(
            clientEntityIDForUser(clientEntityIDsForUser)
                                 ('users', 'real', mongoose.Types.ObjectId()), 
            undefined
        );
    });

    it('returns real ID when passing fake ID', function () {
        assert.strictEqual(
            clientEntityIDForUser(clientEntityIDsForUser)
                                 ('users', 'real', clientEntityIDsForUser[0].fake_id)
                                 .toString(), 
            clientEntityIDsForUser[0].real_id.toString()
        );
    });

    it('returns fake ID when passing real ID', function () {
        assert.strictEqual(
            clientEntityIDForUser(clientEntityIDsForUser)
                                 ('users', 'fake', clientEntityIDsForUser[0].real_id)
                                 .toString(), 
            clientEntityIDsForUser[0].fake_id.toString()
        );
    });

    it('returns fake ID for specified entity when '
       + 'we ask for without passing real ID', function () {

        assert.strictEqual(
            clientEntityIDForUser(clientEntityIDsForUser)
                                 ('users', 'fake')
                                 .toString(), 
            clientEntityIDsForUser[0].fake_id.toString()
        );
    });

    it('returns real ID for specified entity when '
       + 'we ask for without passing fake ID', function () {
        
        assert.strictEqual(
            clientEntityIDForUser(clientEntityIDsForUser)
                                 ('users', 'real')
                                 .toString(), 
            clientEntityIDsForUser[0].real_id.toString()
        );
    });
});