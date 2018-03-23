var sendEmailMock = require('../../../sendEmail');

module.exports = function (messageArgs, clientName, clientLogo, link, to) {
    return sendEmailMock('recover_password', messageArgs, 
                         'Reset my password', clientName, 
                         clientLogo, link, to);
};