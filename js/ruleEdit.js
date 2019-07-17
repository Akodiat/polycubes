function addRule(rule) {
    var faces = ["left","right","bottom","top","back","front"];
    if (rule == undefined) {
        rule = [];
        for(var i=0; i<faces.length; i++) {
           rule.push({'c': 0, 'd': faceRotations[i]})
        }
        rules.push(rule);
        var cubeMaterial = new THREE.MeshLambertMaterial({
            color: randomColor({luminosity: 'light',  hue: 'monochrome'})
        });
        polycubeSystem.cubeMaterials.push(cubeMaterial);
    }
    var ruleset = document.getElementById("ruleset");
    var ruleField = document.createElement("fieldset");
    ruleField.style.borderColor = rgbToHex(polycubeSystem.cubeMaterials[rules.indexOf(rule)].color)
    for(var i=0; i<faces.length; i++) {
        var face = document.createElement("div");
        //face.faceIdx = i;
        var color = document.createElement("input");
        color.type = "number";
        color.value = rule[i].c;
        if(color.value != 0) {
            color.style.backgroundColor = rgbToHex(polycubeSystem.colorMaterials[Math.abs(color.value)-1].color)
        }
        var text = document.createTextNode(faces[i]+": ");
        face.appendChild(text);
        color.addEventListener("change", updateRuleColor.bind(
            event, color, rule, i)
        );
        var rotation = document.createElement("img");
        rotation.value = faceRotations[i].angleTo(rule[i].d)*(2/Math.PI);
        rotation.src = "doc/face.svg"
        rotation.height = "35";
        rotation.style="vertical-align:middle";
        rotation.className = "rot" + rotation.value;
        rotation.addEventListener("click", updateRuleRot.bind(
            event, rotation, rule, i)
        );
        face.appendChild(color);
        face.appendChild(rotation);
        ruleField.appendChild(face);
    }
    var remove = document.createElement("button");
    remove.innerHTML = "Remove rule";
    remove.addEventListener("click", removeRule.bind(
        event, rule, ruleField)
    );
    ruleField.appendChild(remove);
    ruleset.appendChild(ruleField);
}

function updateRuleColor(e, rule, faceIdx) {
    var ruleIdx = rules.indexOf(rule);
    var c;
    if(e.value != 0) {
        while (Math.abs(e.value) > polycubeSystem.colorMaterials.length) {
            var colorMaterial = new THREE.MeshLambertMaterial({
                color: randomColor({luminosity: 'light'})
            });
            polycubeSystem.colorMaterials.push(colorMaterial);
        }
        c = rgbToHex(polycubeSystem.colorMaterials[Math.abs(e.value)-1].color)
    }
    else {
        c = "White";
    }
    e.style.backgroundColor = c;
    rules[ruleIdx][faceIdx].c = e.value;
    if(document.getElementById("autoUpdate").checked) {
        regenerate();
    }
}

function updateRuleRot(e, rule, faceIdx) {
    var ruleIdx = rules.indexOf(rule);
    e.value = (parseInt(e.value) + 1) % 4;
    e.className = "rot" + e.value;
    var r = faceRotations[faceIdx].clone();
    r.applyAxisAngle(ruleOrder[faceIdx], e.value*Math.PI/2);
    rules[ruleIdx][faceIdx].d = r.round();
    if(document.getElementById("autoUpdate").checked) {
        regenerate();
    };
}

function removeRule(rule, ruleField) {
    var ruleIdx = rules.indexOf(rule);
    ruleField.parentNode.removeChild(ruleField);
    rules.splice(ruleIdx, 1);
    if(document.getElementById("autoUpdate").checked) {
        regenerate();
    }
}

function regenerate() {
    scene.background = bgColor;
    polycubeSystem.reset();
    polycubeSystem.addCube(new THREE.Vector3(), rules[0], 0);
    polycubeSystem.processMoves();
    render();
    var argstr = rules.length > 0 ? "?hexRule="+polycubeSystem.getHexRule() : ""
    window.history.pushState(null, null, argstr);
}

function rgbToHex(rgb) {
    return "#" + ((1 << 24) + (rgb.r*255 << 16) + (rgb.g*255 << 8) + rgb.b*255).toString(16).slice(1);
}

function toggleRuleSet() {
    var ruleDiv = document.getElementById("ruleset");
    var hideToggle = document.getElementById("hideToggle");
    if (ruleDiv.style.height == "0px") {
        ruleDiv.style.height = "100%"
        hideToggle.innerHTML = "Hide";
    } else {
        ruleDiv.style.height = "0px"
        hideToggle.innerHTML = "Show";
    }
}

function alert(msg) {
    scene.background = new THREE.Color(0xeecccc);
    render();
}

var bgColor = scene.background;

polycubeSystem.nMaxCubes = 500;
rules.forEach(addRule);




