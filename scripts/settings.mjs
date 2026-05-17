import {genericUtils} from './utilities/_module.mjs';

/**
 * Array of settings to register.
 * Required properties:
 *  key,
 *  type,
 *  default,
 *  menu
 * 
 * Optional properties:
 *  onChange,
 *  choices,
 *  reloadRequired,
 *  select
 */
const settings = [
    {
        key: 'displayDebugLogs',
        type: Boolean,
        default: true // Change this to false eventually.
    },
    {
        key: 'automationSources',
        type: Object,
        default: {
            dnd5e: {
                enabled: true,
                priority: 100
            },
            'dnd-players-handbook': {
                enabled: true,
                priority: 99
            },
            'dnd-dungeon-masters-guide': {
                enabled: true,
                priority: 98
            },
            'ddb-importer': {
                enabled: true,
                priority: 97
            },
            'midi-qol': {
                enabled: true,
                priority: 96
            }
        }
    }
];

function addSetting(options) {
    const defaultOptions = {
        scope: 'world',
        config: false
    };
    game.settings.register('cat', options.key, genericUtils.mergeObject(defaultOptions, options));
}
export function registerSettings() {
    settings.sort(genericUtils.keySort('key'));
    for (const setting of settings) {
        addSetting(setting);
    }
}