if (WEBGL.isWebGLAvailable() === false) {
    document.body.appendChild(WEBGL.getWebGLErrorMessage());
}

var camera, scene, renderer;
var plane;
var mouse, raycaster, isShiftDown = false;

var rollOverMesh, rollOverMaterial;
var cubeGeo, cubeMaterial;

var objects = [];
var moves = {};
var moveKeys = [];
var cubeMap = {};
var maxCoord = 500;

var activeRuleIdx = 0;
var rules = [[0,0,0,1,0,-2],[0,0,-1,0,2,3], [0,0,0,0,-3,0], [0,0,0,0,0,-2]];
var ruleColors = ['#b3ccff', '#b3aabb', '#14a2b2', '#f5aa0b'];
var ruleMaterials = [];
var params = {
    rules: [{
        rule: {front: 0, back: 0, down: 0, up: 0, left: 0, right: 0},
        color: '#b3ccff'
    }],
    step: processMoves,
    test: '[1,1,0,1,-2,0]'
    }

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

function init() {
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window
        .innerHeight, 1, 10000);
    camera.position.set(5, 8, 13);
    camera.lookAt(0, 0, 0);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

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
    for(i=0; i<ruleColors.length; i++) {
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
    document.addEventListener('keydown', onDocumentKeyDown, false);
    document.addEventListener('keyup', onDocumentKeyUp, false);

    //

    window.addEventListener('resize', onWindowResize, false);

    // gui
    var gui = new dat.GUI();

    for(i=0, l=params.rules.length; i<l; i++) {
        f = gui.addFolder('Rule '+i);
        for(p in params.rules[i].rule){
            f.add(params.rules[i].rule, p);
        }
        f.addColor(params.rules[i], 'color');
    }
    gui.add(params, 'step');
    gui.add(params, 'test');

    gui.open();
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
        if(posStr in moves && !ruleFits(moves[posStr].rule, rules[activeRuleIdx])) {
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
            if(posStr in moves && !ruleFits(moves[posStr].rule, rules[activeRuleIdx])) {
                console.log("Cannot add cube at pos "+posStr+" with rule "+rules[activeRuleIdx]);
            } else {
                addCube(pos, activeRuleIdx);
                processMoves();
            }

            render();
        }
    }
}

// From stackoverflow/a/12646864
function shuffleArrayFrom(a, from) {
    for(var i = a.length -1; i>from; i--) {
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
    l = new Array(length);
    for(var i=0; i<length; i++) {
        l[i]=i;
    }
    shuffleArray(l);
    return l;
}

function processMoves() {
    if(moveKeys.length > 0) { //If we have moves to process
        // Shuffle movekeys randomly
        shuffleArray(moveKeys);

        // Loop through moves
        for(moveKey=0; moveKey<moveKeys.length; moveKey++) {
            var move = moves[moveKeys[moveKey]];

            // We should not automatically add cubes where they are not connected
            var isEmpty = true;
            for(i=0; i<move.rule.length; i++){
                if(move.rule[i]){
                    isEmpty = false;
                    break;
                }
            }
            if(isEmpty) {
                continue;
            }

            ruleIdxs = randOrdering(rules.length);
            // Check if we have a rule that fits this move
            for(i=0; i<rules.length; i++) {
                rule = rules[ruleIdxs[i]];
                if(ruleFits(move.rule, rule)){
                    currLastMove = moveKeys.length-1;
                    addCube(move.pos, ruleIdxs[i]);

                    // Remove processed move
                    delete moves[moveKeys[moveKey]];
                    moveKeys.splice(moveKey, 1);
                    moveKey--; // Make sure we don't skip the next move

                    // Any new moves added by the added cube will be appended to the
                    // end of the shuffled moveKeys list.
                    shuffleArrayFrom(moveKeys, currLastMove);
                    // Deterministic but efficient. If not desired, shuffle remaining list
                    // from moveKeys.length as it was before addCube.
                }
            }
        }
    }
}

function addCube(position, ruleIdx) {
    var rule = rules[ruleIdx];


    // Go through all non-zero parts of the rule and add potential moves
    for(i=0; i<rule.length; i++) {
    //  if(rule[i]) {
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
                console.log("There is already a cube at pos "+key);
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
                console.log("Cannot add cube at pos "+vecToStr(position)+" with rule "+rule);
                return;
            }

               moves[key].rule[dirIdx] = rule[i] * -1;
     // }
    }
//  var material = cubeMaterial.clone();
//  material.color.set(ruleColors[ruleIdx])
    var voxel = new THREE.Mesh(cubeGeo, ruleMaterials[ruleIdx]);
    voxel.name = "voxel";
    voxel.position.copy(position);
    scene.add(voxel);
    objects.push(voxel);
    cubeMap[vecToStr(position)] = true;
    console.log("Added cube at pos "+vecToStr(position)+" with rule "+rule);
}

function vecToStr(v){
    return `(${v.x},${v.y},${v.z})`;
}

function onDocumentKeyDown(event) {
    switch (event.keyCode) {
    case 16:
        isShiftDown = true;
        break;
    }
}

function onDocumentKeyUp(event) {
    switch (event.keyCode) {
    case 16:
        isShiftDown = false;
        break;
    }
}

function render() {
    renderer.render(scene, camera);
}

