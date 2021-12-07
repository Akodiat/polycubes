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
            face.appendChild(color);
            const patch = patches[i];
            const patchlist = patch.toJSON();

            const g = (i) => document.getElementById(i).valueAsNumber;

            ['p.x','p.y','p.z','q.x','q.y','q.z','q.w'].forEach((label,i)=>{
                let input = document.createElement("input");
                input.type = "number";
                input.value = patchlist[i];
                input.step = 0.01;
                input.id = label;
                input.title = label;
                input.onchange = ()=>{
                    patch.update(
                        color.valueAsNumber,
                        new THREE.Vector3(g('p.x'), g('p.y'), g('p.z')),
                        new THREE.Quaternion(g('q.x'), g('q.y'), g('q.z'), g('q.w'))
                    );
                    if(document.getElementById("autoUpdate").checked) {
                        system.regenerate();
                    };
                }
                face.appendChild(input);
            });

            color.style.background = 'transparent';

            let removePatch = document.createElement('button');
            removePatch.style.background = 'transparent';
            removePatch.innerHTML = 'x';

            removePatch.onclick = ()=>{
                patches.splice(i, 1);
                clearRules();
            };
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
            patches.push(new Patch(0, new THREE.Vector3(1,0,0), new THREE.Quaternion()));
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