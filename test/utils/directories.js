var assert = require('assert');
var fs = require('fs');
var path = require('path');
var directories = require('../../utils/directories');
var testFolder = path.join(__dirname, '/utils_directories_test_folder/');

var files = [];

describe('utils.directories.loadDirSync with test folder', function () {
    before(function (done) {
        directories.loadDirSync(testFolder, ['blacklist.js'], function (filePath) {
            files.push(filePath);
        });

        done();
    });

    it('returns files', function () {
        assert.notStrictEqual(files.indexOf(path.join(testFolder, '/file.js')), -1);
    });

    it('returns files in folder', function () {
        assert.notStrictEqual(files.indexOf(path.join(testFolder, '/folder/file_in_folder.js')), -1);
    });

    it('doesn\'t return blacklisted files', function () {
        assert.strictEqual(files.indexOf(path.join(testFolder, '/blacklist.js')), -1);
    });

    it('doesn\'t return folders', function () {
        var containsFolders = false;

        for (var i = 0, j = files.length; i < j; ++i) {
            containsFolders = fs.lstatSync(files[i]).isDirectory();

            if (containsFolders) {
                break;
            }
        }

        assert.strictEqual(containsFolders, false);
    });

    it('doesn\'t return index.js', function () {
        var containsIndexJs = false;

        for (var i = 0, j = files.length; i < j; ++i) {
            containsIndexJs = /index\.js$/.test(files[i]);

            if (containsIndexJs) {
                break;
            }
        }

        assert.strictEqual(containsIndexJs, false);
    });

    it('doesn\'t return hidden files', function () {
        var containsHiddenFiles = false;

        for (var i = 0, j = files.length; i < j; ++i) {
            containsHiddenFiles = /^\./.test(files[i]);

            if (containsHiddenFiles) {
                break;
            }
        }

        assert.strictEqual(containsHiddenFiles, false);
    });
});