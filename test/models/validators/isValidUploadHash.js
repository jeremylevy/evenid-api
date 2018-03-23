var assert = require('assert');

var isValidUploadHash = require('../../../models/validators/isValidUploadHash');

describe('models.validators.isValidUploadHash', function () {
    it('returns `false` when passing '
       + 'non-string value as upload hash', function () {
        
        [null, undefined, {}, 9, []].forEach(function (v) {
            assert.strictEqual(isValidUploadHash(v), false);
        });
    });

    it('returns `false` when passing invalid upload hash', function () {
        ['bar', 'foo', ''].forEach(function (v) {
            assert.strictEqual(isValidUploadHash(v), false);
        });
    });

    it('returns `true` when passing valid upload hash', function () {
        assert.strictEqual(isValidUploadHash('034e38fcafd01c52242d406625d9d33eaea35263'),
                           true);
    });
});