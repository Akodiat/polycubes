function addRule(rule) {
    var faces = ["left","right","bottom","top","back","front"];
    if (rule == undefined) {
        rule = [];
        for(var i=0; i<faces.length; i++) {
           rule.push({'c': 0, 'd': faceRotations[i]})
        }
        system.rules.push(rule);
        var cubeMaterial = new THREE.MeshLambertMaterial({
            color: randomColor({luminosity: 'light',  hue: 'monochrome'})
        });
        system.cubeMaterials.push(cubeMaterial);
    }
    var ruleset = document.getElementById("ruleset");
    var ruleField = document.createElement("fieldset");
    ruleField.style.borderColor = rgbToHex(system.cubeMaterials[system.rules.indexOf(rule)].color)
    for(var i=0; i<faces.length; i++) {
        var face = document.createElement("span");
        //face.faceIdx = i;
        var color = document.createElement("input");
        color.type = "number";
        color.value = rule[i].c;
        if(color.value != 0) {
            face.style.backgroundColor = rgbToHex(system.colorMaterials[Math.abs(color.value)-1].color)
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
    var ruleIdx = system.rules.indexOf(rule);
    var c;
    if(e.value != 0) {
        while (Math.abs(e.value) > system.colorMaterials.length) {
            var colorMaterial = new THREE.MeshLambertMaterial({
                color: randomColor({luminosity: 'light'})
            });
            system.colorMaterials.push(colorMaterial);
        }
        c = rgbToHex(system.colorMaterials[Math.abs(e.value)-1].color)
    }
    else {
        c = "White";
    }
    e.parentElement.style.backgroundColor = c;
    system.rules[ruleIdx][faceIdx].c = e.value;
    if(document.getElementById("autoUpdate").checked) {
        regenerate();
    }
}

function updateRuleRot(e, rule, faceIdx) {
    var ruleIdx = system.rules.indexOf(rule);
    e.value = (parseInt(e.value) + 1) % 4;
    e.className = "rot" + e.value;
    var r = faceRotations[faceIdx].clone();
    r.applyAxisAngle(ruleOrder[faceIdx], e.value*Math.PI/2);
    system.rules[ruleIdx][faceIdx].d = r.round();
    if(document.getElementById("autoUpdate").checked) {
        regenerate();
    };
}

function removeRule(rule, ruleField) {
    var ruleIdx = system.rules.indexOf(rule);
    ruleField.parentNode.removeChild(ruleField);
    system.rules.splice(ruleIdx, 1);
    if(document.getElementById("autoUpdate").checked) {
        regenerate();
    }
}

function simplifyRule() {
    let ruleset = system.rules;
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
    system.resetRule(newRuleset);
    regenerate();
    clearRules();
}

function clearRules() {
    var ruleset = document.getElementById("ruleset");
    ruleset.innerText = "";
    system.rules.forEach(addRule);
    if(document.getElementById("autoUpdate").checked) {
        regenerate();
    }
}

function regenerate() {
    system.reset();
    system.addCube(new THREE.Vector3(), system.rules[0], 0);
    system.processMoves();
    render();
    var argstr = system.rules.length > 0 ? "?hexRule="+system.getHexRule() : ""
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

system.nMaxCubes = 500;
clearRules();

