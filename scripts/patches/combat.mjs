import {summonUtils} from '../utilities/_module.mjs';
import {constants, Logging} from '../lib/_module.mjs';
async function rollInitiative(wrapped, ids, options) {
    if (!ids) return this;
    const idArray = typeof ids === 'string' ? [ids] : ids;
    const processedOwners = new Set();
    const allowedIds = [];
    for (const id of idArray) {
        const combatant = this.combatants.get(id);
        const summonData = summonUtils.getSummonData(combatant.actor);
        if (summonData?.initiative !== 'follows') {
            allowedIds.push(id);
            continue;
        }
        const owner = summonData.owner;
        const ownerCombatant = this.combatants.find(c => c.actorId === owner?.id);
        if (ownerCombatant?.initiative !== null) {
            if (!processedOwners.has(owner.id)) {
                await constants.summons.ownerInitiative(owner);
                processedOwners.add(owner.id);
            }
        }
    }
    if (!allowedIds.length) return this;
    return wrapped(allowedIds, options);
}
function patch(enabled) {
    if (enabled) {
        Logging.addEntry('DEBUG', 'Patching: Combat.prototype.rollInitiative');
        libWrapper.register('cat', 'Combat.prototype.rollInitiative', rollInitiative, 'MIXED');
    } else {
        Logging.addEntry('DEBUG', 'Unpatching: Combat.prototype.rollInitiative');
        libWrapper.unregister('cat', 'Combat.prototype.rollInitiative');
    }
}
export default {
    patch
};