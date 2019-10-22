var rotation = 0;
rotateCamera();

scene.background = new THREE.Color(0xf0f0f0);
var bgColor = scene.background;

regenerate()

polycubeSystem.nMaxCubes = 200;

// Regenerate when out of bounds (nMaxCubes reached)
window.addEventListener('oub', function(e) {
    regenerate();
}, false);

// Regenerate when there are no more cubes to add
window.addEventListener('movesProcessed', async function(e) {
    await sleep(2000);
    regenerate();
}, false);

function rotateCamera() {
    rotation += 0.005;
    camera.position.y = Math.sin(rotation) * 20;
    camera.position.x = Math.cos(rotation) * 20;
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    requestAnimationFrame(rotateCamera.bind(this));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function regenerate() {
    var maxRuleSize = 8;
    var ruleSize = Math.round(Math.random()*maxRuleSize)+1;
    var hexRule = "";
    while(ruleSize--) {
        hexRule += (Math.abs(Math.random()*0xFFFFFFFFFFFF<<0)).toString(16);
    }
    var argstr = "?hexRule="+hexRule;
    window.history.pushState(null, null, argstr);
    
    // Parse rule
    rules = parseHexRule(hexRule);
    polycubeSystem.resetRule(rules);
}
