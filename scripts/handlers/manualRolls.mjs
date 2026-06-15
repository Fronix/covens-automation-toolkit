import CatRollResolver from '../applications/dice/roll-resolver.mjs';
async function manualDamageRolls(workflow) {
    if (!game.settings.get('cat', 'manualRollsEnabled') || !workflow.damageRolls?.length) return;
    if (!workflow.hitTargets?.size && !game.settings.get('cat', 'manualRollsPromptOnMiss')) return;
    if (!CatRollResolver.shouldForce(workflow.actor)) return;
    const newRolls = workflow.damageRolls.map(roll => new CONFIG.Dice.DamageRoll(roll.formula, roll.data, roll.options));
    const label = workflow.item?.name ? (workflow.item.name + ' — ' + (workflow.activity?.name ?? '')).trim() : undefined;
    await CatRollResolver.fulfillBatch(newRolls, label, {prompt: true});
    for (const roll of newRolls) await roll.evaluate({allowInteractive: false});
    await workflow.setDamageRolls(newRolls);
}
export default {
    manualDamageRolls
};
