if (WEBGL.isWebGLAvailable() === false) {
    document.body.appendChild(WEBGL.getWebGLErrorMessage());
}

// From: https://html-online.com/articles/get-url-parameters-javascript/
function getUrlVars() {
    var vars = {};
    var parts = window.location.href.replace(
        /[?&]+([^=&]+)=([^&]*)/gi, 
        function(m,key,value) {vars[key] = value;}
    );
    return vars;
}

function getUrlParam(param, defaultVal) {
    var vars = getUrlVars();
    return param in vars ? vars[param] : defaultVal;
}

function vecToStr(v){
    return `(${v.x},${v.y},${v.z})`;
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
        var i = intersects[0];
        rollOverMesh.position.copy(i.point).add(i.face.normal).floor();
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

            polycubeSystem.addCube(pos, rules[activeRuleIdx], activeRuleIdx);
            polycubeSystem.processMoves();

            render();
        }
    }
}

function render() {
    renderer.render(scene, camera);
}

function init() {
    camera = new THREE.PerspectiveCamera(
        45, window.innerWidth / window.innerHeight,
        1, 10000);
    camera.position.set(5, 8, 13);
    camera.lookAt(0, 0, 0);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    
    var ruleOrder = [
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3( 1, 0, 0),
        new THREE.Vector3( 0,-1, 0),
        new THREE.Vector3( 0, 1, 0),
        new THREE.Vector3( 0, 0,-1),
        new THREE.Vector3( 0, 0, 1),
    ]
    
    var faceRotations = [
        new THREE.Vector3( 0,-1, 0),
        new THREE.Vector3( 0, 1, 0),
        new THREE.Vector3( 0, 0,-1),
        new THREE.Vector3( 0, 0, 1),
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3( 1, 0, 0),
    ];

    defaultRule = "[[1,1,1,1,1,1],[-1,0,0,0,0,0]]";
    rules = JSON.parse(getUrlParam("rules",defaultRule));
    rules = rules.map(function(rule) {return rule.map(function(face, i) {
        var r = faceRotations[i].clone();
        if(typeof face == "number") {
            return {'c':face, 'd':r};
        } else {
            r.applyAxisAngle(ruleOrder[i], face[1]*Math.PI/2);
            return {'c':face[0], 'd':r};
        }
    });});

    nMaxCubes = JSON.parse(getUrlParam("nMaxCubes",100));

    polycubeSystem = new PolycubeSystem(rules, ruleOrder, nMaxCubes);

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

    // grid

    var gridHelper = new THREE.GridHelper(100, 100);
    gridHelper.position.set(-0.5, -0.5, 0.5);
    scene.add(gridHelper);

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

var camera, scene, renderer;
var plane;
var mouse, raycaster;
var rollOverMesh, rollOverMaterial;
var polycubeSystem;
var activeRuleIdx = 0;
var objects = [];

init();
render();

