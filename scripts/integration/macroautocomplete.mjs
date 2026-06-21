import {Events, constants, Logging} from '../lib/_module.mjs';
import {ddbi} from '../integration/_modules.mjs';

// reference https://gitlab.com/tposney/midi-qol/-/blob/v13/src/module/lib/midiCompletions.ts#L969
// TODO remove out of scope vars e.g. macroItem, macroActivity

const mkVar = (detail, info) => ({type: 'variable', detail, info: mkInfo(info)});
const mkInfo = msg => `CAT Data: ${msg}`;
const clsInst = (api, cls, info) => {
    const walked = CLASS_CACHE[cls.name] ?? api.classToCompletions(cls);
    CLASS_CACHE[cls.name] ??= walked;
    const v = mkVar(cls.name, info);
    api.mergeCompletions(v, walked.instanceChildren);
    return v;
};
const cls = (key) => {
    switch (key) {
        case 'activeeffect': return CONFIG.ActiveEffect.documentClass;
        case 'combatant': return CONFIG.Combatant.documentClass;
        case 'region': return CONFIG.Region.documentClass;
        case 'actor': return CONFIG.Actor.documentClass;
        case 'token': return CONFIG.Token.documentClass;
        case 'scene': return CONFIG.Scene.documentClass;
        case 'level': return CONFIG.Level.documentClass;
        case 'item': return CONFIG.Item.documentClass;
        default: return {name: 'INVALID'};
    }
};
const alias = (api, base, info) => {
    const original = api.tree[base];
    const c = cls(base);
    if (original) {
        const aliased = {...original, info: mkInfo(info)};
        if (c.name !== 'INVALID') aliased.detail = c.name;
        return aliased;
    }
    if (c.name === 'INVALID') return mkVar(base, info);
    return clsInst(api, c, info);
};

const CLASS_CACHE = {};

const VARS = {
    // General
    encounters: () => mkVar(`${cls('actor').name}[]`, 'Any encounter actors that include the trigger actor.'),
    distances: () => mkVar('object', 'Distances to other tokens on the scene, mapped by their token id.'),
    vehicles: () => mkVar(`${cls('actor').name}[]`, 'Any vehicle actors that include the trigger actor.'),
    groups: () => mkVar(`${cls('actor').name}[]`, 'Any group actors that include the trigger actor.'),
    regions: () => mkVar(`Set<${cls('region').name}>`, 'Any regions containing the trigger token.'),
    level: (api) => clsInst(api, CONFIG.Level.documentClass, 'The scene level of the trigger token.'),
    scene: (api) => clsInst(api, CONFIG.Scene.documentClass, 'The scene for the trigger token.'),

    // Shared
    config: (_, {event}) => mkVar('object', INFO.config[event]),
    dialog: (_, {event}) => mkVar('object', INFO.dialog[event]),
    message: (_, {event}) => mkVar('object', INFO.message[event]),
    updates: (_, {event}) => mkVar('object', INFO.updates[event]),
    targetToken: (api, {event}) => clsInst(api, CONFIG.Token.documentClass, INFO.targetToken[event]),

    // Damage    
    ditem: (api) => mkVar('object', 'Live copy of workflow.damageItem.'),

    // Region
    tokens: () => mkVar(`${cls('token').name}[]`, 'Tokens in the trigger region.'),

    // Effect
    effect: (api) => clsInst(api, CONFIG.ActiveEffect.documentClass, 'The trigger ActiveEffect.'),

    // Combat
    combatant: (api) => clsInst(api, CONFIG.Combatant.documentClass, 'Current combatant.'),
    previousCombatant: (api) => clsInst(api, CONFIG.Combatant.documentClass, 'Previous combatant.'),
    previousRound: () => mkVar('number', 'Previous combat round.'),
    previousTurn: () => mkVar('number', 'Previous combat turn.'),
    round: () => mkVar('number', 'Current combat round.'),
    turn: () => mkVar('number', 'Current combat turn.'),
    context: () => mkVar('object', 'Combat event context.'),

    // Items
    ddbCharacter: (api) => {
        let ddb = game.modules.get(ddbi.CONFIG.id);
        if (ddb) return clsInst(api, ddb.api.lib.DDBCharacter, 'DDBI character helpers.');
        return mkVar('object', 'DDBI is not installed!');
    },

    // Rest
    result: () => mkVar('object', 'Changes to apply from rest.'),

    // Check / Skill / Save / Tool
    roll: (api) => clsInst(api, CONFIG.Dice.D20Roll, 'The trigger roll.'),

    // Time
    worldTime: () => mkVar('number', 'Current world time.'),
    diff: () => mkVar('number', 'Change in world time.'),

    // Summon
    summon: (api) => clsInst(api, CONFIG.Token.documentClass, 'The summoned token.'),

    // Called
    data: () => mkVar('object', 'Called event data.')
};

const OVERRIDES = {
    options: (_, {event}) => ({info: mkInfo(INFO.options[event])}),
    actor: () => ({info: mkInfo('The trigger actor.')}),
    item: () => ({info: mkInfo('The item for this workflow.')}),
    activity: () => ({info: mkInfo('The activity for this workflow.')}),
    token: (api) => clsInst(api, CONFIG.Token.documentClass, 'The trigger token.')
};

