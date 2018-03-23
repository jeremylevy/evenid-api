var config = require('../../../config');

var areValidObjectIDs = require('../../../models/validators/areValidObjectIDs')
                               (config.EVENID_MONGODB
                                      .OBJECT_ID_PATTERN);

module.exports = function (client, resp) {
    if (!client) {
        throw new Error('`client` must be set as response locals '
                        + 'property before calling `setDeleteTestAccountCookieResp` '
                        + 'callback');
    }

    if (!areValidObjectIDs([client.id])) {
        throw new Error('`client` must contains a valid `id` property '
                        + 'before calling `setDeleteTestAccountCookieResp` '
                        + 'callback');
    }

    if (!resp.deleteTestAccountCookie) {
        resp.deleteTestAccountCookie = true;
    }

    // To save and delete test account cookie
    if (!resp.clientID) {
        resp.clientID = client.id;
    }
};