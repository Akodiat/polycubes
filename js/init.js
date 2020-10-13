function createPolycubeSystem() {
    let rules = {};

    // Parse rule
    let vars = getUrlVars();
    if ("rule" in vars) {
        rules = parseHexRule(vars["rule"]);
    } else if ("hexRule" in vars) {
        rules = parseHexRule(vars["hexRule"]);
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

    nMaxCubes = JSON.parse(getUrlParam("nMaxCubes",100));

    system = new PolycubeSystem(rules, ruleOrder, scene, nMaxCubes);
    orbit.target = system.centerOfMass;

    system.addParticle(new THREE.Vector3(), system.rule[0], 0);
    system.processMoves();
    render();
}

function createPolysphereSystem() {
    let defaultRule = "[[[-1,0.25,0,0],[1,0.25,0.6,0]]]";
    let rule = JSON.parse(getUrlParam("rule", defaultRule));
    // Replace rotation number with vector
    rule = rule.map(function(patches) {return patches.map(function(p) {
        //https://en.wikipedia.org/wiki/Spherical_coordinate_system#Unique_coordinates
        let tau = 2*Math.PI;
        let color = p[0];
        let phi = p[1] * tau;
        let theta = p[2] * tau;
        let rotation = p[3] * tau;
        return Patch.init(color, phi, theta, rotation);
    });});

    nMaxCubes = JSON.parse(getUrlParam("nMaxCubes",100));

    system = new PolysphereSystem(rule, scene, nMaxCubes);
    orbit.target = system.centerOfMass;

    system.addParticle(new THREE.Vector3(), system.rule[0], 0);
    system.processMoves();
    render();
}

let system;