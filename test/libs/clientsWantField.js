var assert = require('assert');
var mongoose = require('mongoose');

var clientsWantField = require('../../libs/clientsWantField');

describe('libs.clientsWantField', function () {
    it('throws an exception when passing '
       + 'non-array value as authorizations', function () {
        
        [null, undefined, {}, 9, ''].forEach(function (v) {
            assert.throws(function () {
                clientsWantField(v, 'foo', mongoose.Types.ObjectId());
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'non-string value as entity', function () {
        
        [null, undefined, {}, 9, []].forEach(function (v) {
            assert.throws(function () {
                clientsWantField([], v, mongoose.Types.ObjectId());
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'non-ObjectID & non-false value as entity ID', function () {
        
        [{}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                clientsWantField([], 'foo', v);
            }, assert.AssertionError);
        });
    });

    it('returns `false` when client doesn\'t '
       + 'want field without entity ID', function () {
        
        var userAuthorizations = [{
            scope: ['emails', 'first_name'],
            entities: {
                emails: [],
                phone_numbers: [],
                addresses: []
            }
        }];

        assert.strictEqual(clientsWantField(userAuthorizations,
                                            'last_name'), false);
    });

    it('returns `false` when client doesn\'t '
       + 'want field with entity ID', function () {
        
        var objectID = mongoose.Types.ObjectId();
        var userAuthorizations = [{
            scope: [],
            entities: {
                emails: [objectID],
                phone_numbers: [],
                addresses: []
            }
        }];

        assert.strictEqual(clientsWantField(userAuthorizations,
                                            'emails',
                                            mongoose.Types.ObjectId()), false);
    });

    it('returns `true` when client wants '
       + 'field without entity ID', function () {
        
        var userAuthorizations = [{
            scope: ['emails', 'first_name'],
            entities: {
                emails: [],
                phone_numbers: [],
                addresses: []
            }
        }];

        assert.strictEqual(clientsWantField(userAuthorizations,
                                            'first_name'), true);
    });

    it('returns `true` when client wants '
       + 'field with objectID entity ID', function () {
        
        var objectID = mongoose.Types.ObjectId();
        var userAuthorizations = [{
            scope: [],
            entities: {
                emails: [objectID],
                phone_numbers: [],
                addresses: []
            }
        }];

        assert.strictEqual(clientsWantField(userAuthorizations,
                                            'emails',
                                            objectID), true);
    });

    it('returns `true` when client wants '
       + 'field with string entity ID', function () {
        
        var objectID = '507c7f79bcf86cd7994f6c0e';
        var userAuthorizations = [{
            scope: [],
            entities: {
                emails: [],
                phone_numbers: [objectID],
                addresses: []
            }
        }];

        assert.strictEqual(clientsWantField(userAuthorizations,
                                            'phone_numbers',
                                            objectID), true);
    });
});