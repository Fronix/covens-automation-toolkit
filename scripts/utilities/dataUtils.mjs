import {genericUtils} from './_module.mjs';
/**
 * Set document rules in the correct location. Does not perform updates.
 * @param {object | foundry.abstract.Document} documentData
 * @param {'2024' | '2014'} rules 
 */
function setRules(documentData, rules) {
    genericUtils.setProperty(documentData, 'flags.cat.automation.rules', rules);
}
/**
 * Set document identifier in the correct location. Does not perform updates.
 * @param {object | foundry.abstract.Document} documentData
 * @param {string} identifier 
 */
function setIdentifier(documentData, identifier) {
    genericUtils.setProperty(documentData, 'flags.cat.identifier', identifier);
}
export default {
    setRules,
    setIdentifier
};