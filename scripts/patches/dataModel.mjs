import {constants, Logging} from '../lib/_module.mjs';
import {actorUtils, genericUtils, rollUtils} from '../utilities/_module.mjs';
/*
item.flags.cat.alternateAttributes = {
    RollModifier: [
        {
            value: ['x', 'min2'],
            restrictions: {
                Identifier: {
                    value: ['example', 'itemID|activityID|partID']
                }
                Type: {
                    value: ['spell', 'weapon']
                },
                Property: {
                    value: ['verbal', 'material'],
                    requireAll: false
                },
                School: {
                    value: ['evocation', 'necromancy']
                },
                Level: {
                    value: [1, 2, 3]
                },
                Ability: {
                    value: ['int', 'wis']
                },
                Method: {
                    value: ['spell', 'atwill']
                },
                DamageType: {
                    value: ['fire', 'lightning']
                }
            }
        },
        {
            value: ['min10'],
            restrictions: {
                ...
            }
        }
    ],
    DamageFormula: [ 
        {
            value: '1d8 + @mod',
            restrictions: {
                ... same options as roll modifier
            }
        },
        {
            value: '2d4 + @mod',
            restrictions: {
                ...
            }
        }
    ]
}
*/
function formula(wrapped) {
    const parent = this.parent;
    if (!parent) return wrapped();
    let context;
    if (parent.documentName === 'Activity') {
        const actor = parent.actor;
        if (!actor) return wrapped();
        context = {
            actor,
            damage: this,
            activity: parent,
            document: parent,
            item: parent.item,
            partIndex: this._index,
            activityIdentifier: parent.identifier,
            identifier: parent.item.system.identifier
        };
    } else {
        const grandParent = parent.parent;
        if (grandParent?.documentName !== 'Item') return wrapped();
        const actor = grandParent.actor;
        if (!actor) return wrapped();
        context = {
            actor,
            damage: this,
            item: grandParent,
            document: grandParent,
            identifier: grandParent.system.identifier
        };
    }
    const originalFormula = wrapped();
    const alternateFormulas = new Set([originalFormula]);
    const rollModifiers = new Set();
    const {DamageFormula, RollModifier} = constants.alternateAttributes;
    DamageFormula.getFlagHolders(context.actor).forEach(item => {
        context.sourceItem = item;
        const newFormulas = DamageFormula.evaluate(context);
        if (newFormulas?.size) newFormulas.forEach(f => alternateFormulas.add(f));
        const newModifiers = RollModifier.evaluate(context);
        if (newModifiers?.size) newModifiers.forEach(mod => rollModifiers.add(mod));
    });
    let bestFormula = originalFormula;
    if (alternateFormulas.size > 1) {
        bestFormula = alternateFormulas.reduce((accumulator, currentFormula) => {
            if (!currentFormula.length) return accumulator;
            const currentMax = rollUtils.rollDiceSync(currentFormula, {document: context.document, options: {maximize: true}}).total;
            if (currentMax > accumulator.maxValue) return {best: currentFormula, maxValue: currentMax};
            return accumulator;
        }, {best: originalFormula, maxValue: -Infinity}).best;
    }
    if (rollModifiers.size) {
        const terms = Roll.parse(bestFormula, context.document.getRollData());
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
function defineSchema(wrapped, ...args) {
    const schema = wrapped(...args);
    schema.attributes.fields.senses.fields.ranges.initialKeys.devilsSight = 'CAT.Senses.DevilsSight';
    return schema;
}
function armorClass(wrapped, rollData) {
    wrapped(rollData);
    const ac = this.attributes.ac;
    if (ac.calc === 'flat' || ac.calc === 'natural') return;
    const actor = this.parent;
    if (!actor) return;
    const cfg = CONFIG.DND5E.armorClasses[ac.calc];
    const originalFormula = cfg?.formula ?? ac.formula;
    const formulas = new Map([[originalFormula]]);
    const abilities = new Set(['dex']);
    const context = {actor};
    const {ACAbility, ACFormula} = constants.alternateAttributes;
    ACFormula.getFlagHolders(actor).forEach(item => {
        context.sourceItem = item;
        const newFormulas = ACFormula.evaluate(context);
        if (newFormulas?.size) newFormulas.forEach(f => formulas.set(f, item));
        const newAbilities = ACAbility.evaluate(context);
        if (newAbilities?.size) newAbilities.forEach(mod => abilities.add(mod));
    });
    const bestAbility = actorUtils.getBestAbility(actor, Array.from(abilities));
    const property = _loc('DND5E.ArmorClass');
    const bestFormula = formulas.entries().reduce((acc, [formula, source]) => {
        if (!formula.length) return acc;
        try {
            const replaced = dnd5e.utils.replaceFormulaData(formula, rollData, {actor, property, item: source, missing: null});
            const value = rollUtils.rollDiceSync(replaced, {document: actor, options: {strict: true}}).total;
            if (value > acc.value) return {formula, value, source};
        } catch (e) {
            Logging.addAttributeError(source, formula, e);
        }
        return acc;
    
    }, {formula: originalFormula, value: ac.base});
    ac.catModified = true;
    ac.base = bestFormula.value;
    if (bestFormula.source?.name) {
        ac.calc = 'custom';
        ac.formula = bestFormula.formula;
        ac.label = bestFormula.source.name;
    }
    if (bestAbility !== 'dex') {
        ac.catReplaceDex = bestAbility;
        ac.dex = this.abilities[ac.catReplaceDex]?.mod ?? 0;
        if (ac.equippedArmor) {
            if (ac.equippedArmor.system.type.value === 'heavy') ac.dex = 0;
            else ac.dex = Math.min(ac.equippedArmor.system.armor.dex ?? Infinity, ac.dex);
        }
        if (ac.calc === 'default') ac.base = ac.armor + ac.dex;
    }
    if (ac.armor + ac.dex > ac.base) {
        ac.calc = 'default';
        ac.base = ac.armor + ac.dex;
        ac.label = CONFIG.DND5E.armorClasses.default.label;
    }
    ac.value = Math.max(ac.min, ac.base + ac.shield + ac.bonus + ac.cover);
}
function acLabel(wrapped, property) {
    if (property !== 'attributes.ac.dex') return wrapped(property);
    const replaceDex = this.object.system.attributes.ac.catReplaceDex;
    if (!replaceDex) return wrapped(property);
    return CONFIG.DND5E.abilities[replaceDex]?.label ?? replaceDex;
}
function patch(enabled) {
    if (enabled) {
        Logging.addEntry('DEBUG', 'Patching: dnd5e.dataModels.shared.DamageData.prototype.formula', {force: true});
        libWrapper.register('cat', 'dnd5e.dataModels.shared.DamageData.prototype.formula', formula, 'MIXED');
        Logging.addEntry('DEBUG', 'Patching: dnd5e.dataModels.actor.CharacterData.defineSchema', {force: true});
        libWrapper.register('cat', 'dnd5e.dataModels.actor.CharacterData.defineSchema', defineSchema, 'WRAPPER');
        Logging.addEntry('DEBUG', 'Patching: dnd5e.dataModels.actor.NPCData.defineSchema', {force: true});
        libWrapper.register('cat', 'dnd5e.dataModels.actor.NPCData.defineSchema', defineSchema, 'WRAPPER');
        Logging.addEntry('DEBUG', 'Patching: dnd5e.dataModels.actor.AttributesFields.prepareArmorClass', {force: true});
        libWrapper.register('cat', 'dnd5e.dataModels.actor.AttributesFields.prepareArmorClass', armorClass, 'MIXED');
        Logging.addEntry('DEBUG', 'Patching: dnd5e.applications.PropertyAttribution.prototype.getPropertyLabel', {force: true});
        libWrapper.register('cat', 'dnd5e.applications.PropertyAttribution.prototype.getPropertyLabel', acLabel, 'MIXED');
        
    } else {
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.dataModels.shared.DamageData.prototype.formula');
        libWrapper.unregister('cat', 'dnd5e.dataModels.shared.DamageData.prototype.formula');
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.dataModels.actor.CharacterData.defineSchema');
        libWrapper.unregister('cat', 'dnd5e.dataModels.actor.CharacterData.defineSchema');
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.dataModels.actor.NPCData.defineSchema');
        libWrapper.unregister('cat', 'dnd5e.dataModels.actor.NPCData.defineSchema');
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.dataModels.actor.AttributesFields.prepareArmorClass');
        libWrapper.unregister('cat', 'dnd5e.dataModels.actor.AttributesFields.prepareArmorClass');
        Logging.addEntry('DEBUG', 'Unpatching: dnd5e.applications.PropertyAttribution.prototype.getPropertyLabel');
        libWrapper.unregister('cat', 'dnd5e.applications.PropertyAttribution.prototype.getPropertyLabel');
    }
}
export default {
    patch
};