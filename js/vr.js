var rotation = 0;
var rig = new THREE.PerspectiveCamera();
rig.add(camera);
scene.add(rig);
rig.lookAt(polycubeSystem.centerOfMass);

document.body.appendChild(VRButton.createButton(renderer));
renderer.vr.enabled = true;
renderer.setAnimationLoop(function(){
    rotation += 0.001;
    rig.position.x = Math.sin(rotation) * 5;
    rig.position.z = Math.cos(rotation) * 5;
    rig.lookAt(new THREE.Vector3(0,0,0));
    renderer.render(scene, camera);
});

const controller = renderer.vr.getController(0);

const selectListener = (event) => {
    if(firstRule) { // Ignore first click
        firstRule = false;
        return;
    }
    var maxRuleSize = 20;
    var ruleSize = Math.round(Math.random()*maxRuleSize)+1;
    var hexRule = "";
    while(ruleSize--) {
        hexRule += (Math.abs(Math.random()*0xFFFFFFFFFFFF<<0)).toString(16);
    }

    // Parse rule
    rules = parseHexRule(hexRule);
    polycubeSystem.resetRule(rules);
};

controller.addEventListener('select', selectListener);
var firstRule = true;



