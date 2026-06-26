import {genericUtils} from '../utilities/_module.mjs';

const fields = foundry.data.fields;
const TYPES = {};

const mapKeyKey = config => Object.entries(config).reduce((acc, [key, _]) => (acc[key] = key, acc), {});
const mapKeyLabel = config => Object.entries(config).reduce((acc, [key, value]) => (acc[key] = value.label, acc), {});

class AttributeRestriction {

    #type;
    #hint;
    #label;
    #choices;
    #evaluate;
    #canRequireAll;
    #propertyPath;

    constructor({type, evaluate, choices, canRequireAll, propertyPath, hint, label}) {
        this.#type = type;
        this.#hint = hint;
        this.#label = label;
        this.#choices = choices;
        this.#evaluate = evaluate;
        this.#propertyPath = propertyPath;
        this.#canRequireAll = canRequireAll;
    }

    get type() {
        return this.#type;
    }

    get schema() {
        const data = {
            value: new fields.ArrayField(new fields.StringField({choices: this.#choices, hint: this.#hint, label: this.#label}))
        };
        if (this.#canRequireAll) data.requireAll = new fields.BooleanField({required: true, initial: false});
        return new fields.SchemaField(data, {required: false});
    }

    evaluate(restriction, context) {
        if (!restriction.value?.length) return true;
        context.propertyPath = this.#propertyPath;
        return this.#evaluate(restriction, context);
    }
}

function registerRestriction({type, evaluate, choices, canRequireAll, propertyPath, hint, label}) {
    TYPES[type] = new AttributeRestriction({type, evaluate, choices, canRequireAll, propertyPath, hint, label});
}

function checkList({value, requireAll}, {data, item, propertyPath}) {
    data ??= genericUtils.getProperty(item, propertyPath);
    if (!data) return false;
    if (data instanceof Set) {
        return requireAll ? value.every(v => data.has(v)) : value.some(v => data.has(v));
    }
    if (Array.isArray(data)) {
        return requireAll ? value.every(v => data.includes(v)) : value.some(v => data.includes(v));
    }
    return requireAll ? value.every(v => v === data) : value.some(v => v === data);
}

registerRestriction({
    type: 'Identifier',
    label: '',
    hint: '',
    evaluate: ({value: ids}, {identifier, activityIdentifier, partIndex}) => {
        return ids.some(id => {
            let [itemID, activityID, idx = 0] = id.split('|').map(i => i.trim());
            if (itemID !== identifier) return false;
            if (activityID !== activityIdentifier) return false;
            if (idx === 'all' || !activityID?.length) return true;
            return idx == partIndex;
        });
    }
});

const ITEM_TYPES = ['consumable', 'equipment' ,'feat', 'loot', 'spell', 'tool', 'weapon'];
registerRestriction({
    type: 'Type',
    label: '',
    hint: '',
    propertyPath: 'type',
    choices: () => ITEM_TYPES.reduce((acc, key) => (acc[key] = _loc(CONFIG.Item.typeLabels[key]), acc), {}),
    evaluate: checkList
});

registerRestriction({
    type: 'Property',
    label: '',
    hint: '',
    propertyPath: 'system.properties',
    canRequireAll: true,
    choices: () => mapKeyLabel(CONFIG.DND5E.itemProperties),
    evaluate: checkList
});

registerRestriction({
    type: 'School',
    label: '',
    hint: '',
    propertyPath: 'system.school',
    choices: () => mapKeyLabel(CONFIG.DND5E.spellSchools),
    evaluate: checkList
});

registerRestriction({
    type: 'Level',
    label: '',
    hint: '',
    propertyPath: 'system.level',
    choices: () => CONFIG.DND5E.spellLevels,
    evaluate: checkList
});

registerRestriction({
    type: 'Ability',
    label: '',
    hint: '',
    propertyPath: 'system.ability',
    choices: () => mapKeyLabel(CONFIG.DND5E.abilities),
    evaluate: checkList
});

registerRestriction({
    type: 'Method',
    label: '',
    hint: '',
    propertyPath: 'system.method',
    choices: () => mapKeyLabel(CONFIG.DND5E.spellcasting),
    evaluate: checkList
});

registerRestriction({
    type: 'DamageType',
    label: '',
    hint: '',
    choices: () => mapKeyLabel(CONFIG.DND5E.damageTypes),
    evaluate: (restriction, {damage}) => {
        if (!damage) return false;
        return checkList(restriction, {data: damage.types || [damage.type]});
    }
});

export default {
    mapKeyKey,
    mapKeyLabel,
    ...TYPES
};
