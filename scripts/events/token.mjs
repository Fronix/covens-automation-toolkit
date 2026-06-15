import {tokens} from '../handlers/_module.mjs';
function preDeleteToken(token, options, userId) {
    return tokens.preDeleteToken(token, options);
}
function preCreateToken(token, updates, options, userId) {
    return tokens.preCreateToken(token, options);
}
export default {
    preDeleteToken,
    preCreateToken
};