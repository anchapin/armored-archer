"use strict";
/**
 * Custom ESLint Rules Index
 *
 * This file exports all custom ESLint rules for the project.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = exports.NPlusOneDetectionRule = void 0;
var tslib_1 = require("tslib");
var n_plus_one_detection_1 = require("./n-plus-one-detection");
Object.defineProperty(exports, "NPlusOneDetectionRule", { enumerable: true, get: function () { return n_plus_one_detection_1.NPlusOneDetectionRule; } });
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return tslib_1.__importDefault(n_plus_one_detection_1).default; } });
