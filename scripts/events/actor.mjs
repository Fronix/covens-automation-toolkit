import {queryUtils} from '../utilities/_module.mjs';
import {actors, effects} from '../handlers/_module.mjs';
async function updateActor(actor, updates, options, userId) {
    if (!queryUtils.isTheGM()) return;
    await effects.specialDuration.specialDurationHitPoints(actor, updates);
    await effects.specialDuration.specialDurationZeroSpeed(actor);
}
function preDeleteActor(actor, options, userId) {
    return actors.preDeleteActor(actor, options);
}
export default {
    updateActor,
    preDeleteActor
};