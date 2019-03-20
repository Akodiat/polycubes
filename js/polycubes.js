if (WEBGL.isWebGLAvailable() === false) {
    document.body.appendChild(WEBGL.getWebGLErrorMessage());
}

var camera, scene, renderer;
var plane;
var mouse, raycaster;

var rollOverMesh, rollOverMaterial;
var cubeGeo, cubeMaterial;

var objects = [];
var moves = {};
var moveKeys = [];
var blocked = {};
var cubeMap = {};
var maxCoord = 50;

var activeRuleIdx = 0;
var rules;
var ruleColors = [];
var ruleMaterials = [];

var ruleOrder = [
    new THREE.Vector3( 0, 0,-1),
    new THREE.Vector3( 0, 0, 1),
    new THREE.Vector3( 0,-1, 0),
    new THREE.Vector3( 0, 1, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3( 1, 0, 0),
];

init();
render();

// From: https://html-online.com/articles/get-url-parameters-javascript/
function getUrlVars() {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
        vars[key] = value;
    });
    return vars;
}

function getUrlParam(param, defaultVal) {
    var vars = getUrlVars();
    return param in vars ? vars[param] : defaultVal;
}

function ruleFits(a,b) {
    for (var i = 0, l=a.length; i < l; i++) {
        // if a[i] is zero it has a neigbour who does not want anything here
        // if a[i] is not null it has to agree with b[i]
        if (a[i]==0 || (a[i] && a[i] != b[i])) {
            return false;
        }
    }
    return true;
}

function arrayContainCount(array, element) {
    return array.reduce((acc, curr) => acc + (curr==element), 0);
}

function ruleFitsRotated(a,b) {
    var l = a.length;
    var r = randOrdering(l);
    var rotationCount = 0;

    // Choose random starting rotation for b
    var iRand = Math.floor(Math.random() * l);
    b = rotateRule(b, ruleOrder[0], ruleOrder[iRand]);

    for (var ri=0; ri<l; ri++) {
        if (rotationCount > 2) {
            return false;
        }
        var i = r[ri];
        // if a[i] is zero it has a neigbour who does not want anything here
        if (a[i]==0) {
            return false;
        }
        // if a[i] is not null and it doesn't agree with b[i]
        if (a[i] && a[i] != b[i]) {
            var j = b.indexOf(a[i]);
            if (j<0 ||
                arrayContainCount(a, a[i]) !==
                arrayContainCount(b, a[i]))
            {
                return false;
            }
            
            b = rotateRule(b, ruleOrder[j], ruleOrder[i]);
            rotationCount++;
            ri=0;
        }        
    }
    return b;
}

//https://stackoverflow.com/a/25199671
function rotateRule(rule, vFrom, vTo) {
    var quaternion = new THREE.Quaternion(); // create one and reuse it
    quaternion.setFromUnitVectors(vFrom, vTo);
    l=6;
    newRule = Array(l);
    for (var i=0; i<l; i++) {
        dir = ruleOrder[i];
        newDir = dir.clone().applyQuaternion(quaternion).round();
        var iNewDir = ruleOrder.findIndex(function(element){return newDir.equals(element)});
        newRule[iNewDir] = rule[i];
    }
    return newRule;
}

function init() {
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window
        .innerHeight, 1, 10000);
    camera.position.set(5, 8, 13);
    camera.lookAt(0, 0, 0);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    defaultRule = "[[1,1,1,1,1,1],[-1,0,0,0,0,0]]";
    rules = JSON.parse(getUrlParam("rules",defaultRule));
    ruleColors = randomColor({luminosity: 'light', count: rules.length});
    // orbit controls

    var orbit = new THREE.OrbitControls(camera);
    orbit.damping = 0.2;
    orbit.addEventListener('change', render);

    // roll-over helpers

    var rollOverGeo = new THREE.BoxBufferGeometry(1, 1, 1);
    rollOverMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        opacity: 0.5,
        transparent: true
    });
    rollOverMesh = new THREE.Mesh(rollOverGeo, rollOverMaterial);
    scene.add(rollOverMesh);

    // cubes

    cubeGeo = new THREE.BoxBufferGeometry(1, 1, 1);
    for (var i=0; i<ruleColors.length; i++) {
        ruleMaterial = new THREE.MeshLambertMaterial({
            color: ruleColors[i]
        });
        ruleMaterials.push(ruleMaterial);
    }

    // grid

    var gridHelper = new THREE.GridHelper(100, 100);
    gridHelper.position.set(-0.5, -0.5, 0.5);
    scene.add(gridHelper);

    //

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    var geometry = new THREE.PlaneBufferGeometry(100, 100);
    geometry.rotateX(-Math.PI / 2);

    plane = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        visible: false
    }));
    plane.position.set(-0.5, -0.5, 0.5);
    scene.add(plane);

    objects.push(plane);

    // lights

    var ambientLight = new THREE.AmbientLight(0x606060);
    scene.add(ambientLight);

    var directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.position.set(1, 0.75, 0.5).normalize();
    scene.add(directionalLight);

    renderer = new THREE.WebGLRenderer({
        antialias: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    document.addEventListener('mousemove', onDocumentMouseMove, false);
    document.addEventListener('mousedown', onDocumentMouseDown, false);

    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onDocumentMouseMove(event) {
    event.preventDefault();
    mouse.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY /
        window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouse, camera);

    var intersects = raycaster.intersectObjects(objects);
    if (intersects.length > 0) {
        var intersect = intersects[0];
        rollOverMesh.position.copy(intersect.point).add(intersect.face.normal).floor();
        var posStr = vecToStr(rollOverMesh.position);
        var rule = posStr in moves ? ruleFitsRotated(moves[posStr].rule, rules[activeRuleIdx]): false;
        if(posStr in blocked || rule) {
            rollOverMesh.material = rollOverMaterial;
        } else {
            rollOverMesh.material = ruleMaterials[activeRuleIdx];
        }
    }
    render();
}

function onDocumentMouseDown(event) {
    event.preventDefault();

    if(event.button == THREE.MOUSE.LEFT) {
        mouse.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY /
            window.innerHeight) * 2 + 1);

        raycaster.setFromCamera(mouse, camera);

        var intersects = raycaster.intersectObjects(objects);

        if (intersects.length > 0) {
            var intersect = intersects[0];
            pos = intersect.point.clone().add(intersect.face.normal).floor();

            // Make sure manually added cube is allowed given the moves
            var posStr = vecToStr(pos);
            var rule = posStr in moves ? ruleFitsRotated(moves[posStr].rule, rules[activeRuleIdx]): false;
            if(posStr in blocked || rule) {
                console.log("Cannot add cube at pos "+posStr+" with rule "+rules[activeRuleIdx]);
            } else {
                addCube(pos, rules[activeRuleIdx], activeRuleIdx);
                processMoves();
            }

            render();
        }
    }
}

