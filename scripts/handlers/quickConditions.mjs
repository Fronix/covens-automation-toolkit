import QuickConditions from '../applications/quick-conditions.mjs';
import {genericUtils} from '../utilities/_module.mjs';
const {Collection} = foundry.utils;
const QUICK_CONDITIONS_HELPER_MARKER = '__catQuickConditionsInput';
function onRender(application, element) {
    const names = ['useConditionText', 'effectConditionText'];
    const data = {entity: application.activity, uuid: application.activity.uuid};
    names.forEach(name => {
        const node = element.querySelector('.form-fields:has([name="' + name + '"])');
        if (!node || node.querySelector('i.cat-quick-conditions')) return;
        const el = document.createElement('i');
        el.id = name;
        el.classList.add('fa-solid', 'fa-plus', 'cat-quick-conditions');
        el.dataset.tooltip = _loc('CAT.QuickConditions.Title');
        node.appendChild(el);
        el.addEventListener('click', onClick.bind(data));
    });
}
let helpersRegistered = false;
function isQuickConditionsInput(value) {
    return (value instanceof Object)
        && !(value instanceof Array)
        && Object.hasOwn(value, QUICK_CONDITIONS_HELPER_MARKER)
        && (value[QUICK_CONDITIONS_HELPER_MARKER] === true);
}
function registerCompatHelper(name, helperFn) {
    const previous = Handlebars.helpers?.[name];
    if (previous?.__catCompatProxy) return;
    Handlebars.registerHelper(name, function (...args) {
        if (isQuickConditionsInput(args[0])) return helperFn(args[0]);
        if (typeof previous === 'function') return previous.apply(this, args);
        return '';
    });
    const registered = Handlebars.helpers?.[name];
    if (registered) registered.__catCompatProxy = true;
}
function registerHelpers() {
    if (helpersRegistered) return;
    foundry.applications.handlebars.loadTemplates(['modules/cat/templates/quick-conditions.hbs']);
    Handlebars.registerHelper({
        catButton: button,
        catSelectDetailed: selectDetailed,
        catSelectMultiple: selectMultiple,
        catContentP: contentP,
        catTextInput: textInput,
        catLabelP: labelP,
        catNumberInput: numberInput
    });
    // Backward compatibility for existing Quick Conditions templates while preserving system helpers.
    registerCompatHelper('button', button);
    registerCompatHelper('selectDetailed', selectDetailed);
    registerCompatHelper('selectMultiple', selectMultiple);
    registerCompatHelper('contentP', contentP);
    registerCompatHelper('textInput', textInput);
    registerCompatHelper('labelP', labelP);
    registerCompatHelper('numberInput', numberInput);
    helpersRegistered = true;
}
function safe(value) {
    return Handlebars.escapeExpression(value ?? '');
}
function asSafeString(html) {
    return new Handlebars.SafeString(html);
}
function button(input) {
    const data = input ?? {};
    let html = `<button type="${safe(data.type ?? 'button')}" class="${safe(data.class ?? 'form-button')}"`;
    if (data.dataAction != null) html += ` data-action="${safe(data.dataAction)}"`;
    if (data.id != null) html += ` id="${safe(data.id)}"`;
    if (data.name != null) html += ` name="${safe(data.name)}"`;
    html += '>';
    if (data.image) html += `<img class="button-image" src="${safe(data.image)}">`;
    html += `<p class="button-text"`;
    if (data.tooltip) html += ` data-tooltip="${safe(data.tooltip)}"`;
    html += `>`;
    if (data.label) html += safe(_loc(data.label));
    if (data.icon) html += `<i class="${safe(data.icon)}"></i>`;
    html += `</p></button>`;
    return asSafeString(html);
}
function selectDetailed(input) {
    const data = input ?? {};
    const options = Array.isArray(data.options) ? data.options : [];
    let html = '<select';
    if (data.id != null) html += ` id="${safe(data.id)}"`;
    if (data.name != null) html += ` name="${safe(data.name)}"`;
    html += '>';
    options.forEach(i => {
        html += `<option value="${safe(i?.value)}"`;
        if (data.value === i?.value) html += ' selected';
        html += `>`;
        let text = i?.display ?? i?.name;
        if (text != null) html += safe(_loc(text.toString()));
        html += `</option>`;
    });
    html += `</select>`;
    if (data.label || data.image) {
        html += '<label';
        if (data.id != null) html += ` for="${safe(data.id)}"`;
        html += '>';
        if (data.image) html += `<img class="label-image" src="${safe(data.image)}">`;
        if (data.label) html += `<p class="label-text">${safe(_loc(data.label?.toString()))}</p>`;
        html += `</label>`;
    }
    return asSafeString(html);
}
function selectMultiple(input) {
    const data = input ?? {};
    const options = Array.isArray(data.options) ? data.options : [];
    const selected = Array.isArray(data.value) ? data.value : [];
    let html = '<multi-select';
    if (data.id != null) html += ` id="${safe(data.id)}"`;
    if (data.name != null) html += ` name="${safe(data.name)}"`;
    html += '>';
    options.forEach(i => {
        html += `<option value="${safe(i?.value)}"`;
        if (selected.includes(i?.value)) html += ' selected';
        html += `>`;
        if (i?.name) html += safe(_loc(i.name?.toString()));
        html += `</option>`;
    });
    html += `</multi-select>`;
    if (data.label || data.image) {
        html += '<label';
        if (data.id != null) html += ` for="${safe(data.id)}"`;
        html += '>';
        if (data.image) html += `<img class="label-image" src="${safe(data.image)}">`;
        if (data.label) html += `<p class="label-text">${safe(_loc(data.label?.toString()))}</p>`;
        html += `</label>`;
    }
    return asSafeString(html);
}
function contentP(input) {
    const data = input ?? {};
    let html = `<p class="${safe(data.class ?? 'form-content')}"`;
    if (data.id != null) html += ` id="${safe(data.id)}"`;
    if (data.name != null) html += ` name="${safe(data.name)}"`;
    html += `>${safe(data.value)}</p>`;
    return asSafeString(html);
}
function textInput(input) {
    const data = input ?? {};
    let html = `<input type="text"`;
    if (data.class != null) html += ` class="${safe(data.class)}"`;
    if (data.id != null) html += ` id="${safe(data.id)}"`;
    if (data.name != null) html += ` name="${safe(data.name)}"`;
    if (data.value != null) html += ` value="${safe(data.value)}"`;
    if (data.tooltip) html += ` data-tooltip="${safe(_loc(data.tooltip))}"`;
    html += `></input>`;
    if (data.label) {
        html += '<label';
        if (data.id != null) html += ` for="${safe(data.id)}"`;
        html += `><p class="label-text">${safe(_loc(data.label?.toString()))}</p></label>`;
    }
    return asSafeString(html);
}
function labelP(input) {
    const data = input ?? {};
    let html = '<span';
    if (data.class != null) html += ` class="${safe(data.class)}"`;
    if (data.id != null) html += ` id="${safe(data.id)}"`;
    html += `>${safe(_loc(data.value?.toString()))}</span>`;
    return asSafeString(html);
}
function numberInput(input) {
    const data = input ?? {};
    let html = `<input type="number" class="quick-conditions-number"`;
    if (data.id != null) html += ` id="${safe(data.id)}"`;
    if (data.name != null) html += ` name="${safe(data.name)}"`;
    if (data.value != null) html += ` value="${safe(data.value)}"`;
    if (data.min != null) html += ` min="${safe(data.min)}"`;
    if (data.max != null) html += ` max="${safe(data.max)}"`;
    html += `>`;
    return asSafeString(html);
}
const helpers = {button, selectDetailed, selectMultiple, contentP, textInput, labelP, numberInput};
function onClick(event) {
    const data = this;
    data.fieldId = event.target.id;
    new QuickConditions(data).render(true);
}
class isVar {
    static boolean(value) {return (value === '!') || (value instanceof Boolean);}
    static string(value) {return typeof value === 'string';}
    static array(value) {return value instanceof Array;}
    static object(value) {return (value instanceof Object) && !(value instanceof Array);}
}
class not {
    static default = false;
    static type = 'select';
    static varType = isVar.boolean;
    static options = [
        {name: '!', display: 'CAT.QuickConditions.Not.IsNot', value: true},
        {name: '', display: 'CAT.QuickConditions.Not.Is', value: false}
    ];
}
class creatureTypes {
    static default = [];
    static type = 'selectMultiple';
    static varType = isVar.array;
    static get options() {return Object?.entries(CONFIG?.DND5E?.creatureTypes ?? {})?.map(([key, value]) => ({name: value.label, value: key}));}
}
class dispositions {
    static get default() {return 'CONST.TOKEN_DISPOSITIONS.HOSTILE';}
    static type = 'select';
    static varType = isVar.string;
    static get options() {return Object?.keys(CONST.TOKEN_DISPOSITIONS ?? {})?.map((key) => ({name: 'CONST.TOKEN_DISPOSITIONS.' + key, display: 'TOKEN.DISPOSITION.' + key, value: 'CONST.TOKEN_DISPOSITIONS.' + key}));}
}
class range {
    static default = '5';
    static type = 'select';
    static varType = isVar.string;
    static options = [5, 10, 15, 20, 25, 30].map(i => ({name: i.toString(), value: i.toString()}));
}
class sizes {
    static default = [];
    static type = 'selectMultiple';
    static varType = isVar.array;
    static get options() {return Object?.entries(CONFIG?.DND5E?.actorSizes ?? {})?.map(([key, value]) => ({name: value.label, value: key}));}
}
class damageTypes {
    static default = [];
    static type = 'selectMultiple';
    static varType = isVar.array;
    static get options() {return Object?.entries(CONFIG?.DND5E?.damageTypes ?? {})?.map(([key, value]) => ({name: value.label, value: key}));}
}
class itemActionTypes {
    static default = [];
    static type = 'selectMultiple';
    static varType = isVar.array;
    static get options() {return Object?.entries(CONFIG?.DND5E?.itemActionTypes ?? {})?.map(([key, value]) => ({name: value, value: key}));}
}
class activityTypes {
    static default = [];
    static type = 'selectMultiple';
    static varType = isVar.array;
    static get options() {return Object?.keys(CONFIG?.DND5E?.activityTypes ?? {})?.map(key => ({name: key, value: key}));}
}
class alignments {
    static default = 'evil';
    static type = 'select';
    static varType = isVar.string;
    static get options() {return [...new Set(Object?.values(CONFIG?.DND5E?.alignments ?? {})?.flatMap(a => a.split(' ')))].map(i => ({name: i, value: i.toLowerCase()}));}
}
class abilities {
    static default = 'int';
    static type = 'select';
    static varType = isVar.string;
    static get options() {return Object?.values(CONFIG?.DND5E?.abilities ?? {})?.map(value => ({name: value.label, value: value.abbreviation}));}
}
class comparators {
    static default = '>';
    static type = 'select';
    static varType = isVar.string;
    static options = [
        {name: '<', display: 'CAT.QuickConditions.Comparators.lt', value: '<'},
        {name: '>', display: 'CAT.QuickConditions.Comparators.gt', value: '>'},
        {name: '>=', display: 'CAT.QuickConditions.Comparators.ge', value: '>='},
        {name: '<=', display: 'CAT.QuickConditions.Comparators.le', value: '<='}
    ];
}
class scores {
    static default = '4';
    static type = 'number';
    static varType = isVar.string;
    static max = 99;
    static min = -99;
}
class conditions {
    static default = 'grappled';
    static type = 'select';
    static varType = isVar.string;
    static get options() {return Object?.entries(CONFIG?.DND5E?.conditionTypes ?? {})?.map(([key, value]) => ({name: value.name, value: key}));}
}
class itemTypes {
    static default = 'spell';
    static type = 'select';
    static varType = isVar.string;
    static get options() {return Object?.entries(CONFIG?.Item?.typeLabels ?? {})?.map(([key, value]) => ({name: _loc(value), value: key}));}
}
const constants = new Collection([
    ['typeOrRace', {
        label: 'CAT.QuickConditions.Conditions.typeOrRace',
        format: '$not$creatureTypes.includes(typeOrRace)',
        searchKey: '.includes(typeOrRace)',
        data: {not, creatureTypes}
    }],
    ['checkNearby', {
        label: 'CAT.QuickConditions.Conditions.checkNearby',
        format: '$not$checkNearby($dispositions, tokenUuid, $range)',
        searchKey: 'checkNearby',
        data: {not, dispositions, range}
    }],
    ['reaction', {
        label: 'CAT.QuickConditions.Conditions.reaction',
        format: 'reaction == "$reactionTypes"',
        searchKey: 'reaction',
        data: {
            reactionTypes: {
                default: 'isHit',
                type: 'select',
                varType: isVar.string,
                options: ['preAttack', 'isAttacked', 'isMissed', 'isHit', 'isDamaged', 'isHealed', 'isSave', 'isSaveSuccess', 'isSaveFail'].map(i => ({name: i, value: i}))
            }
        }
    }],
    ['targetActorSize', {
        label: 'CAT.QuickConditions.Conditions.targetActorSize',
        format: '$not$sizes.includes(target.traits.size)',
        searchKey: '.includes(target.traits.size)',
        data: {not, sizes}
    }],
    ['activityType', {
        label: 'CAT.QuickConditions.Conditions.activityType',
        format: '$not$itemActionTypes.includes(activity.actionType)',
        searchKey: '.includes(activity.actionType)',
        data: {not, itemActionTypes}
    }],
    ['damageType', {
        label: 'CAT.QuickConditions.Conditions.damageType',
        format: '$not$w.damageDetail.some(d=>$damageTypes.includes(d.type))',
        searchKey: '.damageDetail.some',
        data: {not, damageTypes}
    }],
    ['critical', {
        label: 'CAT.QuickConditions.Conditions.critical',
        format: '$not$workflow.isCritical',
        searchKey: 'workflow.isCritical',
        data: {not}
    }],
    ['alignment', {
        label: 'CAT.QuickConditions.Conditions.alignment',
        format: '$not$target.details.alignment.toLowerCase().includes($alignments)',
        searchKey: 'target.details.alignment',
        data: {not, alignments}
    }],
    ['ability', {
        label: 'CAT.QuickConditions.Conditions.ability',
        format: '$not$target.abilities.$abilities.value $comparators $scores',
        searchKey: 'target.abilities.',
        data: {not, abilities, comparators, scores}
    }],
    ['hasCondition', {
        label: 'CAT.QuickConditions.Conditions.hasCondition',
        format: '$not$hasCondition(targetUuid, "$conditions")',
        searchKey: 'hasCondition',
        data: {not, conditions}
    }],
    ['itemType', {
        label: 'CAT.QuickConditions.Conditions.itemType',
        format: 'item.itemType == "$itemTypes"',
        searchKey: 'item.itemType',
        data: {itemTypes}
    }]
]);
export default {
    onRender,
    registerHelpers,
    constants,
    helpers
};
