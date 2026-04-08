"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateConfiguration = validateConfiguration;
var config_1 = require("../config");
function validateConfiguration(logger) {
    if (config_1.config.server.port < 1 || config_1.config.server.port > 65535) {
        logger.warn('Invalid server port: %d', config_1.config.server.port);
    }
    if (config_1.config.server.consolePort < 1 || config_1.config.server.consolePort > 65535) {
        logger.warn('Invalid console port: %d', config_1.config.server.consolePort);
    }
    logger.info('Configuration validated successfully');
}