// From stackoverflow/a/12646864
function shuffleArrayFrom(a, from) {
    for (var i = a.length -1; i>from; i--) {
     // var j = Math.floor(Math.random() * (i + 1));
        var j = Math.floor(Math.random() * (i+1-from))+from;
        var temp = a[i];
        a[i] = a[j];
        a[j] = temp;
    }
}

function shuffleArray(a) {
    shuffleArrayFrom(a, 0)
}

function randOrdering(length) {
    var l = new Array(length);
    for (var i=0; i<length; i++) {
        l[i]=i;
    }
    shuffleArray(l);
    return l;
}

function processMoves() {
    if (moveKeys.length > 0) { // While we have moves to process
        // Pick a random move
        var key = moveKeys[Math.floor(Math.random()*moveKeys.length)];

        // Pick a random rule order
        var ruleIdxs = randOrdering(rules.length);
        // Check if we have a rule that fits this move
        for (var r=0; r<rules.length; r++) {
            rule = rules[ruleIdxs[r]];
            rule = ruleFitsRotated(moves[key].rule, rule);
            if(rule){
                console.log("Processing move: "+key+"(="+vecToStr(moves[key].pos)+"), trying to add cube with rule:"+rule);
                addCube(moves[key].pos, rule, ruleIdxs[r]);
                // Remove processed move
                delete moves[key];
                moveKeys.splice(moveKeys.indexOf(key), 1);
                console.log("Done processing move: "+key+", removing. Remaining moves:"+moveKeys);
                break;
            }
        }
    } else {
        return;
    }
    render();
    requestAnimationFrame(processMoves);
}

//Need both rule and ruleIdx to determine color as the rule might be rotated
function addCube(position, rule, ruleIdx) {
    // Go through all non-zero parts of the rule and add potential moves
    var potentialMoves = [];
    var potentialBlocked = [];
    for (var i=0; i<rule.length; i++) {
        var direction = ruleOrder[i].clone().negate();
        var movePos = position.clone().add(ruleOrder[i])
        if(Math.abs(movePos.x)>maxCoord ||
           Math.abs(movePos.y)>maxCoord ||
           Math.abs(movePos.z)>maxCoord)
        {
            console.log("Neigbour at "+key+" outside of bounding box, stopping here")
            continue;
        }
        var key = vecToStr(movePos);
        if(key in cubeMap) {
            console.log(vecToStr(position)+": There is already a cube at pos "+key+", no need to add this neigbour to moves. Rule: "+rule);
            continue
        }
        if(key in blocked) {
            console.log(vecToStr(position)+": Another neigbour to "+key+" is already blocking it, so no need to add this neigbour to moves. Rule: "+rule);
            continue
        }
        if(!(key in moves)) {
            moves[key] = {pos: movePos, rule: [null,null,null,null,null,null]};
            moveKeys.push(key);
        }
        var r = position.clone().sub(movePos);
        var dirIdx = ruleOrder.findIndex(function(element){return r.equals(element)});

        //Make sure we haven't written anything here before:
        if(moves[key].rule[dirIdx]) {
            console.log(vecToStr(position)+": Cannot add cube at pos "+vecToStr(position)+" with rule "+rule);
            return;
        }

        if(rule[i] == 0) {
            potentialBlocked.push(key);
        }
        potentialMoves.push({'key': key, 'dirIdx': dirIdx, 'val': rule[i]*-1});
    }
    potentialMoves.forEach(function(i){
        moves[i.key].rule[i.dirIdx] = i.val;
        if(i.val) {
            console.log(vecToStr(position)+": Adding move at pos"+i.key+" Rule: "+moves[i.key].rule);
        }
    });
    potentialBlocked.forEach(function(key){
        blocked[key] = moves[key];
        delete moves[key];
        moveKey = moveKeys.indexOf(key);
        moveKeys.splice(moveKey, 1);
        console.log(vecToStr(position)+": Blocking move at pos"+key+" Rule: "+blocked[key].rule);
    });

    var voxel = new THREE.Mesh(cubeGeo, ruleMaterials[ruleIdx]);
    voxel.name = "voxel_rule"+ruleIdx;
    voxel.position.copy(position);
    scene.add(voxel);
    objects.push(voxel);
    cubeMap[vecToStr(position)] = true;
    console.log("Added cube at pos "+vecToStr(position)+" with rule "+rule);
    render();
}

function vecToStr(v){
    return `(${v.x},${v.y},${v.z})`;
}

function render() {
    renderer.render(scene, camera);
}

