function alert(msg) {
    regenerate()
}

var rotation = 0;
rotateCamera();

scene.background = new THREE.Color(0xf0f0f0);
var bgColor = scene.background;

polycubeSystem.nMaxCubes = 200;

regenerate()

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
    polycubeSystem.reset();
    polycubeSystem.rules = rules;
    
    var nColors = Math.max.apply(Math, rules.map(x => Math.max.apply(
        Math, x.map(r => Math.abs(r.c))))
    );
    nColors = Math.max(nColors, 2) //Avoid getting only red colors

    for (var i=0; i<nColors; i++) {
        var colorMaterial = new THREE.MeshLambertMaterial({
            color: randomColor({luminosity: 'light'})
        });
        polycubeSystem.colorMaterials.push(colorMaterial);
    }

    for (var i=0; i<rules.length; i++) {
        var cubeMaterial = new THREE.MeshLambertMaterial({
            color: randomColor({luminosity: 'light',  hue: 'monochrome'})
        });
        polycubeSystem.cubeMaterials.push(cubeMaterial);
    }
    
    polycubeSystem.addCube(new THREE.Vector3(), rules[0], 0);
    
    polycubeSystem.processMoves();
    render();
}
