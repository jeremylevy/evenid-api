var sendEmailMock = require('../../../sendEmail');

module.exports = function (messageArgs, clientName, clientLogo, link, to) {
    return sendEmailMock('validate_email', messageArgs, 
                         'Validate my email address', clientName, 
                         clientLogo, link, to);
};