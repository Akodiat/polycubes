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

function createPolysphereSystem() {
    let defaultRule = "[[[1,-2.5,0,0,-0.5,1,0,0],[1,-2,-1,0,-1,0,0,0],[1,1,0,0,1,1,-0,0],[1,0,-1,0,-1,0,1,0],[1,0,1,0,0,-1,0,1],[1,0,0,-1,-0,1,-1,0],[1,0,0,1,1,0,0,1]],[[-1,-1,0,0,-1,1,0,0]]]";
    let rule = JSON.parse(getUrlParam("rule", defaultRule));
    // Replace rotation number with vector
    rule = rule.map(function(patches) {return patches.map(function(p) {
        //https://en.wikipedia.org/wiki/Spherical_coordinate_system#Unique_coordinates
        let color = p[0];
        let pos = new THREE.Vector3(p[1], p[2], p[3]);
        let q = new THREE.Quaternion(p[4], p[5], p[6], p[7]);
        return new Patch(color, pos, q);
    });});


    system = new PolysphereSystem(rule, scene, 10);
    orbit.target = system.centerOfMass;

    system.addParticle(new THREE.Vector3(), system.rule[0], 0);
    system.processMoves();
    render();
}

let system;