function createPolycubeSystem() {
    let rules = {};

    // Parse rule
    let vars = getUrlVars();
    if ("rule" in vars) {
        rules = parseHexRule(vars["rule"]);
    } else if ("hexRule" in vars) {
        rules = parseHexRule(vars["hexRule"]);
    } else if ("decRule" in vars) {
        rules = parseDecRule(vars["decRule"]);
    } else {
        defaultRule = "[[1,1,1,1,1,1],[-1,0,0,0,0,0]]";
        rules = JSON.parse(getUrlParam("rules",defaultRule));

        // Replace rotation number with vector
        rules = rules.map(function(rule) {return rule.map(function(face, i) {
            let r = faceRotations[i].clone();
            if(typeof face == "number") {
                return {'color':face, 'alignDir':r};
            } else {
                r.applyAxisAngle(ruleOrder[i], face[1]*Math.PI/2);
                return {'color':face[0], 'alignDir':r};
            }
        });});
    }
    let assemblyMode = getUrlParam("assemblyMode", 'seeded');

    try {
        document.getElementById('assemblyMode').value = assemblyMode;
    } catch (error) {
        ; // Might not have an assembly mode DOM
    }


    nMaxCubes = parseInt(getUrlParam("nMaxCubes", 100));
    maxCoord = parseInt(getUrlParam("maxCoord", 100));

    system = new PolycubeSystem(rules, scene, nMaxCubes, maxCoord, assemblyMode);

    orbit.target = system.centerOfMass;

    system.seed();
    system.processMoves();
    render();
}

function createKlossSystem() {
    let vars = getUrlVars();
    if ("rule" in vars) {
        rule = parseKlossString(vars["rule"]);
    } else if ("hexRule" in vars) {
        rule = polycubeRuleToKloss(parseHexRule(vars["hexRule"]));
    } else if ("decRule" in vars) {
        rule = polycubeRuleToKloss(parseDecRule(vars["decRule"]));
    } else {
        let defaultRule = "[[[1,-1.25,0,0,-0.5,1,0,0],[1,-1,-1,0,-1,0,0,0],[1,0.5,0,0,1,1,-0,0],[1,0,-0.5,0,-1,0,1,0],[1,0,0.5,0,0,-1,0,1],[1,0,0,-0.5,-0,1,-1,0],[1,0,0,0.5,1,0,0,1]],[[-1,-0.5,0,0,-1,1,0,0]]]";
        rule = parseKlossString(defaultRule);
    }

    system = new KlossSystem(rule, scene, 100);
    orbit.target = system.centerOfMass;

    system.addParticle(new THREE.Vector3(), system.rule[0], 0);
    system.processMoves();
    render();
}

let system;