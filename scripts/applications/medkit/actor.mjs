import MedkitApp from './base.mjs';
import ItemMedkit from './item.mjs';
import {constants} from '../../lib/_module.mjs';
import {automationUtils, documentUtils} from '../../utilities/_module.mjs';
const {fields} = foundry.data;

export default class ActorMedkit extends MedkitApp {
    static DOCUMENT_TYPE = 'actor';
    static DEFAULT_OPTIONS = {
        id: 'medkit-window-actor',
        actions: {
            toggleCR: ActorMedkit.#toggleCR,
            toggleCV: ActorMedkit.#toggleCV,
            removeCondition: ActorMedkit.#removeCondition,
            openItemMedkit: ActorMedkit.#openItemMedkit
        }
    };

    static PARTS = {
        ...MedkitApp.SHARED_PARTS,
        automations: {template: 'modules/cat/templates/medkit/actor/automations.hbs'},
        ...MedkitApp.GENERIC_PART,
        embedded: {template: 'modules/cat/templates/medkit/shared/embedded-tab.hbs'},
        docprops: {template: 'modules/cat/templates/medkit/actor/docprops.hbs'},
        macros: {template: 'modules/cat/templates/medkit/shared/registered-macros.hbs'}
    };

    static TABS = {
        sheet: {
            tabs: [
                {id: 'automations', icon: 'fa-solid fa-download', label: 'CAT.MEDKIT.TABS.Automations'},
                MedkitApp.GENERIC_TAB,
                {id: 'embedded', icon: 'fa-solid fa-feather-pointed', label: 'CAT.MEDKIT.TABS.Embedded'},
                {id: 'docprops', icon: 'fa-solid fa-sliders', label: 'CAT.MEDKIT.TABS.DocProps'},
                {id: 'macros', icon: 'fa-solid fa-wand-magic-sparkles', label: 'CAT.MEDKIT.TABS.Macros'}
            ],
            initial: 'automations'
        }
    };

    _getMassApplyItems() {
        return Array.from(this.document.items ?? []);
    }

