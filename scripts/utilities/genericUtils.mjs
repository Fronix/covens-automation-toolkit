function setProperty(object, key, value) {
    return foundry.utils.setProperty(object, key, value);
}
function getProperty(object, key) {
    return foundry.utils.getProperty(object, key);
}
function duplicate(object) {
    return foundry.utils.duplicate(object);
}
function deepClone(object) {
    return foundry.utils.deepClone(object);
}
function mergeObject(original, other, options = {}) {
    return foundry.utils.mergeObject(original, other, options);
}
function convertDistance(scene, distanceFt) {
    switch(scene.grid.units) {
        case 'm': return Math.floor((distanceFt / 5) * 1.5);
        default: return distanceFt;
    }
}
function translate(key) {
    return game.i18n.localize(key);
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function keySort(key) {
    return function(a, b) {
        if (a[key] < b[key]) return -1;
        if (a[key] > b[key]) return 1;
        return 0;
    };
}
export default {
    setProperty,
    getProperty,
    duplicate,
    deepClone,
    mergeObject,
    convertDistance,
    translate,
    sleep,
    keySort
};