function addRule(rule) {
    var faces = ["left","right","bottom","top","back","front"];
    if (rule == undefined) {
        rule = [];
        for(var i=0; i<faces.length; i++) {
           rule.push({'c': 0, 'd': faceRotations[i]})
        }
        polycubeSystem.rules.push(rule);
        var cubeMaterial = new THREE.MeshLambertMaterial({
            color: randomColor({luminosity: 'light',  hue: 'monochrome'})
        });
        polycubeSystem.cubeMaterials.push(cubeMaterial);
    }
    var ruleset = document.getElementById("ruleset");
    var ruleField = document.createElement("fieldset");
    ruleField.style.borderColor = rgbToHex(polycubeSystem.cubeMaterials[polycubeSystem.rules.indexOf(rule)].color)
    for(var i=0; i<faces.length; i++) {
        var face = document.createElement("span");
        //face.faceIdx = i;
        var color = document.createElement("input");
        color.type = "number";
        color.value = rule[i].c;
        if(color.value != 0) {
            face.style.backgroundColor = rgbToHex(polycubeSystem.colorMaterials[Math.abs(color.value)-1].color)
        }
	face.title = faces[i];
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
        face.appendChild(rotation);
        face.appendChild(color);
        ruleField.appendChild(face);
    }
    var remove = document.createElement("button");
    remove.innerHTML = "Delete";
    remove.style.height = "20px";
    remove.style.margin = "0px";
    remove.addEventListener("click", removeRule.bind(
        event, rule, ruleField)
    );
    ruleField.appendChild(remove);
    ruleset.appendChild(ruleField);
}

function updateRuleColor(e, rule, faceIdx) {
    var ruleIdx = polycubeSystem.rules.indexOf(rule);
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
    e.parentElement.style.backgroundColor = c;
    polycubeSystem.rules[ruleIdx][faceIdx].c = e.value;
    if(document.getElementById("autoUpdate").checked) {
        regenerate();
    }
}

function updateRuleRot(e, rule, faceIdx) {
    var ruleIdx = polycubeSystem.rules.indexOf(rule);
    e.value = (parseInt(e.value) + 1) % 4;
    e.className = "rot" + e.value;
    var r = faceRotations[faceIdx].clone();
    r.applyAxisAngle(ruleOrder[faceIdx], e.value*Math.PI/2);
    polycubeSystem.rules[ruleIdx][faceIdx].d = r.round();
    if(document.getElementById("autoUpdate").checked) {
        regenerate();
    };
}

function removeRule(rule, ruleField) {
    var ruleIdx = polycubeSystem.rules.indexOf(rule);
    ruleField.parentNode.removeChild(ruleField);
    polycubeSystem.rules.splice(ruleIdx, 1);
    if(document.getElementById("autoUpdate").checked) {
        regenerate();
    }
}

function simplifyRule() {
    let ruleset = polycubeSystem.rules;
    let colors = new Set([].concat.apply([], ruleset.map(r=>r.map(f=>{return f.c}))));
    let newRuleset = [];
    ruleset.forEach((cube, iCube)=>{
        let allZero = true;
        cube.forEach((face, iFace)=>{
            let c = face['c']
            if (!colors.has(c*-1)) {
                face.c = 0;
            }
            if (face.c == 0) {
                face.d = faceRotations[iFace];
            }
            else {
                allZero = false;
            }
        })
          
        if (!allZero || iCube == 0) {
            newRuleset.push(cube);
        }
    });

    let colorset = Array.from(new Set([].concat.apply([], ruleset.map(r=>r.map(f=>{return Math.abs(f.c)}))))).filter(x => x != 0)
    newRuleset.forEach(rule=>{
        rule.forEach(face=>{
            c = face.c;
            if (c != 0) {
                face.c = colorset.indexOf(Math.abs(c)) + 1;
                if (c < 0) {
                    face.c *= -1;
                }
            }
        })
    })
    polycubeSystem.resetRule(newRuleset);
    regenerate();
    clearRules();
}

clearRules(); polycubeSystem.rules.forEach(addRule);

function clearRules() {
    var ruleset = document.getElementById("ruleset");
    ruleset.innerText = "";
    polycubeSystem.rules.forEach(addRule);
    if(document.getElementById("autoUpdate").checked) {
        regenerate();
    }
}

function regenerate() {
    polycubeSystem.reset();
    polycubeSystem.addCube(new THREE.Vector3(), polycubeSystem.rules[0], 0);
    polycubeSystem.processMoves();
    render();
    var argstr = polycubeSystem.rules.length > 0 ? "?hexRule="+polycubeSystem.getHexRule() : ""
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

polycubeSystem.nMaxCubes = 500;
polycubeSystem.rules.forEach(addRule);