    // One row per item that has (or could have) an automation, mirroring what massApply would touch.
    #prepareAutomationOverview() {
        const rowMeta = {
            [constants.automationStatus.OUTDATED]: {status: constants.MEDKIT_STATUSES.OUTDATED, label: 'CAT.MEDKIT.STATUSES.Outdated', icon: 'fa-solid fa-circle-exclamation', order: 0},
            [constants.automationStatus.AVAILABLE]: {status: constants.MEDKIT_STATUSES.AVAILABLE, label: 'CAT.MEDKIT.STATUSES.Available', icon: 'fa-solid fa-circle-plus', order: 1},
            [constants.automationStatus.CONFIGURABLE]: {status: constants.MEDKIT_STATUSES.CONFIGURABLE, label: 'CAT.MEDKIT.STATUSES.Configurable', icon: 'fa-solid fa-circle-check', order: 2},
            [constants.automationStatus.GENERIC]: {status: constants.MEDKIT_STATUSES.CONFIGURABLE, label: 'CAT.MEDKIT.STATUSES.Generic', icon: 'fa-solid fa-circle-check', order: 2},
            [constants.automationStatus.UP_TO_DATE]: {status: constants.MEDKIT_STATUSES.UP_TO_DATE, label: 'CAT.MEDKIT.STATUSES.UpToDate', icon: 'fa-solid fa-circle-check', order: 3}
        };
        const rows = [];
        const counts = {outdated: 0, available: 0, current: 0, none: 0};
        for (const item of this.document.items ?? []) {
            if (item.flags.cat?.ignoreItem) continue;
            let status = automationUtils.getAutomationStatus(item);
            let detail;
            switch (status) {
                case constants.automationStatus.AVAILABLE: {
                    const available = automationUtils.getAvailableAutomations(item, {excludeSources: constants.massApplyExcludeSources});
                    if (!available.length) {
                        status = constants.automationStatus.UNAVAILABLE;
                        break;
                    }
                    detail = [...new Set(available.map(automation => constants.automations.getSourceName(automation.source)))].join(', ');
                    counts.available++;
                    break;
                }
                case constants.automationStatus.OUTDATED: {
                    const before = documentUtils.getVersion(item);
                    const after = automationUtils.getCurrentAutomation(item)?.version;
                    if (before && after && before !== after) detail = _loc('CAT.MEDKIT.Actor.Overview.Versions', {before, after});
                    counts.outdated++;
                    break;
                }
                case constants.automationStatus.UP_TO_DATE:
                case constants.automationStatus.CONFIGURABLE:
                case constants.automationStatus.GENERIC:
                    detail = documentUtils.getVersion(item);
                    counts.current++;
                    break;
            }
            const meta = rowMeta[status];
            if (!meta) {
                counts.none++;
                continue;
            }
            rows.push({id: item.id, name: item.name, img: item.img, detail, ...meta});
        }
        rows.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'en', {sensitivity: 'base'}));
        return {rows, counts};
    }

    // Per-condition flag values are comma-separated strings: 'true' (all saves) or 'wis,cha' (subset).
    #parseConditionValue(value) {
        const parts = String(value ?? '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
        return {
            all: parts.includes('true') || parts.includes('1'),
            abilities: new Set(parts.filter(p => p !== 'true' && p !== '1'))
        };
    }

    #buildConditionRows(flagKey, picked, sortedTypes) {
        const flags = this._getFlags();
        const abilities = Object.entries(CONFIG.DND5E?.abilities ?? {})
            .map(([key, cfg]) => ({key, label: cfg.abbreviation?.toUpperCase() ?? key.toUpperCase()}));
        return picked.map(conditionKey => {
            const parsed = this.#parseConditionValue(flags[flagKey]?.[conditionKey]);
            const type = sortedTypes.find(t => t.key === conditionKey);
            return {
                key: conditionKey,
                label: type?.label ?? conditionKey,
                all: parsed.all,
                abilities: abilities.map(a => ({key: a.key, label: a.label, active: parsed.abilities.has(a.key)}))
            };
        });
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const flags = this._getFlags();
        context.fields = {
            name: new fields.StringField({label: _loc('CAT.MEDKIT.Actor.Name.Label')}),
            ignoreActor: new fields.BooleanField({label: _loc('CAT.MEDKIT.Actor.IgnoreActor.Label')})
        };
        this._prepareIdentifierField(context);
        context.ignoreActor = flags.ignoreActor ?? false;
        const conditionTypes = CONFIG.DND5E?.conditionTypes ?? {};
        const sortedTypes = Object.entries(conditionTypes)
            .map(([key, cfg]) => ({key, label: cfg.label ?? cfg.name ?? key}))
            .sort((a, b) => a.label.localeCompare(b.label, 'en', {sensitivity: 'base'}));
        for (const flagKey of ['CR', 'CV']) {
            const picked = Object.keys(flags[flagKey] ?? {});
            const pickedSet = new Set(picked);
            context[`conditionChoices${flagKey}`] = sortedTypes.map(t => ({value: t.key, label: t.label, selected: pickedSet.has(t.key)}));
            context[`${flagKey.toLowerCase()}ConditionRows`] = this.#buildConditionRows(flagKey, picked, sortedTypes);
        }
        context.overview = this.#prepareAutomationOverview();
        return context;
    }

    /** @this {ActorMedkit} */
    static #openItemMedkit(_event, target) {
        const item = this.document.items.get(target.dataset.itemId);
        if (item) new ItemMedkit({document: item}).render({force: true});
    }

    // Add/remove condition keys via multi-combobox; default new entries to 'true' (all saves).
    async _onChangeForm(formConfig, event) {
        const name = event.target?.name ?? event.target?.getAttribute?.('name');
        if (name === 'flags.cat.CR' || name === 'flags.cat.CV') {
            const multi = event.target.closest?.('cat-multi-combobox');
            if (multi) {
                const raw = multi.querySelector('input[type="hidden"]')?.value ?? '';
                let arr;
                try { arr = raw ? JSON.parse(raw) : []; }
                catch { arr = []; }
                const flagKey = name === 'flags.cat.CR' ? 'CR' : 'CV';
                const current = this._getFlags()[flagKey] ?? {};
                const next = {};
                for (const key of arr) next[key] = current[key] ?? 'true';
                foundry.utils.setProperty(this._getFlags(), flagKey, next);
                this.render();
                return;
            }
        }
        await super._onChangeForm(formConfig, event);
    }

    #mutateCondition(flagKey, conditionKey, abilityKey) {
        const flags = this._getFlags();
        const parsed = this.#parseConditionValue(flags[flagKey]?.[conditionKey]);
        if (abilityKey === 'all') {
            // [All] click sets value to 'true' and clears ability subset; pressing again is a no-op.
            if (parsed.all && !parsed.abilities.size) return;
            foundry.utils.setProperty(flags, `${flagKey}.${conditionKey}`, 'true');
        } else {
            // Otherwise toggle this ability in/out of the subset.
            let abilities;
            if (parsed.all) abilities = new Set([abilityKey]);
            else {
                abilities = new Set(parsed.abilities);
                if (abilities.has(abilityKey)) abilities.delete(abilityKey);
                else abilities.add(abilityKey);
            }
            const next = abilities.size ? Array.from(abilities).join(',') : 'true';
            foundry.utils.setProperty(flags, `${flagKey}.${conditionKey}`, next);
        }
        this.render();
    }

    /** @this {ActorMedkit} */
    static #toggleCR(_event, target) {
        this.#mutateCondition('CR', target.dataset.condition, target.dataset.ability);
    }

    /** @this {ActorMedkit} */
    static #toggleCV(_event, target) {
        this.#mutateCondition('CV', target.dataset.condition, target.dataset.ability);
    }

    /** @this {ActorMedkit} */
    static #removeCondition(_event, target) {
        const flagKey = target.dataset.flagKey;
        const condition = target.dataset.condition;
        const flags = this._getFlags();
        if (!flags[flagKey]) return;
        delete flags[flagKey][condition];
        this.render();
    }
}
