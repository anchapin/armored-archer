"use strict";
exports.id = 568;
exports.ids = [568];
exports.modules = {

/***/ 13967
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   q: () => (/* binding */ execAsync)
/* harmony export */ });
/* harmony import */ var child_process__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(35317);
/* harmony import */ var child_process__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(child_process__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var util__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(39023);
/* harmony import */ var util__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(util__WEBPACK_IMPORTED_MODULE_1__);
/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */


const execAsync = util__WEBPACK_IMPORTED_MODULE_1__.promisify(child_process__WEBPACK_IMPORTED_MODULE_0__.exec);
//# sourceMappingURL=execAsync.js.map

/***/ },

/***/ 1568
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getMachineId: () => (/* binding */ getMachineId)
/* harmony export */ });
/* harmony import */ var _execAsync__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(13967);
/* harmony import */ var _opentelemetry_api__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(78758);
/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */


async function getMachineId() {
    try {
        const result = await (0,_execAsync__WEBPACK_IMPORTED_MODULE_0__/* .execAsync */ .q)('ioreg -rd1 -c "IOPlatformExpertDevice"');
        const idLine = result.stdout
            .split('\n')
            .find(line => line.includes('IOPlatformUUID'));
        if (!idLine) {
            return undefined;
        }
        const parts = idLine.split('" = "');
        if (parts.length === 2) {
            return parts[1].slice(0, -1);
        }
    }
    catch (e) {
        _opentelemetry_api__WEBPACK_IMPORTED_MODULE_1__/* .diag */ .s.debug(`error reading machine id: ${e}`);
    }
    return undefined;
}
//# sourceMappingURL=getMachineId-darwin.js.map

/***/ }

};
;