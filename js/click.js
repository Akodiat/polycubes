if (WEBGL.isWebGLAvailable() === false) {
    document.body.appendChild(WEBGL.getWebGLErrorMessage());
}

// From: https://html-online.com/articles/get-url-parameters-javascript/
function getUrlVars() {
    let vars = {};
    let parts = window.location.href.replace(
        /[?&]+([^=&]+)=([^&]*)/gi, 
        function(m,key,value) {vars[key] = value;}
    );
    return vars;
}

function getUrlParam(param, defaultVal) {
    let vars = getUrlVars();
    return param in vars ? vars[param] : defaultVal;
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

    let intersects = raycaster.intersectObjects(objects);
    if (intersects.length > 0) {
        let i = intersects[0];
        rollOverMesh.position.copy(i.point).add(i.face.normal).add(new THREE.Vector3(0.5,0,0.5)).floor();
    }
    render();
}

function onDocumentMouseDblclick(event) {
    event.preventDefault();

    mouse.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY /
        window.innerHeight) * 2 + 1);

    raycaster.setFromCamera(mouse, camera);

    let intersects = raycaster.intersectObjects(objects);

    if (intersects.length > 0) {
        let intersect = intersects[0];
        pos = intersect.point.clone().add(intersect.face.normal).add(new THREE.Vector3(0.5,0,0.5)).floor();

        system.addParticle(pos, rules[activeRuleIdx], activeRuleIdx);
        system.processMoves();

        render();
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

    // Parse rule
    let vars = getUrlVars();
    if ("hexRule" in vars) {
        rules = parseHexRule(vars["hexRule"]);
    } else {
        defaultRule = "[[1,1,1,1,1,1],[-1,0,0,0,0,0]]";
        rules = JSON.parse(getUrlParam("rules",defaultRule));

        // Replace rotation number with vector
        rules = rules.map(function(rule) {return rule.map(function(face, i) {
            let r = faceRotations[i].clone();
            if(typeof face == "number") {
                return {'c':face, 'd':r};
            } else {
                r.applyAxisAngle(ruleOrder[i], face[1]*Math.PI/2);
                return {'c':face[0], 'd':r};
            }
        });});
    }

    nMaxCubes = JSON.parse(getUrlParam("nMaxCubes",100));

    system = new PolycubeSystem(rules, ruleOrder, nMaxCubes);

    // orbit controls

    let orbit = new THREE.OrbitControls(camera);
    orbit.damping = 0.2;
    orbit.addEventListener('change', render);

    // roll-over helpers

    let rollOverGeo = new THREE.BoxBufferGeometry(1, 1, 1);
    rollOverMaterial = new THREE.MeshBasicMaterial({
        color: 0xff2222,
        opacity: 0.5,
        transparent: true
    });
    rollOverMesh = new THREE.Mesh(rollOverGeo, rollOverMaterial);
    scene.add(rollOverMesh);

    // grid

    let gridHelper = new THREE.GridHelper(100, 100);
    gridHelper.position.set(-0.5, -0.5, 0.5);
    scene.add(gridHelper);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    let geometry = new THREE.PlaneBufferGeometry(100, 100);
    geometry.rotateX(-Math.PI / 2);

    plane = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        visible: false
    }));
    plane.position.set(-0.5, -0.5, 0.5);
    scene.add(plane);

    objects.push(plane);

    // lights

    let ambientLight = new THREE.AmbientLight(0x606060);
    scene.add(ambientLight);

    let directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.position.set(1, 0.75, 0.5).normalize();
    scene.add(directionalLight);

    renderer = new THREE.WebGLRenderer({
        antialias: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    document.addEventListener('mousemove', onDocumentMouseMove, false);
    document.addEventListener('dblclick', onDocumentMouseDblclick, false);
    window.addEventListener('resize', onWindowResize, false);
}

let camera, scene, renderer;
let plane;
let mouse, raycaster;
let rollOverMesh, rollOverMaterial;
let system;
let activeRuleIdx = 0;
let objects = [];

init();
render();

