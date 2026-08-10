import * as fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

console.log('Installing Module');

if (fs.existsSync('foundry-config.yaml')) {
    let modulesRoot = '';
    try {
        const fc = await fs.promises.readFile('foundry-config.yaml', 'utf-8');

        const foundryConfig = yaml.load(fc);

        modulesRoot = path.join(foundryConfig.dataPath, 'Data', 'modules');
    } catch (err) {
        console.error(`Error reading foundry-config.yaml: ${err}`);
    }

    // module.json is gitignored and generated - from module-template.json at release
    // time, from module-dev.json here. The dev manifest loads scripts/module.mjs
    // directly, so there's no build step between an edit and a reload.
    const manifest = JSON.parse(await fs.promises.readFile('module-dev.json', 'utf-8'));
    await fs.promises.copyFile('module-dev.json', 'module.json');
    console.log('Wrote module.json from module-dev.json');

    const source = path.resolve();
    const target = path.join(modulesRoot, manifest.id);

    await fs.promises.mkdir(modulesRoot, {recursive: true});

    // 'junction' is ignored on non-Windows, where a plain symlink is made instead
    try {
        await fs.promises.symlink(source, target, 'junction');
        console.log(`Linked ${manifest.id} -> ${target}`);
    } catch (e) {
        if (e.code !== 'EEXIST') throw e;
        const existing = (await fs.promises.lstat(target)).isSymbolicLink() ? await fs.promises.readlink(target) : undefined;
        if (existing && path.resolve(existing) === source) {
            console.log(`Already installed at ${target}`);
        } else if (existing) {
            console.error(`${target} already links to ${existing}. Remove it first if you want this repo there instead.`);
        } else {
            console.error(`${target} already exists and is not a symlink. It looks like a real install of ${manifest.id} - remove it first.`);
        }
    }
} else {
    console.log('Foundry config file did not exist.');
}
