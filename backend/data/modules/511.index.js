"use strict";
exports.id = 511;
exports.ids = [511];
exports.modules = {

/***/ 81511
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getMachineId: () => (/* binding */ getMachineId)
/* harmony export */ });
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(94383);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _opentelemetry_api__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(78758);
/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */


async function getMachineId() {
    const paths = ['/etc/machine-id', '/var/lib/dbus/machine-id'];
    for (const path of paths) {
        try {
            const result = await fs__WEBPACK_IMPORTED_MODULE_0__.promises.readFile(path, { encoding: 'utf8' });
            return result.trim();
        }
        catch (e) {
            _opentelemetry_api__WEBPACK_IMPORTED_MODULE_1__/* .diag */ .s.debug(`error reading machine id: ${e}`);
        }
    }
    return undefined;
}
//# sourceMappingURL=getMachineId-linux.js.map

/***/ }

};
;