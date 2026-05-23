import {Logging} from '../lib/_module.mjs';
import {default as dataModel} from './dataModel.mjs';
function availableAbilities(wrapped) {
    const otherAbilities = this.flags?.cat?.otherAbilities ?? [];
    const allAbilities = [...wrapped(), ...otherAbilities];
    if (!this.actor) return new Set(allAbilities); 
    const identifier = this.item?.system?.identifier;
    this.actor.items.forEach(item => {
        const abilities = item.flags?.cat?.alternateAbilities?.[identifier];
        if (abilities) allAbilities.push(...abilities);
    });
    return new Set(allAbilities);
}
function getDamageConfig(wrapped, config) {
    const rollConfig = wrapped(config);
    if (!rollConfig || !rollConfig.rolls?.length) return rollConfig;
    const targetItem = this.item;
    const actor = this.actor;
    if (!actor) return rollConfig;
    const identifier = targetItem.system.identifier + '|' + this.identifier;
    rollConfig.rolls.forEach(rollData => {
        if (!rollData.parts) return;
        const rollModifiers = new Set();
        actor.items.forEach(item => {
            const modifiersList = item.flags.cat?.rollModifiers;
            if (modifiersList) {
                modifiersList.forEach(modDef => {
                    if (dataModel.isValidModifier(modDef, targetItem, identifier, {rollData}) && modDef.modifiers) {
                        modDef.modifiers.forEach(m => rollModifiers.add(m));
                    }
                });
            }
        });
        if (rollModifiers.size) {
            rollData.parts = rollData.parts.map(part => {
                const terms = Roll.parse(part);
                terms.forEach(term => {
                    if (term.modifiers) {
                        rollModifiers.forEach(mod => {
                            if (!term.modifiers.includes(mod)) term.modifiers.push(mod);
                        });
                    }
                });
                return Roll.getFormula(terms);
            });
        }
    });
    return rollConfig;
}
const activityTypes = [
    'AttackActivity',
    'DamageActivity',
    'SaveActivity',
    'HealActivity'
];
function patch(enabled) {
    if (enabled) {
        Logging.addEntry('DEBUG', 'Patching: dnd5e.documents.activity.AttackActivity.prototype.availableAbilities', {force: true});
        libWrapper.register('cat', 'dnd5e.documents.activity.AttackActivity.prototype.availableAbilities', availableAbilities, 'MIXED');
        activityTypes.forEach(type => {
            Logging.addEntry('DEBUG', 'Patching: dnd5e.documents.activity.' + type + '.prototype.getDamageConfig', {force: true});
            libWrapper.register('cat', 'dnd5e.documents.activity.' + type + '.prototype.getDamageConfig', getDamageConfig, 'WRAPPER');
        });
    } else {
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.documents.activity.AttackActivity.prototype.availableAbilities');
        libWrapper.unregister('cat', 'dnd5e.documents.activity.AttackActivity.prototype.availableAbilities');
        activityTypes.forEach(type => {
            Logging.addEntry('DEBUG', 'Unpatching: dnd5e.documents.activity.' + type + '.prototype.getDamageConfig');
            libWrapper.unregister('cat', 'dnd5e.documents.activity.' + type + '.prototype.getDamageConfig');
        });
    }
}
export default {
    patch
};