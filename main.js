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

var rules = [[0,0,0,0,0,2]]
var params = {
    rule: {
        front: 0,
        back: 0,
        up: 0,
        down: 0,
        left: 0,
        right: 0
    },
    color: '#b3ccff'
}

var ruleOrder = [
    new THREE.Vector3( 0, 0,-1),
    new THREE.Vector3( 0, 0, 1),
    new THREE.Vector3( 0, 1, 0),
    new THREE.Vector3( 0,-1, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3( 1, 0, 0),
];

init();
render();

// From answer: https://stackoverflow.com/a/14853974
function arrayEquals(a,b) {
    // if the other array is a falsy value, return
    if (!b)
        return false;

    // compare lengths - can save a lot of time 
    if (a.length != b.length)
        return false;

    for (var i = 0, l=a.length; i < l; i++) {
        // Check if we have nested arrays
        if (a[i] instanceof Array && b[i] instanceof Array) {
            // recurse into the nested arrays
            if (!a[i].equals(b[i]))
                return false;       
        }           
        else if (a[i] != b[i]) { 
            // Warning - two different object instances will never be equal: {x:20} != {x:20}
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
    cubeMaterial = new THREE.MeshLambertMaterial({
        color: 0xb3ccff
    });

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
    for(p in params.rule){
        gui.add(params.rule, p);
    }
    gui.addColor(params, 'color');

    gui.open();

    addCube(new THREE.Vector3(0,0,0), [0,0,1,0,-2,0]);
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
    }
    render();
}

function onDocumentMouseDown(event) {
    event.preventDefault();

    mouse.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY /
        window.innerHeight) * 2 + 1);

    raycaster.setFromCamera(mouse, camera);

    var intersects = raycaster.intersectObjects(objects);

    if (intersects.length > 0) {
        var intersect = intersects[0];

        // delete cube
        if (isShiftDown) {
            if (intersect.object !== plane) {
                scene.remove(intersect.object);
                objects.splice(objects.indexOf(intersect.object), 1);
            }

        // create cube
        } else {
            pos = intersect.point.clone().add(intersect.face.normal).floor();
            addCube(pos, [0,0,1,0,-2,0]);
        }

        render();
    }
}

function processMoves() {
    // Select random move destination
    var moveKey = Math.floor(Math.random()*moveKeys.length);
    var move = moves[moveKeys[moveKey]];

    rules.forEach(function(rule){
        if(arrayEquals(rule, move.rule)){
            console.log("Yay");
            addCube(move.pos, move.rule);
            delete moves[moveKeys[moveKey]];
            moveKeys.splice(moveKey, 1);
        }
    }); 
}

function addCube(position, rule) {
    var voxel = new THREE.Mesh(cubeGeo, cubeMaterial);
    voxel.material.color.set(params.color);
    voxel.name = "voxel";
    voxel.position.copy(position);
    scene.add(voxel);
    objects.push(voxel);
    
    for(i=0; i<rule.length; i++) {
        if(rule[i]) {
     //    var move = {
     //        position: position.clone().add(ruleOrder[i]),
     //        direction: ruleOrder[i].clone().negate(),
     //        rule: rule[i]
     //    }
           var direction = ruleOrder[i].clone().negate();
           var pos = position.clone().add(ruleOrder[i])
           var key = `(${pos.x},${pos.y},${pos.z})`;
           if(!(key in moves)) {
               moves[key] = {pos: pos, rule: [0,0,0,0,0,0]};
               moveKeys.push(key);
           }
           var r = position.clone().sub(pos);
           var rulePos = ruleOrder.findIndex(function(element){return r.equals(element)});

           //Make sure we haven't written anything here before:
           console.assert(!(moves[key].rule[rulePos]));

           moves[key].rule[rulePos] = rule[i] * -1;
        }
    }
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
    processMoves();
}

