var async = require('async');
var validator = require('validator');

var findOauthEntitiesID = require('../../../../models/actions/findOauthEntitiesID');
var findOauthUserStatus = require('../../../../models/actions/findOauthUserStatus');

var sendTokenRes = require('./sendTokenRes');

module.exports = function (req, res, next) {
    var resp = {};
    
    // Hook `sendTokenRes` function 
    // to add client specific user ID 
    // and user status to response
    var sendRes = function () {
        var grantType = validator.trim(req.body.grant_type);

        var client = res.locals.client;
        var clientID = client && client.id;
        var userID = resp.user_id;

        // User status and client specific user ID
        // are meaningless for app client.
        if (!resp.error && client !== 'app') {

            /* During error, client and user were not set
               So assert after the if */

            if (!clientID) {
                throw new Error('`client` must be set as response locals '
                                + 'property before calling `sendRes` '
                                + 'method');
            }
            
            if (!userID) {
                throw new Error('`user_id` must be set as response property '
                                + 'property before calling `sendRes` '
                                + 'method');
            }

            async.auto({
                setOauthUserStatus: function (cb) {
                    findOauthUserStatus(clientID, userID, function (err, oauthUserStatus) {
                        if (err) {
                            return cb(err);
                        }

                        resp.user_status = oauthUserStatus.status;

                        cb(null, oauthUserStatus.status);
                    });
                },

                setClientSpecificUserID: function (cb) {
                    findOauthEntitiesID({
                        real_id: userID,
                        entities: ['users']
                    }, userID, clientID, function (err, oauthEntitiesID) {
                        if (err) {
                            return cb(err);
                        }

                        resp.user_id = oauthEntitiesID[0].fake_id.toString();

                        cb(null, userID);
                    });
                }
            }, function (err, results) {
                if (err) {
                    return next(err);
                }

                sendTokenRes(resp, res);
            });

            return;
        }

        sendTokenRes(resp, res);
    };

    // Give access to next middlewares
    res.locals.resp = resp;
    res.locals.sendRes = sendRes;

    next();
};