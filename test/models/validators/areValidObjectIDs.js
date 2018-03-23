var assert = require('assert');

var mongoose = require('mongoose');

var config = require('../../../config');

var areValidObjectIDs = require('../../../models/validators/areValidObjectIDs');

describe('models.validators.areValidObjectIDs', function () {
    it('throws an exception when passing '
       + 'invalid value as pattern', function () {
        
        [null, undefined, {}, 9, '', [], function () {}].forEach(function (v) {
            assert.throws(function () {
                areValidObjectIDs(v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'non/empty-array value as object IDs', function () {
        
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                areValidObjectIDs(config.EVENID_MONGODB.OBJECT_ID_PATTERN)(v);
            }, assert.AssertionError);
        });
    });

    it('returns `false` when passing '
       + 'invalid values as object IDs', function () {
        
        var invalidValues = [
            [
                mongoose.Types.ObjectId(), 
                undefined, null, {}, 9, []
            ],
            
            [
                '973abfe374', 
                mongoose.Types.ObjectId().toString()
            ]
        ];

        invalidValues.forEach(function (v) {
            assert.strictEqual(areValidObjectIDs(config.EVENID_MONGODB.OBJECT_ID_PATTERN)(v),
                               false);
        });
    });

    it('returns `true` when passing '
       + 'valid values as object IDs', function () {
        
        var validValues = [
            [
                mongoose.Types.ObjectId()
            ],

            [
                mongoose.Types.ObjectId().toString()
            ], 
         
            [
                mongoose.Types.ObjectId(), 
                mongoose.Types.ObjectId().toString()
            ]
        ];

        validValues.forEach(function (v) {
            assert.strictEqual(areValidObjectIDs(config.EVENID_MONGODB.OBJECT_ID_PATTERN)(v),
                               true);
        });
    });
});