// TODO any more detail here?
const INFO = {
    options: {
        none: 'Event options.',
        move: 'Move event options.',
        region: 'Region event options.',
        effect: 'Effect event options.',
        aura: 'Aura event options.',
        item: 'Item event options.',
        time: 'Time event options.'
    },
    updates: {
        region: 'Region updates.',
        effect: 'Effect updates.',
        item: 'Item updates.',
        summon: 'Summon updates.'
    },
    targetToken: {
        roll: 'The token taking damage.',
        aura: 'The token on which to apply an aura.'
    },
    config:{
        roll: 'Item roll configuration.',
        rest: 'Rest configuration.',
        check: 'Dice roll configuration.',
        save: 'Dice roll configuration.',
        skill: 'Dice roll configuration.',
        tool: 'Dice roll configuration.'
    },
    dialog: {
        roll: 'Item roll dialog configuration.',
        check: 'Dice roll dialog configuration.',
        save: 'Dice roll dialog configuration.',
        skill: 'Dice roll dialog configuration.',
        tool: 'Dice roll dialog configuration.'
    }, 
    message: {
        roll: 'Item roll message configuration.',
        check: 'Dice message configuration.',
        save: 'Dice message configuration.',
        skill: 'Dice message configuration.',
        tool: 'Dice message configuration.'
    }
};

function registerCAT({mergeCompletions, objectToCompletions, rebuildSignatureMap, tree}) {
    if (!globalThis.cat || !!tree.cat) return;
    tree.cat = {type: 'object', detail: 'object', info: _loc('CAT.Manual.MethodLabel')};
    const members = objectToCompletions(globalThis.cat, 3);
    mergeCompletions(tree.cat, members);
    rebuildSignatureMap();
    Logging.addEntry('DEBUG', `macro-autocomplete integration finished with ${Object.keys(members).length} members`);
}

function inContext(config, context, docType) {
    const codeMirror = context.element.querySelector('code-mirror');
    if (!codeMirror) return;
    const autocomplete = game.modules.get('macro-autocomplete')?.api;
    if (!autocomplete) return;
    const baseTree = autocomplete.tree;
    const tree = baseTree.cat?.children;
    if (!tree) return;
    const completions = {
        ...tree.utils?.children,
        constants: tree.lib?.children.constants,
        document: alias(autocomplete, docType, 'The document from which this macro was fetched.'),
        name: mkVar('string', 'The name of the document from which this macro was fetched.'),
        identifier: mkVar('string', 'The identifier of this macro.'),
        priority: mkVar('number', 'The priority of this macro.'),
        macroName: mkVar('string', 'The name of this macro.'),
        macro: mkVar('string', 'This macro.'),
        castData: {
            ...mkVar('object', 'Cast scaling info for spell effects.'),
            children: {
                castLevel: mkVar('number', 'Spell upcast level.'),
                baseLevel: mkVar('number', 'Spell level.'),
                saveDC: mkVar('number', 'Spell DC')
            }
        }
    };
    const event = config.inputs.event?.value || 'none';
    const pass = config.inputs.pass?.value || 'none';
    const macroData = dataForMacroEvent(event, pass);
    for (const key of macroData) {
        if (key in completions) continue;
        if (key in baseTree) {
            if (key in OVERRIDES)
                completions[key] = {...baseTree[key], ...OVERRIDES[key](autocomplete, {event, pass, docType})};
            continue;
        }
        let triggerData = VARS[key]?.(autocomplete, {event, pass, docType});
        completions[key] = triggerData || mkVar('any', 'unregistered');
    }
    autocomplete.setContextCompletions(codeMirror, completions /*, blockly */);
    Logging.addEntry('DEBUG', `macro-autocomplete injected ${Object.keys(completions).length} contextual completions`);
}

function dataForMacroEvent(event, pass) {
    let eventData;
    const get = cls => cls.prototype.appendData({});
    const isPass = (p, tgt) => p === tgt || p.toLowerCase().includes(tgt.toLowerCase());
    switch (event) {
        case 'move': eventData = get(Events.MovementEvent); break;
        case 'region': eventData = get(Events.RegionEvent); break;
        case 'effect': eventData = get(Events.EffectEvent); break;
        case 'combat': eventData = get(Events.CombatEvent); break;
        case 'aura': eventData = get(Events.AuraEvent); break;
        case 'rest': eventData = get(Events.RestEvent); break;
        case 'check': eventData = get(Events.CheckEvent); break;
        case 'skill': eventData = get(Events.SkillEvent); break;
        case 'save': eventData = get(Events.SaveEvent); break;
        case 'tool': eventData = get(Events.ToolEvent); break;
        case 'time': eventData = get(Events.TimeEvent); break;
        case 'summon': eventData = get(Events.SummonEvent); break;
        case 'called': eventData = get(Events.CalledEvent); break;
        case 'item':
            if (isPass(pass, constants.itemPasses.munched)) {
                eventData = get(Events.ItemsEvent);
                break;
            }
            eventData = get(Events.ItemEvent);
            break;
        case 'roll':
            if (isPass(pass, constants.workflowPasses.preTargeting)) {
                eventData = get(Events.PreTargetingWorkflowEvent);
                break;
            }
            if ([
                constants.workflowPasses.damage,
                constants.workflowPasses.damageBonuses,
                constants.workflowPasses.damageFlatReductions,
                constants.workflowPasses.damagePercentReductions,
                constants.workflowPasses.damageComplete
            ].some(p => isPass(pass, p))) {
                eventData = get(Events.TokenDamageWorkflowEvent);
                break;
            }
            eventData = get(Events.WorkflowEvent); 
            break;
    }
    return Object.keys(eventData ?? {});
}

export default {
    registerCAT,
    inContext
};
