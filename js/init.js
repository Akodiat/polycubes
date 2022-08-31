function createPolycubeSystem() {
    let rule = {};

    // Parse rule
    let vars = getUrlVars();
    if (vars.has("rule")) {
        rule = parseHexRule(vars.get("rule"));
    } else if (vars.has("hexRule")) {
        rule = parseHexRule(vars.get("hexRule"));
    } else if (vars.has("decRule")) {
        rule = parseDecRule(vars.get("decRule"));
    } else {
        rule = parseHexRule("040404040404840000000000");
    }
    let assemblyMode = getUrlParam("assemblyMode", 'seeded');

    let groupsStr = getUrlParam("groups", undefined);
    let groups
    if (groupsStr) {
        groups = JSON.parse(groupsStr)
    }

    try {
        document.getElementById('assemblyMode').value = assemblyMode;
    } catch (error) {
        ; // Might not have an assembly mode DOM
    }

    let nMaxCubes = parseInt(getUrlParam("nMaxCubes", 1000));
    let maxCoord = parseInt(getUrlParam("maxCoord", 100));

    let torsion = document.getElementById('torsion').checked;
    let allowMismatches = document.getElementById('mismatches').checked;

    system = new PolycubeSystem(rule, scene, nMaxCubes, maxCoord, assemblyMode, undefined, torsion, allowMismatches, groups);

    orbit.target = system.centerOfMass;

    system.seed();
    system.processMoves();
    render();
}

function createKlossSystem() {
    let vars = getUrlVars();
    if (vars.has("rule")) {
        rule = parseKlossString(vars.get("rule"));
    } else if (vars.has("hexRule")) {
        rule = polycubeRuleToKloss(parseHexRule(vars.get("hexRule")));
    } else if (vars.has("decRule")) {
        rule = polycubeRuleToKloss(parseDecRule(vars.get("decRule")));
    } else {
        let defaultRule = "[[[1,-1.25,0,0,-0.5,1,0,0],[1,-1,-1,0,-1,0,0,0],[1,0.5,0,0,1,1,-0,0],[1,0,-0.5,0,-1,0,1,0],[1,0,0.5,0,0,-1,0,1],[1,0,0,-0.5,-0,1,-1,0],[1,0,0,0.5,1,0,0,1]],[[-1,-0.5,0,0,-1,1,0,0]]]";
        rule = parseKlossString(defaultRule);
    }

    system = new KlossSystem(rule, scene, 100);
    orbit.target = system.centerOfMass;

    system.addParticle(new THREE.Vector3(), new THREE.Quaternion(), system.rule[0], 0);
    system.processMoves();
    render();
}

let system;