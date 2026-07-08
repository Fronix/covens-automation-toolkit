/** @import {CompendiumCollection} from '@client/documents/collections/_module.mjs' */
import {Logging} from '../lib/_module.mjs';
import {documentUtils} from '../utilities/_module.mjs';
const fields = foundry.data.fields;

/**
 * @typedef {Object} AutomationData
 * @property {string} source
 * @property {'2014'|'2024'} rules
 * @property {string} version
 * @property {string} uuid
 * @property {AutomationConfig[]} config
 * @property {string} [notes]
 */

// TODO: More fully document
/**
 * @typedef {Object} AutomationConfig
 * @property {string} key
 * @property {string|boolean|null|number|string[]} default
 * @property {string} label
 * @property {string} type
 * @property {string} [i18nOption]
 * @property {string} [category]
 */

class Automation {
    constructor(source, rules, identifier, uuid, version, {config = {}, notes, monsterIdentifier, scales, type} = {}) {
        this.source = source;
        this.rules = rules;
        this.identifier = identifier;
        this.version = version;
        this.uuid = uuid;
        this.config = config;
        this.notes = notes;
        this.monsterIdentifier = monsterIdentifier;
        this.scales = scales;
        this.type = type;
    }

    /**
     * @type {string}
     */
    source;

    /**
     * @type {'2014'|'2024'|'all'}
     */
    rules;

    /**
     * @type {string}
     */
    identifier;

    /**
     * @type {string}
     */
    version;

    /**
     * @type {string}
     */
    uuid;

    /**
     * @type {AutomationConfig[]}
     */
    config;

    /**
     * @type {string}
     */
    notes;

    /**
     * @type {string}
     */
    monsterIdentifier;

    /**
     * @type {array}
     */
    scales;

    /**
     * @type {string}
     */
    type;
    
