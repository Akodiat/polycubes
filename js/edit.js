function addRule(patches) {
    let faces = ["left","right","bottom","top","back","front"];
    if (patches == undefined) {
        patches = [];
        if(system.isPolycubeSystem()) {
            for(let i=0; i<faces.length; i++) {
                patches.push({'color': 0, 'alignDir': faceRotations[i]})
             }
        }
        system.rule.push(patches);
        let cubeMaterial = new THREE.MeshLambertMaterial({
            color: selectColor(system.rule.length-1)
        });
        system.particleMaterials.push(cubeMaterial);
    }
    let ruleset = document.getElementById("ruleset");
    let ruleField = document.createElement("fieldset");
    ruleField.style.borderColor = selectColor(system.rule.indexOf(patches))
    for(let i=0; i<patches.length; i++) {
        let face = document.createElement("span");
        //face.faceIdx = i;
        let color = document.createElement("input");
        color.type = "number";
        color.value = patches[i].color;
        if(color.value != 0) {
            face.style.backgroundColor = selectColor(Math.abs(color.value)-1)
        }
        color.addEventListener("change", updateRuleColor.bind(
            event, color, patches, i)
        );
        if (system.isPolycubeSystem()) {
            face.title = faces[i];
        }
        if (system.isPolycubeSystem()) {
            let rotation = document.createElement("img");
            rotation.value = faceRotations[i].angleTo(patches[i].alignDir)*(2/Math.PI);

            rotation.src = "doc/face.svg"
            rotation.height = "35";
            rotation.style="vertical-align:middle";
            rotation.className = "rot" + rotation.value;
            rotation.addEventListener("click", updateRuleRot.bind(
                event, rotation, patches, i)
            );
            face.appendChild(rotation);
            face.appendChild(color);
        } else {
            let patch= patches[i].toJSON();

            let phi = document.createElement("input");
            phi.type = "number";
            phi.value = patch[1]; phi.max = 1, phi.min = -1, phi.step = 0.01;

            let theta = document.createElement("input");
            theta.type = "number";
            theta.value = patch[2]; theta.max = 1, theta.min = -1, theta.step = 0.01;

            let rotation = document.createElement("input");
            rotation.type = "number";
            rotation.value = patch[3]; rotation.max = 1, rotation.min = -1, rotation.step = 0.01;
            let removePatch = document.createElement("button");
            removePatch.innerHTML = "x";
            //removePatch.style.width = "2em"

            color.style.background = 'transparent';
            removePatch.style.background = 'transparent';

            removePatch.onclick = ()=>{
                patches.splice(i, 1);
                clearRules();
            };

            let updatedPatch = ()=>{
                patches[i].set(
                    color.valueAsNumber,
                    phi.valueAsNumber * 2 * Math.PI,
                    theta.valueAsNumber * 2 * Math.PI,
                    rotation.valueAsNumber * 2 * Math.PI
                );
                if(document.getElementById("autoUpdate").checked) {
                    system.regenerate();
                };
            }
            phi.onchange = updatedPatch;
            theta.onchange = updatedPatch;
            rotation.onchange = updatedPatch;

            face.appendChild(color);
            face.appendChild(phi);
            face.appendChild(theta);
            face.appendChild(rotation);
            face.appendChild(removePatch);
        }
        ruleField.appendChild(face);
    }
    if(!system.isPolycubeSystem()) {
        let add = document.createElement("button");
        add.innerHTML = "Add patch";
        add.style.height = "20px";
        add.style.margin = "0px";
        add.onclick = ()=>{
            patches.push(Patch.init(0, 0, 0, 0));
            clearRules();
        }
        ruleField.appendChild(add);
    }
    let remove = document.createElement("button");
    remove.innerHTML = "Delete patches";
    remove.style.height = "20px";
    remove.style.margin = "0px";
    remove.addEventListener("click", removeRule.bind(
        event, patches, ruleField)
    );
    ruleField.appendChild(remove);
    ruleset.appendChild(ruleField);
}

function updateRuleColor(e, patches, faceIdx) {
    let ruleIdx = system.rule.indexOf(patches);
    let c;
    let value = parseInt(e.value);
    if(value != 0) {
        while (Math.abs(value) > system.colorMaterials.length) {
            let colorMaterial = new THREE.MeshLambertMaterial({
                color: selectColor(system.colorMaterials.length-1)
            });
            system.colorMaterials.push(colorMaterial);
        }
        c = selectColor(Math.abs(value)-1);
    }
    else {
        c = "White";
    }
    e.parentElement.style.backgroundColor = c;
    system.rule[ruleIdx][faceIdx].color = value;
    if(document.getElementById("autoUpdate").checked) {
        system.regenerate();
    }
}

function updateRuleRot(e, patches, faceIdx) {
    let ruleIdx = system.rule.indexOf(patches);
    e.value = (parseInt(e.value) + 1) % 4;
    e.className = "rot" + e.value;
    let r = faceRotations[faceIdx].clone();
    r.applyAxisAngle(ruleOrder[faceIdx], e.value*Math.PI/2);
    system.rule[ruleIdx][faceIdx].alignDir = r.round();
    if(document.getElementById("autoUpdate").checked) {
        system.regenerate();
    };
}

function removeRule(patches, ruleField) {
    let ruleIdx = system.rule.indexOf(patches);
    ruleField.parentNode.removeChild(ruleField);
    system.rule.splice(ruleIdx, 1);
    if(document.getElementById("autoUpdate").checked) {
        system.regenerate();
    }
}

function simplifyRule() {
    let newRuleset = simplify(system.rule);
    system.resetRule(newRuleset);
    system.regenerate();
    clearRules();
}

function simplifyRule2() {
    let newRuleset = simplify2(system.rule);
    system.resetRule(newRuleset);
    system.regenerate();
    clearRules();
}

function clearRules() {
    document.getElementById("ruleset").innerText = "";
    system.rule.forEach(addRule);
    if(document.getElementById("autoUpdate").checked) {
        system.regenerate();
    }
}

function rgbToHex(rgb) {
    return "#" + ((1 << 24) + (rgb.r*255 << 16) + (rgb.g*255 << 8) + rgb.b*255).toString(16).slice(1);
}

function toggleRuleSet() {
    let ruleDiv = document.getElementById("ruleset");
    let hideToggle = document.getElementById("hideToggle");
    if (ruleDiv.style.height == "0px") {
        ruleDiv.style.height = "100%"
        hideToggle.innerHTML = "Hide";
    } else {
        ruleDiv.style.height = "0px"
        hideToggle.innerHTML = "Show";
    }
}

system.rule.forEach(addRule);