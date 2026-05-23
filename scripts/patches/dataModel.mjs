import {Logging} from '../lib/_module.mjs';
import {rollUtils} from '../utilities/_module.mjs';
/*
[
    {
        modifiers: ['x', 'min1'],
        restrictions: {
            identifier: 'example'
            type: 'spell',
            property: ['verbal', 'material'],
            school: 'evocation',
            level: 0,
            ability: 'int',
            method: 'spell',
            damageTypes: ['fire', 'force']
        }
    }
]
*/
function isValidModifier(modDef, targetItem, identifier, {rollData} = {}) {
    const reqs = modDef.restrictions;
    if (!reqs) return true;
    if (reqs.identifier && reqs.identifier !== identifier) return false;
    if (reqs.type && reqs.type !== targetItem.type) return false;
    if (reqs.property) {
        const hasAllProperties = reqs.property.every(p => targetItem.system.properties.has(p));
        if (!hasAllProperties) return false;
    }
    if (targetItem.type === 'spell') {
        if (reqs.school && reqs.school !== targetItem.system.school) return false;
        if (reqs.level && reqs.level !== targetItem.system.level) return false;
        if (reqs.ability && reqs.ability !== targetItem.system.ability) return false;
        if (reqs.method && reqs.method !== targetItem.system.method) return false;
    }
    if (reqs.classIdentifier && reqs.classIdentifier !== targetItem.system.classIdentifier) return false;
    if (reqs.damageTypes) {
        if (!rollData) return false; 
        const currentDamageType = rollData.options?.type;
        if (!reqs.damageTypes.includes(currentDamageType)) return false;
    }
    return true;
}
function formula(wrapped) {
    const parent = this.parent;
    if (!parent) return wrapped();
    let identifier;
    let actor;
    let document;
    let targetItem; 
    if (parent.documentName === 'Activity') {
        actor = parent.actor;
        if (!actor) return wrapped();
        targetItem = parent.item;
        identifier = targetItem.system.identifier + '|' + parent.identifier;
        document = parent;
    } else {
        const grandParent = parent.parent;
        if (grandParent?.documentName !== 'Item') return wrapped();
        actor = grandParent.actor;
        if (!actor) return wrapped();
        targetItem = grandParent;
        identifier = grandParent.system.identifier;
        document = grandParent;
    }
    const originalFormula = wrapped();
    const alternateFormulas = [originalFormula];
    const rollModifiers = new Set();
    actor.items.forEach(item => {
        const altFormula = item.flags.cat?.alternateFormula?.[identifier];
        if (altFormula) alternateFormulas.push(altFormula);
        const modifiersList = item.flags.cat?.rollModifiers;
        if (modifiersList) {
            modifiersList.forEach(modDef => {
                if (isValidModifier(modDef, targetItem, identifier) && modDef.modifiers) modDef.modifiers.forEach(m => rollModifiers.add(m));
            });
        }
    });
    let bestFormula = originalFormula;
    if (alternateFormulas.length > 1) {
        const highestIndex = alternateFormulas.reduce((accumulator, currentFormula, currentIndex) => {
            const currentMax = rollUtils.rollDiceSync(currentFormula, {document, options: {maximize: true}}).total;
            if (currentMax > accumulator.maxValue) return {index: currentIndex, maxValue: currentMax};
            return accumulator;
        }, {index: 0, maxValue: -Infinity}).index;
        bestFormula = alternateFormulas[highestIndex];
    }
    if (rollModifiers.size) {
        const terms = Roll.parse(bestFormula);
        terms.forEach(term => {
            if (term.modifiers) {
                rollModifiers.forEach(mod => {
                    if (!term.modifiers.includes(mod)) term.modifiers.push(mod);
                });
            }
        });
        bestFormula = Roll.getFormula(terms);
    }
    return bestFormula;
}
function patch(enabled) {
    if (enabled) {
        Logging.addEntry('DEBUG', 'Patching: dnd5e.dataModels.shared.DamageData.prototype.formula', {force: true});
        libWrapper.register('cat', 'dnd5e.dataModels.shared.DamageData.prototype.formula', formula, 'MIXED');
    } else {
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.dataModels.shared.DamageData.prototype.formula');
        libWrapper.unregister('cat', 'dnd5e.dataModels.shared.DamageData.prototype.formula');
    }
}
export default {
    patch,
    isValidModifier
};