    async getDocument() {
        return await fromUuid(this.uuid);
    }
    getConfigValue(key) {
        return this.config?.[key]?.default;
    }
}
export class RegisteredAutomations {
    #automationsSchema = new fields.SchemaField({
        source: new fields.StringField({required: true, nullable: false}),
        rules: new fields.StringField({required: true, nullable: false}),
        identifier: new fields.StringField({required: true, nullable: false}),
        version: new fields.StringField({required: true, nullable: false}),
        uuid: new fields.StringField({required: true, nullable: false}),
        config: new fields.ObjectField({required: false, nullable: false}),
        notes: new fields.StringField({required: false, nullable: false}),
        monsterIdentifier: new fields.StringField({required: false, nullable: false}),
        scales: new fields.ArrayField(new fields.ObjectField({required: true, nullable: false}), {required: false}),
        type: new fields.StringField({required: false, nullable: false})
    });
    #multiAutomationsSchema = new fields.ArrayField(this.#automationsSchema);

    /**
     * @type {Automation[]}
     */
    automations = [];

    /**
     * @type {Set<string>}
     */
    sources = new Set();

    /**
     * @type {Object}
     */
    sourceNames = {};

    /**
     * Get the registered Automation (or Automations), if any, by identifier & other criteria
     * @param {string} identifier                           The identifier of the automation
     * @param {object} [options={}]                         Additional options
     * @param {'all'|'2014'|'2024'} [options.rules='all']   The ruleset of the automation
     * @param {string} [options.source='all']               The source of the automation
     * @param {boolean} [options.multiple=false]            Whether to return all matching automations or only one
     * @param {string} [options.monsterIdentifier]          Match using a monster identifier as well
     * @param {string} [options.type]                       The item type to get automation(s) for
     * @param {string[]} [options.excludeSources]           Which sources to exclude from consideration, if any
     * @returns {Automation[]|Automation|undefined}
     */
    getAutomationByIdentifier(identifier, {rules = 'all', source = 'all', multiple = false, monsterIdentifier, type, excludeSources = []} = {}) {
        const predicate = automation => {
            if (automation.identifier !== identifier) return false;
            if (rules !== 'all' && automation.rules !== 'all' && automation.rules !== rules) return false;
            if (source !== 'all' && automation.source !== source) return false;
            if (excludeSources.includes(automation.source)) return false;
            if (monsterIdentifier && monsterIdentifier !== automation.monsterIdentifier) return false;
            if (type && type !== automation.type) return false;
            return true;
        };
        return multiple ? this.automations.filter(predicate) : this.automations.find(predicate);
    }

    /**
     * Register a single automation
     * @param {AutomationData} data 
     */
    registerAutomation(data) {
        const validationError = this.#automationsSchema.validate(data);
        if (validationError) {
            Logging.addRegistrationError(data, 'automation', validationError.asError());
            return false;
        }
        this.automations.push(new Automation(data.source, data.rules, data.identifier, data.uuid, data.version, {
            config: data.config,
            notes: data.notes,
            monsterIdentifier: data.monsterIdentifier,
            scales: data.scales,
            type: data.type
        }));
        this.sources.add(data.source);
        Logging.addEntry('DEBUG', 'Automation Registered: ' + data.identifier + ' from ' + data.source + ' with version ' + data.version);
        return true;
    }

    /**
     * Register multiple automations
     * @param {AutomationData[]} data 
     */
    registerAutomations(data) {
        const validationError = this.#multiAutomationsSchema.validate(data);
        if (validationError) {
            Logging.addRegistrationError(data, 'automation', validationError.asError());
            return false;
        }
        return data.map(i => this.registerAutomation(i));
    }

    /**
     * Get the value of a config key for a given document
     * @param {foundry.abstract.Document} document 
     * @param {string} key 
     */
    getConfigValue(document, key) {
        /** @type {AutomationConfig['default']|undefined} */
        const value = document.flags.cat?.config?.[key];
        if (value) return value;
        /** @type {Automation|undefined} */
        const automation = this.getAutomationByIdentifier(documentUtils.getIdentifier(document), {
            rules: documentUtils.getRules(document),
            source: documentUtils.getSource(document)
        });
        return automation?.config?.[key]?.default;
    }

    /**
     * Register a compendium pack of documents with automations
     * @param {CompendiumCollection} pack                                   The compendium pack of documents to register as automations
     * @param {object} [options={}]                                         Additional options
     * @param {Record<string, AutomationConfig[]>} [options.configs2014={}] An object with identifiers as keys and configs as values
     * @param {Record<string, AutomationConfig[]>} [options.configs2024={}] An object with identifiers as keys and configs as values
     * @param {Record<string, AutomationConfig[]>} [options.configsAll={}]  An object with identifiers as keys and configs as values
     * @param {Record<string, string>} [options.versions={}]                An object with identifiers as keys and versions as values
     * @param {Record<string, string>} [options.rules={}]                   An object with identifiers as keys and rulesets as values
     * @param {string} [options.source]                                     The source of the automations
     */
    async registerAutomationCompendium(pack, {configs2014 = {}, configs2024 = {}, configsAll = {}, versions2014 = {}, versions2024 = {}, versionsAll = {}, rules = {}, source, notes2014 = {}, notes2024 = {}, notesAll = {}, scales2014 = {}, scales2024 = {}, scalesAll = {}, typesAll = {}, types2014 = {}, types2024 = {}} = {}) {
        const fields = ['system.identifier', 'system.source.rules', 'flags.cat.automation.version', 'type'];
        let index = await this.#getIndexSafely(pack, fields);
        // A concurrent getIndex from another module (e.g. the compendium browser preloading at
        // ready) can win the in-flight request without our fields; retry once to get them.
        if (pack.metadata.type === 'Item' && index.size && !index.find(document => document.system?.source !== undefined)) {
            index = await this.#getIndexSafely(pack, fields);
        }
        source ??= pack.metadata.packageName;
        const documentType = pack.metadata.type;
        Logging.group('Automation Compendium Registered: ' + pack.metadata.label + ' (' + pack.metadata.packageName + ')');
        //Logging.addEntry('DEBUG', 'Automation Compendium Registered: ' + pack.metadata.label + ' from ' + pack.metadata.packageName);
        const results = index.map(document => {
            try {
                return this.#registerIndexEntry(document, {documentType, source, configs2014, configs2024, configsAll, versions2014, versions2024, versionsAll, rules, notes2014, notes2024, notesAll, scales2014, scales2024, scalesAll, typesAll, types2014, types2024});
            } catch (error) {
                Logging.addRegistrationError({pack: pack.metadata.id, document: document.name}, 'automation', error);
                return false;
            }
        });
        Logging.groupEnd();
        return results;
    }

    // Packs whose index requests time out during a busy world load (other modules doing
    // heavy compendium work) are retried in deferred rounds once the server calms down.
    async #retryFailedPacks(module, packIds, options, round = 1) {
        const maxRounds = 3;
        await new Promise(resolve => setTimeout(resolve, 30000 * round));
        const stillFailing = [];
        for (const packId of packIds) {
            const pack = game.packs.get(packId);
            if (!pack) continue;
            try {
                // Scrub any partial registration from an earlier attempt before re-registering
                this.automations = this.automations.filter(automation => !automation.uuid.startsWith('Compendium.' + packId + '.'));
                const packResults = await this.registerAutomationCompendium(pack, options);
                Logging.addEntry('INFO', 'Recovered automation registration for ' + packId + ' (' + packResults.filter(Boolean).length + ' automations, retry round ' + round + ')', {force: true});
            } catch (error) {
                stillFailing.push(packId);
                Logging.addRegistrationError({pack: packId, retryRound: round}, 'automation', error);
            }
        }
        if (!stillFailing.length) return;
        if (round >= maxRounds) {
            Logging.addEntry('ERROR', 'Automation registration permanently failed for: ' + stillFailing.join(', '), {force: true});
            return;
        }
        this.#retryFailedPacks(module, stillFailing, options, round + 1);
    }

    // Index requests fired under heavy startup socket traffic can stall for a long time;
    // race a timeout and retry instead of hanging forever.
    async #getIndexSafely(pack, fields, {timeout = 10000, attempts = 3} = {}) {
        for (let attempt = 1; attempt <= attempts; attempt++) {
            const index = await Promise.race([
                pack.getIndex({fields}),
                new Promise(resolve => setTimeout(() => resolve(null), timeout))
            ]);
            if (index) return index;
            Logging.addEntry('WARNING', 'Index request for ' + pack.metadata.id + ' timed out (attempt ' + attempt + '/' + attempts + ')', {force: true});
        }
        throw new Error('Unable to build index for compendium ' + pack.metadata.id);
    }

    #registerIndexEntry(document, {documentType, source, configs2014, configs2024, configsAll, versions2014, versions2024, versionsAll, rules, notes2014, notes2024, notesAll, scales2014, scales2024, scalesAll, typesAll, types2014, types2024}) {
        const identifier = documentUtils.getIdentifier(document, {documentType});
        const rule = rules[identifier] ?? documentUtils.getRules(document, {documentType});
        let config;
        let notes;
        let scales;
        let type;
        let version;
        switch (rule) {
            case '2014':
                config = configs2014[identifier] ?? configsAll[identifier];
                notes = notes2014[identifier] ?? notesAll[identifier];
                scales = scales2014[identifier] ?? scalesAll[identifier];
                type = types2014[identifier] ?? typesAll[identifier];
                version = versions2014[identifier] ?? documentUtils.getVersion(document) ?? '0';
                break;
            case '2024':
                config = configs2024[identifier] ?? configsAll[identifier];
                notes = notes2024[identifier] ?? notesAll[identifier];
                scales = scales2024[identifier] ?? scalesAll[identifier];
                type = types2024[identifier] ?? typesAll[identifier];
                version = versions2024[identifier] ?? documentUtils.getVersion(document) ?? '0';
                break;
            default:
                config = configsAll[identifier];
                notes = notesAll[identifier];
                scales = scalesAll[identifier];
                type = typesAll[identifier];
                version = versionsAll[identifier] ?? documentUtils.getVersion(document) ?? '0';
                break;
        }
        const data = {
            source,
            rules: rule,
            identifier,
            version,
            uuid: document.uuid,
            config,
            notes,
            scales,
            type: type ?? document.type
        };
        return this.registerAutomation(data);
    }

    /**
     * Register multiple compendium packs of documents with automations, with those packs being provided by the given module ID
     * @param {string} id                                                   The id of the module to register the compendium packs of
     * @param {object} [options={}]                                         Additional options
     * @param {string[]} [options.ignoredPackIds=[]]                        A list of compendium pack IDs to ignore and not register
     * @param {Record<string, AutomationConfig[]>} [options.configs2014={}] An object with identifiers as keys and configs as values
     * @param {Record<string, AutomationConfig[]>} [options.configs2024={}] An object with identifiers as keys and configs as values
     * @param {Record<string, AutomationConfig[]>} [options.configsAll={}]  An object with identifiers as keys and configs as values
     * @param {Record<string, string>} [options.versions={}]                An object with identifiers as keys and versions as values
     * @param {Record<string, string>} [options.rules={}]                   An object with identifiers as keys and rulesets as values
     */
    async registerAutomationModule(id, {ignoredPackIds = [], configs2014 = {}, configs2024 = {}, configsAll = {}, versions2014 = {}, versions2024 = {}, versionsAll = {}, rules = {}, notes2014 = {}, notes2024 = {}, notesAll = {}, scales2014 = {}, scales2024 = {}, scalesAll = {}, typesAll = {}, types2014 = {}, types2024 = {}} = {}) {
        const module = game.modules.get(id);
        if (!module?.active) return false;
        Logging.group('Automation Module Registered: ' + module.title);
        const itemPacks = module.packs.filter(pack => pack.type === 'Item' && !ignoredPackIds.includes(pack.id));
        if (!itemPacks.size) return;
        // Sequential on purpose: a burst of concurrent index requests during world load can be
        // dropped under startup socket traffic and never resolve, silently losing packs.
        const options = {configs2014, configs2024, configsAll, versions2014, versions2024, versionsAll, rules, source: id, notes2014, notes2024, notesAll, scales2014, scales2024, scalesAll, types2014, types2024, typesAll};
        const results = [];
        const failedPackIds = [];
        let registered = 0;
        for (const data of itemPacks) {
            const pack = game.packs.get(data.id);
            if (!pack) {
                results.push(false);
                continue;
            }
            try {
                const packResults = await this.registerAutomationCompendium(pack, options);
                registered += packResults.filter(Boolean).length;
                results.push(packResults);
            } catch (error) {
                failedPackIds.push(data.id);
                Logging.addRegistrationError({pack: data.id}, 'automation', error);
                results.push(false);
            }
        }
        Logging.groupEnd();
        Logging.addEntry(failedPackIds.length ? 'WARNING' : 'INFO', 'Automation Module ' + module.title + ': registered ' + registered + ' automations from ' + itemPacks.size + ' packs' + (failedPackIds.length ? ' (' + failedPackIds.length + ' packs failed, retrying later)' : ''), {force: failedPackIds.length > 0});
        if (failedPackIds.length) this.#retryFailedPacks(module, failedPackIds, options);
        return results;
    }

    registerSourceName(id, name) {
        if (!id || !name) return;
        this.sourceNames[id] = name;
    }

    getSourceName(id) {
        return this.sourceNames[id] ?? id;
    }

    unregisterAutomationsBySource(source) {
        const initialLength = this.automations.length;
        this.automations = this.automations.filter(automation => automation.source !== source);
        if (this.automations.length !== initialLength) {
            this.sources.delete(source);
            Logging.addEntry('DEBUG', 'Unregistered all automations from source: ' + source);
        }
    }

    unregisterAutomation(source, identifier, rules) {
        const initialLength = this.automations.length;
        this.automations = this.automations.filter(automation => !(automation.source === source && automation.identifier === identifier && automation.rules === rules));
        if (this.automations.length !== initialLength) Logging.addEntry('DEBUG', 'Unregistered automation: ' + identifier + ' from ' + source + ' (' + rules + ')');
    }

    unregisterUuid(uuid) {
        const initialLength = this.automations.length;
        this.automations = this.automations.filter(automation => automation.uuid !== uuid);
        if (this.automations.length !== initialLength) Logging.addEntry('DEBUG', 'Unregistered automation with uuid: ' + uuid);
    }
}
export default {
    Automation,
    RegisteredAutomations
};