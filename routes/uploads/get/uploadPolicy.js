var config = require('../../../config');

var insertEvent = require('../../../models/actions/insertEvent');
var countEvent = require('../../../models/actions/countEvent');

var checkScope = require('../../oauth/middlewares/checkScope');
var generateUploadPolicy = require('../middlewares/generateUploadPolicy');

var MaxAttemptsError = require('../../../errors/types/MaxAttemptsError');

module.exports = function (app, express) {
    app.get('/uploads/policy', checkScope('app'), function (req, res, next) {
        var user = res.locals.user;
        var IPAddress = null;

        countEvent(IPAddress, {
            user: user.id
        }, 'upload_policy_generated', 
        config.EVENID_EVENTS
              .TIMEOUTS
              .UPLOAD_POLICY_GENERATED, function (err, count) {

            if (err) {
                return next(err);
            }

            // Too many photos uploaded?
            if (count >= config.EVENID_EVENTS
                               .MAX_ATTEMPTS
                               .UPLOAD_POLICY_GENERATED) {
                
                return next(new MaxAttemptsError());
            }

            next();
        });
    }, generateUploadPolicy, function (req, res, next) {
        var user = res.locals.user;

        insertEvent({
            entities: {
                user: user.id
            },
            type: 'upload_policy_generated'
        }, function (err, event) {
            if (err) {
                return next(err);
            }

            res.send(res.locals.generatedPolicy);
        });
    });
};